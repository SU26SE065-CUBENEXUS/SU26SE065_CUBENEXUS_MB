import { useEffect, useRef, useState, type MutableRefObject, type RefObject } from 'react';
import type { CameraView } from 'expo-camera';
import { analyzeFaceFrame, FaceAnalyzeFrameDto } from '@/constants/api';

/** Minimum idle gap between two polls; the round trip itself sets the pace. */
const MIN_GAP_MS = 150;
/** Keep the last known bbox this long so one dropped frame doesn't reset the oval. */
const BBOX_GRACE_MS = 1000;

/**
 * Light frame polling while positioning — drives oval fit to face bbox.
 * Skips when busy / camera not ready; never draws mesh.
 */
export function useFaceOvalTracking(opts: {
  enabled: boolean;
  token: string;
  cameraRef: RefObject<CameraView | null>;
  cameraReady: boolean;
  /** When true, polling must not touch the camera (capture in progress). */
  busyRef?: MutableRefObject<boolean>;
  onHint?: (text: string) => void;
}) {
  const { enabled, token, cameraRef, cameraReady, busyRef, onHint } = opts;
  const [analysis, setAnalysis] = useState<FaceAnalyzeFrameDto | null>(null);
  const onHintRef = useRef(onHint);
  onHintRef.current = onHint;

  useEffect(() => {
    if (!enabled) {
      setAnalysis(null);
      return;
    }

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let lastFace: { at: number; frame: FaceAnalyzeFrameDto } | null = null;

    const tick = async () => {
      if (cancelled) return;
      try {
        if (!busyRef?.current && cameraReady && cameraRef.current) {
          const photo = await cameraRef.current.takePictureAsync({
            quality: 0.2,
            skipProcessing: true,
            shutterSound: false,
          });
          if (cancelled || busyRef?.current || !photo?.uri) return;
          const result = await analyzeFaceFrame(token, photo.uri);
          if (cancelled || busyRef?.current) return;

          const hasFace = Boolean(result.bbox && result.bbox.length >= 4);
          if (hasFace) {
            lastFace = { at: Date.now(), frame: result };
            setAnalysis(result);
          } else if (lastFace && Date.now() - lastFace.at < BBOX_GRACE_MS) {
            // Hold the oval in place through a momentary miss.
            setAnalysis({ ...result, ...pickGeometry(lastFace.frame) });
          } else {
            lastFace = null;
            setAnalysis(result);
          }

          const hint = onHintRef.current;
          if (hint) {
            if (result.status === 'QUALITY_READY') {
              hint('Face detected — oval aligned');
            } else if (hasFace) {
              hint(result.reason || 'Center your face and hold still');
            } else {
              hint('No face detected — look at the camera');
            }
          }
        }
      } catch {
        // ignore transient camera/analyze errors while positioning
      } finally {
        if (!cancelled) timer = setTimeout(tick, MIN_GAP_MS);
      }
    };

    tick();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [enabled, token, cameraReady, cameraRef, busyRef]);

  return analysis;
}

function pickGeometry(frame: FaceAnalyzeFrameDto) {
  return {
    bbox: frame.bbox,
    imageWidth: frame.imageWidth,
    imageHeight: frame.imageHeight,
  };
}

/** Wait until oval polling releases the camera (or timeout). */
export async function waitForCameraIdle(
  busyRef: MutableRefObject<boolean>,
  ms = 600
): Promise<void> {
  busyRef.current = true;
  await new Promise(resolve => setTimeout(resolve, ms));
}
