// Breadth-first shortest path on the walkable tile grid (4-directional).
// Uniform cost → BFS yields a shortest path.

export type Tile = { c: number; r: number };

export function bfs(
  walk: boolean[][],
  start: Tile,
  goal: Tile
): Tile[] | null {
  const rows = walk.length;
  const cols = walk[0].length;
  const inB = (c: number, r: number) => c >= 0 && r >= 0 && c < cols && r < rows;
  if (!inB(goal.c, goal.r) || !walk[goal.r][goal.c]) return null;
  if (start.c === goal.c && start.r === goal.r) return [];

  const prev = new Int32Array(rows * cols).fill(-1);
  const seen = new Uint8Array(rows * cols);
  const idx = (c: number, r: number) => r * cols + c;
  const queue: number[] = [idx(start.c, start.r)];
  seen[idx(start.c, start.r)] = 1;
  const dirs = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ];

  let head = 0;
  while (head < queue.length) {
    const cur = queue[head++];
    const cc = cur % cols;
    const cr = (cur - cc) / cols;
    if (cc === goal.c && cr === goal.r) break;
    for (const [dc, dr] of dirs) {
      const nc = cc + dc;
      const nr = cr + dr;
      if (!inB(nc, nr) || !walk[nr][nc]) continue;
      const ni = idx(nc, nr);
      if (seen[ni]) continue;
      seen[ni] = 1;
      prev[ni] = cur;
      queue.push(ni);
    }
  }

  const goalI = idx(goal.c, goal.r);
  if (!seen[goalI]) return null;
  const path: Tile[] = [];
  let cur = goalI;
  while (cur !== idx(start.c, start.r)) {
    const cc = cur % cols;
    const cr = (cur - cc) / cols;
    path.push({ c: cc, r: cr });
    cur = prev[cur];
    if (cur < 0) break;
  }
  path.reverse();
  return path;
}

/** nearest walkable tile to a (possibly blocked) target — ring search */
export function nearestWalkable(
  walk: boolean[][],
  target: Tile,
  maxRing = 6
): Tile | null {
  const rows = walk.length;
  const cols = walk[0].length;
  const ok = (c: number, r: number) =>
    c >= 0 && r >= 0 && c < cols && r < rows && walk[r][c];
  if (ok(target.c, target.r)) return target;
  for (let ring = 1; ring <= maxRing; ring++) {
    for (let dr = -ring; dr <= ring; dr++) {
      for (let dc = -ring; dc <= ring; dc++) {
        if (Math.max(Math.abs(dr), Math.abs(dc)) !== ring) continue;
        const c = target.c + dc;
        const r = target.r + dr;
        if (ok(c, r)) return { c, r };
      }
    }
  }
  return null;
}
