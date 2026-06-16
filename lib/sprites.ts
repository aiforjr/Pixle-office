// ------------------------------------------------------------------ //
//  Pixel-art sprite library — everything is drawn in NATIVE pixels on
//  a small low-res buffer that is later upscaled with nearest-neighbour
//  so the result reads as authentic, chunky pixel art.
//  Every sprite uses a dark outline + 3-tone shading (shadow/base/light).
// ------------------------------------------------------------------ //

export const TILE = 16;
export const COLS = 104;
export const ROWS = 108;
export const NATIVE_W = COLS * TILE; // 1632
export const NATIVE_H = ROWS * TILE; // 1728
export const SCALE = 2; // backing-store multiplier

export type Ctx = CanvasRenderingContext2D;

/** integer-aligned rectangle */
export function R(ctx: Ctx, x: number, y: number, w: number, h: number, c: string) {
  ctx.fillStyle = c;
  ctx.fillRect(Math.round(x), Math.round(y), Math.max(0, Math.round(w)), Math.max(0, Math.round(h)));
}

/** stable per-tile pseudo-random in [0,n) — keeps texture from flickering */
function det(a: number, b: number, n: number) {
  const h = ((a * 73856093) ^ (b * 19349663)) >>> 0;
  return h % n;
}

/** Adjust a hex color's RGB channels by delta d (positive=lighter, negative=darker). */
function adjustHex(hex: string, d: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const cl = (v: number) => Math.min(255, Math.max(0, Math.round(v + d)));
  return "#" + [cl(r), cl(g), cl(b)].map((v) => v.toString(16).padStart(2, "0")).join("");
}

// ------------------------------------------------------------------ //
//  Floors
// ------------------------------------------------------------------ //
export function grassTile(ctx: Ctx, x: number, y: number, _c: number, _r: number) {
  R(ctx, x, y, 16, 16, "#334a43");
}

export function woodTile(ctx: Ctx, x: number, y: number, c: number, r: number) {
  R(ctx, x, y, 16, 16, "#9c6a3d");
  // two horizontal planks per tile
  R(ctx, x, y, 16, 1, "#b07c4a");
  R(ctx, x, y + 7, 16, 1, "#7c4f2b");
  R(ctx, x, y + 8, 16, 1, "#b07c4a");
  R(ctx, x, y + 15, 16, 1, "#7c4f2b");
  // staggered vertical seams
  const sx = (r % 2) * 8;
  R(ctx, x + sx, y, 1, 7, "#6f4a28");
  R(ctx, x + ((sx + 8) % 16), y + 8, 1, 7, "#6f4a28");
  // grain fleck
  if (det(c, r, 3) === 0) R(ctx, x + 4 + det(c, r, 6), y + 3, 3, 1, "#8a5b30");
}

export function darkTile(ctx: Ctx, x: number, y: number) {
  R(ctx, x, y, 16, 16, "#3c4350");
  R(ctx, x + 1, y + 1, 14, 14, "#414a59");
  R(ctx, x + 1, y + 1, 13, 1, "#4b556a"); // inner top highlight
  R(ctx, x, y, 16, 1, "#2f3540"); // grout
  R(ctx, x, y, 1, 16, "#2f3540");
}

// pattern: planks — horizontal planks with staggered seams
export function lavTile(ctx: Ctx, x: number, y: number, _c: number, r: number, color = "#a08070") {
  const grout = adjustHex(color, -30);
  R(ctx, x, y, 16, 16, color);
  R(ctx, x, y, 16, 1, grout);
  R(ctx, x, y + 8, 16, 1, grout);
  const sx = (r % 2) * 8;
  R(ctx, x + sx, y + 1, 1, 7, grout);
  R(ctx, x + ((sx + 8) % 16), y + 9, 1, 7, grout);
}

// pattern: grid — square tiles with grout lines
export function greyTile(ctx: Ctx, x: number, y: number, color = "#7e848e") {
  const inner = adjustHex(color, 7);
  const grout = adjustHex(color, -20);
  R(ctx, x, y, 16, 16, color);
  R(ctx, x + 1, y + 1, 14, 14, inner);
  R(ctx, x, y, 16, 1, grout);
  R(ctx, x, y, 1, 16, grout);
}

// pattern: checker — alternating light/dark squares with grout
export function creamTile(ctx: Ctx, x: number, y: number, c: number, r: number, color = "#fdfaf0") {
  const a = (c + r) % 2 === 0;
  const base  = a ? color : adjustHex(color, -8);
  const grout = adjustHex(color, -16);
  const grain = adjustHex(color, -12);
  R(ctx, x, y, 16, 16, base);
  R(ctx, x, y, 16, 1, grout);
  R(ctx, x, y, 1, 16, grout);
  if (det(c, r, 5) === 0) R(ctx, x + 5, y + 6, 3, 1, grain);
}

// pattern: carpet — solid with scattered texture blobs
export function carpetTile(ctx: Ctx, x: number, y: number, c: number, r: number, color = "#7f88bf") {
  const light = adjustHex(color, 14);
  const dark  = adjustHex(color, -14);
  const grout = adjustHex(color, -8);
  R(ctx, x, y, 16, 16, color);
  const v = det(c, r, 5);
  if (v === 0) R(ctx, x + 3, y + 4, 4, 4, light);
  else if (v === 1) R(ctx, x + 9, y + 9, 4, 4, dark);
  else if (v === 2) R(ctx, x + 6, y + 2, 3, 3, light);
  else if (v === 3) R(ctx, x + 2, y + 10, 3, 3, dark);
  R(ctx, x, y, 16, 1, grout);
  R(ctx, x, y, 1, 16, grout);
}

// pattern: rug — checker base with plus/cross motif
export function rugTile(ctx: Ctx, x: number, y: number, c: number, r: number, color = "#e8dfc8") {
  const a = (c + r) % 2 === 0;
  const base  = a ? color : adjustHex(color, -6);
  const grout = adjustHex(color, -20);
  const motif = adjustHex(color, -14);
  R(ctx, x, y, 16, 16, base);
  R(ctx, x, y, 16, 1, grout);
  R(ctx, x, y, 1, 16, grout);
  R(ctx, x + 7, y + 5, 2, 6, motif);
  R(ctx, x + 5, y + 7, 6, 2, motif);
}

// ------------------------------------------------------------------ //
//  Walls + windows
// ------------------------------------------------------------------ //
export function wallTile(
  ctx: Ctx,
  x: number,
  y: number,
  edge: { top?: boolean; bottom?: boolean; left?: boolean; right?: boolean }
) {
  R(ctx, x, y, 16, 16, "#23262d");
  R(ctx, x, y, 16, 16, "#22252c");
  // baseboard / cap shading toward the interior
  if (edge.top) {
    R(ctx, x, y, 16, 4, "#2d313b");
    R(ctx, x, y + 13, 16, 3, "#191b21");
  }
  if (edge.bottom) {
    R(ctx, x, y, 16, 3, "#2d313b");
    R(ctx, x, y + 12, 16, 4, "#191b21");
  }
  if (edge.left) {
    R(ctx, x, y, 4, 16, "#2d313b");
    R(ctx, x + 13, y, 3, 16, "#191b21");
  }
  if (edge.right) {
    R(ctx, x, y, 3, 16, "#191b21");
    R(ctx, x + 12, y, 4, 16, "#2d313b");
  }
}

export function clock(ctx: Ctx, x: number, y: number) {
  // round wall clock, mounted on the wall face (~14px)
  fillCircle(ctx, x + 7, y + 7, 8, "#15171c"); // outer rim
  fillCircle(ctx, x + 7, y + 7, 7, "#cfd4d9"); // bezel
  fillCircle(ctx, x + 7, y + 7, 6, "#f1f3f5"); // face
  // ticks
  R(ctx, x + 7, y + 2, 1, 2, "#5a6470");
  R(ctx, x + 7, y + 11, 1, 2, "#5a6470");
  R(ctx, x + 2, y + 7, 2, 1, "#5a6470");
  R(ctx, x + 11, y + 7, 2, 1, "#5a6470");
  // hands
  R(ctx, x + 7, y + 4, 1, 4, "#23262d"); // minute
  R(ctx, x + 7, y + 7, 3, 1, "#23262d"); // hour
  R(ctx, x + 6, y + 6, 2, 2, "#c0533f"); // hub
}

