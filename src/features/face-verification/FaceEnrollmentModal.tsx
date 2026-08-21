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
  startFaceEnrollmentSession,
  submitFaceEnrollmentEvidence,
} from '@/constants/api';
import FaceFittingOval from './FaceFittingOval';
import { useCompactPictureSize } from './useCompactPictureSize';
import { useFaceOvalTracking, waitForCameraIdle } from './useFaceOvalTracking';

type Phase = 'LOADING' | 'POSITIONING' | 'CAPTURING' | 'SUBMITTING' | 'DONE' | 'FAILED';

interface Props {
  visible: boolean;
  token: string;
  mode?: 'enroll' | 'update';
  onEnrolled: () => void;
  /** Optional message = failure reason; parent should alert and dismiss. */
  onClose: (message?: string) => void;
}

const ENROLL_IMAGE_COUNT = 3;
const OVAL_W = 200;
const OVAL_H = 280;

export default function FaceEnrollmentModal({
  visible,
  token,
  mode = 'enroll',
  onEnrolled,
  onClose,
}: Props) {
  const cameraRef = useRef<CameraView>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [phase, setPhase] = useState<Phase>('LOADING');
  const [statusText, setStatusText] = useState('Preparing...');
  const [session, setSession] = useState<FaceSessionStartDto | null>(null);
  const [capturedCount, setCapturedCount] = useState(0);
  const [cameraReady, setCameraReady] = useState(false);
  const [viewSize, setViewSize] = useState({ w: 0, h: 0 });
  const [timing, setTiming] = useState<string | null>(null);
  const busyRef = useRef(false);

  const pictureSize = useCompactPictureSize(cameraRef, cameraReady);

  // A failure keeps its own message on screen: no oval, no detection, no hints
  // until the user asks for another attempt.
  const trackingEnabled = visible && cameraReady && phase === 'POSITIONING';

  const analysis = useFaceOvalTracking({
    enabled: trackingEnabled,
    token,
    cameraRef,
    cameraReady,
    busyRef,
    onHint: text => {
      if (phase === 'POSITIONING') setStatusText(text);
    },
  });

  const isUpdate = mode === 'update';
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  const reset = useCallback(() => {
    setPhase('LOADING');
    setStatusText(isUpdate ? 'Preparing update...' : 'Preparing...');
    setSession(null);
    setCapturedCount(0);
    setCameraReady(false);
    setTiming(null);
    busyRef.current = false;
  }, [isUpdate]);

  useEffect(() => {
    if (!visible) {
      reset();
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        if (!permission?.granted) {
          await requestPermission();
        }
        setPhase('LOADING');
        setStatusText('Creating session...');
        const started = await startFaceEnrollmentSession(token);
        if (cancelled) return;
        setSession(started);
        setPhase('POSITIONING');
        setStatusText('Look straight at the oval → Start');
      } catch (err: any) {
        if (cancelled) return;
        const message = err?.message || 'Unable to create session';
        setPhase('FAILED');
        setStatusText(message);
        onCloseRef.current(message);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [visible, token, permission?.granted, requestPermission, reset]);

  const captureOne = useCallback(async (): Promise<string | null> => {
    if (!cameraRef.current) return null;
    const photo = await cameraRef.current.takePictureAsync({
      quality: 0.35,
      skipProcessing: true,
      shutterSound: false,
    });
    return photo?.uri ?? null;
  }, []);

  const runEnrollment = useCallback(async () => {
    if (!session || busyRef.current || phase === 'SUBMITTING') return;
    if (!cameraReady) {
      setStatusText('Camera is not ready...');
      return;
    }
    busyRef.current = true;
    try {
      setPhase('CAPTURING');
      await waitForCameraIdle(busyRef, 250);
      const uris: string[] = [];
      const captureStart = Date.now();
      for (let i = 0; i < ENROLL_IMAGE_COUNT; i += 1) {
        setStatusText(`Capturing ${i + 1}/${ENROLL_IMAGE_COUNT}`);
        const uri = await captureOne();
        if (!uri) throw new Error('Unable to capture photo');
        uris.push(uri);
        setCapturedCount(uris.length);
      }
      const captureMs = Date.now() - captureStart;

      setPhase('SUBMITTING');
      setStatusText(isUpdate ? 'Updating...' : 'Uploading...');
      const submitStart = Date.now();
      const result = await submitFaceEnrollmentEvidence(
        session.sessionId,
        token,
        uris,
        null
      );
      setTiming(
        `capture ${captureMs} ms · upload+AI ${Date.now() - submitStart} ms` +
          (pictureSize ? ` · ${pictureSize}` : '')
      );
      if (result.state === 'ENROLLED') {
        setPhase('DONE');
        setStatusText(isUpdate ? 'Update successful' : 'VERIFIED — enrollment successful');
        onEnrolled();
        return;
      }
      throw new Error(result.failureReason || result.result?.reason || `Failed (${result.state})`);
    } catch (err: any) {
      const message = err?.message || 'Enrollment failed';
      setPhase('FAILED');
      setStatusText(message);
      setCapturedCount(0);
      // Exit immediately — parent shows the alert; no in-modal retry.
      onClose(message);
    } finally {
      busyRef.current = false;
    }
  }, [cameraReady, captureOne, isUpdate, onClose, onEnrolled, phase, pictureSize, session, token]);

  return (
    <Modal visible={visible} animationType="fade" presentationStyle="fullScreen">
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>{isUpdate ? 'Update Face ID' : 'Enroll Face ID'}</Text>
          <Text style={styles.subtitle}>Capture 3 photos — fast processing</Text>
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
              mode="picture"
              pictureSize={pictureSize}
              onCameraReady={() => setCameraReady(true)}
            />
          ) : (
            <View style={styles.permissionBox}>
              <Text style={styles.permissionText}>Camera permission is required</Text>
              <TouchableOpacity style={styles.primaryBtn} onPress={requestPermission}>
                <Text style={styles.primaryBtnText}>Grant Permission</Text>
              </TouchableOpacity>
            </View>
          )}
          {(phase === 'POSITIONING' || phase === 'LOADING') && (
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
          <Text style={styles.meta}>{capturedCount}/{ENROLL_IMAGE_COUNT}</Text>
        ) : null}
        {timing ? <Text style={styles.meta}>{timing}</Text> : null}

        <View style={styles.hintBox}>
          <Text style={styles.hint}>• Use good lighting, look straight, avoid dark glasses</Text>
          <Text style={styles.hint}>• Do not record video — only 3 quick photos</Text>
        </View>

        <View style={styles.actions}>
          {phase === 'POSITIONING' && session ? (
            <TouchableOpacity style={styles.primaryBtn} onPress={runEnrollment}>
              <MaterialCommunityIcons name="camera" size={18} color="#fff" />
              <Text style={styles.primaryBtnText}>
                {isUpdate ? 'Capture & Update' : 'Capture & Enroll'}
              </Text>
            </TouchableOpacity>
          ) : null}

          {phase === 'DONE' ? (
            <TouchableOpacity style={styles.primaryBtn} onPress={() => onClose()}>
              <MaterialCommunityIcons name="check-circle-outline" size={18} color="#fff" />
              <Text style={styles.primaryBtnText}>Xong</Text>
            </TouchableOpacity>
          ) : null}

          {(phase === 'LOADING' || phase === 'CAPTURING' || phase === 'SUBMITTING') && (
            <View style={styles.loadingRow}>
              <ActivityIndicator color="#10b981" />
              <Text style={styles.meta}>{phase === 'SUBMITTING' ? 'AI is processing...' : 'Capturing...'}</Text>
            </View>
          )}

          <TouchableOpacity
            style={styles.cancelBtn}
            onPress={() => onClose()}
            disabled={phase === 'SUBMITTING' || phase === 'CAPTURING'}
          >
            <Text style={styles.cancelText}>{phase === 'DONE' ? 'Close' : 'Cancel'}</Text>
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
  subtitle: { color: '#94a3b8', marginTop: 4, fontSize: 13, fontWeight: '600' },
  cameraWrap: {
    height: 320,
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
    marginTop: 14,
    paddingHorizontal: 24,
    fontSize: 14,
    fontWeight: '600',
  },
  meta: { color: '#94a3b8', textAlign: 'center', marginTop: 6, fontSize: 12 },
  hintBox: { marginTop: 12, paddingHorizontal: 28, gap: 4 },
  hint: { color: '#64748b', fontSize: 12, fontWeight: '500' },
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
