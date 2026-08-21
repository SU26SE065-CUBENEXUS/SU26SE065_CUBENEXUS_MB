import { useEffect, useState, type RefObject } from 'react';
import { Platform } from 'react-native';
import type { CameraView } from 'expo-camera';

/**
 * Full-sensor photos cost hundreds of ms to encode and megabytes to upload,
 * while the face service downscales every frame to 640px wide anyway.
 * Pick the smallest camera size that still comfortably covers that.
 */
export function useCompactPictureSize(
  cameraRef: RefObject<CameraView | null>,
  cameraReady: boolean,
  minShortEdge = 640
): string | undefined {
  const [pictureSize, setPictureSize] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (Platform.OS !== 'android' || !cameraReady || pictureSize) return;

    let cancelled = false;
    (async () => {
      try {
        const sizes = await cameraRef.current?.getAvailablePictureSizesAsync();
        if (cancelled || !sizes?.length) return;

        const parsed = sizes
          .map(size => {
            const [width, height] = size.split('x').map(Number);
            return { size, width, height };
          })
          .filter(item => Number.isFinite(item.width) && Number.isFinite(item.height))
          .sort((a, b) => a.width * a.height - b.width * b.height);

        const chosen =
          parsed.find(item => Math.min(item.width, item.height) >= minShortEdge) ??
          parsed[parsed.length - 1];
        if (chosen) setPictureSize(chosen.size);
      } catch {
        // Keep the platform default when the query is unsupported.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [cameraReady, cameraRef, minShortEdge, pictureSize]);

  return pictureSize;
}
