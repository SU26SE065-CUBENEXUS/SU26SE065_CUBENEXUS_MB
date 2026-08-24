import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  LayoutChangeEvent,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import {
  Camera as VisionCamera,
  useCameraDevice,
  useCameraFormat,
  useCameraPermission,
  type Frame,
  type VideoFile,
} from 'react-native-vision-camera';
import {
  Camera as FaceDetectorCamera,
  type Face,
  type FrameFaceDetectionOptions,
} from 'react-native-vision-camera-face-detector';
import {
  FaceAnalyzeFrameDto,
  FaceSessionStartDto,
  FaceSessionStatusDto,
  submitFaceActiveEvidence,
  submitFacePassiveEvidence,
} from '@/constants/api';
import FaceFittingOval from './FaceFittingOval';
import {
  ChallengeActionDetector,
  type RealtimeFaceSample,
} from './challengeActionDetector';

type Phase = 'POSITIONING' | 'CAPTURING' | 'SUBMITTING' | 'CHALLENGE' | 'RECORDING_CHALLENGE' | 'DONE' | 'FAILED';

interface Props {
  visible: boolean;
  token: string;
  session: FaceSessionStartDto;
  mode?: 'check-in' | 'self-test';
  onVerified: (sessionId: string) => void;
  onCancel: (message?: string) => void;
}

const PASSIVE_FRAME_COUNT = 3;
const CHALLENGE_PREPARE_MS = 1_200;
const RECORDING_FINISH_TIMEOUT_MS = 8_000;
const MAX_CHALLENGE_STEP_DURATION_MS = 40_000;
const OVAL_W = 200;
const OVAL_H = 280;

const wait = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));

function actionInstruction(action: string): string {
  switch (action.trim().toUpperCase()) {
    case 'TURN_LEFT':
      return 'Turn your head left';
    case 'TURN_RIGHT':
      return 'Turn your head right';
    case 'RETURN_CENTER':
      return 'Return to the center';
    case 'BLINK':
      return 'Blink naturally';
    case 'NOD':
      return 'Nod your head';
    case 'SMILE':
      return 'Smile naturally';
    default:
      return action.replace(/_/g, ' ').toLowerCase();
  }
}

function isChallengeState(state?: string): boolean {
  return state === 'CHALLENGE_REQUIRED' || state === 'CHALLENGE';
}