/** a run of window panes set into a back-wall band (w x h px, face down) */
export function windowWall(ctx: Ctx, x: number, y: number, w: number, h: number) {
  let wx = x + 2;
  const top = y + 6;
  const gh = h - 12;
  while (wx < x + w - 2) {
    const ww = Math.min(22, x + w - 2 - wx);
    if (ww < 8) break;
    R(ctx, wx, top - 2, ww, gh + 4, "#c9d0d6"); // frame
    R(ctx, wx + 2, top, ww - 4, gh, "#5fb6c4"); // glass
    R(ctx, wx + 2, top, (ww - 4) / 2, gh / 2, "#86d2dc"); // reflection
    R(ctx, wx + (ww >> 1), top, 1, gh, "#c9d0d6"); // mullion
    R(ctx, wx + 2, top + (gh >> 1), ww - 4, 1, "#c9d0d6");
    wx += ww + 3;
  }
}

export function windowPane(ctx: Ctx, x: number, y: number) {
  // sits on a top-wall tile (16x16)
  R(ctx, x, y, 16, 16, "#23262d");
  R(ctx, x + 1, y + 2, 14, 11, "#cdd4d9"); // frame
  R(ctx, x + 2, y + 3, 12, 9, "#5fb6c4"); // glass
  R(ctx, x + 2, y + 3, 6, 4, "#86d2dc"); // reflection
  R(ctx, x + 8, y + 3, 1, 9, "#cdd4d9"); // mullion v
  R(ctx, x + 2, y + 7, 12, 1, "#cdd4d9"); // mullion h
}

/** Large framed office window — 3 cols × 3 rows of panes, flush against a wall.
 *  w × h are the full bounding-box pixels (e.g. 48×48 for a 3×3-tile object).
 *  Matches the reference: thick dark outer frame, grey inner frame strips,
 *  sky-blue glass with a lighter reflection band in each pane. */
export function officeWindow(ctx: Ctx, x: number, y: number, w: number, h: number) {
  const frameOuter = "#4a4f58"; // dark outer border
  const frameInner = "#7a828e"; // grey frame / mullions
  const frameHi    = "#9aa2ae"; // frame highlight
  const glass      = "#7ecae0"; // sky-blue glass fill
  const glassHi    = "#aadff0"; // lighter reflection band
  const glassShad  = "#5ab0c8"; // shadow edge of glass

  const border = 3;  // outer frame thickness

  // ── outer frame ──────────────────────────────────────────────────────
  R(ctx, x,           y,           w,  h,  frameOuter);
  R(ctx, x + 1,       y + 1,       w - 2, h - 2, frameInner);
  // highlight: top & left inner edge
  R(ctx, x + 1,       y + 1,       w - 2, 1,      frameHi);
  R(ctx, x + 1,       y + 1,       1,     h - 2,  frameHi);

  // ── pane grid (3 cols × 3 rows) ───────────────────────────────────
  const cols = 3;
  const rows = 3;
  const mullionW = 2; // thickness of cross-bar mullions
  const innerX = x + border;
  const innerY = y + border;
  const innerW = w - border * 2;
  const innerH = h - border * 2;
  // each pane size (including its right/bottom mullion space)
  const paneW = Math.floor((innerW - mullionW * (cols - 1)) / cols);
  const paneH = Math.floor((innerH - mullionW * (rows - 1)) / rows);

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const px = innerX + col * (paneW + mullionW);
      const py = innerY + row * (paneH + mullionW);
      // glass
      R(ctx, px,       py,           paneW,          paneH,          glass);
      // reflection strip — top-left quarter of each pane
      R(ctx, px,       py,           Math.ceil(paneW / 2), Math.ceil(paneH / 2), glassHi);
      // shadow: right & bottom edge of each pane
      R(ctx, px + paneW - 1, py,     1,              paneH,          glassShad);
      R(ctx, px,             py + paneH - 1, paneW,  1,              glassShad);
    }
  }

  // ── vertical mullions (between columns) ───────────────────────────
  for (let col = 1; col < cols; col++) {
    const mx = innerX + col * paneW + (col - 1) * mullionW;
    R(ctx, mx, innerY, mullionW, innerH, frameInner);
    R(ctx, mx, innerY, 1,        innerH, frameHi);
  }
  // ── horizontal mullions (between rows) ────────────────────────────
  for (let row = 1; row < rows; row++) {
    const my = innerY + row * paneH + (row - 1) * mullionW;
    R(ctx, innerX, my, innerW, mullionW, frameInner);
    R(ctx, innerX, my, innerW, 1,        frameHi);
  }
}

// ------------------------------------------------------------------ //
//  Office furniture
// ------------------------------------------------------------------ //
export function desk(ctx: Ctx, x: number, y: number, w: number, h: number) {
  const O = "#3a2a18";
  R(ctx, x + 2, y + h, w - 2, 2, "rgba(0,0,0,0.20)"); // ground shadow
  R(ctx, x, y, w, h, O); // outline
  R(ctx, x + 1, y + 1, w - 2, h - 2, "#6f4a28"); // front/edge
  R(ctx, x + 1, y + 1, w - 2, h - 7, "#9c6a3d"); // top surface
  R(ctx, x + 1, y + 1, w - 2, 1, "#b88a55"); // top hi-light
  // wood grain
  for (let gx = x + 4; gx < x + w - 3; gx += 12) {
    R(ctx, gx, y + 3, 8, 1, "#8a5b30");
  }
  R(ctx, x + 1, y + h - 6, w - 2, 1, "#5a3c20"); // lip seam
}

export function monitor(ctx: Ctx, x: number, y: number, screen: string, accent: string) {
  const O = "#15171c";
  R(ctx, x + 5, y + 12, 4, 2, "#23262d"); // neck
  R(ctx, x + 3, y + 14, 8, 2, O); // foot
  R(ctx, x + 1, y, 14, 12, O); // body outline
  R(ctx, x + 2, y + 1, 12, 10, "#2a2e35"); // bezel
  R(ctx, x + 3, y + 2, 10, 8, screen); // screen
  R(ctx, x + 4, y + 3, 8, 2, accent); // header bar
  R(ctx, x + 4, y + 6, 6, 1, "rgba(255,255,255,0.55)");
  R(ctx, x + 4, y + 8, 7, 1, "rgba(255,255,255,0.30)");
  R(ctx, x + 3, y + 2, 3, 3, "rgba(255,255,255,0.16)"); // glare
}

export function keyboard(ctx: Ctx, x: number, y: number) {
  R(ctx, x, y, 14, 6, "#15171c");
  R(ctx, x + 1, y + 1, 12, 4, "#cdd2d8");
  R(ctx, x + 1, y + 1, 12, 1, "#e7ebef");
  R(ctx, x + 1, y + 3, 12, 1, "#aab0b8");
  R(ctx, x + 16, y + 1, 4, 5, "#15171c"); // mouse
  R(ctx, x + 17, y + 2, 2, 3, "#cdd2d8");
}

export function papers(ctx: Ctx, x: number, y: number) {
  R(ctx, x, y, 8, 6, "#15171c");
  R(ctx, x + 1, y + 1, 7, 5, "#eef1f4");
  R(ctx, x + 2, y + 2, 4, 1, "#9aa3ad");
  R(ctx, x + 2, y + 4, 5, 1, "#9aa3ad");
}

export function mug(ctx: Ctx, x: number, y: number) {
  R(ctx, x, y, 6, 6, "#15171c");
  R(ctx, x + 1, y + 1, 4, 4, "#c0533f");
  R(ctx, x + 1, y + 1, 4, 1, "#d96a5c");
  R(ctx, x + 5, y + 2, 2, 2, "#15171c"); // handle
}

export function deskPlant(ctx: Ctx, x: number, y: number) {
  R(ctx, x + 1, y + 5, 6, 4, "#8f4d2e"); // pot
  R(ctx, x + 1, y + 5, 6, 1, "#b5643c");
  R(ctx, x, y, 8, 6, "#2c7a44"); // leaves
  R(ctx, x + 1, y, 6, 4, "#3f9d5a");
  R(ctx, x + 2, y, 4, 2, "#5cbf72");
}

