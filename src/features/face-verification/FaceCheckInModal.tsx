import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import {
  FaceSessionStartDto,
  FaceSessionStatusDto,
  submitFaceActiveEvidence,
  submitFacePassiveEvidence,
} from '@/constants/api';

// ─── Types ───────────────────────────────────────────────────────────────────

type Phase =
  | 'POSITIONING'
  | 'CAPTURING'
  | 'SUBMITTING'
  | 'CHALLENGE'
  | 'RECORDING_CHALLENGE'
  | 'DONE'
  | 'FAILED';

interface Props {
  visible: boolean;
  token: string;
  session: FaceSessionStartDto;
  mode?: 'check-in' | 'self-test';
  onVerified: (sessionId: string) => void;
  onCancel: (message?: string) => void;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const PASSIVE_FRAME_COUNT = 3;
/** Pause before starting the first challenge step (ms). */
const CHALLENGE_PREPARE_MS = 2_000;
/** How long the user has to perform each action (ms). Timer counts down. */
const CHALLENGE_STEP_MS = 5_000;
/** How many photos to snap during each action step (spread evenly). */
const PHOTOS_PER_STEP = 2;

// ─── Helpers ─────────────────────────────────────────────────────────────────

const wait = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));

function actionInstruction(action: string): string {
  switch (action.trim().toUpperCase()) {
    case 'TURN_LEFT':      return 'Turn your head LEFT';
    case 'TURN_RIGHT':     return 'Turn your head RIGHT';
    case 'RETURN_CENTER':  return 'Return to center';
    case 'BLINK':          return 'Blink naturally';
    case 'NOD':            return 'Nod your head';
    case 'SMILE':          return 'Smile naturally';
    default:               return action.replace(/_/g, ' ').toLowerCase();
  }
}

function actionIcon(action: string): string {
  switch (action.trim().toUpperCase()) {
    case 'TURN_LEFT':      return 'arrow-left-circle-outline';
    case 'TURN_RIGHT':     return 'arrow-right-circle-outline';
    case 'RETURN_CENTER':  return 'image-filter-center-focus';
    case 'BLINK':          return 'eye-outline';
    case 'NOD':            return 'arrow-up-down';
    case 'SMILE':          return 'emoticon-happy-outline';
    default:               return 'gesture';
  }
}

function isChallengeState(state?: string): boolean {
  return state === 'CHALLENGE_REQUIRED' || state === 'CHALLENGE';
}

// ─── StaticOval ──────────────────────────────────────────────────────────────
// A simple pulsing oval guide drawn over the camera — no face-detection data needed.

