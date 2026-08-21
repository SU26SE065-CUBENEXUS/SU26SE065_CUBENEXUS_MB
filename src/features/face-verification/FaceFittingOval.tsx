import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import type { FaceAnalyzeFrameDto } from '@/constants/api';

interface Props {
  analysis: FaceAnalyzeFrameDto | null;
  viewWidth: number;
  viewHeight: number;
  mirrored?: boolean;
  defaultWidth?: number;
  defaultHeight?: number;
}

type Box = { x: number; y: number; w: number; h: number };

/** How much wider/taller than the raw detection box the oval should be. */
const WIDTH_FACTOR = 1.34;
const HEIGHT_FACTOR = 1.5;
/** Keep a head-like silhouette instead of a circle or a slit. */
const MIN_ASPECT = 1.2;
const MAX_ASPECT = 1.5;
/** Detection boxes start mid-forehead, so bias the oval upwards a little. */
const VERTICAL_BIAS = 0.06;

function defaultBox(viewW: number, viewH: number, ow: number, oh: number): Box {
  return {
    x: (viewW - ow) / 2,
    y: (viewH - oh) / 2,
    w: ow,
    h: oh,
  };
}

function clampBox(box: Box, viewW: number, viewH: number): Box {
  const margin = 4;
  let { x, y, w, h } = box;
  w = Math.max(70, Math.min(w, viewW - margin * 2));
  h = Math.max(88, Math.min(h, viewH - margin * 2));
  x = Math.max(margin, Math.min(x, viewW - w - margin));
  y = Math.max(margin, Math.min(y, viewH - h - margin));
  return { x, y, w, h };
}

/** Map AI bbox → oval that hugs the face (with padding). */
function boxFromAnalysis(
  analysis: FaceAnalyzeFrameDto,
  viewW: number,
  viewH: number,
  mirrored: boolean,
  fallback: Box
): Box {
  const imgW = analysis.imageWidth ?? 0;
  const imgH = analysis.imageHeight ?? 0;
  if (imgW < 2 || imgH < 2 || !analysis.bbox || analysis.bbox.length < 4) {
    return fallback;
  }

  // The preview fills the frame by center-cropping, so both axes share one
  // scale factor and the overflow is split evenly. Scaling each axis on its own
  // stretches the box and is why the oval used to drift off the face.
  const scale = Math.max(viewW / imgW, viewH / imgH);
  const offsetX = (viewW - imgW * scale) / 2;
  const offsetY = (viewH - imgH * scale) / 2;

  const [x1, y1, x2, y2] = analysis.bbox;
  let left = offsetX + x1 * scale;
  let right = offsetX + x2 * scale;
  if (mirrored) {
    const mirroredLeft = viewW - right;
    right = viewW - left;
    left = mirroredLeft;
  }
  const top = offsetY + y1 * scale;
  const bottom = offsetY + y2 * scale;

  const faceW = Math.max(1, right - left);
  const faceH = Math.max(1, bottom - top);
  const centerX = (left + right) / 2;
  const centerY = (top + bottom) / 2 - faceH * VERTICAL_BIAS;

  const w = faceW * WIDTH_FACTOR;
  const h = Math.min(Math.max(faceH * HEIGHT_FACTOR, w * MIN_ASPECT), w * MAX_ASPECT);

  return clampBox({ x: centerX - w / 2, y: centerY - h / 2, w, h }, viewW, viewH);
}

function boxDelta(a: Box, b: Box): number {
  return Math.max(
    Math.abs(a.x - b.x),
    Math.abs(a.y - b.y),
    Math.abs(a.w - b.w),
    Math.abs(a.h - b.h)
  );
}

export default function FaceFittingOval({
  analysis,
  viewWidth,
  viewHeight,
  mirrored = true,
  defaultWidth = 200,
  defaultHeight = 280,
}: Props) {
  const fallback = useMemo(
    () => defaultBox(viewWidth, viewHeight, defaultWidth, defaultHeight),
    [viewWidth, viewHeight, defaultWidth, defaultHeight]
  );

  const target = useMemo(() => {
    if (viewWidth < 2 || viewHeight < 2) return fallback;
    if (!analysis) return fallback;
    return boxFromAnalysis(analysis, viewWidth, viewHeight, mirrored, fallback);
  }, [analysis, fallback, mirrored, viewHeight, viewWidth]);

  const tracking = Boolean(analysis?.bbox && analysis.bbox.length >= 4);
  const ready = analysis?.status === 'QUALITY_READY';

  const [display, setDisplay] = useState(target);
  const displayRef = useRef(target);
  const targetRef = useRef(target);
  const pulse = useRef(new Animated.Value(0.65)).current;

  useEffect(() => {
    targetRef.current = target;
  }, [target]);

  useEffect(() => {
    let raf = 0;
    let alive = true;
    const step = () => {
      if (!alive) return;
      const tgt = targetRef.current;
      const cur = displayRef.current;
      const delta = boxDelta(tgt, cur);
      if (delta > 0.25) {
        // Catch up quickly on real movement, crawl on detector jitter.
        const k = delta > 60 ? 0.45 : delta > 16 ? 0.26 : 0.12;
        const next = {
          x: cur.x + (tgt.x - cur.x) * k,
          y: cur.y + (tgt.y - cur.y) * k,
          w: cur.w + (tgt.w - cur.w) * k,
          h: cur.h + (tgt.h - cur.h) * k,
        };
        displayRef.current = next;
        setDisplay(next);
      }
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => {
      alive = false;
      cancelAnimationFrame(raf);
    };
  }, []);

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 650, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.55, duration: 650, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  const borderColor = ready
    ? 'rgba(16,185,129,0.95)'
    : tracking
      ? 'rgba(251,191,36,0.9)'
      : 'rgba(16,185,129,0.55)';

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Animated.View
        style={[
          styles.oval,
          {
            left: display.x,
            top: display.y,
            width: display.w,
            height: display.h,
            borderColor,
            opacity: ready ? pulse : tracking ? 0.95 : 0.75,
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  oval: {
    position: 'absolute',
    borderRadius: 999,
    borderWidth: 2.5,
  },
});
