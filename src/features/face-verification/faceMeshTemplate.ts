/** Normalized face mesh template (0..1 inside face bbox), warped in realtime using the AI bbox. */

export type MeshPoint = { x: number; y: number };

/** Contour + facial features roughly matching a frontal face. */
export const FACE_MESH_TEMPLATE: MeshPoint[] = [
  // jaw / cheek contour
  { x: 0.5, y: 0.08 },
  { x: 0.62, y: 0.1 },
  { x: 0.74, y: 0.16 },
  { x: 0.84, y: 0.28 },
  { x: 0.9, y: 0.42 },
  { x: 0.9, y: 0.56 },
  { x: 0.84, y: 0.7 },
  { x: 0.72, y: 0.84 },
  { x: 0.5, y: 0.94 },
  { x: 0.28, y: 0.84 },
  { x: 0.16, y: 0.7 },
  { x: 0.1, y: 0.56 },
  { x: 0.1, y: 0.42 },
  { x: 0.16, y: 0.28 },
  { x: 0.26, y: 0.16 },
  { x: 0.38, y: 0.1 },
  // left brow
  { x: 0.22, y: 0.3 },
  { x: 0.3, y: 0.27 },
  { x: 0.38, y: 0.28 },
  { x: 0.44, y: 0.31 },
  // right brow
  { x: 0.56, y: 0.31 },
  { x: 0.62, y: 0.28 },
  { x: 0.7, y: 0.27 },
  { x: 0.78, y: 0.3 },
  // left eye
  { x: 0.28, y: 0.4 },
  { x: 0.34, y: 0.37 },
  { x: 0.4, y: 0.4 },
  { x: 0.34, y: 0.43 },
  // right eye
  { x: 0.6, y: 0.4 },
  { x: 0.66, y: 0.37 },
  { x: 0.72, y: 0.4 },
  { x: 0.66, y: 0.43 },
  // nose bridge + tip
  { x: 0.5, y: 0.38 },
  { x: 0.5, y: 0.48 },
  { x: 0.5, y: 0.56 },
  { x: 0.44, y: 0.58 },
  { x: 0.56, y: 0.58 },
  // mouth
  { x: 0.38, y: 0.7 },
  { x: 0.44, y: 0.68 },
  { x: 0.5, y: 0.69 },
  { x: 0.56, y: 0.68 },
  { x: 0.62, y: 0.7 },
  { x: 0.56, y: 0.74 },
  { x: 0.5, y: 0.75 },
  { x: 0.44, y: 0.74 },
  // cheeks / mid fill
  { x: 0.32, y: 0.55 },
  { x: 0.68, y: 0.55 },
  { x: 0.5, y: 0.63 },
];

export const FACE_MESH_EDGES: [number, number][] = [
  // outer contour loop
  [0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 7], [7, 8],
  [8, 9], [9, 10], [10, 11], [11, 12], [12, 13], [13, 14], [14, 15], [15, 0],
  // brows
  [16, 17], [17, 18], [18, 19],
  [20, 21], [21, 22], [22, 23],
  // eyes
  [24, 25], [25, 26], [26, 27], [27, 24],
  [28, 29], [29, 30], [30, 31], [31, 28],
  // nose
  [32, 33], [33, 34], [34, 35], [34, 36], [35, 36],
  // mouth
  [37, 38], [38, 39], [39, 40], [40, 41], [41, 42], [42, 43], [43, 44], [44, 37],
  // cross links (tessellation feel)
  [19, 24], [20, 28], [26, 32], [28, 32],
  [35, 37], [36, 41], [27, 45], [31, 46],
  [45, 47], [46, 47], [47, 39],
  [18, 25], [21, 29], [14, 16], [2, 23],
];

export function warpTemplateToBox(
  box: { x: number; y: number; w: number; h: number },
  template: MeshPoint[] = FACE_MESH_TEMPLATE
): MeshPoint[] {
  return template.map(p => ({
    x: box.x + p.x * box.w,
    y: box.y + p.y * box.h,
  }));
}

export function lerpPoints(from: MeshPoint[], to: MeshPoint[], t: number): MeshPoint[] {
  const n = Math.min(from.length, to.length);
  const out: MeshPoint[] = [];
  for (let i = 0; i < n; i += 1) {
    out.push({
      x: from[i].x + (to[i].x - from[i].x) * t,
      y: from[i].y + (to[i].y - from[i].y) * t,
    });
  }
  // if target longer, append remaining
  for (let i = n; i < to.length; i += 1) out.push({ ...to[i] });
  return out;
}