function StaticOval() {
  const pulse = useRef(new Animated.Value(0.6)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.6, duration: 700, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Animated.View style={[styles.staticOval, { opacity: pulse }]} />
    </View>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function FaceCheckInModal({
  visible,
  token,
  session,
  mode = 'check-in',
  onVerified,
  onCancel,
}: Props) {
  const cameraRef = useRef<CameraView>(null);
  const [permission, requestPermission] = useCameraPermissions();

  const [phase, setPhase] = useState<Phase>('POSITIONING');
  const [statusText, setStatusText] = useState('Position your face inside the oval');
  const [capturedCount, setCapturedCount] = useState(0);
  const [challengeActions, setChallengeActions] = useState<string[]>(
    session.challenge?.actions ?? []
  );
  const [challengeStepIndex, setChallengeStepIndex] = useState(-1);
  const [completedChallengeSteps, setCompletedChallengeSteps] = useState(0);
  const [isChallengeMode, setIsChallengeMode] = useState(false);
  const [stepCountdown, setStepCountdown] = useState(CHALLENGE_STEP_MS / 1000);
  const [processingSeconds, setProcessingSeconds] = useState(0);
  const [timing, setTiming] = useState<string | null>(null);

  const phaseRef = useRef<Phase>('POSITIONING');
  const capturingRef = useRef(false);
  const abortedRef = useRef(false);

  // Keep phaseRef in sync with state for use inside callbacks
  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  // ── Reset state when modal closes ──
  useEffect(() => {
    if (!visible) {
      abortedRef.current = true;
      setPhase('POSITIONING');
      setStatusText('Position your face inside the oval');
      setCapturedCount(0);
      setChallengeActions(session.challenge?.actions ?? []);
      setChallengeStepIndex(-1);
      setCompletedChallengeSteps(0);
      setIsChallengeMode(false);
      setStepCountdown(CHALLENGE_STEP_MS / 1000);
      setProcessingSeconds(0);
      setTiming(null);
      capturingRef.current = false;
    } else {
      abortedRef.current = false;
    }
  }, [visible, session.challenge?.actions]);

  // ── Processing second counter ──
  useEffect(() => {
    if (phase !== 'SUBMITTING') { setProcessingSeconds(0); return; }
    const startedAt = Date.now();
    const timer = setInterval(() => {
      setProcessingSeconds(Math.floor((Date.now() - startedAt) / 1000));
    }, 500);
    return () => clearInterval(timer);
  }, [phase]);

  // ── Permission request ──
  useEffect(() => {
    if (visible && permission && !permission.granted) {
      requestPermission();
    }
  }, [visible, permission, requestPermission]);

  // ── Cleanup on unmount ──
  useEffect(() => {
    return () => {
      abortedRef.current = true;
    };
  }, []);

  // ─── Core helpers ──────────────────────────────────────────────────────────

  const handleFailure = useCallback(
    (message: string) => {
      setPhase('FAILED');
      setStatusText(message);
      setCapturedCount(0);
      onCancel(message);
    },
    [onCancel]
  );

  const handleCancel = useCallback(() => {
    abortedRef.current = true;
    onCancel('Verification cancelled');
  }, [onCancel]);

  const applyAiStatus = useCallback(
    (result: FaceSessionStatusDto) => {
      if (result.state === 'VERIFIED') {
        setPhase('DONE');
        setStatusText('Face verification successful ✓');
        onVerified(result.sessionId);
        return;
      }
      if (isChallengeState(result.state)) {
        const actions = result.challenge?.actions?.length
          ? result.challenge.actions
          : challengeActions;
        setChallengeActions(actions);
        setChallengeStepIndex(-1);
        setCompletedChallengeSteps(0);
        setIsChallengeMode(true);
        setStatusText('Get ready. Follow the actions shown one at a time.');
        setCapturedCount(0);
        setPhase('CHALLENGE');
        return;
      }
      handleFailure(
        result.failureReason || result.result?.reason || 'Face verification rejected'
      );
    },
    [challengeActions, handleFailure, onVerified]
  );

  /** Take a single photo using expo-camera */
  const captureOne = useCallback(async (): Promise<string | null> => {
    if (!cameraRef.current) return null;
    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.82,
        skipProcessing: true,
        shutterSound: false,
      });
      return photo?.uri ?? null;
    } catch {
      return null;
    }
  }, []);

  // ─── Passive (photo-only) capture ─────────────────────────────────────────

  const runPassiveCapture = useCallback(async () => {
    if (capturingRef.current || phaseRef.current === 'SUBMITTING') return;
    capturingRef.current = true;
    setPhase('CAPTURING');
    const uris: string[] = [];
    const captureStart = Date.now();
    try {
      for (let i = 0; i < PASSIVE_FRAME_COUNT; i++) {
        setStatusText('AI is verifying…');
        const uri = await captureOne();
        if (!uri) throw new Error('Unable to capture photo — try again');
        uris.push(uri);
        setCapturedCount(uris.length);
        await wait(300);
      }
      setPhase('SUBMITTING');
      setStatusText('AI is verifying…');
      const result = await submitFacePassiveEvidence(session.sessionId, token, uris);
      applyAiStatus(result);
    } catch (err: any) {
      handleFailure(err?.message || 'Passive face verification failed');
    } finally {
      capturingRef.current = false;
    }
  }, [applyAiStatus, captureOne, handleFailure, session.sessionId, token]);

  // ─── Active challenge (photo-per-step, no video) ──────────────────────────
  //
  // Instead of recording a video (slow upload, ~10-15 MB), we capture
  // PHOTOS_PER_STEP still frames during each action step.
  // The collected photos are submitted WITHOUT a video — videoUri is optional
  // in the API. This makes upload ~10-30× faster (< 1 MB total).

  const runActiveChallenge = useCallback(async () => {
    if (capturingRef.current || challengeActions.length === 0) {
      if (challengeActions.length === 0) {
        handleFailure('Challenge actions were empty. Please try again.');
      }
      return;
    }
    capturingRef.current = true;
    abortedRef.current = false;
    setPhase('RECORDING_CHALLENGE');
    setChallengeStepIndex(-1);
    setCompletedChallengeSteps(0);

    // All photo URIs collected across every step — sent to server at the end.
    const allFrames: string[] = [];

    try {
      // ── Brief preparation window ──
      setStatusText('📸 Get ready! Keep your face inside the oval.');
      for (let t = Math.ceil(CHALLENGE_PREPARE_MS / 1000); t > 0; t--) {
        if (abortedRef.current) return;
        setStepCountdown(t);
        await wait(1_000);
      }
      if (abortedRef.current) return;

      // ── Walk through each action with a countdown + photo snapshots ──
      for (let i = 0; i < challengeActions.length; i++) {
        if (abortedRef.current) return;

        setChallengeStepIndex(i);
        const instruction = actionInstruction(challengeActions[i]);
        const total = challengeActions.length;

        // Spread PHOTOS_PER_STEP captures evenly across the step duration.
        // e.g. step = 5 s, 2 photos → snap at 1.5 s and 3.5 s (leaving 1 s pad at start/end).
        const snapInterval = CHALLENGE_STEP_MS / (PHOTOS_PER_STEP + 1);
        const snapTimes = Array.from(
          { length: PHOTOS_PER_STEP },
          (_, k) => snapInterval * (k + 1)
        );

        const stepStart = Date.now();
        const stepEnd = stepStart + CHALLENGE_STEP_MS;
        let nextSnapIndex = 0;

        while (Date.now() < stepEnd) {
          if (abortedRef.current) return;

          const elapsed = Date.now() - stepStart;
          const remaining = Math.ceil((stepEnd - Date.now()) / 1000);
          setStepCountdown(remaining);
          setStatusText(`Step ${i + 1}/${total}: ${instruction}`);

          // Snap a photo when we reach each scheduled snap time.
          if (
            nextSnapIndex < snapTimes.length &&
            elapsed >= snapTimes[nextSnapIndex]
          ) {
            const uri = await captureOne();
            if (uri) allFrames.push(uri);
            nextSnapIndex++;
          }

          await wait(150);
        }

        setCompletedChallengeSteps(i + 1);
        if (i < challengeActions.length - 1) {
          setStatusText(`✓ Done! Next: ${actionInstruction(challengeActions[i + 1])}`);
          await wait(300);
        }
      }

      if (abortedRef.current) return;
      if (allFrames.length === 0) throw new Error('No frames were captured during the challenge');

      setChallengeStepIndex(challengeActions.length);
      setStatusText('AI is verifying…');

      // ── Submit photos only (no video) — fast upload ──
      setPhase('SUBMITTING');
      const result = await submitFaceActiveEvidence(
        session.sessionId,
        token,
        allFrames,
        null   // no video — videoUri is optional in the API
      );
      if (abortedRef.current) return;

      if (isChallengeState(result.state)) {
        handleFailure(
          result.failureReason ||
            result.result?.reason ||
            'Challenge not completed. Please restart face verification.'
        );
        return;
      }
      applyAiStatus(result);
    } catch (err: any) {
      if (abortedRef.current) return;
      handleFailure(err?.message || 'Active challenge failed');
    } finally {
      capturingRef.current = false;
    }
  }, [applyAiStatus, captureOne, challengeActions, handleFailure, session.sessionId, token]);

  // Auto-start challenge once camera is ready and phase is CHALLENGE
  const [cameraReady, setCameraReady] = useState(false);

  useEffect(() => {
    if (visible && phase === 'CHALLENGE' && cameraReady) {
      void runActiveChallenge();
    }
  }, [visible, phase, cameraReady, runActiveChallenge]);

  // ─── Render ────────────────────────────────────────────────────────────────

  const isRecording = phase === 'RECORDING_CHALLENGE';
  const isBusy =
    phase === 'CAPTURING' ||
    phase === 'SUBMITTING' ||
    phase === 'CHALLENGE' ||
    phase === 'RECORDING_CHALLENGE';

  // Progress ratio for the step countdown bar (0→1)
  const stepProgressRatio = Math.max(
    0,
    Math.min(1, (CHALLENGE_STEP_MS / 1000 - stepCountdown) / (CHALLENGE_STEP_MS / 1000))
  );

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen">
      <View style={styles.container}>
        {/* ── Header ── */}
        <View style={styles.header}>
          <Text style={styles.title}>
            {mode === 'self-test' ? '🪪 Test Face ID' : '🔐 Face Verification'}
          </Text>
          <Text style={styles.subtitle}>{session.playerName || 'Competitor'}</Text>
          <Text style={styles.note}>
            {mode === 'self-test'
              ? 'Live face will be compared against your enrolled Face ID template'
              : 'Your face will be verified against your registered Face ID'}
          </Text>
        </View>

        {/* ── Camera ── */}
        <View
          style={[
            styles.cameraWrap,
            isRecording && styles.cameraWrapRecording,
          ]}
        >
          {permission?.granted ? (
            <CameraView
              ref={cameraRef}
              style={StyleSheet.absoluteFill}
              facing="front"
              mode="video"
              videoQuality="480p"
              onCameraReady={() => setCameraReady(true)}
            />
          ) : (
            <View style={styles.permissionBox}>
              <MaterialCommunityIcons name="camera-off" size={36} color="#64748b" />
              <Text style={styles.permissionText}>
                Camera permission is required for face verification
              </Text>
              <TouchableOpacity style={styles.primaryBtn} onPress={requestPermission}>
                <Text style={styles.primaryBtnText}>Grant Camera Permission</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Static pulsing oval guide */}
          {permission?.granted && <StaticOval />}

          {/* Capturing indicator badge */}
          {isRecording && (
            <View style={styles.recBadge}>
              <MaterialCommunityIcons name="camera" size={13} color="#fff" />
              <Text style={styles.recText}>VERIFYING</Text>
            </View>
          )}
        </View>

        {/* ── Status text ── */}
        <Text style={styles.status}>{statusText}</Text>

        {/* ── Challenge action list ── */}
        {isChallengeMode && challengeActions.length > 0 && (
          phase === 'CHALLENGE' ||
          phase === 'RECORDING_CHALLENGE' ||
          phase === 'SUBMITTING'
        ) ? (
          <View style={styles.challengePanel}>
            <Text style={styles.challengeHelp}>
              Follow each action when highlighted.
            </Text>

            {challengeActions.map((action, index) => {
              const completed = index < completedChallengeSteps;
              const active = isRecording && index === challengeStepIndex;
              return (
                <View
                  key={`${action}-${index}`}
                  style={[
                    styles.challengeRow,
                    active && styles.challengeRowActive,
                    completed && styles.challengeRowCompleted,
                  ]}
                >
                  <MaterialCommunityIcons
                    name={completed ? 'check-circle' : active ? (actionIcon(action) as any) : 'circle-outline'}
                    size={20}
                    color={completed ? '#34d399' : active ? '#fbbf24' : '#475569'}
                  />
                  <Text
                    style={[
                      styles.challengeText,
                      active && styles.challengeTextActive,
                      completed && styles.challengeTextCompleted,
                    ]}
                  >
                    {completed || active ? actionInstruction(action) : `Action ${index + 1}`}
                  </Text>

                  {active ? (
                    <View style={styles.countdownBadge}>
                      <Text style={styles.countdownText}>{stepCountdown}s</Text>
                    </View>
                  ) : (
                    <Text style={styles.challengeState}>
                      {completed ? 'DONE ✓' : 'LOCKED'}
                    </Text>
                  )}
                </View>
              );
            })}

            {/* Progress bar for current active step */}
            {isRecording && challengeStepIndex >= 0 && challengeStepIndex < challengeActions.length && (
              <View style={styles.progressTrack}>
                <Animated.View
                  style={[
                    styles.progressFill,
                    { width: `${stepProgressRatio * 100}%` },
                  ]}
                />
              </View>
            )}
          </View>
        ) : null}

        {/* ── Action buttons ── */}
        <View style={styles.actions}>
          {phase === 'POSITIONING' ? (
            <TouchableOpacity
              style={[styles.primaryBtn, !cameraReady && styles.primaryBtnDisabled]}
              onPress={runPassiveCapture}
              disabled={!cameraReady}
            >
              <MaterialCommunityIcons name="face-recognition" size={18} color="#fff" />
              <Text style={styles.primaryBtnText}>
                {cameraReady ? 'Start Verification' : 'Waiting for camera…'}
              </Text>
            </TouchableOpacity>
          ) : null}

          {isBusy && (
            <View style={styles.loadingRow}>
              <ActivityIndicator color="#10b981" />
              <Text style={styles.meta}>
                {phase === 'RECORDING_CHALLENGE'
                  ? 'Follow the action instructions…'
                  : `AI is verifying${processingSeconds > 0 ? ` (${processingSeconds}s)` : '…'}`}
              </Text>
            </View>
          )}

          <TouchableOpacity style={styles.cancelBtn} onPress={handleCancel}>
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0b1220', paddingTop: 52 },
  header: { alignItems: 'center', marginBottom: 12, paddingHorizontal: 20 },
  title: { color: '#fff', fontSize: 18, fontWeight: '800' },
  subtitle: { color: '#94a3b8', marginTop: 4, fontSize: 14, fontWeight: '600' },
  note: {
    color: '#64748b', marginTop: 8, fontSize: 12, fontWeight: '500',
    textAlign: 'center', paddingHorizontal: 12,
  },

  cameraWrap: {
    height: 340, marginHorizontal: 20, borderRadius: 24, overflow: 'hidden',
    backgroundColor: '#111827', justifyContent: 'center', alignItems: 'center',
  },
  cameraWrapRecording: {
    borderWidth: 2.5, borderColor: '#ef4444',
  },

  // Pulsing oval
  staticOval: {
    position: 'absolute',
    width: 200, height: 280,
    borderRadius: 999,
    borderWidth: 2.5,
    borderColor: 'rgba(16,185,129,0.75)',
    alignSelf: 'center',
    top: '50%',
    marginTop: -140,
  },

  // REC badge
  recBadge: {
    position: 'absolute', top: 12, right: 14,
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: 'rgba(239,68,68,0.85)',
    paddingHorizontal: 9, paddingVertical: 4,
    borderRadius: 8,
  },
  recDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#fff' },
  recText: { color: '#fff', fontSize: 11, fontWeight: '900', letterSpacing: 1 },

  permissionBox: { alignItems: 'center', padding: 24, gap: 12 },
  permissionText: { color: '#e2e8f0', textAlign: 'center', fontSize: 14 },

  status: {
    color: '#e2e8f0', textAlign: 'center', marginTop: 14,
    paddingHorizontal: 24, fontSize: 14, fontWeight: '600',
  },

  challengePanel: {
    marginTop: 12, marginHorizontal: 20, padding: 12,
    borderRadius: 16, borderWidth: 1, borderColor: '#243244',
    backgroundColor: '#111827', gap: 8,
  },
  challengeHelp: {
    color: '#94a3b8', fontSize: 11, lineHeight: 16,
    textAlign: 'center', marginBottom: 4,
  },
  challengeRow: {
    minHeight: 40, paddingHorizontal: 10, borderRadius: 10,
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#0b1220', borderWidth: 1, borderColor: 'transparent',
  },
  challengeRowActive: { borderColor: '#f59e0b', backgroundColor: '#2b2110' },
  challengeRowCompleted: { borderColor: '#14532d', backgroundColor: '#0b2118' },
  challengeText: { flex: 1, color: '#94a3b8', fontSize: 13, fontWeight: '700' },
  challengeTextActive: { color: '#fef3c7' },
  challengeTextCompleted: { color: '#a7f3d0' },
  challengeState: { color: '#475569', fontSize: 9, fontWeight: '900' },

  // Countdown
  countdownBadge: {
    backgroundColor: '#f59e0b', borderRadius: 8,
    paddingHorizontal: 8, paddingVertical: 2,
    minWidth: 30, alignItems: 'center',
  },
  countdownText: { color: '#0b1220', fontWeight: '900', fontSize: 13 },

  // Progress bar
  progressTrack: {
    height: 4, borderRadius: 2, backgroundColor: '#1e293b',
    marginTop: 4, overflow: 'hidden',
  },
  progressFill: { height: 4, borderRadius: 2, backgroundColor: '#f59e0b' },

  meta: { color: '#94a3b8', textAlign: 'center', marginTop: 8, fontSize: 12 },
  actions: { marginTop: 'auto', padding: 20, gap: 12, paddingBottom: 40 },
  primaryBtn: {
    backgroundColor: '#10b981', borderRadius: 12, minHeight: 50,
    alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8,
  },
  primaryBtnDisabled: { backgroundColor: '#1e3a2f' },
  primaryBtnText: { color: '#fff', fontWeight: '800', fontSize: 15 },
  cancelBtn: { minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  cancelText: { color: '#94a3b8', fontWeight: '700' },
  loadingRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8 },
});