export function tower(ctx: Ctx, x: number, y: number) {
  R(ctx, x, y, 10, 20, "#15171c");
  R(ctx, x + 1, y + 1, 8, 18, "#33373f");
  R(ctx, x + 2, y + 2, 6, 3, "#1c1f25");
  R(ctx, x + 2, y + 7, 6, 1, "#5fd2e0"); // rgb strip
  R(ctx, x + 2, y + 9, 6, 1, "#a86fe0");
  R(ctx, x + 2, y + 11, 6, 1, "#5fd2e0");
}

export function chair(ctx: Ctx, x: number, y: number) {
  // top-down swivel chair (~14 x 17)
  const O = "#16181c";
  R(ctx, x + 5, y + 13, 4, 4, "#202329"); // gas post
  R(ctx, x + 2, y + 14, 3, 2, "#2a2e35"); // wheels
  R(ctx, x + 9, y + 14, 3, 2, "#2a2e35");
  R(ctx, x + 3, y, 8, 5, O); // backrest
  R(ctx, x + 4, y + 1, 6, 3, "#3a4049");
  R(ctx, x + 1, y + 5, 12, 9, O); // seat block
  R(ctx, x + 2, y + 6, 10, 7, "#3a4049"); // seat
  R(ctx, x + 3, y + 7, 8, 4, "#49505b"); // cushion hi
  R(ctx, x, y + 6, 2, 6, "#2a2e35"); // arm L
  R(ctx, x + 12, y + 6, 2, 6, "#2a2e35"); // arm R
}

export function deskChair(ctx: Ctx, x: number, y: number, seat: string, seatHi: string) {
  // chair seen from behind/above with a coloured seat (for seated NPCs)
  const O = "#16181c";
  R(ctx, x + 5, y + 13, 4, 4, "#202329");
  R(ctx, x + 2, y + 14, 3, 2, "#2a2e35");
  R(ctx, x + 9, y + 14, 3, 2, "#2a2e35");
  R(ctx, x + 1, y + 4, 12, 11, O);
  R(ctx, x + 2, y + 5, 10, 9, seat);
  R(ctx, x + 3, y + 6, 8, 5, seatHi);
  R(ctx, x, y + 5, 2, 7, "#2a2e35");
  R(ctx, x + 12, y + 5, 2, 7, "#2a2e35");
}

export function plant(ctx: Ctx, x: number, y: number) {
  const ld = "#2c7a44";
  const lf = "#3f9d5a";
  const ll = "#5cbf72";
  // pot
  R(ctx, x + 4, y + 13, 8, 6, "#7a4026"); // outline-ish
  R(ctx, x + 5, y + 13, 6, 6, "#b5643c");
  R(ctx, x + 5, y + 13, 6, 2, "#cb7a4d");
  R(ctx, x + 3, y + 11, 10, 2, "#8f4d2e"); // rim
  R(ctx, x + 4, y + 11, 8, 1, "#a85c38");
  // foliage (monstera-ish)
  R(ctx, x + 5, y + 4, 6, 8, ld); // central mass
  R(ctx, x + 1, y + 5, 6, 6, lf);
  R(ctx, x + 9, y + 5, 6, 6, lf);
  R(ctx, x + 3, y + 1, 5, 6, ll);
  R(ctx, x + 8, y + 1, 5, 6, ll);
  R(ctx, x + 0, y + 8, 4, 4, ld);
  R(ctx, x + 12, y + 8, 4, 4, ld);
  R(ctx, x + 6, y + 2, 1, 9, ld); // veins
  R(ctx, x + 3, y + 5, 1, 4, "#67c97d");
}

export function fiddleLeafFig(ctx: Ctx, x: number, y: number) {
  // 32 × 48 px native (2 × 3 tiles) — fiddle-leaf fig on a wooden roller stand
  const ld = "#243d2e"; const lm = "#2e6b3e"; const lf = "#3d8a52";
  const ll = "#52a366"; const lh = "#68b87c";
  const tD = "#4a2e10"; const tM = "#7a4e2d"; const tL = "#9c6a3d";
  const pO = "#7a8290"; const pB = "#c8cdd2"; const pH = "#dde2e6";
  const pS = "#9aa2aa"; const pR = "#b8c0c8"; const sk = "#2a1c0e";
  const wO = "#3a2a18"; const wM = "#7a4e2a"; const wL = "#9c6a3d";

  // -- foliage --
  // Leaf A: center, upright (tallest)
  R(ctx, x + 10, y +  0, 12, 18, ld);
  R(ctx, x + 11, y +  0, 10, 16, lm);
  R(ctx, x + 12, y +  1,  8, 13, lf);
  R(ctx, x + 13, y +  2,  6,  9, ll);
  R(ctx, x + 15, y +  1,  2, 15, lh);   // midrib
  // Leaf B: left
  R(ctx, x +  1, y +  5, 12, 13, ld);
  R(ctx, x +  2, y +  4, 10, 13, lm);
  R(ctx, x +  3, y +  5,  8, 10, lf);
  R(ctx, x +  4, y +  6,  5,  7, ll);
  R(ctx, x +  6, y +  5,  2, 11, lh);
  // Leaf C: right
  R(ctx, x + 19, y +  5, 12, 13, ld);
  R(ctx, x + 20, y +  4, 10, 13, lm);
  R(ctx, x + 21, y +  5,  8, 10, lf);
  R(ctx, x + 23, y +  6,  5,  7, ll);
  R(ctx, x + 24, y +  5,  2, 11, lh);
  // Leaf D: lower-left
  R(ctx, x +  0, y + 12, 13, 10, ld);
  R(ctx, x +  1, y + 11, 11, 10, lm);
  R(ctx, x +  2, y + 12,  8,  7, lf);
  R(ctx, x +  3, y + 13,  5,  5, ll);
  R(ctx, x +  4, y + 12,  2,  9, lh);
  // Leaf E: lower-right
  R(ctx, x + 19, y + 12, 13, 10, ld);
  R(ctx, x + 20, y + 11, 11, 10, lm);
  R(ctx, x + 22, y + 12,  8,  7, lf);
  R(ctx, x + 24, y + 13,  5,  5, ll);
  R(ctx, x + 26, y + 12,  2,  9, lh);

  // -- trunk --
  R(ctx, x + 13, y +  7,  6, 15, tD);
  R(ctx, x + 14, y +  7,  4, 14, tM);
  R(ctx, x + 14, y +  7,  2, 14, tL);

  // -- pot rim --
  R(ctx, x +  5, y + 21, 22,  4, pO);
  R(ctx, x +  6, y + 21, 20,  3, pR);
  R(ctx, x +  6, y + 21, 20,  1, pH);

  // -- pot body --
  R(ctx, x +  6, y + 24, 20, 13, pO);
  R(ctx, x +  7, y + 24, 18, 12, pB);
  R(ctx, x +  7, y + 24,  5, 12, pH);   // left hi
  R(ctx, x + 21, y + 24,  3, 12, pS);   // right shadow
  R(ctx, x +  7, y + 24, 18,  3, sk);   // soil
  R(ctx, x +  9, y + 25,  6,  1, "#3e2b16");

  // -- wooden stand ring --
  R(ctx, x +  4, y + 36, 24,  4, wO);
  R(ctx, x +  5, y + 36, 22,  3, wM);
  R(ctx, x +  5, y + 36, 22,  1, wL);
  // center/back leg (hidden behind pot)
  R(ctx, x + 13, y + 36,  6,  6, wO);
  R(ctx, x + 14, y + 36,  4,  5, wM);
  // left leg + wheel
  R(ctx, x +  5, y + 39,  6,  6, wO);
  R(ctx, x +  6, y + 39,  5,  5, wM);
  R(ctx, x +  6, y + 39,  2,  5, wL);
  R(ctx, x +  3, y + 44,  8,  4, wO);
  R(ctx, x +  4, y + 44,  6,  3, wM);
  R(ctx, x +  4, y + 44,  2,  1, wL);
  // right leg + wheel
  R(ctx, x + 21, y + 39,  6,  6, wO);
  R(ctx, x + 22, y + 39,  5,  5, wM);
  R(ctx, x + 23, y + 39,  2,  5, wL);
  R(ctx, x + 21, y + 44,  8,  4, wO);
  R(ctx, x + 22, y + 44,  6,  3, wM);
  R(ctx, x + 25, y + 44,  2,  1, wL);
}

