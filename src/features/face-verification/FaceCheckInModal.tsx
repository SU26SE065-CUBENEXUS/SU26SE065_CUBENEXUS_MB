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
import { CameraView, useCameraPermissions } from 'expo-camera';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import {
  FaceSessionStartDto,
  FaceSessionStatusDto,
  submitFaceActiveEvidence,
  submitFacePassiveEvidence,
} from '@/constants/api';
import FaceFittingOval from './FaceFittingOval';
import { useCompactPictureSize } from './useCompactPictureSize';
import { useFaceOvalTracking, waitForCameraIdle } from './useFaceOvalTracking';

type Phase = 'POSITIONING' | 'CAPTURING' | 'SUBMITTING' | 'CHALLENGE' | 'DONE' | 'FAILED';

interface Props {
  visible: boolean;
  token: string;
  session: FaceSessionStartDto;
  mode?: 'check-in' | 'self-test';
  onVerified: (sessionId: string) => void;
  onCancel: (message?: string) => void;
}

const PASSIVE_FRAME_COUNT = 3;
const OVAL_W = 200;
const OVAL_H = 280;

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
  const [statusText, setStatusText] = useState('Look straight at the camera');
  const [capturedCount, setCapturedCount] = useState(0);
  const [challengeActions, setChallengeActions] = useState<string[]>(session.challenge?.actions ?? []);
  const [cameraReady, setCameraReady] = useState(false);
  const [viewSize, setViewSize] = useState({ w: 0, h: 0 });
  const [timing, setTiming] = useState<string | null>(null);
  const capturingRef = useRef(false);

  const pictureSize = useCompactPictureSize(cameraRef, cameraReady);

  // A failure keeps its own message on screen: no oval, no detection, no hints
  // until the user asks for another attempt.
  const trackingEnabled = visible && cameraReady && phase === 'POSITIONING';

  const analysis = useFaceOvalTracking({
    enabled: trackingEnabled,
    token,
    cameraRef,
    cameraReady,
    busyRef: capturingRef,
    onHint: text => {
      if (phase === 'POSITIONING') setStatusText(text);
    },
  });

  useEffect(() => {
    if (!visible) {
      setPhase('POSITIONING');
      setStatusText('Look straight at the camera');
      setCapturedCount(0);
      setChallengeActions(session.challenge?.actions ?? []);
      setCameraReady(false);
      setTiming(null);
      capturingRef.current = false;
    }
  }, [visible, session.challenge?.actions]);

  useEffect(() => {
    if (visible && !permission?.granted) {
      requestPermission();
    }
  }, [visible, permission?.granted, requestPermission]);

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

  const applyAiStatus = useCallback(
    (result: FaceSessionStatusDto) => {
      if (result.state === 'VERIFIED') {
        setPhase('DONE');
        setStatusText('Face verification successful');
        onVerified(result.sessionId);
        return;
      }
      if (result.state === 'CHALLENGE_REQUIRED') {
        setPhase('CHALLENGE');
        setChallengeActions(result.challenge?.actions?.length ? result.challenge.actions : challengeActions);
        setStatusText(
          `Challenge required: ${(result.challenge?.actions ?? challengeActions).join(' → ')}`
        );
        setCapturedCount(0);
        return;
      }
      handleFailure(result.failureReason || result.result?.reason || 'Face verification rejected');
    },
    [challengeActions, handleFailure, onVerified]
  );

  const captureOne = useCallback(async (): Promise<string | null> => {
    if (!cameraRef.current) return null;
    const photo = await cameraRef.current.takePictureAsync({
      quality: 0.35,
      skipProcessing: true,
      shutterSound: false,
    });
    return photo?.uri ?? null;
  }, []);

  const runPassiveCapture = useCallback(async () => {
    if (capturingRef.current || phase === 'SUBMITTING') return;
    if (!cameraReady) {
      setStatusText('Camera is not ready. Wait and try again...');
      return;
    }
    capturingRef.current = true;
    setPhase('CAPTURING');
    await waitForCameraIdle(capturingRef, 250);
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
          (pictureSize ? ` · ${pictureSize}` : '')
      );
      applyAiStatus(result);
    } catch (err: any) {
      handleFailure(err?.message || 'Passive face verification failed');
    } finally {
      capturingRef.current = false;
    }
  }, [applyAiStatus, cameraReady, captureOne, handleFailure, phase, pictureSize, session.sessionId, token]);

  const runActiveChallenge = useCallback(async () => {
    if (capturingRef.current) return;
    capturingRef.current = true;
    setPhase('CAPTURING');
    try {
      setStatusText(`Perform: ${challengeActions.join(' → ')}`);
      setCameraReady(false);
      await new Promise(resolve => setTimeout(resolve, 450));

      let videoUri: string | null = null;
      if (cameraRef.current?.recordAsync) {
        const recordPromise = cameraRef.current.recordAsync({ maxDuration: 5 });
        await new Promise(resolve => setTimeout(resolve, 3500));
        try {
          cameraRef.current.stopRecording?.();
        } catch {
          // ignore
        }
        const recorded = await recordPromise;
        videoUri = recorded?.uri ?? null;
      }

      const uris: string[] = [];
      for (let i = 0; i < 2; i += 1) {
        const uri = await captureOne();
        if (uri) uris.push(uri);
      }
      if (uris.length < 1) throw new Error('Final challenge frames are missing');

      setPhase('SUBMITTING');
      setStatusText('Uploading challenge evidence...');
      const result = await submitFaceActiveEvidence(session.sessionId, token, uris, videoUri);
      applyAiStatus(result);
    } catch (err: any) {
      handleFailure(err?.message || 'Active challenge failed');
    } finally {
      capturingRef.current = false;
    }
  }, [applyAiStatus, captureOne, challengeActions, handleFailure, session.sessionId, token]);

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
          style={styles.cameraWrap}
          onLayout={(e: LayoutChangeEvent) => {
            const { width, height } = e.nativeEvent.layout;
            setViewSize({ w: width, h: height });
          }}
        >
          {permission?.granted ? (
            <CameraView
              ref={cameraRef}
              style={StyleSheet.absoluteFill}
              facing="front"
              mode={phase === 'CHALLENGE' ? 'video' : 'picture'}
              pictureSize={pictureSize}
              onCameraReady={() => setCameraReady(true)}
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

          {phase === 'CHALLENGE' ? (
            <TouchableOpacity style={styles.primaryBtn} onPress={runActiveChallenge}>
              <MaterialCommunityIcons name="motion-play-outline" size={18} color="#fff" />
              <Text style={styles.primaryBtnText}>Record Challenge</Text>
            </TouchableOpacity>
          ) : null}

          {(phase === 'CAPTURING' || phase === 'SUBMITTING') && (
            <View style={styles.loadingRow}>
              <ActivityIndicator color="#10b981" />
              <Text style={styles.meta}>Processing...</Text>
            </View>
          )}

          <TouchableOpacity
            style={styles.cancelBtn}
            onPress={() => onCancel('Verification cancelled')}
            disabled={phase === 'SUBMITTING'}
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