export default function FaceCheckInModal({
  visible,
  token,
  session,
  mode = 'check-in',
  onVerified,
  onCancel,
}: Props) {
  const cameraRef = useRef<VisionCamera>(null);
  const cameraDevice = useCameraDevice('front');
  const cameraFormat = useCameraFormat(cameraDevice, [
    { videoResolution: { width: 640, height: 480 } },
    { photoResolution: { width: 1280, height: 720 } },
    { fps: 30 },
  ]);
  const { hasPermission, requestPermission } = useCameraPermission();
  const [phase, setPhase] = useState<Phase>('POSITIONING');
  const [statusText, setStatusText] = useState('Look straight at the camera');
  const [capturedCount, setCapturedCount] = useState(0);
  const [challengeActions, setChallengeActions] = useState<string[]>(session.challenge?.actions ?? []);
  const [challengeStepIndex, setChallengeStepIndex] = useState(-1);
  const [completedChallengeSteps, setCompletedChallengeSteps] = useState(0);
  const [processingSeconds, setProcessingSeconds] = useState(0);
  const [cameraReady, setCameraReady] = useState(false);
  const [viewSize, setViewSize] = useState({ w: 0, h: 0 });
  const [analysis, setAnalysis] = useState<FaceAnalyzeFrameDto | null>(null);
  const [timing, setTiming] = useState<string | null>(null);
  const capturingRef = useRef(false);
  const cameraReadyRef = useRef(false);
  const recordingRef = useRef(false);
  const challengeAbortedRef = useRef(false);
  const phaseRef = useRef<Phase>('POSITIONING');
  const challengeDetectorRef = useRef<ChallengeActionDetector | null>(null);
  const challengeResolveRef = useRef<(() => void) | null>(null);
  const challengeRejectRef = useRef<((error: Error) => void) | null>(null);
  const lastFaceUiUpdateRef = useRef(0);
  const challengeFaceMissingRef = useRef(false);
  const faceDetectionOptions = useRef<FrameFaceDetectionOptions>({
    performanceMode: 'fast',
    landmarkMode: 'all',
    contourMode: 'none',
    classificationMode: 'all',
    trackingEnabled: true,
    cameraFacing: 'front',
    autoMode: false,
    minFaceSize: 0.18,
  }).current;

  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  useEffect(() => {
    if (!visible) {
      challengeAbortedRef.current = true;
      challengeRejectRef.current?.(new Error('Face verification closed'));
      challengeRejectRef.current = null;
      challengeResolveRef.current = null;
      if (recordingRef.current) {
        try {
          cameraRef.current?.stopRecording?.();
        } catch {
          // Camera may already be closing.
        }
      }
      setPhase('POSITIONING');
      setStatusText('Look straight at the camera');
      setCapturedCount(0);
      setChallengeActions(session.challenge?.actions ?? []);
      setChallengeStepIndex(-1);
      setCompletedChallengeSteps(0);
      setProcessingSeconds(0);
      setCameraReady(false);
      cameraReadyRef.current = false;
      recordingRef.current = false;
      setTiming(null);
      setAnalysis(null);
      challengeDetectorRef.current = null;
      challengeResolveRef.current = null;
      challengeRejectRef.current = null;
      capturingRef.current = false;
    }
  }, [visible, session.challenge?.actions]);

  useEffect(() => {
    if (phase !== 'SUBMITTING') {
      setProcessingSeconds(0);
      return;
    }
    const startedAt = Date.now();
    const timer = setInterval(() => {
      setProcessingSeconds(Math.floor((Date.now() - startedAt) / 1000));
    }, 500);
    return () => clearInterval(timer);
  }, [phase]);

  useEffect(() => {
    if (visible && !hasPermission) {
      requestPermission();
    }
  }, [visible, hasPermission, requestPermission]);

  useEffect(() => {
    return () => {
      challengeAbortedRef.current = true;
      challengeRejectRef.current?.(new Error('Face verification closed'));
      if (recordingRef.current) {
        try {
          cameraRef.current?.stopRecording?.();
        } catch {
          // Camera may already be unmounted.
        }
      }
    };
  }, []);

  const handleFailure = useCallback(
    (message: string) => {
      setPhase('FAILED');
      setStatusText(message);
      setCapturedCount(0);
      // Exit immediately like success — parent shows the alert; no in-modal retry.
      onCancel(message);
    },
    [onCancel]
  );

  const handleCancel = useCallback(() => {
    challengeAbortedRef.current = true;
    challengeRejectRef.current?.(new Error('Verification cancelled'));
    challengeRejectRef.current = null;
    challengeResolveRef.current = null;
    challengeDetectorRef.current = null;
    if (recordingRef.current) {
      try {
        cameraRef.current?.stopRecording?.();
      } catch {
        // Camera may already be closing.
      }
      recordingRef.current = false;
    }
    onCancel('Verification cancelled');
  }, [onCancel]);

  const applyAiStatus = useCallback(
    (result: FaceSessionStatusDto) => {
      if (result.state === 'VERIFIED') {
        setPhase('DONE');
        setStatusText('Face verification successful');
        onVerified(result.sessionId);
        return;
      }
      if (isChallengeState(result.state)) {
        const actions = result.challenge?.actions?.length
          ? result.challenge.actions
          : challengeActions;
        setPhase('CHALLENGE');
        setChallengeActions(actions);
        setChallengeStepIndex(-1);
        setCompletedChallengeSteps(0);
        setStatusText('Get ready. Follow one instruction at a time.');
        setCapturedCount(0);
        return;
      }
      handleFailure(result.failureReason || result.result?.reason || 'Face verification rejected');
    },
    [challengeActions, handleFailure, onVerified]
  );

  const captureOne = useCallback(async (): Promise<string | null> => {
    if (!cameraRef.current) return null;
    const photo = await cameraRef.current.takePhoto({
      flash: 'off',
      enableShutterSound: false,
    });
    return photo?.path ? `file://${photo.path}` : null;
  }, []);

  const handleFacesDetected = useCallback(
    (faces: Face[], frame: Frame) => {
      const now = Date.now();
      const face = faces.length === 1 ? faces[0] : null;

      if (phaseRef.current === 'POSITIONING' && now - lastFaceUiUpdateRef.current >= 180) {
        lastFaceUiUpdateRef.current = now;
        if (!face) {
          setAnalysis(null);
          setStatusText(
            faces.length > 1 ? 'Only one face may be visible' : 'No face detected — look at the camera'
          );
        } else {
          const { x, y, width, height } = face.bounds;
          const faceRatio = width / Math.max(frame.width, 1);
          setAnalysis({
            status: faceRatio >= 0.18 ? 'QUALITY_READY' : 'FACE_TOO_SMALL',
            bbox: [x, y, x + width, y + height],
            imageWidth: frame.width,
            imageHeight: frame.height,
            faceRatio,
          });
          setStatusText(
            faceRatio >= 0.18 ? 'Face detected — ready to verify' : 'Move closer to the camera'
          );
        }
      }

      if (phaseRef.current !== 'RECORDING_CHALLENGE' || !challengeDetectorRef.current) return;

      if (!face && !challengeFaceMissingRef.current) {
        challengeFaceMissingRef.current = true;
        setStatusText(faces.length > 1 ? 'Only one face may be visible' : 'Face lost — look at the camera');
      } else if (face && challengeFaceMissingRef.current) {
        challengeFaceMissingRef.current = false;
        const currentIndex = challengeDetectorRef.current.stepIndex;
        setStatusText(
          `${currentIndex + 1}/${challengeActions.length}: ${actionInstruction(challengeActions[currentIndex])}`
        );
      }

      const sample: RealtimeFaceSample | null = face
        ? {
            yaw: face.yawAngle,
            pitch: face.pitchAngle,
            leftEyeOpen: face.leftEyeOpenProbability ?? -1,
            rightEyeOpen: face.rightEyeOpenProbability ?? -1,
            smiling: face.smilingProbability ?? -1,
          }
        : null;
      const event = challengeDetectorRef.current.process(sample, now);

      if (event.type === 'RETRY') {
        setStatusText(
          `Action not detected. Try again (${event.retry}/2): ${actionInstruction(challengeActions[event.stepIndex])}`
        );
        return;
      }
      if (event.type === 'FAILED') {
        challengeDetectorRef.current = null;
        challengeRejectRef.current?.(new Error(event.reason));
        challengeRejectRef.current = null;
        challengeResolveRef.current = null;
        return;
      }
      if (event.type !== 'STEP_COMPLETED') return;

      setCompletedChallengeSteps(event.completedCount);
      if (event.allCompleted) {
        setChallengeStepIndex(challengeActions.length);
        setStatusText('All actions detected successfully. Finishing the video...');
        challengeDetectorRef.current = null;
        challengeResolveRef.current?.();
        challengeResolveRef.current = null;
        challengeRejectRef.current = null;
        return;
      }

      const nextIndex = event.completedCount;
      setChallengeStepIndex(nextIndex);
      setStatusText(
        `${nextIndex + 1}/${challengeActions.length}: ${actionInstruction(challengeActions[nextIndex])}`
      );
    },
    [challengeActions]
  );

  const runPassiveCapture = useCallback(async () => {
    if (capturingRef.current || phase === 'SUBMITTING') return;
    if (!cameraReady) {
      setStatusText('Camera is not ready. Wait and try again...');
      return;
    }
    capturingRef.current = true;
    setPhase('CAPTURING');
    const uris: string[] = [];
    const captureStart = Date.now();
    try {
      for (let i = 0; i < PASSIVE_FRAME_COUNT; i += 1) {
        setStatusText(`Capturing ${i + 1}/${PASSIVE_FRAME_COUNT}`);
        const uri = await captureOne();
        if (!uri) throw new Error('Unable to capture face photo');
        uris.push(uri);
        setCapturedCount(uris.length);
      }
      const captureMs = Date.now() - captureStart;

      setPhase('SUBMITTING');
      setStatusText('Uploading verification photos...');
      const submitStart = Date.now();
      const result = await submitFacePassiveEvidence(session.sessionId, token, uris);
      setTiming(
        `capture ${captureMs} ms · upload+AI ${Date.now() - submitStart} ms` +
          (cameraFormat ? ` · ${cameraFormat.photoWidth}x${cameraFormat.photoHeight}` : '')
      );
      applyAiStatus(result);
    } catch (err: any) {
      handleFailure(err?.message || 'Passive face verification failed');
    } finally {
      capturingRef.current = false;
    }
  }, [applyAiStatus, cameraFormat, cameraReady, captureOne, handleFailure, phase, session.sessionId, token]);

  const runActiveChallenge = useCallback(async () => {
    if (capturingRef.current) return;
    if (challengeActions.length === 0) {
      handleFailure('The verification service returned an empty challenge. Please try again.');
      return;
    }
    capturingRef.current = true;
    challengeAbortedRef.current = false;
    setPhase('RECORDING_CHALLENGE');
    setChallengeStepIndex(-1);
    setCompletedChallengeSteps(0);
    challengeFaceMissingRef.current = false;
    let recordingPromise: Promise<VideoFile> | null = null;
    try {
      const camera = cameraRef.current;
      if (!camera) {
        throw new Error('Video recording is not available on this device');
      }

      recordingPromise = new Promise<VideoFile>((resolve, reject) => {
        camera.startRecording({
          fileType: 'mp4',
          videoCodec: 'h264',
          onRecordingFinished: resolve,
          onRecordingError: reject,
        });
      });
      recordingRef.current = true;
      const recordingStart = Date.now();
      setStatusText('Get ready. Keep your face inside the camera frame.');
      await wait(CHALLENGE_PREPARE_MS);
      if (challengeAbortedRef.current) return;

      challengeDetectorRef.current = new ChallengeActionDetector(challengeActions);
      setChallengeStepIndex(0);
      setStatusText(`1/${challengeActions.length}: ${actionInstruction(challengeActions[0])}`);
      const challengeCompletion = new Promise<void>((resolve, reject) => {
        challengeResolveRef.current = resolve;
        challengeRejectRef.current = reject;
      });

      await Promise.race([
        challengeCompletion,
        wait(challengeActions.length * MAX_CHALLENGE_STEP_DURATION_MS).then(() => {
          throw new Error('Realtime challenge timed out. Please restart face verification.');
        }),
      ]);
      if (challengeAbortedRef.current) return;

      setChallengeStepIndex(challengeActions.length);
      setStatusText('All actions detected successfully. Finishing the video...');
      await camera.stopRecording();
      const recorded = await Promise.race([
        recordingPromise,
        wait(RECORDING_FINISH_TIMEOUT_MS).then(() => {
          throw new Error('The camera did not finish the challenge recording in time.');
        }),
      ]);
      recordingRef.current = false;
      if (challengeAbortedRef.current) return;

      const videoUri = recorded?.path ? `file://${recorded.path}` : null;
      if (!videoUri) {
        throw new Error('Challenge recording was not created');
      }
      const recordingMs = Date.now() - recordingStart;

      setStatusText('Capturing final verification frames...');
      await wait(150);
      const finalFrames: string[] = [];
      for (let index = 0; index < 2; index += 1) {
        const uri = await captureOne();
        if (uri) finalFrames.push(uri);
      }
      if (finalFrames.length === 0) throw new Error('Final challenge frames are missing');

      setPhase('SUBMITTING');
      setStatusText('Uploading the challenge. AI verification is in progress...');
      const submitStart = Date.now();
      const result = await submitFaceActiveEvidence(
        session.sessionId,
        token,
        finalFrames,
        videoUri
      );
      if (challengeAbortedRef.current) return;
      setTiming(
        `record ${recordingMs} ms · upload+AI ${Date.now() - submitStart} ms`
      );
      if (isChallengeState(result.state)) {
        handleFailure(
          result.failureReason ||
            result.result?.reason ||
            'The challenge was not completed correctly. Please try face verification again.'
        );
        return;
      }
      applyAiStatus(result);
    } catch (err: any) {
      if (recordingRef.current) {
        try {
          await cameraRef.current?.stopRecording();
        } catch {
          // Recording may already have stopped after an error.
        }
      }
      if (recordingPromise) void recordingPromise.catch(() => undefined);
      if (challengeAbortedRef.current) return;
      handleFailure(err?.message || 'Active challenge failed');
    } finally {
      challengeDetectorRef.current = null;
      challengeFaceMissingRef.current = false;
      challengeResolveRef.current = null;
      challengeRejectRef.current = null;
      recordingRef.current = false;
      capturingRef.current = false;
    }
  }, [applyAiStatus, captureOne, challengeActions, handleFailure, session.sessionId, token]);

  // A challenge is server-triggered. The competitor cannot manually start or stop it.
  useEffect(() => {
    if (visible && phase === 'CHALLENGE' && cameraReady) {
      void runActiveChallenge();
    }
  }, [visible, phase, cameraReady, runActiveChallenge]);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen">
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>
            {mode === 'self-test' ? 'Test Face ID' : 'Face Verification'}
          </Text>
          <Text style={styles.subtitle}>{session.playerName || 'Competitor'}</Text>
          <Text style={styles.note}>
            {mode === 'self-test'
              ? 'Compare the live face with the enrolled Face ID template — the template will not be replaced'
              : 'Compare against the existing enrolled template only — this does not enroll a new Face ID'}
          </Text>
        </View>

        <View
          style={[
            styles.cameraWrap,
            (phase === 'CHALLENGE' || phase === 'RECORDING_CHALLENGE') &&
              styles.cameraWrapChallenge,
          ]}
          onLayout={(e: LayoutChangeEvent) => {
            const { width, height } = e.nativeEvent.layout;
            setViewSize({ w: width, h: height });
          }}
        >
          {hasPermission && cameraDevice ? (
            <FaceDetectorCamera
              ref={cameraRef}
              style={StyleSheet.absoluteFill}
              device={cameraDevice}
              format={cameraFormat}
              isActive={visible && phase !== 'DONE' && phase !== 'FAILED'}
              photo
              video
              audio={false}
              photoQualityBalance="speed"
              videoBitRate="low"
              androidPreviewViewType="texture-view"
              faceDetectionOptions={faceDetectionOptions}
              faceDetectionCallback={handleFacesDetected}
              onInitialized={() => {
                cameraReadyRef.current = true;
                setCameraReady(true);
              }}
              onError={error => {
                cameraReadyRef.current = false;
                setCameraReady(false);
                setStatusText(error.message || 'Camera could not be started');
              }}
            />
          ) : (
            <View style={styles.permissionBox}>
              <Text style={styles.permissionText}>Camera permission is required for face verification</Text>
              <TouchableOpacity style={styles.primaryBtn} onPress={requestPermission}>
                <Text style={styles.primaryBtnText}>Grant Permission</Text>
              </TouchableOpacity>
            </View>
          )}
          {phase === 'POSITIONING' && (
            <FaceFittingOval
              analysis={analysis}
              viewWidth={viewSize.w}
              viewHeight={viewSize.h}
              mirrored
              defaultWidth={OVAL_W}
              defaultHeight={OVAL_H}
            />
          )}
        </View>

        <Text style={styles.status}>{statusText}</Text>
        {challengeActions.length > 0 &&
        (phase === 'CHALLENGE' ||
          phase === 'RECORDING_CHALLENGE' ||
          phase === 'SUBMITTING') ? (
          <View style={styles.challengePanel}>
            <Text style={styles.challengeHelp}>
              Each action must be detected live before the next one unlocks. AI validates the recording again after upload.
            </Text>
            {challengeActions.map((action, index) => {
              const completed = index < completedChallengeSteps;
              const active = phase === 'RECORDING_CHALLENGE' && index === challengeStepIndex;
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
                    name={completed ? 'check-circle' : active ? 'record-circle' : 'circle-outline'}
                    size={19}
                    color={completed ? '#34d399' : active ? '#fbbf24' : '#64748b'}
                  />
                  <Text
                    style={[
                      styles.challengeText,
                      active && styles.challengeTextActive,
                      completed && styles.challengeTextCompleted,
                    ]}
                  >
                    {index + 1}.{' '}
                    {completed || active ? actionInstruction(action) : 'Upcoming action'}
                  </Text>
                  <Text style={styles.challengeState}>
                    {completed ? 'DETECTED' : active ? 'NOW' : 'LOCKED'}
                  </Text>
                </View>
              );
            })}
          </View>
        ) : null}
        {capturedCount > 0 && phase === 'CAPTURING' ? (
          <Text style={styles.meta}>{capturedCount}/{PASSIVE_FRAME_COUNT} frames</Text>
        ) : null}
        {timing ? <Text style={styles.meta}>{timing}</Text> : null}

        <View style={styles.actions}>
          {phase === 'POSITIONING' ? (
            <TouchableOpacity style={styles.primaryBtn} onPress={runPassiveCapture}>
              <MaterialCommunityIcons name="face-recognition" size={18} color="#fff" />
              <Text style={styles.primaryBtnText}>Start Verification</Text>
            </TouchableOpacity>
          ) : null}

          {(phase === 'CHALLENGE' || phase === 'RECORDING_CHALLENGE' || phase === 'CAPTURING' || phase === 'SUBMITTING') && (
            <View style={styles.loadingRow}>
              <ActivityIndicator color="#10b981" />
              <Text style={styles.meta}>
                {phase === 'SUBMITTING'
                  ? `AI verification in progress${processingSeconds > 0 ? ` · ${processingSeconds}s` : '...'}`
                  : 'Processing...'}
              </Text>
            </View>
          )}

          <TouchableOpacity
            style={styles.cancelBtn}
            onPress={handleCancel}
          >
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0b1220', paddingTop: 48 },
  header: { alignItems: 'center', marginBottom: 12, paddingHorizontal: 16 },
  title: { color: '#fff', fontSize: 18, fontWeight: '800' },
  subtitle: { color: '#94a3b8', marginTop: 4, fontSize: 14, fontWeight: '600' },
  note: {
    color: '#64748b',
    marginTop: 8,
    fontSize: 12,
    fontWeight: '500',
    textAlign: 'center',
    paddingHorizontal: 12,
  },
  cameraWrap: {
    height: 360,
    marginHorizontal: 20,
    borderRadius: 24,
    overflow: 'hidden',
    backgroundColor: '#111827',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cameraWrapChallenge: { height: 300 },
  permissionBox: { alignItems: 'center', padding: 20, gap: 12 },
  permissionText: { color: '#e2e8f0', textAlign: 'center' },
  status: {
    color: '#e2e8f0',
    textAlign: 'center',
    marginTop: 16,
    paddingHorizontal: 24,
    fontSize: 14,
    fontWeight: '600',
  },
  challengePanel: {
    marginTop: 12,
    marginHorizontal: 20,
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#243244',
    backgroundColor: '#111827',
    gap: 8,
  },
  challengeHelp: {
    color: '#94a3b8',
    fontSize: 11,
    lineHeight: 16,
    textAlign: 'center',
    marginBottom: 2,
  },
  challengeRow: {
    minHeight: 38,
    paddingHorizontal: 10,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#0b1220',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  challengeRowActive: {
    borderColor: '#f59e0b',
    backgroundColor: '#2b2110',
  },
  challengeRowCompleted: {
    borderColor: '#14532d',
    backgroundColor: '#0b2118',
  },
  challengeText: { flex: 1, color: '#94a3b8', fontSize: 12, fontWeight: '700' },
  challengeTextActive: { color: '#fef3c7' },
  challengeTextCompleted: { color: '#a7f3d0' },
  challengeState: { color: '#64748b', fontSize: 9, fontWeight: '900' },
  meta: { color: '#94a3b8', textAlign: 'center', marginTop: 8, fontSize: 12 },
  actions: { marginTop: 'auto', padding: 20, gap: 12, paddingBottom: 36 },
  primaryBtn: {
    backgroundColor: '#10b981',
    borderRadius: 12,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  primaryBtnText: { color: '#fff', fontWeight: '800', fontSize: 14 },
  cancelBtn: { minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  cancelText: { color: '#94a3b8', fontWeight: '700' },
  loadingRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8 },
});