export function bookshelf(ctx: Ctx, x: number, y: number, w: number, h: number) {
  R(ctx, x, y, w, h, "#3a2a18"); // frame outline
  R(ctx, x + 1, y + 1, w - 2, 2, "#a96b3a"); // top molding
  const spineColors = ["#c0533f", "#3f7fc0", "#caa64a", "#4caf6a", "#9b5bbf", "#d98445", "#5aa0b8"];
  const shelves = Math.max(2, Math.floor((h - 4) / 11));
  for (let s = 0; s < shelves; s++) {
    const sy = y + 3 + s * 11;
    R(ctx, x + 1, sy, w - 2, 10, "#2b2018"); // shelf cavity
    let bx = x + 2;
    let i = s * 3;
    while (bx < x + w - 3) {
      const bw = 3 + det(bx, sy, 3);
      const bh = 8 - det(bx + 1, sy, 2);
      R(ctx, bx, sy + (9 - bh), bw, bh, spineColors[i % spineColors.length]);
      R(ctx, bx, sy + (9 - bh), bw, 1, "rgba(255,255,255,0.25)");
      bx += bw + 1;
      i++;
    }
    R(ctx, x + 1, sy + 10, w - 2, 1, "#5a3c20"); // shelf board
  }
}

export function framedPicture(ctx: Ctx, x: number, y: number) {
  R(ctx, x, y, 18, 16, "#2a2d34");
  R(ctx, x + 2, y + 2, 14, 12, "#eef1f4");
  // bar chart
  R(ctx, x + 4, y + 9, 2, 4, "#4f7bd1");
  R(ctx, x + 7, y + 6, 2, 7, "#4caf6a");
  R(ctx, x + 10, y + 4, 2, 9, "#e0a93f");
  R(ctx, x + 13, y + 7, 2, 6, "#c0533f");
}

export function floorLamp(ctx: Ctx, x: number, y: number) {
  R(ctx, x + 4, y + 22, 8, 4, "#202329"); // base
  R(ctx, x + 5, y + 23, 6, 1, "#3a3f47");
  R(ctx, x + 7, y + 6, 2, 17, "#33373f"); // pole
  // three lamp heads
  R(ctx, x + 1, y + 3, 14, 2, "#202329");
  for (const bx of [1, 7, 13]) {
    R(ctx, x + bx - 1, y, 4, 4, "#2a2e35");
    R(ctx, x + bx, y + 1, 2, 2, "#f6e8a0");
  }
  R(ctx, x + 5, y + 3, 6, 2, "#2a2e35");
}

export function whiteboard(ctx: Ctx, x: number, y: number, w: number, h: number) {
  R(ctx, x, y, w, h, "#aeb3ba"); // frame
  R(ctx, x + 2, y + 2, w - 4, h - 5, "#f7f8fa"); // surface
  R(ctx, x + (w >> 1) - 6, y + h - 3, 12, 2, "#8a909a"); // tray
  // notes
  R(ctx, x + 5, y + 6, w - 26, 1, "#5a6470");
  R(ctx, x + 5, y + 9, w - 30, 1, "#5a6470");
  R(ctx, x + 5, y + 12, w - 22, 1, "#5a6470");
  R(ctx, x + 5, y + 16, 8, 6, "#7fcdd8"); // chart box
  // red trend arrow
  R(ctx, x + w - 22, y + h - 8, 16, 2, "#d04a3a");
  R(ctx, x + w - 9, y + 6, 2, 12, "#d04a3a");
  R(ctx, x + w - 13, y + 5, 8, 2, "#d04a3a");
}

export function easel(ctx: Ctx, x: number, y: number, w: number, h: number) {
  // legs
  R(ctx, x + 2, y + 4, 2, h - 2, "#5a4327");
  R(ctx, x + w - 4, y + 4, 2, h - 2, "#5a4327");
  R(ctx, x + (w >> 1) - 1, y + h - 14, 2, 12, "#6b5034");
  // pad
  R(ctx, x, y, w - 1, h - 12, "#3a3f47");
  R(ctx, x + 2, y + 2, w - 5, h - 16, "#f4f5f7");
  // line chart
  R(ctx, x + 4, y + h - 18, w - 9, 1, "#9aa3ad");
  R(ctx, x + 4, y + 4, 1, h - 22, "#9aa3ad");
  R(ctx, x + 5, y + 12, 3, 1, "#4caf6a");
  R(ctx, x + 8, y + 9, 3, 1, "#4caf6a");
  R(ctx, x + 11, y + 11, 3, 1, "#4caf6a");
  R(ctx, x + 14, y + 6, 3, 1, "#4caf6a");
}

export function openBook(ctx: Ctx, x: number, y: number) {
  R(ctx, x, y + 3, 9, 9, "#a4842f");
  R(ctx, x + 9, y + 3, 9, 9, "#b8923c");
  R(ctx, x + 1, y + 4, 7, 7, "#f4efe0");
  R(ctx, x + 10, y + 4, 7, 7, "#efe9d6");
  R(ctx, x + 8, y + 3, 2, 9, "#8a6f2c");
  for (let i = 0; i < 3; i++) {
    R(ctx, x + 2, y + 5 + i * 2, 5, 1, "#b3a38a");
    R(ctx, x + 11, y + 5 + i * 2, 5, 1, "#b3a38a");
  }
}

export function tv(ctx: Ctx, x: number, y: number) {
  R(ctx, x + 4, y + 14, 12, 3, "#202329"); // console
  R(ctx, x + 6, y + 13, 8, 2, "#33373f");
  R(ctx, x, y, 20, 14, "#15171c"); // bezel
  R(ctx, x + 2, y + 2, 16, 10, "#2bd1c4"); // screen
  R(ctx, x + 3, y + 3, 9, 3, "rgba(255,255,255,0.45)");
  R(ctx, x + 3, y + 7, 6, 2, "rgba(255,255,255,0.22)");
}

export function roundTable(ctx: Ctx, cx: number, cy: number, rad: number) {
  for (let yy = -rad; yy <= rad; yy++) {
    const sp = Math.floor(Math.sqrt(rad * rad - yy * yy));
    R(ctx, cx - sp, cy + yy, sp * 2, 1, "#4f555f"); // rim/outline
  }
  for (let yy = -rad + 2; yy <= rad - 2; yy++) {
    const sp = Math.floor(Math.sqrt((rad - 2) * (rad - 2) - yy * yy));
    R(ctx, cx - sp, cy + yy, sp * 2, 1, "#8a9099"); // surface
  }
  R(ctx, cx - rad + 4, cy - rad + 5, rad - 2, Math.floor(rad / 2), "rgba(255,255,255,0.16)");
}

// white oval coffee/meeting table
export function ovalTable(ctx: Ctx, cx: number, cy: number, rx: number, ry: number) {
  for (let yy = -ry; yy <= ry; yy++) {
    const sp = Math.floor(rx * Math.sqrt(Math.max(0, 1 - (yy * yy) / (ry * ry))));
    R(ctx, cx - sp, cy + yy, sp * 2, 1, "#c4c9d0"); // rim
  }
  for (let yy = -ry + 2; yy <= ry - 2; yy++) {
    const rry = ry - 2;
    const rrx = rx - 3;
    const sp = Math.floor(rrx * Math.sqrt(Math.max(0, 1 - (yy * yy) / (rry * rry))));
    R(ctx, cx - sp, cy + yy, sp * 2, 1, "#eef1f4"); // top
  }
  R(ctx, cx - rx + 6, cy - ry + 4, rx, Math.floor(ry / 2), "rgba(255,255,255,0.4)");
}

// blue 3-seat sofa (top-down, backrest at the top)
export function sofa(ctx: Ctx, x: number, y: number, w: number) {
  const O = "#20406a";
  const base = "#3f6fb0";
  const cush = "#4f7fc0";
  const hi = "#6f9bd8";
  R(ctx, x + 2, y + 22, w - 2, 2, "rgba(0,0,0,0.18)"); // shadow
  R(ctx, x, y, w, 9, O); // backrest
  R(ctx, x + 1, y + 1, w - 2, 7, base);
  R(ctx, x + 1, y + 1, w - 2, 2, hi);
  R(ctx, x, y + 7, w, 15, O); // seat block
  R(ctx, x + 4, y + 9, w - 8, 11, cush); // seat cushions
  // cushion divisions
  for (let cxn = x + 4 + Math.floor((w - 8) / 3); cxn < x + w - 5; cxn += Math.floor((w - 8) / 3))
    R(ctx, cxn, y + 9, 1, 11, O);
  R(ctx, x + 4, y + 9, w - 8, 2, hi);
  R(ctx, x, y + 5, 5, 17, base); // arm L
  R(ctx, x + w - 5, y + 5, 5, 17, base); // arm R
  R(ctx, x + 1, y + 6, 3, 2, hi);
  R(ctx, x + w - 4, y + 6, 3, 2, hi);
}

