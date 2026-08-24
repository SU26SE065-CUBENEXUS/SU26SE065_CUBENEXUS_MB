export type SupportedChallengeAction =
  | 'TURN_LEFT'
  | 'TURN_RIGHT'
  | 'RETURN_CENTER'
  | 'BLINK'
  | 'NOD'
  | 'SMILE';

export interface RealtimeFaceSample {
  yaw: number;
  pitch: number;
  leftEyeOpen: number;
  rightEyeOpen: number;
  smiling: number;
}

export type ChallengeDetectorEvent =
  | { type: 'NONE' }
  | { type: 'RETRY'; stepIndex: number; retry: number }
  | { type: 'STEP_COMPLETED'; stepIndex: number; completedCount: number; allCompleted: boolean }
  | { type: 'FAILED'; stepIndex: number; reason: string };

const STEP_TIMEOUT_MS = 12_000;
const REQUIRED_STABLE_MS = 400;
const MAX_RETRIES = 2;
const TURN_YAW_DEGREES = 18;
const CENTER_YAW_DEGREES = 8;
const CENTER_PITCH_DEGREES = 9;
const NOD_PITCH_DEGREES = 13;
const EYES_OPEN = 0.62;
const EYES_CLOSED = 0.36;
const SMILE_PROBABILITY = 0.72;

const SUPPORTED_ACTIONS = new Set<SupportedChallengeAction>([
  'TURN_LEFT',
  'TURN_RIGHT',
  'RETURN_CENTER',
  'BLINK',
  'NOD',
  'SMILE',
]);

export function normalizeChallengeAction(action: string): SupportedChallengeAction | null {
  const normalized = action.trim().toUpperCase() as SupportedChallengeAction;
  return SUPPORTED_ACTIONS.has(normalized) ? normalized : null;
}

/**
 * Stateful, ordered challenge detector. A step advances only after ML Kit reports
 * the expected gesture; timers never mark an action as successful.
 */
export class ChallengeActionDetector {
  private readonly actions: SupportedChallengeAction[];
  private currentIndex = 0;
  private stepStartedAt: number;
  private stableSince: number | null = null;
  private retry = 0;
  private blinkStage: 'WAIT_OPEN' | 'WAIT_CLOSED' | 'WAIT_REOPEN' = 'WAIT_OPEN';
  private blinkClosedAt: number | null = null;
  private nodStage: 'WAIT_CENTER' | 'WAIT_MOVE' | 'WAIT_RETURN' = 'WAIT_CENTER';
  private faceMissingSince: number | null = null;

  constructor(actions: string[], startedAt = Date.now()) {
    const normalized = actions.map(normalizeChallengeAction);
    const unsupportedIndex = normalized.findIndex(action => action === null);
    if (unsupportedIndex >= 0) {
      throw new Error(`Unsupported realtime challenge action: ${actions[unsupportedIndex]}`);
    }
    if (normalized.length === 0) {
      throw new Error('The verification service returned an empty challenge.');
    }
    this.actions = normalized as SupportedChallengeAction[];
    this.stepStartedAt = startedAt;
  }

  get stepIndex(): number {
    return this.currentIndex;
  }

  process(sample: RealtimeFaceSample | null, now = Date.now()): ChallengeDetectorEvent {
    if (this.currentIndex >= this.actions.length) return { type: 'NONE' };

    if (now - this.stepStartedAt >= STEP_TIMEOUT_MS) {
      this.retry += 1;
      if (this.retry > MAX_RETRIES) {
        return {
          type: 'FAILED',
          stepIndex: this.currentIndex,
          reason: 'The requested action could not be detected. Please restart face verification.',
        };
      }
      this.resetGesture(now);
      return { type: 'RETRY', stepIndex: this.currentIndex, retry: this.retry };
    }

    if (!sample) {
      this.stableSince = null;
      if (this.faceMissingSince === null) this.faceMissingSince = now;
      if (now - this.faceMissingSince >= 500) this.resetTemporalEvidence();
      return { type: 'NONE' };
    }
    this.faceMissingSince = null;

    const action = this.actions[this.currentIndex];
    if (action === 'BLINK') return this.processBlink(sample, now);
    if (action === 'NOD') return this.processNod(sample, now);

    let matches = false;
    switch (action) {
      // Front-camera image coordinates are mirrored relative to the person.
      case 'TURN_LEFT':
        matches = sample.yaw >= TURN_YAW_DEGREES;
        break;
      case 'TURN_RIGHT':
        matches = sample.yaw <= -TURN_YAW_DEGREES;
        break;
      case 'RETURN_CENTER':
        matches =
          Math.abs(sample.yaw) <= CENTER_YAW_DEGREES &&
          Math.abs(sample.pitch) <= CENTER_PITCH_DEGREES;
        break;
      case 'SMILE':
        matches =
          Math.abs(sample.yaw) <= CENTER_YAW_DEGREES * 2 &&
          sample.smiling >= SMILE_PROBABILITY;
        break;
    }
    return this.processStableMatch(matches, now);
  }

