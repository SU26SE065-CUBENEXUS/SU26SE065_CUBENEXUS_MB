import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import type { FaceAnalyzeFrameDto } from '@/constants/api';
import {
  FACE_MESH_EDGES,
  FACE_MESH_TEMPLATE,
  MeshPoint,
  lerpPoints,
  warpTemplateToBox,
} from './faceMeshTemplate';

interface Props {
  analysis: FaceAnalyzeFrameDto | null;
  viewWidth: number;
  viewHeight: number;
  mirrored?: boolean;
  ovalWidth?: number;
  ovalHeight?: number;
}

const LABEL_SHORT: Record<string, string> = {
  LEFT_EYE: 'L-EYE',
  RIGHT_EYE: 'R-EYE',
  NOSE: 'NOSE',
  MOUTH_LEFT: 'L-MOUTH',
  MOUTH_RIGHT: 'R-MOUTH',
};

export default function FaceMeshOverlay({
  analysis,
  viewWidth,
  viewHeight,
  mirrored = true,
  ovalWidth = 168,
  ovalHeight = 210,
}: Props) {
  const ovalLeft = (viewWidth - ovalWidth) / 2;
  const ovalTop = (viewHeight - ovalHeight) / 2;

  const target = useMemo(() => {
    if (!analysis?.imageWidth || !analysis.imageHeight || viewWidth < 2) {
      return {
        box: {
          x: ovalLeft,
          y: ovalTop,
          w: ovalWidth,
          h: ovalHeight,
        } as const,
        points: warpTemplateToBox(
          { x: ovalLeft, y: ovalTop, w: ovalWidth, h: ovalHeight },
          FACE_MESH_TEMPLATE
        ),
        labels: [] as { label: string; x: number; y: number }[],
        ready: false,
        tracking: false,
        reason: null as string | null,
      };
    }

    const sx = viewWidth / analysis.imageWidth;
    const sy = viewHeight / analysis.imageHeight;
    const mapX = (x: number) => {
      const px = x * sx;
      return mirrored ? viewWidth - px : px;
    };
    const mapY = (y: number) => y * sy;

    let box = {
      x: ovalLeft,
      y: ovalTop,
      w: ovalWidth,
      h: ovalHeight,
    };
    if (analysis.bbox && analysis.bbox.length >= 4) {
      const [x1, y1, x2, y2] = analysis.bbox;
      const left = mapX(mirrored ? x2 : x1);
      const right = mapX(mirrored ? x1 : x2);
      const top = mapY(y1);
      const bottom = mapY(y2);
      box = {
        x: Math.min(left, right),
        y: top,
        w: Math.max(24, Math.abs(right - left)),
        h: Math.max(30, bottom - top),
      };
    }

    const dense = (analysis.landmarksDense ?? []).map(p => ({
      x: mapX(p.x),
      y: mapY(p.y),
    }));

    // Prefer live dense landmarks; else warp template to tracked bbox (moves with face)
    const points =
      dense.length >= 20
        ? dense
        : warpTemplateToBox(box, FACE_MESH_TEMPLATE);

    const labels = (analysis.landmarks ?? []).map(p => ({
      label: LABEL_SHORT[p.label] || p.label,
      x: mapX(p.x),
      y: mapY(p.y),
    }));

    return {
      box,
      points,
      labels,
      ready: analysis.status === 'QUALITY_READY',
      tracking: Boolean(analysis.bbox),
      reason: analysis.reason || null,
    };
  }, [analysis, mirrored, ovalHeight, ovalLeft, ovalTop, ovalWidth, viewHeight, viewWidth]);

  const [displayPoints, setDisplayPoints] = useState<MeshPoint[]>(target.points);
  const [displayBox, setDisplayBox] = useState(target.box);
  const displayPointsRef = useRef(target.points);
  const displayBoxRef = useRef(target.box);
  const targetRef = useRef(target);
  const pulse = useRef(new Animated.Value(0.55)).current;

  useEffect(() => {
    targetRef.current = target;
  }, [target]);

  // Smooth realtime interpolation between AI updates (~60fps feel)
  useEffect(() => {
    let raf = 0;
    let alive = true;
    const step = () => {
      if (!alive) return;
      const tgt = targetRef.current;
      const curPts = displayPointsRef.current;
      const nextPts =
        curPts.length === tgt.points.length
          ? lerpPoints(curPts, tgt.points, 0.32)
          : tgt.points.map(p => ({ ...p }));

      const curBox = displayBoxRef.current;
      const nextBox = {
        x: curBox.x + (tgt.box.x - curBox.x) * 0.32,
        y: curBox.y + (tgt.box.y - curBox.y) * 0.32,
        w: curBox.w + (tgt.box.w - curBox.w) * 0.32,
        h: curBox.h + (tgt.box.h - curBox.h) * 0.32,
      };

      displayPointsRef.current = nextPts;
      displayBoxRef.current = nextBox;
      setDisplayPoints(nextPts);
      setDisplayBox(nextBox);
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
        Animated.timing(pulse, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.45, duration: 700, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  const edges =
    displayPoints.length === FACE_MESH_TEMPLATE.length
      ? FACE_MESH_EDGES
      : buildNeighborEdges(displayPoints, 2);

  const meshOpacity = target.ready ? pulse : 0.85;

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Animated.View
        style={[
          styles.box,
          {
            left: displayBox.x,
            top: displayBox.y,
            width: displayBox.w,
            height: displayBox.h,
            borderColor: target.ready ? '#34d399' : target.tracking ? '#22d3ee' : '#64748b',
            opacity: meshOpacity,
          },
        ]}
      />

      <Animated.View style={[StyleSheet.absoluteFill, { opacity: meshOpacity }]}>
        {edges.map(([a, b], idx) => {
          const p1 = displayPoints[a];
          const p2 = displayPoints[b];
          if (!p1 || !p2) return null;
          const dx = p2.x - p1.x;
          const dy = p2.y - p1.y;
          const len = Math.sqrt(dx * dx + dy * dy) || 1;
          const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
          const midX = (p1.x + p2.x) / 2;
          const midY = (p1.y + p2.y) / 2;
          return (
            <View
              key={`e-${idx}`}
              style={[
                styles.edge,
                {
                  left: midX - len / 2,
                  top: midY - 0.7,
                  width: len,
                  backgroundColor: target.ready
                    ? 'rgba(52,211,153,0.75)'
                    : 'rgba(34,211,238,0.7)',
                  transform: [{ rotate: `${angle}deg` }],
                },
              ]}
            />
          );
        })}

        {displayPoints.map((p, idx) => (
          <View
            key={`p-${idx}`}
            style={[
              styles.dot,
              {
                left: p.x - 1.8,
                top: p.y - 1.8,
                backgroundColor: target.ready ? '#a7f3d0' : '#67e8f9',
              },
            ]}
          />
        ))}
      </Animated.View>

      {target.labels.map(p => (
        <Text key={p.label} style={[styles.liveLabel, { left: p.x - 18, top: p.y - 16 }]}>
          {p.label}
        </Text>
      ))}

      <View style={styles.badgeWrap}>
        <Text
          style={[
            styles.badge,
            target.ready ? styles.badgeOk : target.tracking ? styles.badgeTrack : styles.badgeInfo,
          ]}
        >
          {target.ready
            ? 'FACE MESH LOCKED'
            : target.tracking
              ? 'TRACKING FACE…'
              : 'Tìm khuôn mặt…'}
        </Text>
      </View>
    </View>
  );
}

function buildNeighborEdges(points: MeshPoint[], neighbors: number): [number, number][] {
  const edges = new Set<string>();
  for (let i = 0; i < points.length; i += 1) {
    const dists: { j: number; d: number }[] = [];
    for (let j = 0; j < points.length; j += 1) {
      if (i === j) continue;
      const dx = points[i].x - points[j].x;
      const dy = points[i].y - points[j].y;
      dists.push({ j, d: dx * dx + dy * dy });
    }
    dists.sort((a, b) => a.d - b.d);
    for (const item of dists.slice(0, neighbors)) {
      const a = Math.min(i, item.j);
      const b = Math.max(i, item.j);
      edges.add(`${a}-${b}`);
    }
  }
  return Array.from(edges).map(k => {
    const [a, b] = k.split('-').map(Number);
    return [a, b];
  });
}

const styles = StyleSheet.create({
  box: {
    position: 'absolute',
    borderWidth: 2,
    borderRadius: 18,
  },
  edge: {
    position: 'absolute',
    height: 1.4,
  },
  dot: {
    position: 'absolute',
    width: 3.6,
    height: 3.6,
    borderRadius: 2,
  },
  liveLabel: {
    position: 'absolute',
    color: '#ecfdf5',
    fontSize: 9,
    fontWeight: '800',
    width: 56,
    textShadowColor: 'rgba(0,0,0,0.85)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  badgeWrap: {
    position: 'absolute',
    top: 10,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    overflow: 'hidden',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  badgeOk: { backgroundColor: '#065f46', color: '#ecfdf5' },
  badgeTrack: { backgroundColor: '#155e75', color: '#ecfeff' },
  badgeInfo: { backgroundColor: '#334155', color: '#e2e8f0' },
});