// white display cabinet with glass shelves, colour items, plant on top
// a tapered leaf blade from a wide base to a 1px tip
function leaf(ctx: Ctx, x0: number, y0: number, x1: number, y1: number, baseW: number, col: string, hi: string) {
  const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const px = Math.round(x0 + (x1 - x0) * t);
    const py = Math.round(y0 + (y1 - y0) * t);
    const ww = Math.max(1, Math.round(baseW * (1 - t * 0.85)));
    R(ctx, px - (ww >> 1), py, ww, 1, col);
    if (ww >= 2 && t < 0.75) R(ctx, px - (ww >> 1), py, 1, 1, hi); // midrib hint
  }
}

// spiky aloe in a banded grey pot (sits on top of the cabinet)
function aloePlant(ctx: Ctx, x: number, y: number) {
  const ld = "#2f7a44";
  const lf = "#3f9d5a";
  const ll = "#5cbf72";
  // pot — tapered, with horizontal bands + dark soil
  R(ctx, x + 5, y + 21, 13, 13, "#6f7780"); // body outline
  R(ctx, x + 6, y + 21, 11, 12, "#8b939c");
  R(ctx, x + 6, y + 21, 11, 2, "#a6aeb6"); // rim
  R(ctx, x + 7, y + 25, 9, 1, "#a6aeb6"); // band
  R(ctx, x + 8, y + 29, 7, 1, "#a6aeb6"); // band
  R(ctx, x + 7, y + 19, 9, 3, "#3a2a1a"); // soil
  // leaves — fanned, pointed
  leaf(ctx, x + 11, y + 20, x + 11, y - 1, 6, lf, ll); // center
  leaf(ctx, x + 10, y + 20, x + 3, y + 3, 5, ld, lf); // upper-left
  leaf(ctx, x + 12, y + 20, x + 19, y + 3, 5, ld, lf); // upper-right
  leaf(ctx, x + 9, y + 21, x + 1, y + 12, 4, lf, ll); // left
  leaf(ctx, x + 13, y + 21, x + 21, y + 12, 4, lf, ll); // right
  leaf(ctx, x + 11, y + 20, x + 7, y + 1, 4, ll, ll); // inner-left
  leaf(ctx, x + 11, y + 20, x + 15, y + 1, 4, ll, ll); // inner-right
}

// white display cabinet matched to reference: white top, silver frame,
// four shelves of multicolour book spines, aloe plant on top
const BOOK_SPINES = [
  "#c2a079", "#b08f63", "#5e8db0", "#6f9ec0", "#8c949d",
  "#9aa2ab", "#d56b5c", "#c55a4d", "#dce2e7", "#5a6470",
];
export function whiteCabinet(ctx: Ctx, x: number, y: number, w: number, h: number) {
  const O = "#6f7780";
  const frame = "#aeb7bf";
  const frameHi = "#c8cfd5";
  const frameSh = "#8b949d";
  const topCol = "#e9ecef";
  const recess = "#9aa2ab";

  R(ctx, x + 3, y + h - 1, w - 4, 2, "rgba(0,0,0,0.16)"); // ground shadow

  // white top surface (the cabinet top seen at the 2.5-D angle)
  const topH = 11;
  R(ctx, x, y, w, topH + 2, O);
  R(ctx, x + 1, y + 1, w - 2, topH, topCol);
  R(ctx, x + 1, y + 1, w - 2, 2, "#f5f7f8");
  R(ctx, x + 1, y + topH - 1, w - 2, 2, "#d4d9dd"); // front lip

  // body frame
  const bodyY = y + topH + 2;
  const bodyH = h - topH - 2;
  R(ctx, x, bodyY, w, bodyH, O);
  R(ctx, x + 1, bodyY, w - 2, bodyH - 1, frame);
  R(ctx, x + 2, bodyY, 2, bodyH - 1, frameHi); // left edge highlight
  R(ctx, x + w - 3, bodyY, 2, bodyH - 1, frameSh); // right edge shadow

  // four shelves of books
  const shelves = 4;
  const side = 4;
  const gap = 3;
  const innerX = x + side;
  const innerW = w - side * 2;
  const shelfH = Math.floor((bodyH - gap * (shelves + 1)) / shelves);
  for (let s = 0; s < shelves; s++) {
    const sy = bodyY + gap + s * (shelfH + gap);
    R(ctx, innerX, sy, innerW, shelfH, recess); // recessed backing
    R(ctx, innerX, sy, innerW, 1, frameSh); // inner top shadow
    // book spines
    let bx = innerX + 1;
    while (bx < innerX + innerW - 1) {
      const bw = 3 + det(bx, sy + s, 3); // 3–5 px
      if (bx + bw > innerX + innerW - 1) {
        R(ctx, bx, sy + 1, innerX + innerW - 1 - bx, shelfH - 1, BOOK_SPINES[det(bx, sy, 10)]);
        break;
      }
      const shrink = det(bx + 1, sy, 4) === 0 ? 2 : 0; // a few shorter books
      const bh = shelfH - 1 - shrink;
      const col = BOOK_SPINES[det(bx, sy + s * 3, BOOK_SPINES.length)];
      R(ctx, bx, sy + (shelfH - bh), bw, bh, col);
      R(ctx, bx, sy + (shelfH - bh), bw, 1, "rgba(255,255,255,0.28)"); // top sheen
      R(ctx, bx, sy + (shelfH - bh), 1, bh, "rgba(255,255,255,0.20)"); // left sheen
      R(ctx, bx + bw, sy + (shelfH - bh), 1, bh, "rgba(0,0,0,0.18)"); // gap shadow
      bx += bw + 1;
    }
    // shelf rail
    R(ctx, x + 2, sy + shelfH, w - 4, gap, frameHi);
    R(ctx, x + 2, sy + shelfH + gap - 1, w - 4, 1, frameSh);
  }

  // aloe plant on the top surface (left of centre, like the reference)
  aloePlant(ctx, x + Math.round(w * 0.16), y - 23);
}

// small green locker / door cabinet
export function locker(ctx: Ctx, x: number, y: number) {
  R(ctx, x, y, 16, 26, "#1f3a2a");
  R(ctx, x + 1, y + 1, 14, 24, "#3f8a5c"); // door
  R(ctx, x + 1, y + 1, 14, 2, "#56a974");
  R(ctx, x + 7, y + 1, 1, 24, "#2c6644"); // seam
  R(ctx, x + 4, y + 12, 2, 4, "#dfe6d8"); // handle
  R(ctx, x + 10, y + 12, 2, 4, "#dfe6d8");
}

// blue gaming chair (top-down, tall back + headrest)
export function gamingChair(ctx: Ctx, x: number, y: number) {
  const O = "#13161c";
  R(ctx, x + 5, y + 16, 4, 4, "#202329"); // post
  R(ctx, x + 2, y + 17, 3, 2, "#2a2e35");
  R(ctx, x + 9, y + 17, 3, 2, "#2a2e35");
  R(ctx, x + 3, y, 8, 7, O); // headrest+back
  R(ctx, x + 4, y + 1, 6, 5, "#3f6fb0");
  R(ctx, x + 4, y + 1, 6, 2, "#5b8ed0"); // stripe
  R(ctx, x + 1, y + 6, 12, 10, O); // seat
  R(ctx, x + 2, y + 7, 10, 8, "#2a2e35");
  R(ctx, x + 3, y + 8, 8, 5, "#3f6fb0");
  R(ctx, x, y + 7, 2, 7, "#3f6fb0"); // arms
  R(ctx, x + 12, y + 7, 2, 7, "#3f6fb0");
}

