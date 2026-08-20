import React, { useEffect, useMemo } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import type { FaceAnalyzeFrameDto } from '@/constants/api';
import { FACE_MESH_EDGES, FACE_MESH_TEMPLATE, warpTemplateToBox } from './faceMeshTemplate';

interface Props {
  visible: boolean;
  imageUri: string | null;
  analysis: FaceAnalyzeFrameDto | null;
  durationMs?: number;
  onDone: () => void;
}

/**
 * One-shot MediaPipe-like mesh flash after a successful capture.
 * Not continuous tracking — only a brief “wow” moment on the frozen photo.
 */
export default function FaceMeshFlash({
  visible,
  imageUri,
  analysis,
  durationMs = 900,
  onDone,
}: Props) {
  useEffect(() => {
    if (!visible || !imageUri) return;
    const t = setTimeout(onDone, durationMs);
    return () => clearTimeout(t);
  }, [visible, imageUri, durationMs, onDone]);

  const mesh = useMemo(() => {
    if (!analysis?.imageWidth || !analysis.imageHeight) return null;
    const W = 320;
    const H = 400;
    const sx = W / analysis.imageWidth;
    const sy = H / analysis.imageHeight;
    // Photo from front camera is usually already mirrored in preview feel;
    // keep coordinates as returned (no extra mirror) for still image overlay.
    const mapX = (x: number) => x * sx;
    const mapY = (y: number) => y * sy;

    let box = { x: W * 0.2, y: H * 0.12, w: W * 0.6, h: H * 0.72 };
    if (analysis.bbox && analysis.bbox.length >= 4) {
      const [x1, y1, x2, y2] = analysis.bbox;
      box = {
        x: Math.min(x1, x2) * sx,
        y: Math.min(y1, y2) * sy,
        w: Math.max(20, Math.abs(x2 - x1) * sx),
        h: Math.max(24, Math.abs(y2 - y1) * sy),
      };
    }

    const dense = (analysis.landmarksDense ?? []).map(p => ({
      x: mapX(p.x),
      y: mapY(p.y),
    }));
    const points = dense.length >= 20 ? dense : warpTemplateToBox(box, FACE_MESH_TEMPLATE);
    const edges = dense.length >= 20 ? buildNeighborEdges(points, 3) : FACE_MESH_EDGES;

    return { W, H, box, points, edges, ready: analysis.status === 'QUALITY_READY' };
  }, [analysis]);

  if (!visible || !imageUri) return null;

  return (
    <View style={styles.wrap} pointerEvents="none">
      <View style={styles.card}>
        <Image source={{ uri: imageUri }} style={styles.image} resizeMode="cover" />
        {mesh ? (
          <View style={[styles.overlay, { width: mesh.W, height: mesh.H }]}>
            <View
              style={[
                styles.box,
                {
                  left: mesh.box.x,
                  top: mesh.box.y,
                  width: mesh.box.w,
                  height: mesh.box.h,
                  borderColor: mesh.ready ? '#34d399' : '#22d3ee',
                },
              ]}
            />
            {mesh.edges.map(([a, b], idx) => {
              const p1 = mesh.points[a];
              const p2 = mesh.points[b];
              if (!p1 || !p2) return null;
              const dx = p2.x - p1.x;
              const dy = p2.y - p1.y;
              const len = Math.sqrt(dx * dx + dy * dy) || 1;
              const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
              return (
                <View
                  key={`e-${idx}`}
                  style={[
                    styles.edge,
                    {
                      left: (p1.x + p2.x) / 2 - len / 2,
                      top: (p1.y + p2.y) / 2 - 0.7,
                      width: len,
                      transform: [{ rotate: `${angle}deg` }],
                    },
                  ]}
                />
              );
            })}
            {mesh.points.map((p, idx) => (
              <View key={`d-${idx}`} style={[styles.dot, { left: p.x - 1.5, top: p.y - 1.5 }]} />
            ))}
          </View>
        ) : null}
        <Text style={styles.badge}>FACE MESH</Text>
      </View>
    </View>
  );
}

function buildNeighborEdges(points: { x: number; y: number }[], neighbors: number): [number, number][] {
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
  wrap: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(2,6,23,0.72)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 40,
  },
  card: {
    width: 320,
    height: 400,
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: '#34d399',
    backgroundColor: '#0f172a',
  },
  image: { ...StyleSheet.absoluteFillObject },
  overlay: {
    ...StyleSheet.absoluteFillObject,
  },
  box: {
    position: 'absolute',
    borderWidth: 2,
    borderRadius: 16,
  },
  edge: {
    position: 'absolute',
    height: 1.3,
    backgroundColor: 'rgba(110,231,183,0.85)',
  },
  dot: {
    position: 'absolute',
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: '#a7f3d0',
  },
  badge: {
    position: 'absolute',
    top: 12,
    alignSelf: 'center',
    left: 0,
    right: 0,
    textAlign: 'center',
    color: '#ecfdf5',
    fontWeight: '900',
    fontSize: 12,
    letterSpacing: 1,
    textShadowColor: '#000',
    textShadowRadius: 4,
  },
});