  private processBlink(sample: RealtimeFaceSample, now: number): ChallengeDetectorEvent {
    const eyesAvailable = sample.leftEyeOpen >= 0 && sample.rightEyeOpen >= 0;
    if (!eyesAvailable || Math.abs(sample.yaw) > CENTER_YAW_DEGREES * 2) {
      return { type: 'NONE' };
    }
    const average = (sample.leftEyeOpen + sample.rightEyeOpen) / 2;
    if (this.blinkStage === 'WAIT_OPEN' && average >= EYES_OPEN) {
      this.blinkStage = 'WAIT_CLOSED';
    } else if (this.blinkStage === 'WAIT_CLOSED' && average <= EYES_CLOSED) {
      this.blinkStage = 'WAIT_REOPEN';
      this.blinkClosedAt = now;
    } else if (this.blinkStage === 'WAIT_REOPEN') {
      if (this.blinkClosedAt !== null && now - this.blinkClosedAt > 1_500) {
        this.resetTemporalEvidence();
      } else if (
        average >= EYES_OPEN &&
        this.blinkClosedAt !== null &&
        now - this.blinkClosedAt >= 50
      ) {
        return this.completeStep(now);
      }
    }
    return { type: 'NONE' };
  }

  private processNod(sample: RealtimeFaceSample, now: number): ChallengeDetectorEvent {
    if (Math.abs(sample.yaw) > CENTER_YAW_DEGREES * 2) return { type: 'NONE' };
    if (this.nodStage === 'WAIT_CENTER' && Math.abs(sample.pitch) <= CENTER_PITCH_DEGREES) {
      this.nodStage = 'WAIT_MOVE';
    } else if (this.nodStage === 'WAIT_MOVE' && Math.abs(sample.pitch) >= NOD_PITCH_DEGREES) {
      this.nodStage = 'WAIT_RETURN';
    } else if (this.nodStage === 'WAIT_RETURN' && Math.abs(sample.pitch) <= CENTER_PITCH_DEGREES) {
      return this.completeStep(now);
    }
    return { type: 'NONE' };
  }

  private processStableMatch(matches: boolean, now: number): ChallengeDetectorEvent {
    if (!matches) {
      this.stableSince = null;
      return { type: 'NONE' };
    }
    if (this.stableSince === null) {
      this.stableSince = now;
      return { type: 'NONE' };
    }
    if (now - this.stableSince < REQUIRED_STABLE_MS) return { type: 'NONE' };
    return this.completeStep(now);
  }

  private completeStep(now: number): ChallengeDetectorEvent {
    const completedIndex = this.currentIndex;
    this.currentIndex += 1;
    const allCompleted = this.currentIndex >= this.actions.length;
    this.retry = 0;
    this.resetGesture(now);
    return {
      type: 'STEP_COMPLETED',
      stepIndex: completedIndex,
      completedCount: this.currentIndex,
      allCompleted,
    };
  }

  private resetGesture(now: number): void {
    this.stepStartedAt = now;
    this.stableSince = null;
    this.faceMissingSince = null;
    this.resetTemporalEvidence();
  }

  private resetTemporalEvidence(): void {
    this.blinkStage = 'WAIT_OPEN';
    this.blinkClosedAt = null;
    this.nodStage = 'WAIT_CENTER';
  }
}