export function tubChair(
  ctx: Ctx,
  x: number,
  y: number,
  facing: "up" | "down" | "left" | "right"
) {
  const O = "#1d6b66";
  const base = "#3fb6b0";
  const hi = "#5fcfc8";
  R(ctx, x, y, 16, 16, O); // outline body
  R(ctx, x + 1, y + 1, 14, 14, base);
  R(ctx, x + 3, y + 3, 10, 10, hi); // cushion
  R(ctx, x + 4, y + 4, 8, 4, "#74dad3"); // cushion hi
  // thick backrest on the far side
  if (facing === "down") R(ctx, x, y, 16, 5, O), R(ctx, x + 1, y + 1, 14, 3, base);
  if (facing === "up") R(ctx, x, y + 11, 16, 5, O), R(ctx, x + 1, y + 12, 14, 3, base);
  if (facing === "left") R(ctx, x, y, 5, 16, O), R(ctx, x + 1, y + 1, 3, 14, base);
  if (facing === "right") R(ctx, x + 11, y, 5, 16, O), R(ctx, x + 12, y + 1, 3, 14, base);
}

export function loungeChair(
  ctx: Ctx,
  x: number,
  y: number,
  facing: "left" | "right"
) {
  // blue meeting-room armchair
  const O = "#2c5a86";
  const base = "#5b9bd5";
  const hi = "#7fb4e0";
  R(ctx, x, y, 16, 16, O);
  R(ctx, x + 1, y + 1, 14, 14, base);
  R(ctx, x + 3, y + 3, 10, 10, hi);
  R(ctx, x + 4, y + 4, 8, 4, "#9cc6ea");
  if (facing === "left") R(ctx, x, y, 5, 16, O), R(ctx, x + 1, y + 1, 3, 14, base);
  else R(ctx, x + 11, y, 5, 16, O), R(ctx, x + 12, y + 1, 3, 14, base);
}

export function tree(ctx: Ctx, x: number, y: number, size: number) {
  // size = canopy diameter in px; trunk below
  const cx = x + size / 2;
  const trunkW = Math.max(6, size * 0.18);
  const trunkH = size * 0.55;
  const ty = y + size - 4;
  // ground shadow
  R(ctx, cx - size * 0.32, ty + trunkH - 2, size * 0.64, 3, "rgba(0,0,0,0.18)");
  // trunk
  R(ctx, cx - trunkW / 2 - 1, ty, trunkW + 2, trunkH, "#4a3826");
  R(ctx, cx - trunkW / 2, ty, trunkW, trunkH, "#6b5034");
  R(ctx, cx - trunkW / 2, ty, Math.max(2, trunkW * 0.35), trunkH, "#7d6243"); // hi side
  R(ctx, cx - trunkW / 2 + 2, ty + 4, 1, trunkH - 8, "#4a3826"); // bark line
  // canopy — layered blobs
  const blob = (bx: number, by: number, d: number, col: string) =>
    fillCircle(ctx, cx + bx, y + size / 2 + by, d / 2, col);
  blob(0, 4, size * 1.02, "#266b3a"); // dark base
  blob(-size * 0.22, 0, size * 0.6, "#2f7a44");
  blob(size * 0.22, 0, size * 0.6, "#2f7a44");
  blob(0, -size * 0.14, size * 0.72, "#3f9d5a"); // mid
  blob(-size * 0.16, -size * 0.18, size * 0.42, "#54b86c"); // light
  blob(size * 0.12, -size * 0.06, size * 0.36, "#54b86c");
  blob(-size * 0.05, -size * 0.26, size * 0.22, "#67c97d"); // hi-light
}

export function stump(ctx: Ctx, x: number, y: number) {
  R(ctx, x, y + 6, 18, 8, "#4a3826");
  R(ctx, x + 1, y + 6, 16, 6, "#6b5034");
  R(ctx, x + 1, y + 2, 16, 6, "#7d6243"); // top
  R(ctx, x + 2, y + 2, 14, 5, "#8a6e4a");
  R(ctx, x + 6, y + 3, 6, 3, "#6b5034"); // rings
  R(ctx, x + 8, y + 4, 2, 1, "#4a3826");
}

// Small decorative ground bush — 2×2 tiles (32×32 native px)
export function bush(ctx: Ctx, x: number, y: number) {
  const ld = "#1e5530";
  const lm = "#2e7a46";
  const lf = "#42a05e";
  const ll = "#5abf72";
  R(ctx, x + 3, y + 22, 24, 3, "rgba(0,0,0,0.18)");
  fillCircle(ctx, x + 7,  y + 17, 7, ld);
  fillCircle(ctx, x + 15, y + 15, 8, ld);
  fillCircle(ctx, x + 23, y + 17, 7, ld);
  fillCircle(ctx, x + 7,  y + 14, 7, lm);
  fillCircle(ctx, x + 15, y + 12, 8, lm);
  fillCircle(ctx, x + 23, y + 14, 7, lm);
  fillCircle(ctx, x + 10, y + 10, 8, lf);
  fillCircle(ctx, x + 20, y + 10, 7, lf);
  fillCircle(ctx, x + 10, y + 8,  4, ll);
  fillCircle(ctx, x + 20, y + 8,  4, ll);
}

// Large round tree — dark teal canopy, brown trunk, snow base — 5×6 tiles (80×96 px)
export function treeRound(ctx: Ctx, x: number, y: number) {
  const cx = x + 38;
  const cy = y + 34;
  const r  = 32;
  const ty = cy + r - 4;   // trunk top ≈ y+62
  const trunkW = 14;
  const trunkH = 28;
  R(ctx, cx - 22, ty + trunkH, 44, 4, "rgba(0,0,0,0.18)");
  // snow base
  R(ctx, cx - 18, ty + trunkH - 4, 36, 10, "#a8b8c0");
  R(ctx, cx - 15, ty + trunkH - 2, 30,  8, "#c8d8e0");
  R(ctx, cx - 12, ty + trunkH,     24,  4, "#dce8ed");
  // trunk
  R(ctx, cx - trunkW / 2 - 1, ty, trunkW + 2, trunkH, "#3a2a18");
  R(ctx, cx - trunkW / 2,     ty, trunkW,     trunkH, "#6b5034");
  R(ctx, cx - trunkW / 2,     ty, 4,          trunkH, "#7d6243");
  R(ctx, cx - trunkW / 2 + 4, ty + 4,  1, trunkH - 8,  "#4a3826");
  R(ctx, cx - trunkW / 2 + 8, ty + 7,  1, trunkH - 12, "#4a3826");
  // canopy — layered dark-teal blobs
  fillCircle(ctx, cx,     cy + 4,  r,      "#183c38");
  fillCircle(ctx, cx - 9, cy,      r - 4,  "#224e48");
  fillCircle(ctx, cx + 9, cy,      r - 4,  "#224e48");
  fillCircle(ctx, cx,     cy - 8,  r - 2,  "#2c6458");
  fillCircle(ctx, cx - 6, cy - 12, r - 8,  "#3a7a6c");
  fillCircle(ctx, cx + 4, cy - 10, r - 14, "#3a7a6c");
  fillCircle(ctx, cx - 2, cy - 16, r - 20, "#4a9080");
}

// 4-ball cluster tree — gray trunk, light-green spheres — 5×7 tiles (80×112 px)
export function treeCluster(ctx: Ctx, x: number, y: number) {
  const cx = x + 40;
  const baseY = y + 100;
  const trunkW = 12;
  const trunkH = 28;
  const ty = baseY - trunkH;   // trunk top ≈ y+72
  const bR = 19;
  R(ctx, cx - 24, baseY + 3, 48, 4, "rgba(0,0,0,0.18)");
  // moss base ring
  R(ctx, cx - 18, baseY - 4, 36, 9, "#2c5028");
  R(ctx, cx - 15, baseY - 2, 30, 7, "#3a6634");
  R(ctx, cx - 12, baseY,     24, 3, "#4a8042");
  // trunk — gray/silver
  R(ctx, cx - trunkW / 2 - 1, ty, trunkW + 2, trunkH, "#464d55");
  R(ctx, cx - trunkW / 2,     ty, trunkW,     trunkH, "#6b7280");
  R(ctx, cx - trunkW / 2,     ty, 3,          trunkH, "#8b949e");
  R(ctx, cx - trunkW / 2 + 4, ty + 6,  1, trunkH - 10, "#464d55");
  R(ctx, cx - 4, ty + 12, 8, 3, "#464d55");
  R(ctx, cx - 3, ty + 13, 6, 2, "#5a6370");
  R(ctx, cx - 3, ty + 22, 6, 2, "#464d55");
  // four leaf balls
  const ball = (bx: number, by: number) => {
    fillCircle(ctx, bx,     by + 4,  bR,      "#3a7030");
    fillCircle(ctx, bx - 2, by,      bR - 2,  "#52904a");
    fillCircle(ctx, bx - 3, by - 4,  bR - 6,  "#6aaa60");
    fillCircle(ctx, bx - 4, by - 7,  bR - 12, "#82c478");
  };
  ball(cx - 16, ty + 6);   // back-left
  ball(cx + 16, ty + 6);   // back-right
  ball(cx - 12, ty + 20);  // front-left
  ball(cx + 12, ty + 20);  // front-right
}

// Conifer / pine tree — layered tiers, dark teal, snow base — 4×6 tiles (64×96 px)
export function treePine(ctx: Ctx, x: number, y: number) {
  const cx = x + 30;
  const baseY = y + 88;
  const trunkW = 10;
  const trunkH = 16;
  const ty = baseY - trunkH;   // trunk top ≈ y+72
  R(ctx, cx - 18, baseY + 3, 36, 4, "rgba(0,0,0,0.18)");
  // snow base
  R(ctx, cx - 16, baseY - 4, 32, 9, "#a8b8c0");
  R(ctx, cx - 14, baseY - 2, 28, 7, "#c8d8e0");
  R(ctx, cx - 11, baseY,     22, 3, "#dce8ed");
  // trunk
  R(ctx, cx - trunkW / 2 - 1, ty, trunkW + 2, trunkH, "#3a2a18");
  R(ctx, cx - trunkW / 2,     ty, trunkW,     trunkH, "#6b5034");
  R(ctx, cx - trunkW / 2,     ty, 3,          trunkH, "#7d6243");
  // layered tiers [half-width, topY, height]
  const dk = "#183830";
  const md = "#22503c";
  const lt = "#2e6a4e";
  const hi = "#3c7e60";
  const tiers: Array<[number, number, number]> = [
    [24, ty - 16, 16],
    [19, ty - 29, 13],
    [15, ty - 40, 11],
    [11, ty - 49,  9],
    [ 7, ty - 57,  8],
    [ 4, ty - 63,  6],
    [ 2, ty - 67,  4],
  ];
  for (const [hw, top, h] of tiers) {
    R(ctx, cx - hw,     top, hw * 2,     h,     dk);
    R(ctx, cx - hw + 2, top, hw * 2 - 4, h - 2, md);
    R(ctx, cx - hw + 3, top, hw * 2 - 6, 3,     lt);
    if (hw > 3) R(ctx, cx - hw + 4, top + 1, hw * 2 - 8, 1, hi);
    R(ctx, cx - hw,     top + 2, 2, h - 3, dk);
    R(ctx, cx + hw - 2, top + 2, 2, h - 3, dk);
  }
}

// Long conference table with drawer pedestals on each end.
// Viewed from the 2.5-D top-front angle that matches the reference image:
//   – wide flat top surface in warm terracotta/salmon
//   – a darker front-face lip underneath
//   – a pair of squat drawer units below-left and below-right
//   – dark wood outline + 3-tone shading throughout
// w × h are the pixel dimensions of the full bounding box.
export function longTable(ctx: Ctx, x: number, y: number, w: number, h: number) {
  const outlineCol  = "#3a2218";   // dark outline / shadow edge
  const frontCol    = "#8c5034";   // front face of table + pedestal fronts
  const frontHi     = "#a86040";   // front face highlight stripe
  const topCol      = "#c47856";   // tabletop surface (salmon-terracotta)
  const topHi       = "#d48e6a";   // tabletop highlight strip at back
  const topLo       = "#b06848";   // tabletop shadow near front lip
  const pedestalCol = "#7a4028";   // drawer pedestal body
  const drawerFace  = "#9c5838";   // drawer front faces
  const drawerHi    = "#b06848";   // drawer highlight strip
  const drawerLo    = "#6b3420";   // drawer shadow at bottom
  const handleCol   = "#c8a060";   // small brass-ish handle dots
  const shadowCol   = "rgba(0,0,0,0.18)";

  // --- layout constants ---
  const topH     = Math.round(h * 0.55);   // tabletop block height (visible surface + lip)
  const surfaceH = Math.round(topH * 0.62); // how much is the flat top surface
  const lipH     = topH - surfaceH;         // front-lip band
  const pedW     = Math.round(w * 0.20);    // pedestal width (each side)
  const pedH     = h - topH;                // pedestal height below table
  const pedY     = y + topH;                // top of pedestals

  // ground shadow
  R(ctx, x + 4, y + h + 1, w - 6, 3, shadowCol);

  // ── tabletop ──────────────────────────────────────────────────────────
  // full outline block
  R(ctx, x, y, w, topH, outlineCol);
  // flat top surface (lighter, seen from above)
  R(ctx, x + 1, y + 1, w - 2, surfaceH - 1, topCol);
  // highlight row at very back of top surface
  R(ctx, x + 1, y + 1, w - 2, 2, topHi);
  // gentle wood-grain streaks across the top
  for (let gx = x + 10; gx < x + w - 8; gx += 18) {
    R(ctx, gx, y + 3, 12, 1, topLo);
  }
  // front-lip shading (darker band = the "thickness" of the table edge)
  R(ctx, x + 1, y + surfaceH, w - 2, lipH - 1, frontCol);
  R(ctx, x + 1, y + surfaceH, w - 2, 1,         frontHi);  // top of lip
  R(ctx, x + 1, y + topH - 2, w - 2, 1,         outlineCol); // bottom seam of lip

  // ── left drawer pedestal ──────────────────────────────────────────────
  const lx = x + 1;
  // pedestal body outline
  R(ctx, lx, pedY, pedW, pedH, outlineCol);
  // pedestal front face
  R(ctx, lx + 1, pedY + 1, pedW - 2, pedH - 1, pedestalCol);

  // two drawers in the left pedestal
  const dh = Math.round((pedH - 3) / 2);   // each drawer's height
  for (let d = 0; d < 2; d++) {
    const dy = pedY + 1 + d * (dh + 1);
    R(ctx, lx + 1, dy,      pedW - 2, dh,    outlineCol);   // drawer outline
    R(ctx, lx + 2, dy + 1,  pedW - 4, dh - 2, drawerFace);  // drawer face
    R(ctx, lx + 2, dy + 1,  pedW - 4, 1,      drawerHi);    // top edge hi
    R(ctx, lx + 2, dy + dh - 2, pedW - 4, 1,  drawerLo);    // bottom shadow
    // small centred handle
    const hx = lx + 2 + Math.round((pedW - 6) / 2);
    R(ctx, hx, dy + Math.round(dh / 2) - 1, 4, 2, handleCol);
    R(ctx, hx, dy + Math.round(dh / 2) - 1, 4, 1, "#d4b880");  // handle hi
  }

  // ── right drawer pedestal ─────────────────────────────────────────────
  const rx = x + w - pedW - 1;
  R(ctx, rx, pedY, pedW, pedH, outlineCol);
  R(ctx, rx + 1, pedY + 1, pedW - 2, pedH - 1, pedestalCol);
  for (let d = 0; d < 2; d++) {
    const dy = pedY + 1 + d * (dh + 1);
    R(ctx, rx + 1, dy,      pedW - 2, dh,       outlineCol);
    R(ctx, rx + 2, dy + 1,  pedW - 4, dh - 2,   drawerFace);
    R(ctx, rx + 2, dy + 1,  pedW - 4, 1,         drawerHi);
    R(ctx, rx + 2, dy + dh - 2, pedW - 4, 1,     drawerLo);
    const hx = rx + 2 + Math.round((pedW - 6) / 2);
    R(ctx, hx, dy + Math.round(dh / 2) - 1, 4, 2, handleCol);
    R(ctx, hx, dy + Math.round(dh / 2) - 1, 4, 1, "#d4b880");
  }

  // ── gap between pedestals (recessed underside, shows table thickness) ─
  const gapX = lx + pedW;
  const gapW = rx - gapX;
  if (gapW > 0) {
    R(ctx, gapX, pedY, gapW, pedH, outlineCol);                 // dark recess
    R(ctx, gapX + 1, pedY + 1, gapW - 2, pedH - 2, frontCol);  // subtle front colour
  }
}

function fillCircle(ctx: Ctx, cx: number, cy: number, rad: number, col: string) {
  const rr = Math.round(rad);
  for (let yy = -rr; yy <= rr; yy++) {
    const sp = Math.floor(Math.sqrt(Math.max(0, rr * rr - yy * yy)));
    R(ctx, cx - sp, cy + yy, sp * 2, 1, col);
  }
}

// ------------------------------------------------------------------ //
//  Characters
// ------------------------------------------------------------------ //
export type Skin = { hair: string; hairHi: string; shirt: string; shirtHi: string; skin: string };

export function person(
  ctx: Ctx,
  cx: number, // centre x (native px)
  footY: number, // bottom of feet
  s: Skin,
  facing: "down" | "up" | "left" | "right",
  step: number // 0=idle, 1=left-contact, 2=mid-swing, 3=right-contact
) {
  const O = "#161114";
  const leftLead  = step === 1;
  const rightLead = step === 3;
  // body rises 1px on mid-swing (airborne phase)
  const bob = step === 2 ? -1 : 0;

  ctx.save();
  ctx.translate(Math.round(cx), Math.round(footY));
  ctx.scale(2.4, 2.4);
  const x = -6; // sprite is 12 wide, centred on cx
  const y = -20 + bob;

  // shadow (stays at foot level; compensate so it doesn't bob)
  R(ctx, x + 1, y + 19 - bob, 10, 2, "rgba(0,0,0,0.22)");

  // legs
  if (facing === "left" || facing === "right") {
    // side view — front leg and back leg with depth separation
    // front leg is lighter, back leg is darker to simulate depth
    const frontLead = facing === "right" ? leftLead : rightLead;
    const backLead  = facing === "right" ? rightLead : leftLead;
    // back leg (darker, drawn first so front leg overlaps)
    const backH  = backLead  ? 6 : frontLead ? 3 : 4;
    const backOY = backLead  ? 0 : frontLead ? 1 : 0; // raised when trailing
    R(ctx, x + 5, y + 15 + backOY, 3, backH, "#1e2229");
    // shoe for back leg — extends slightly backward
    if (facing === "right") R(ctx, x + 3, y + 14 + backOY + backH, 4, 1, "#1e2229");
    else                    R(ctx, x + 5, y + 14 + backOY + backH, 4, 1, "#1e2229");
    // front leg (lighter)
    const frontH  = frontLead ? 6 : backLead ? 3 : 4;
    const frontOY = frontLead ? 0 : backLead ? 1 : 0;
    R(ctx, x + 3, y + 15 + frontOY, 3, frontH, "#2b2f37");
    // shoe for front leg — extends in direction of travel
    if (facing === "right") R(ctx, x + 4, y + 14 + frontOY + frontH, 4, 1, O);
    else                    R(ctx, x + 2, y + 14 + frontOY + frontH, 4, 1, O);
  } else if (facing === "down") {
    // front view: legs spread + heel-lift on trailing foot
    const lLead = leftLead;
    const rLead = rightLead;
    const lx = lLead ? 1 : rLead ? 3 : 2;
    const rx = rLead ? 8 : lLead ? 6 : 7;
    // trailing leg is shorter (heel lifted)
    const lH = lLead ? 5 : rLead ? 3 : 4;
    const rH = rLead ? 5 : lLead ? 3 : 4;
    R(ctx, x + lx, y + 15, 3, lH, "#2b2f37");
    R(ctx, x + rx, y + 15, 3, rH, "#2b2f37");
    // shoes — wider on planted foot
    R(ctx, x + lx - (lLead ? 1 : 0), y + 14 + lH, lLead ? 4 : 3, 1, O);
    R(ctx, x + rx - (rLead ? 0 : 0), y + 14 + rH, rLead ? 4 : 3, 1, O);
  } else {
    // back view (facing up): same leg spread, but shoes point outward/back
    const lLead = leftLead;
    const rLead = rightLead;
    const lx = lLead ? 1 : rLead ? 3 : 2;
    const rx = rLead ? 8 : lLead ? 6 : 7;
    const lH = lLead ? 5 : rLead ? 3 : 4;
    const rH = rLead ? 5 : lLead ? 3 : 4;
    R(ctx, x + lx, y + 15, 3, lH, "#2b2f37");
    R(ctx, x + rx, y + 15, 3, rH, "#2b2f37");
    R(ctx, x + lx - 1, y + 14 + lH, 4, 1, O);
    R(ctx, x + rx,     y + 14 + rH, 4, 1, O);
  }

  // torso / shirt
  R(ctx, x + 1, y + 8, 10, 8, O);
  R(ctx, x + 2, y + 9, 8, 6, s.shirt);
  R(ctx, x + 3, y + 9, 6, 2, s.shirtHi);

  // arms — swing opposite to lead leg
  if (facing === "left" || facing === "right") {
    // side view: one arm forward, one arm behind torso
    // forward arm swings with opposite phase to front leg
    const frontArmSwing = facing === "right" ? rightLead : leftLead;
    const backArmSwing  = facing === "right" ? leftLead  : rightLead;
    const fArmBot = frontArmSwing ? 14 : backArmSwing ? 11 : 13;
    const bArmBot = backArmSwing  ? 14 : frontArmSwing ? 11 : 13;
    // back arm (darker, drawn behind torso edge)
    const bax = facing === "right" ? x + 9 : x + 1;
    R(ctx, bax, y + 9, 2, bArmBot - 9, "#4a3f6a"); // darker shirt
    R(ctx, bax, y + bArmBot, 2, 2, "#c89060");     // hand in shadow
    // front arm
    const fax = facing === "right" ? x : x + 8;
    R(ctx, fax, y + 9, 2, fArmBot - 9, s.shirt);
    R(ctx, fax, y + fArmBot, 2, 2, s.skin);
  } else {
    // front/back view: both arms visible, swing normally
    const armLBot = rightLead ? 14 : leftLead ? 12 : 13;
    const armRBot = leftLead  ? 14 : rightLead ? 12 : 13;
    R(ctx, x,      y + 9, 2, armLBot - 9, s.shirt);
    R(ctx, x + 10, y + 9, 2, armRBot - 9, s.shirt);
    R(ctx, x,      y + armLBot, 2, 2, s.skin);
    R(ctx, x + 10, y + armRBot, 2, 2, s.skin);
  }

  // head
  R(ctx, x + 2, y, 8, 9, O);
  if (facing === "up") {
    R(ctx, x + 3, y + 1, 6, 7, s.hair);
    R(ctx, x + 3, y + 1, 6, 2, s.hairHi);
  } else {
    R(ctx, x + 3, y + 3, 6, 5, s.skin);
    R(ctx, x + 3, y + 6, 6, 1, "#d39a72");
    R(ctx, x + 3, y, 6, 4, s.hair);
    R(ctx, x + 3, y, 6, 1, s.hairHi);
    if (facing === "down") {
      R(ctx, x + 2, y + 2, 1, 5, s.hair);
      R(ctx, x + 9, y + 2, 1, 5, s.hair);
      R(ctx, x + 4, y + 5, 1, 1, O);
      R(ctx, x + 7, y + 5, 1, 1, O);
    } else if (facing === "left") {
      R(ctx, x + 2, y + 1, 2, 7, s.hair);
      R(ctx, x + 4, y + 5, 1, 1, O);
    } else {
      R(ctx, x + 8, y + 1, 2, 7, s.hair);
      R(ctx, x + 7, y + 5, 1, 1, O);
    }
  }
  ctx.restore();
}

export const SKINS: Record<string, Skin> = {
  neel:    { hair: "#2a2620", hairHi: "#3c372e", shirt: "#3a6fd0", shirtHi: "#5b8fe8", skin: "#e8b48c" },
  sagar:   { hair: "#1c1a22", hairHi: "#2e2b38", shirt: "#d96a1a", shirtHi: "#f08840", skin: "#e0a87e" },
  pramit:  { hair: "#23201a", hairHi: "#34302a", shirt: "#3a9e52", shirtHi: "#56c470", skin: "#e8b48c" },
  mamjima: { hair: "#1a1208", hairHi: "#2e2010", shirt: "#d04a8a", shirtHi: "#e86aaa", skin: "#8b5e3c" },
};
