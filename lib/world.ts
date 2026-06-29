import * as S from "./sprites";
import { TILE, COLS, ROWS, Ctx, R } from "./sprites";

// ------------------------------------------------------------------ //
//  Single connected office in an elevated 2.5-D view, zoomed out so the
//  whole building sits on a lawn framed by trees. Light cream corridors
//  connect the rooms: a top-left work area, a top-right meeting room
//  (lavender), a central desk pod on blue carpet, a right lounge (grey),
//  a bottom-left sofa lounge (rug) and bottom-right display cabinets.
// ------------------------------------------------------------------ //

export type Floor = "grass" | "cream" | "lav" | "grey" | "carpet" | "rug" | "wall" | "custom";
export type FloorPattern = "checker" | "planks" | "grid" | "carpet" | "rug";
export type Facing = "up" | "down" | "left" | "right";
export type Rect = { c0: number; r0: number; c1: number; r1: number };

export type WorldObject = {
  id: string;
  label?: string;
  kind: string;
  c: number;
  r: number;
  w: number;
  h: number;
  scale?: number;    // visual scale (1 = 1:1)
  rotation?: number; // 0 | 90 | 180 | 270
  blocking?: boolean;
  sittable?: boolean;
  sitFacing?: Facing;
};

export type NPCStatus = "online" | "busy" | "away" | "offline";

export const STATUS_COLOR: Record<NPCStatus, string> = {
  online:  "#22c55e",
  busy:    "#eab308",
  away:    "#ef4444",
  offline: "#6b7280",
};

export const STATUS_ICON: Record<NPCStatus, string> = {
  online:  "",
  busy:    "🎙",
  away:    "🍵",
  offline: "",
};

export type NPC = {
  id: string;
  name: string;
  c: number;
  r: number;
  status: NPCStatus;
  skinKey: keyof typeof S.SKINS;
  facing: Facing;
  seat?: { seat: string; seatHi: string };
  slackUserId?: string;
};

// a walled floor area (its own interior walls + a door)
export type Room = {
  id: string;
  label: string;
  kind: Floor;
  customFloorColor?: string;
  floorPattern?: FloorPattern;
  rect: Rect;
  doorSide?: "left" | "right" | "top" | "bottom";
  doorAnchor?: number;  // override midR (left/right doors) or midC (top/bottom doors) for primary door
  doorSide2?: "left" | "right" | "top" | "bottom";
  doorOpen2?: boolean; // true = doorSide2 is an always-open entry; no panel drawn
  wallTheme?: string;
};
// an unwalled floor patch (carpet / rug)
export type Patch = { id: string; label: string; kind: Floor; customFloorColor?: string; floorPattern?: FloorPattern; rect: Rect };

export type World = {
  building: Rect;
  buildingFloor: Floor;
  buildingFloorColor?: string;
  buildingFloorPattern?: FloorPattern;
  wallTheme: string;
  rooms: Room[];
  patches: Patch[];
  floor: Floor[][];
  walk: boolean[][];
  objects: WorldObject[];
  npcs: NPC[];
  gallery: WorldObject[]; // deleted items
};

const WALL_TOP_H = 1;
export const WALL_VIS = 108;
export const BACK_WALL_VIS = 108;
export const MIN_SPAN = 4; // smallest editable building/room/patch span

export type WallTheme = { main: string; light: string; dark: string; side: string };

export const WALL_THEMES: Record<string, { label: string; theme: WallTheme }> = {
  orange: { label: "Orange",    theme: { main: "#d97030", light: "#e88844", dark: "#b85820", side: "#c26228" } },
  slate:  { label: "Slate",     theme: { main: "#5a6a88", light: "#7a8aaa", dark: "#3d4a62", side: "#4e5c78" } },
  sage:   { label: "Sage",      theme: { main: "#4a7c59", light: "#5d9670", dark: "#336648", side: "#406a4d" } },
  navy:   { label: "Navy",      theme: { main: "#2d4a7a", light: "#3d5f9a", dark: "#1e3355", side: "#263f6a" } },
  stone:  { label: "Stone",     theme: { main: "#8a7a65", light: "#a39077", dark: "#6d6050", side: "#7a6e5a" } },
  charcoal: { label: "Charcoal", theme: { main: "#3a404e", light: "#4e5668", dark: "#252b36", side: "#323844" } },
};

/** Derive a full WallTheme from a single hex color by lightening/darkening it. */
function hexToTheme(hex: string): WallTheme {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const adj = (v: number, d: number) => Math.min(255, Math.max(0, Math.round(v + d)));
  const h = (r2: number, g2: number, b2: number) =>
    "#" + [r2, g2, b2].map((v) => v.toString(16).padStart(2, "0")).join("");
  return {
    main:  hex,
    light: h(adj(r, 20), adj(g, 20), adj(b, 20)),
    dark:  h(adj(r, -30), adj(g, -30), adj(b, -30)),
    side:  h(adj(r, -12), adj(g, -12), adj(b, -12)),
  };
}

export function getWallTheme(key?: string): WallTheme {
  if (!key) return WALL_THEMES.orange.theme;
  if (key.startsWith("#")) return hexToTheme(key);
  return WALL_THEMES[key]?.theme ?? WALL_THEMES.orange.theme;
}

export const FLOOR_KINDS: Array<{ kind: Exclude<Floor, "grass" | "wall">; label: string; color: string }> = [
  { kind: "lav",    label: "Lavender", color: "#faf6d8" },
  { kind: "cream",  label: "Cream",    color: "#e8dfc8" },
  { kind: "grey",   label: "Grey",     color: "#858b95" },
  { kind: "carpet", label: "Carpet",   color: "#7f88bf" },
  { kind: "rug",    label: "Rug",      color: "#a8a8a8" },
];

export const FLOOR_PATTERNS: Array<{ pattern: FloorPattern; label: string; icon: string }> = [
  { pattern: "checker", label: "Checker",  icon: "⬛" },
  { pattern: "planks",  label: "Planks",   icon: "▬" },
  { pattern: "grid",    label: "Grid",     icon: "⊞" },
  { pattern: "carpet",  label: "Carpet",   icon: "░" },
  { pattern: "rug",     label: "Rug",      icon: "✛" },
];

function blankGrid<T>(v: T): T[][] {
  return Array.from({ length: ROWS }, () => Array.from({ length: COLS }, () => v));
}

export function buildWorld(): World {
  const building: Rect = { c0: 22, r0: 22, c1: 82, r1: 75 };
  const rooms: Room[] = [
    { id: "room_1", label: "Meeting Room 2", kind: "lav", rect: { c0: 82, r0: 23, c1: 101, r1: 43 }, doorSide: "left",  customFloorColor: "#ae9066" },
    { id: "room_3", label: "Meeting Room 1", kind: "lav", rect: { c0:  2, r0: 39, c1:  22, r1: 58 }, doorSide: "right", customFloorColor: "#ae9066" },
    { id: "room_4", label: "Reception",      kind: "lav", rect: { c0:  2, r0: 64, c1:  22, r1: 86 }, doorSide: "right", doorAnchor: 70, doorSide2: "bottom", doorOpen2: true, customFloorColor: "#ae9066" },
  ];
  const patches: Patch[] = [
    { id: "rug1", label: "Rug", kind: "rug", rect: { c0: 36, r0: 39, c1: 72, r1: 64 }, customFloorColor: "#a88661" },
  ];

  // ---- active objects ----
  const activeObjects: WorldObject[] = [
    { id: "deskTower_4",        label: "Workstation (tower)", kind: "deskTower",    c: 59, r: 57, w: 5, h: 3, scale: 1.45 },
    { id: "deskTower_11",       label: "Workstation (tower)", kind: "deskTower",    c: 45, r: 57, w: 5, h: 3, scale: 1.45 },
    { id: "deskTower_12",       label: "Workstation (tower)", kind: "deskTower",    c: 52, r: 57, w: 5, h: 3, scale: 1.45 },
    { id: "deskTower_18",       label: "Workstation (tower)", kind: "deskTower",    c: 59, r: 44, w: 5, h: 3, scale: 1.45 },
    { id: "deskTower_19",       label: "Workstation (tower)", kind: "deskTower",    c: 45, r: 44, w: 5, h: 3, scale: 1.45 },
    { id: "deskTower_20",       label: "Workstation (tower)", kind: "deskTower",    c: 52, r: 44, w: 5, h: 3, scale: 1.45 },
    { id: "chair_7",            label: "Chair",               kind: "chair",        c: 47, r: 60, w: 1, h: 1, scale: 2.5,  sittable: true, sitFacing: "up" },
    { id: "chair_13",           label: "Chair",               kind: "chair",        c: 61, r: 60, w: 1, h: 1, scale: 2.5,  sittable: true, sitFacing: "up" },
    { id: "chair_14",           label: "Chair",               kind: "chair",        c: 54, r: 60, w: 1, h: 1, scale: 2.5,  sittable: true, sitFacing: "up" },
    { id: "chair_15",           label: "Chair",               kind: "chair",        c: 47, r: 48, w: 1, h: 1, scale: 2.5,  sittable: true, sitFacing: "up" },
    { id: "chair_16",           label: "Chair",               kind: "chair",        c: 54, r: 48, w: 1, h: 1, scale: 2.5,  sittable: true, sitFacing: "up" },
    { id: "chair_17",           label: "Chair",               kind: "chair",        c: 61, r: 48, w: 1, h: 1, scale: 2.5,  sittable: true, sitFacing: "up" },
    { id: "chair_65",           label: "Chair",               kind: "chair",        c: 16, r: 50, w: 1, h: 1, scale: 2.5,  rotation: 270, sittable: true, sitFacing: "left" },
    { id: "chair_66",           label: "Chair",               kind: "chair",        c:  8, r: 50, w: 1, h: 1, scale: 2.5,  rotation: 270, sittable: true, sitFacing: "left" },
    { id: "chair_67",           label: "Chair",               kind: "chair",        c: 10, r: 54, w: 1, h: 1, scale: 2.5,  rotation: 180, sittable: true, sitFacing: "down" },
    { id: "chair_68",           label: "Chair",               kind: "chair",        c: 14, r: 54, w: 1, h: 1, scale: 2.5,  rotation: 180, sittable: true, sitFacing: "down" },
    { id: "chair_69",           label: "Chair",               kind: "chair",        c: 10, r: 47, w: 1, h: 1, scale: 2.5,  rotation:   0, sittable: true, sitFacing: "up" },
    { id: "chair_72",           label: "Chair",               kind: "chair",        c: 14, r: 47, w: 1, h: 1, scale: 2.5,  sittable: true, sitFacing: "up" },
    { id: "gamingChair_34",     label: "Gaming chair",        kind: "gamingChair",  c: 60, r: 25, w: 1, h: 1, scale: 3,    sittable: true, sitFacing: "up" },
    { id: "gamingChair_79",     label: "Gaming chair",        kind: "gamingChair",  c:  7, r: 70, w: 1, h: 1, scale: 3,    sittable: true, sitFacing: "up" },
    { id: "sofa_21",            label: "Sofa",                kind: "sofa",         c: 76, r: 50, w: 7, h: 2, scale: 2.2,  rotation: 90 },
    { id: "sofa_82",            label: "Sofa",                kind: "sofa",         c: 17, r: 82, w: 7, h: 2, scale: 1.75, rotation: 90 },
    { id: "roundTable_22",      label: "Round table",         kind: "roundTable",   c: 74, r: 50, w: 3, h: 3, scale: 1.55 },
    { id: "roundTable_46",      label: "Round table",         kind: "roundTable",   c:  6, r: 82, w: 3, h: 3 },
    { id: "ovalTable_50",       label: "Conference table",    kind: "ovalTable",    c: 91, r: 32, w: 4, h: 4, scale: 1.52 },
    { id: "locker_23",          label: "Locker",              kind: "locker",       c: 99, r: 22, w: 1, h: 2, scale: 3 },
    { id: "locker_35",          label: "Locker",              kind: "locker",       c: 45, r: 23, w: 1, h: 2, scale: 3,    rotation: 90 },
    { id: "locker_37",          label: "Locker",              kind: "locker",       c: 20, r: 64, w: 1, h: 2, scale: 3 },
    { id: "locker_73",          label: "Locker",              kind: "locker",       c:  4, r: 39, w: 1, h: 2, scale: 3 },
    { id: "locker_74",          label: "Locker",              kind: "locker",       c:  7, r: 39, w: 1, h: 2, scale: 3 },
    { id: "locker_86",          label: "Locker",              kind: "locker",       c: 49, r: 23, w: 1, h: 2, scale: 3,    rotation: 90 },
    { id: "bookshelf_24",       label: "Shelf",               kind: "bookshelf",    c: 86, r: 23, w: 4, h: 2, scale: 2.2 },
    { id: "bookshelf_77",       label: "Shelf",               kind: "bookshelf",    c:  3, r: 36, w: 4, h: 2, scale: 1.01 },
    { id: "whiteCabinet_31",    label: "Book cabinet",        kind: "whiteCabinet", c: 27, r: 22, w: 4, h: 5, scale: 1.7 },
    { id: "whiteCabinet_40",    label: "Book cabinet",        kind: "whiteCabinet", c:  5, r: 62, w: 4, h: 5, scale: 1.62 },
    { id: "plant_25",           label: "Plant",               kind: "plant",        c: 95, r: 22, w: 1, h: 2, scale: 2.57 },
    { id: "plant_32",           label: "Plant",               kind: "plant",        c: 80, r: 56, w: 1, h: 2, scale: 3 },
    { id: "plant_83",           label: "Plant",               kind: "plant",        c: 17, r: 85, w: 1, h: 2, scale: 3 },
    { id: "fiddleLeafFig_27",   label: "Fiddle Leaf Fig",     kind: "fiddleLeafFig",c: 78, r: 23, w: 2, h: 3, scale: 1.63 },
    { id: "fiddleLeafFig_47",   label: "Fiddle Leaf Fig",     kind: "fiddleLeafFig",c: 12, r: 64, w: 2, h: 3, scale: 1.23 },
    { id: "fiddleLeafFig_76",   label: "Fiddle Leaf Fig",     kind: "fiddleLeafFig",c: 19, r: 38, w: 2, h: 3, scale: 1.52 },
    { id: "tv_28",              label: "TV",                  kind: "tv",           c: 47, r: 21, w: 2, h: 2, scale: 3 },
    { id: "rack_29",            label: "Storage rack",        kind: "rack",         c: 57, r: 23, w: 5, h: 2, scale: 2.47 },
    { id: "whiteboard_38",      label: "Whiteboard",          kind: "whiteboard",   c: 70, r: 21, w: 3, h: 2, scale: 2.33 },
    { id: "whiteboard_48",      label: "Whiteboard",          kind: "whiteboard",   c: 15, r: 59, w: 3, h: 2 },
    { id: "easel_39",           label: "Chart easel",         kind: "easel",        c: 64, r: 39, w: 2, h: 3, scale: 2.72 },
    { id: "easel_75",           label: "Chart easel",         kind: "easel",        c: 14, r: 38, w: 2, h: 3, scale: 2.21, rotation: 0 },
    { id: "deskMon2_59",        label: "Workstation (dual)",  kind: "deskMon2",     c: 10, r: 49, w: 5, h: 3, scale: 1.64 },
    { id: "deskMon2_80",        label: "Workstation (dual)",  kind: "deskMon2",     c:  6, r: 72, w: 5, h: 3, scale: 1.51, rotation: 180 },
    { id: "tubDown_54",         label: "Armchair",            kind: "tubDown",      c: 93, r: 39, w: 1, h: 1, scale: 3,    rotation: 180, sittable: true, sitFacing: "up" },
    { id: "tubDown_57",         label: "Armchair",            kind: "tubDown",      c: 93, r: 28, w: 1, h: 1, scale: 3,    sittable: true, sitFacing: "down" },
    { id: "tubLeft_42",         label: "Armchair",            kind: "tubLeft",      c:  4, r: 83, w: 1, h: 1, scale: 3,    sittable: true, sitFacing: "left" },
    { id: "tubLeft_56",         label: "Armchair",            kind: "tubLeft",      c: 87, r: 33, w: 1, h: 1, scale: 2.85, sittable: true, sitFacing: "left" },
    { id: "tubRight_58",        label: "Armchair",            kind: "tubRight",     c: 98, r: 33, w: 1, h: 1, scale: 3,    sittable: true, sitFacing: "right" },
    { id: "officeWindow_1",     label: "Window",              kind: "officeWindow", c: 64, r: 76, w: 3, h: 3, scale: 1.5002039473697546 },
    { id: "officeWindow_2",     label: "Window",              kind: "officeWindow", c: 72, r: 76, w: 3, h: 3, scale: 1.5002039473697546 },
    { id: "officeWindow_5",     label: "Window",              kind: "officeWindow", c: 33, r: 76, w: 3, h: 3, scale: 1.5002039473697546 },
    { id: "officeWindow_6",     label: "Window",              kind: "officeWindow", c: 33, r: 19, w: 3, h: 3, scale: 1.5002039473697546 },
    { id: "officeWindow_7",     label: "Window",              kind: "officeWindow", c: 37, r: 19, w: 3, h: 3, scale: 1.5002039473697546 },
    { id: "officeWindow_8",     label: "Window",              kind: "officeWindow", c: 41, r: 19, w: 3, h: 3, scale: 1.5002039473697546 },
    { id: "officeWindow_9",     label: "Window",              kind: "officeWindow", c: 37, r: 76, w: 3, h: 3, scale: 1.5002039473697546 },
    { id: "officeWindow_10",    label: "Window",              kind: "officeWindow", c: 41, r: 76, w: 3, h: 3, scale: 1.5002039473697546 },
    { id: "officeWindow_11",    label: "Window",              kind: "officeWindow", c: 18, r: 87, w: 3, h: 3, scale: 1.5002039473697546 },
    { id: "officeWindow_12",    label: "Window",              kind: "officeWindow", c:  4, r: 87, w: 3, h: 3, scale: 1.5002039473697546 },
    { id: "officeWindow_13",    label: "Window",              kind: "officeWindow", c: 10, r: 35, w: 3, h: 3, scale: 1.5002039473697546 },
    { id: "officeWindow_15",    label: "Window",              kind: "officeWindow", c: 14, r: 35, w: 3, h: 3, scale: 1.5002039473697546 },
    { id: "officeWindow_16",    label: "Window",              kind: "officeWindow", c: 89, r: 19, w: 3, h: 3, scale: 1.5002039473697546 },
    { id: "officeWindow_17",    label: "Window",              kind: "officeWindow", c: 93, r: 19, w: 3, h: 3, scale: 1.5002039473697546 },
    { id: "officeWindow_18",    label: "Window",              kind: "officeWindow", c: 90, r: 44, w: 3, h: 3, scale: 1.5002039473697546 },
    { id: "officeWindow_19",    label: "Window",              kind: "officeWindow", c: 94, r: 44, w: 3, h: 3, scale: 1.5002039473697546 },
  ];

  // ---- gallery (removed from active layout but available to re-add) ----
  const gallery: WorldObject[] = [
    { id: "rack",         label: "Storage rack",            kind: "rack",         c: 11, r:  5, w: 5, h: 2 },
    { id: "plantA",       label: "Plant",                   kind: "plant",        c: 17, r:  5, w: 1, h: 2 },
    { id: "chart",        label: "Chart easel",             kind: "easel",        c: 19, r:  5, w: 2, h: 3 },
    { id: "shelfT",       label: "Shelf",                   kind: "bookshelf",    c: 24, r:  5, w: 4, h: 2 },
    { id: "plantB",       label: "Plant",                   kind: "plant",        c: 30, r:  5, w: 1, h: 2 },
    { id: "wb",           label: "Whiteboard",              kind: "whiteboard",   c: 32, r:  5, w: 3, h: 2 },
    { id: "plantFig",     label: "Fiddle Leaf Fig",         kind: "fiddleLeafFig",c: 38, r:  5, w: 2, h: 3 },
    { id: "deskA",        label: "Workstation",             kind: "deskMon2",     c: 15, r: 14, w: 5, h: 3 },
    { id: "deskB",        label: "Workstation",             kind: "deskMon1",     c: 22, r: 14, w: 4, h: 3 },
    { id: "sagarChair",   label: "Chair — click to sit",    kind: "chair",        c: 61, r: 48, w: 1, h: 1, sittable: true, sitFacing: "up" },
    { id: "chB",          label: "Chair — click to sit",    kind: "chair",        c: 23, r: 17, w: 1, h: 1, sittable: true, sitFacing: "up" },
    { id: "deskC",        label: "Workstation",             kind: "deskTower",    c: 15, r: 21, w: 5, h: 3 },
    { id: "deskD",        label: "Workstation",             kind: "deskMon2",     c: 22, r: 21, w: 4, h: 3 },
    { id: "chC",          label: "Chair — click to sit",    kind: "chair",        c: 17, r: 24, w: 1, h: 1, sittable: true, sitFacing: "up" },
    { id: "ltv",          label: "TV",                      kind: "tv",           c: 32, r: 13, w: 2, h: 2 },
    { id: "ltable",       label: "Round table",             kind: "roundTable",   c: 32, r: 20, w: 3, h: 3 },
    { id: "lc1",          label: "Armchair — click to sit", kind: "tubDown",      c: 33, r: 19, w: 1, h: 1, sittable: true, sitFacing: "down" },
    { id: "lc2",          label: "Armchair — click to sit", kind: "tubUp",        c: 33, r: 24, w: 1, h: 1, sittable: true, sitFacing: "up" },
    { id: "mtable",       label: "Conference table",        kind: "longTable",    c: 84, r: 28, w: 14, h: 4 },
    { id: "mc1",          label: "Chair — click to sit",    kind: "tubUp",        c: 42, r: 14, w: 1, h: 1, sittable: true, sitFacing: "up" },
    { id: "mc2",          label: "Chair — click to sit",    kind: "tubDown",      c: 42, r: 21, w: 1, h: 1, sittable: true, sitFacing: "down" },
    { id: "llamp",        label: "Floor lamp",              kind: "floorLamp",    c: 43, r: 12, w: 1, h: 2 },
    { id: "shelfL",       label: "Shelf",                   kind: "bookshelf",    c:  4, r:  7, w: 4, h: 2 },
    { id: "plantL",       label: "Plant",                   kind: "plant",        c:  4, r: 16, w: 1, h: 2 },
    { id: "locker",       label: "Locker",                  kind: "locker",       c:  4, r: 24, w: 1, h: 2 },
    { id: "gchair",       label: "Gaming chair — click to sit", kind: "gamingChair", c: 5, r: 28, w: 1, h: 1, sittable: true, sitFacing: "up" },
    { id: "sofa",         label: "Sofa",                    kind: "sofa",         c: 11, r: 36, w: 7, h: 2 },
    { id: "coffee",       label: "Coffee table",            kind: "roundTable",   c: 13, r: 40, w: 3, h: 2 },
    { id: "sc1",          label: "Armchair — click to sit", kind: "tubRight",     c: 11, r: 41, w: 1, h: 1, sittable: true, sitFacing: "right" },
    { id: "sc2",          label: "Armchair — click to sit", kind: "tubLeft",      c: 18, r: 41, w: 1, h: 1, sittable: true, sitFacing: "left" },
    { id: "oTR1",         label: "Tree",  kind: "treeRound",   c:  3, r:  0, w: 5, h: 6 },
    { id: "oTP1",         label: "Pine",  kind: "treePine",    c: 13, r:  0, w: 4, h: 6 },
    { id: "oBsh1",        label: "Bush",  kind: "bush",        c: 20, r:  3, w: 2, h: 2 },
    { id: "oTP2",         label: "Pine",  kind: "treePine",    c: 80, r:  0, w: 4, h: 6 },
    { id: "oTR2",         label: "Tree",  kind: "treeRound",   c: 87, r:  0, w: 5, h: 6 },
    { id: "oBsh2",        label: "Bush",  kind: "bush",        c: 76, r:  3, w: 2, h: 2 },
    { id: "oTC1",         label: "Tree",  kind: "treeCluster", c: 85, r: 47, w: 5, h: 7 },
    { id: "oBsh3",        label: "Bush",  kind: "bush",        c: 93, r: 55, w: 2, h: 2 },
    { id: "oTP3",         label: "Pine",  kind: "treePine",    c: 24, r: 78, w: 4, h: 6 },
    { id: "oTC2",         label: "Tree",  kind: "treeCluster", c: 45, r: 78, w: 5, h: 7 },
    { id: "oBsh4",        label: "Bush",  kind: "bush",        c: 57, r: 82, w: 2, h: 2 },
    { id: "oTR3",         label: "Tree",  kind: "treeRound",   c: 63, r: 78, w: 5, h: 6 },
    { id: "oBsh5",        label: "Bush",  kind: "bush",        c: 75, r: 82, w: 2, h: 2 },
    { id: "oTP4",         label: "Pine",  kind: "treePine",    c: 84, r: 78, w: 4, h: 6 },
    { id: "mlamp",        label: "Floor lamp",   kind: "floorLamp",    c: 25, r: 36, w: 1, h: 2 },
    { id: "cab1",         label: "Book cabinet", kind: "whiteCabinet", c: 34, r: 33, w: 4, h: 5 },
    { id: "cab2",         label: "Book cabinet", kind: "whiteCabinet", c: 29, r: 33, w: 4, h: 5 },
    { id: "otable",       label: "Table",        kind: "ovalTable",    c: 31, r: 39, w: 5, h: 3 },
    { id: "deskTower_1",  label: "Workstation (tower)", kind: "deskTower", c: 25, r: 26, w: 5, h: 3 },
    { id: "deskTower_2",  label: "Workstation (tower)", kind: "deskTower", c: 43, r: 57, w: 5, h: 3 },
    { id: "deskTower_3",  label: "Workstation (tower)", kind: "deskTower", c: 51, r: 57, w: 5, h: 3 },
    { id: "chair_8",      label: "Chair", kind: "chair", c: 53, r: 60, w: 1, h: 1, sittable: true, sitFacing: "up" },
    { id: "chair_10",     label: "Chair", kind: "chair", c: 45, r: 60, w: 1, h: 1, sittable: true, sitFacing: "up" },
    { id: "chair_45",     label: "Chair", kind: "chair", c:  8, r: 70, w: 1, h: 1, scale: 2.5, sittable: true, sitFacing: "up" },
    { id: "chair_60",     label: "Chair", kind: "chair", c: 12, r: 46, w: 1, h: 1, scale: 2.5, sittable: true, sitFacing: "up" },
    { id: "chair_61",     label: "Chair", kind: "chair", c: 12, r: 47, w: 1, h: 1, scale: 2.5, sittable: true, sitFacing: "up" },
    { id: "chair_62",     label: "Chair", kind: "chair", c: 13, r: 48, w: 1, h: 1, scale: 2.5, sittable: true, sitFacing: "up" },
    { id: "chair_63",     label: "Chair", kind: "chair", c: 14, r: 49, w: 1, h: 1, scale: 2.5, sittable: true, sitFacing: "up" },
    { id: "chair_64",     label: "Chair", kind: "chair", c: 15, r: 50, w: 1, h: 1, scale: 2.5, sittable: true, sitFacing: "up" },
    { id: "chair_70",     label: "Chair", kind: "chair", c: 12, r: 48, w: 1, h: 1, scale: 2.5, rotation: 0, sittable: true, sitFacing: "up" },
    { id: "chair_71",     label: "Chair", kind: "chair", c: 48, r: 61, w: 1, h: 1, scale: 2.5, sittable: true, sitFacing: "up" },
    { id: "gamingChair_9",label: "Gaming chair", kind: "gamingChair", c: 63, r: 55, w: 1, h: 1, sittable: true, sitFacing: "up" },
    { id: "sofa_30",      label: "Sofa",          kind: "sofa",        c: 27, r: 23, w: 7, h: 2, scale: 2.04 },
    { id: "ovalTable_78", label: "Conference table", kind: "ovalTable", c: 6, r: 72, w: 4, h: 4, scale: 1.66 },
    { id: "locker_36",    label: "Locker", kind: "locker", c: 42, r: 22, w: 1, h: 2, scale: 3 },
    { id: "plant_5",      label: "Plant",  kind: "plant",  c: 55, r: 44, w: 1, h: 2 },
    { id: "plant_6",      label: "Plant",  kind: "plant",  c: 46, r: 44, w: 1, h: 2 },
    { id: "floorLamp_26", label: "Floor lamp", kind: "floorLamp", c: 79, r: 74, w: 1, h: 2, scale: 3 },
    { id: "floorLamp_49", label: "Floor lamp", kind: "floorLamp", c:  4, r: 63, w: 1, h: 2, scale: 2.34 },
    { id: "floorLamp_85", label: "Floor lamp", kind: "floorLamp", c: 12, r: 63, w: 1, h: 2, scale: 2.16 },
    { id: "tv_84",        label: "TV",  kind: "tv",       c:  7, r: 73, w: 2, h: 2, scale: 3 },
    { id: "deskMon1_44",  label: "Workstation (single)", kind: "deskMon1", c: 7, r: 72, w: 4, h: 3, scale: 1.45, rotation: 180 },
    { id: "tubDown_33",   label: "Armchair", kind: "tubDown",  c: 40, r: 25, w: 1, h: 1, scale: 3, sittable: true, sitFacing: "down" },
    { id: "tubDown_51",   label: "Armchair", kind: "tubDown",  c: 76, r: 34, w: 1, h: 1, sittable: true, sitFacing: "down" },
    { id: "tubDown_52",   label: "Armchair", kind: "tubDown",  c: 99, r: 33, w: 1, h: 1, scale: 3, rotation:  90, sittable: true, sitFacing: "down" },
    { id: "tubDown_53",   label: "Armchair", kind: "tubDown",  c: 92, r: 42, w: 1, h: 1, scale: 3, rotation: 180, sittable: true, sitFacing: "up" },
    { id: "tubDown_55",   label: "Armchair", kind: "tubDown",  c: 100, r: 34, w: 1, h: 1, scale: 3, rotation: 90, sittable: true, sitFacing: "down" },
    { id: "tubLeft_41",   label: "Armchair", kind: "tubLeft",  c:  4, r: 87, w: 1, h: 1, scale: 3, sittable: true, sitFacing: "left" },
    { id: "tubLeft_43",   label: "Armchair", kind: "tubLeft",  c:  4, r: 84, w: 1, h: 1, scale: 3, sittable: true, sitFacing: "left" },
    { id: "tubRight_81",  label: "Armchair", kind: "tubRight", c: 19, r: 78, w: 1, h: 1, scale: 3, sittable: true, sitFacing: "right" },
    { id: "officeWindow_3",  label: "Window", kind: "officeWindow", c: 41, r: 76, w: 3, h: 3, scale: 1.5002039473697546 },
    { id: "officeWindow_4",  label: "Window", kind: "officeWindow", c: 37, r: 76, w: 3, h: 3, scale: 1.5002039473697546 },
    { id: "officeWindow_14", label: "Window", kind: "officeWindow", c: 14, r: 34, w: 3, h: 3, scale: 1.5002039473697546 },
  ];

  const npcs: NPC[] = [
    { id: "sagar",   name: "Sagar",   c: 61, r: 48, status: "offline", skinKey: "sagar",   facing: "up", seat: { seat: "#d96a1a", seatHi: "#f08840" }, slackUserId: "D0ALF3H3FPT" },
    { id: "neel",    name: "Neel",    c: 47, r: 48, status: "offline", skinKey: "neel",    facing: "up", seat: { seat: "#3a6fd0", seatHi: "#5b8fe8" }, slackUserId: "D0BAREP8ASZ" },
    { id: "manjima", name: "Manjima", c: 54, r: 48, status: "offline", skinKey: "manjima", facing: "up", seat: { seat: "#d04a8a", seatHi: "#e86aaa" }, slackUserId: "D0BBNKMNM7S" },
    { id: "pramit",  name: "Pramit",  c: 47, r: 60, status: "offline", skinKey: "pramit",  facing: "up", seat: { seat: "#3a9e52", seatHi: "#56c470" }, slackUserId: "D0BAQV1UDRT" },
  ];

  const world: World = {
    building,
    buildingFloor: "lav",
    buildingFloorColor: "#ae9066",
    wallTheme: "charcoal",
    rooms,
    patches,
    floor: blankGrid<Floor>("grass"),
    walk: blankGrid(true),
    objects: activeObjects,
    npcs,
    gallery,
  };
  rebuildFloors(world);
  return world;
}

function carveOneSide(world: World, room: Room, side: Room["doorSide"], anchor?: number) {
  const [t0, t1] = doorSpanForSide(room.rect, side, anchor);
  const f = world.floor;
  const set = (c: number, r: number) => { if (f[r]?.[c] !== undefined) f[r][c] = room.kind; };
  if (side === "left" || side === "right") {
    const col = side === "left" ? t0.c : t1.c;
    for (let r = t0.r; r <= t1.r; r++) set(col, r);
  } else {
    const row = side === "top" ? t0.r : t1.r;
    for (let c = t0.c; c <= t1.c; c++) set(c, row);
  }
}

function carveDoor(world: World, room: Room) {
  if (!room.doorSide) return;
  carveOneSide(world, room, room.doorSide, room.doorAnchor);
  if (room.doorSide2) carveOneSide(world, room, room.doorSide2);
}

// derive the floor grid from building + rooms + patches, then walkability.
// call after the building / a room / a patch is resized or moved.
export function rebuildFloors(world: World) {
  const { floor, building: B, rooms, patches } = world;
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) floor[r][c] = "grass";
  // building interior floor
  for (let r = B.r0 + WALL_TOP_H; r <= B.r1 - 1; r++)
    for (let c = B.c0 + 1; c <= B.c1 - 1; c++) if (floor[r]?.[c] !== undefined) floor[r][c] = world.buildingFloor;
  // walled rooms (border = wall, interior = kind)
  for (const room of rooms) {
    const R = room.rect;
    for (let r = R.r0; r <= R.r1; r++)
      for (let c = R.c0; c <= R.c1; c++) {
        if (floor[r]?.[c] === undefined) continue;
        const border = c === R.c0 || c === R.c1 || r === R.r0 || r === R.r1;
        floor[r][c] = border ? "wall" : room.kind;
      }
  }
  // patches (no walls)
  for (const p of patches) {
    const R = p.rect;
    for (let r = R.r0; r <= R.r1; r++)
      for (let c = R.c0; c <= R.c1; c++) if (floor[r]?.[c] !== undefined) floor[r][c] = p.kind;
  }
  // building perimeter walls always win
  for (let c = B.c0; c <= B.c1; c++) {
    if (floor[B.r0]) floor[B.r0][c] = "wall";
    if (floor[B.r0 + 1]) floor[B.r0 + 1][c] = "wall";
    if (floor[B.r1]) floor[B.r1][c] = "wall";
  }
  for (let r = B.r0; r <= B.r1; r++) if (floor[r]) { floor[r][B.c0] = "wall"; floor[r][B.c1] = "wall"; }
  // doors
  for (const room of rooms) carveDoor(world, room);
  rebuildWalk(world);
}

// recompute the walkable grid — call after any object/room moves at runtime
export function rebuildWalk(world: World) {
  const { floor, walk, building: B, objects, npcs } = world;
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++) walk[r][c] = floor[r][c] !== "wall";
  for (let c = B.c0; c <= B.c1; c++) if (walk[B.r0 - 1]?.[c] !== undefined) walk[B.r0 - 1][c] = false;
  for (const o of objects) {
    if (o.blocking === false) continue;
    if (o.kind === "treeSmall" || o.kind === "treeBig" ||
        o.kind === "treeRound" || o.kind === "treeCluster" || o.kind === "treePine") {
      const tc = o.c + (o.w >> 1);
      const tr = o.r + o.h - 1;
      if (walk[tr]?.[tc] !== undefined) walk[tr][tc] = false;
      continue;
    }
    const s = o.scale ?? 1;
    if (s <= 1) {
      for (let r = o.r; r < o.r + o.h; r++)
        for (let c = o.c; c < o.c + o.w; c++) if (walk[r]?.[c] !== undefined) walk[r][c] = false;
    } else {
      // Scale pivots at tile-center; block the expanded visual footprint
      const pivotC = o.c + o.w / 2;
      const pivotR = o.r + o.h / 2;
      const halfW = (o.w / 2) * s;
      const halfH = (o.h / 2) * s;
      const c0 = Math.floor(pivotC - halfW);
      const c1 = Math.ceil(pivotC + halfW) - 1;
      const r0 = Math.floor(pivotR - halfH);
      const r1 = Math.ceil(pivotR + halfH) - 1;
      for (let r = r0; r <= r1; r++)
        for (let c = c0; c <= c1; c++) if (walk[r]?.[c] !== undefined) walk[r][c] = false;
    }
  }
  for (const n of npcs) if (n.status !== "offline" && walk[n.r]?.[n.c] !== undefined) walk[n.r][n.c] = false;
}

// ------------------------------------------------------------------ //
//  Coordinate helpers
// ------------------------------------------------------------------ //
export const tileCenterPx = (c: number, r: number) => ({
  x: c * TILE + TILE / 2,
  y: r * TILE + TILE / 2,
});

export function objectById(world: World, id: string) {
  return world.objects.find((o) => o.id === id) ?? world.gallery.find((o) => o.id === id)!;
}

export function approachTile(o: WorldObject): { c: number; r: number } {
  const opp: Record<Facing, [number, number]> = {
    up: [0, 1], down: [0, -1], left: [1, 0], right: [-1, 0],
  };
  const [dc, dr] = opp[o.sitFacing ?? "up"];
  return { c: o.c + dc, r: o.r + dr };
}

// ------------------------------------------------------------------ //
//  2.5-D wall rendering
// ------------------------------------------------------------------ //

function backWall(ctx: Ctx, x: number, baseY: number, w: number, visH: number, t: WallTheme) {
  const top = baseY - visH;
  R(ctx, x, top, w, visH, t.main);
  R(ctx, x, top, w, 3, t.light);
  R(ctx, x, baseY - 3, w, 3, t.dark);
}

function floorShadowDown(ctx: Ctx, x: number, y: number, w: number) {
  R(ctx, x, y, w, 3, "rgba(0,0,0,0.22)");
  R(ctx, x, y + 3, w, 2, "rgba(0,0,0,0.10)");
}

export function drawFrontWall(ctx: Ctx, x: number, baseY: number, w: number, t: WallTheme = WALL_THEMES.orange.theme) {
  R(ctx, x, baseY, w, WALL_VIS, t.main);
  R(ctx, x, baseY, w, 3, t.light);
  R(ctx, x, baseY + WALL_VIS - 3, w, 3, t.dark);
}


// ------------------------------------------------------------------ //
//  Object sprite dispatch
// ------------------------------------------------------------------ //
export function drawObject(ctx: Ctx, o: WorldObject) {
  const x = o.c * TILE;
  const y = o.r * TILE;
  const w = o.w * TILE;
  const h = o.h * TILE;
  switch (o.kind) {
    case "plant":
      S.plant(ctx, x + (w - 16) / 2, y + h - 20);
      break;
    case "fiddleLeafFig":
      S.fiddleLeafFig(ctx, x, y);
      break;
    case "easel":
      S.easel(ctx, x + 2, y + 2, w - 2, h - 4);
      break;
    case "floorLamp":
      S.floorLamp(ctx, x, y + 4);
      break;
    case "bookshelf":
      S.bookshelf(ctx, x, y, w, h - 2);
      break;
    case "rack":
      S.bookshelf(ctx, x, y, w, h - 2);
      S.deskPlant(ctx, x + w - 10, y - 8);
      break;
    case "desk":
      S.desk(ctx, x, y, w, h);
      break;
    case "deskMon1":
      S.desk(ctx, x, y, w, h);
      S.monitor(ctx, x + 8, y - 2, "#3a2f6e", "#8a7be0");
      S.keyboard(ctx, x + 8, y + h - 14);
      S.papers(ctx, x + w - 14, y + 4);
      S.mug(ctx, x + w - 12, y + h - 12);
      break;
    case "deskMon2":
      S.desk(ctx, x, y, w, h);
      S.monitor(ctx, x + 6, y - 2, "#0f5560", "#2bd1c4");
      S.monitor(ctx, x + 26, y - 2, "#3a2f6e", "#8a7be0");
      S.keyboard(ctx, x + 16, y + h - 13);
      S.deskPlant(ctx, x + w - 12, y + 5);
      break;
    case "deskTower":
      S.desk(ctx, x, y, w, h);
      S.tower(ctx, x + 4, y + 6);
      S.monitor(ctx, x + 28, y - 2, "#234a86", "#5b9bd5");
      S.keyboard(ctx, x + 26, y + h - 13);
      S.papers(ctx, x + 18, y + 6);
      break;
    case "whiteboard":
      S.whiteboard(ctx, x, y, w, h + 8);
      break;
    case "tv":
      S.tv(ctx, x + 4, y + 6);
      break;
    case "longTable":
      S.longTable(ctx, x, y, w, h);
      break;
    case "roundTable":
      S.roundTable(ctx, x + w / 2, y + h / 2, Math.min(w, h) / 2 - 2);
      break;
    case "ovalTable":
      S.ovalTable(ctx, x + w / 2, y + h / 2, w / 2 - 3, h / 2 - 2);
      break;
    case "sofa":
      S.sofa(ctx, x, y + 4, w);
      break;
    case "whiteCabinet":
      S.whiteCabinet(ctx, x, y, w, h);
      break;
    case "locker":
      S.locker(ctx, x, y + 4);
      break;
    case "gamingChair":
      S.gamingChair(ctx, x + 1, y);
      break;
    case "chair":
      S.chair(ctx, x + 1, y);
      break;
    case "tubUp":
      S.tubChair(ctx, x, y, "up");
      break;
    case "tubDown":
      S.tubChair(ctx, x, y, "down");
      break;
    case "tubLeft":
      S.tubChair(ctx, x, y, "left");
      break;
    case "tubRight":
      S.tubChair(ctx, x, y, "right");
      break;
    case "treeSmall":
      S.tree(ctx, x, y - 6, 46);
      break;
    case "treeBig":
      S.tree(ctx, x - 6, y - 10, 78);
      break;
    case "bush":
      S.bush(ctx, x, y);
      break;
    case "treeRound":
      S.treeRound(ctx, x, y);
      break;
    case "treeCluster":
      S.treeCluster(ctx, x, y);
      break;
    case "treePine":
      S.treePine(ctx, x, y);
      break;
    case "officeWindow":
      S.officeWindow(ctx, x, y, w, h);
      break;
  }
}

// ------------------------------------------------------------------ //
//  Render the static base (floors + walls + wall decor) into a buffer
//  once. Objects and NPCs are drawn per-frame so they can be moved.
// ------------------------------------------------------------------ //
export function drawNpc(ctx: Ctx, n: NPC) {
  const { x: nx } = tileCenterPx(n.c, n.r);
  const yTop = n.r * TILE;
  if (n.seat) {
    // Person sits on the chair object that the render loop already drew underneath
    S.person(ctx, nx, yTop + TILE / 2 + 4, S.SKINS[n.skinKey], n.facing, 0);
  } else {
    S.person(ctx, nx, yTop + 14, S.SKINS[n.skinKey], n.facing, 0);
  }
}

export function drawBase(ctx: Ctx, world: World) {
  ctx.imageSmoothingEnabled = false;
  const B = world.building;

  // Build lookup: tile → owning entity (patch beats room beats building).
  // We store color + pattern per tile based strictly on which entity owns it.
  const colorAt   = new Map<number, string | undefined>();
  const patternAt = new Map<number, FloorPattern | undefined>();
  const tileKey   = (c: number, r: number) => r * COLS + c;

  // Building first (lowest priority)
  for (let r = B.r0; r <= B.r1; r++)
    for (let c = B.c0; c <= B.c1; c++) {
      colorAt.set(tileKey(c, r), world.buildingFloorColor);
      patternAt.set(tileKey(c, r), world.buildingFloorPattern);
    }
  // Rooms overwrite building (including door gap tiles on the border)
  for (const room of world.rooms) {
    const rr = room.rect;
    for (let r = rr.r0; r <= rr.r1; r++)
      for (let c = rr.c0; c <= rr.c1; c++) {
        colorAt.set(tileKey(c, r), room.customFloorColor);
        patternAt.set(tileKey(c, r), room.floorPattern);
      }
    // Door gap tiles sit on the room border — also apply room color so they match
    for (const side of [room.doorSide, room.doorSide2] as const) {
      if (!side) continue;
      const anchor = side === room.doorSide ? room.doorAnchor : undefined;
      const [t0, t1] = doorSpanForSide(room.rect, side, anchor);
      for (let tc = Math.min(t0.c, t1.c); tc <= Math.max(t0.c, t1.c); tc++)
        for (let tr = Math.min(t0.r, t1.r); tr <= Math.max(t0.r, t1.r); tr++) {
          colorAt.set(tileKey(tc, tr), room.customFloorColor);
          patternAt.set(tileKey(tc, tr), room.floorPattern);
        }
    }
  }
  // Patches overwrite everything (highest priority)
  for (const patch of world.patches) {
    const rr = patch.rect;
    for (let r = rr.r0; r <= rr.r1; r++)
      for (let c = rr.c0; c <= rr.c1; c++) {
        colorAt.set(tileKey(c, r), patch.customFloorColor);
        patternAt.set(tileKey(c, r), patch.floorPattern);
      }
  }

  // 1) floors
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (world.floor[r][c] === "wall") continue;
      paintFloor(ctx, world.floor[r][c], c, r, colorAt.get(tileKey(c, r)), patternAt.get(tileKey(c, r)));
    }
  }

  // 2) room walls — sorted north→south so southernmost rooms layer on top; building is always drawn after (highest z)
  const roomsByDepth = [...world.rooms].sort((a, b) => a.rect.r0 - b.rect.r0);
  for (const room of roomsByDepth) {
    const t = getWallTheme(room.wallTheme ?? world.wallTheme);
    const rr = room.rect;
    const rx = rr.c0 * TILE;
    const rw = (rr.c1 - rr.c0 + 1) * TILE;
    const rBaseY = (rr.r0 + WALL_TOP_H) * TILE;
    backWall(ctx, rx, rBaseY, rw, BACK_WALL_VIS, t);
    floorShadowDown(ctx, rx, rBaseY, rw);
    // Side walls start at the top of the back wall so there's no gap
    const rSideTop = rBaseY - BACK_WALL_VIS;
    const rSideH = rr.r1 * TILE - rSideTop;
    R(ctx, rr.c0 * TILE, rSideTop, TILE, rSideH, t.side);
    R(ctx, rr.c0 * TILE, rSideTop, 2, rSideH, t.light);
    R(ctx, rr.c1 * TILE, rSideTop, TILE, rSideH, t.side);
    R(ctx, (rr.c1 + 1) * TILE - 2, rSideTop, 2, rSideH, t.dark);
  }

  // 3) building perimeter walls — back wall first so side walls render on top at the overlap
  const bt = getWallTheme(world.wallTheme);
  const x = B.c0 * TILE;
  const bandW = (B.c1 - B.c0 + 1) * TILE;
  const baseY = (B.r0 + WALL_TOP_H + 1) * TILE;
  backWall(ctx, x, baseY, bandW, BACK_WALL_VIS, bt);
  floorShadowDown(ctx, x, baseY, bandW);
  // Side walls start at the top of the back wall so there's no gap
  const sideTop = baseY - BACK_WALL_VIS;
  const sideH = B.r1 * TILE - sideTop;
  R(ctx, B.c0 * TILE, sideTop, TILE, sideH, bt.side);
  R(ctx, B.c0 * TILE, sideTop, 2, sideH, bt.light);
  R(ctx, B.c1 * TILE, sideTop, TILE, sideH, bt.side);
  R(ctx, (B.c1 + 1) * TILE - 2, sideTop, 2, sideH, bt.dark);

  // clock on the back wall
  const faceY = baseY - BACK_WALL_VIS;
  const clockCol = B.c0 + 3;
  S.clock(ctx, clockCol * TILE, Math.round(faceY + BACK_WALL_VIS / 2) - 7);
}

function paintFloor(ctx: Ctx, f: Floor, c: number, r: number, color?: string, pattern?: FloorPattern) {
  const x = c * TILE;
  const y = r * TILE;
  // Resolve which drawing function to use: pattern overrides kind-based default.
  const p = pattern ?? kindToPattern(f);
  switch (p) {
    case "planks":  S.lavTile(ctx, x, y, c, r, color); break;
    case "grid":    S.greyTile(ctx, x, y, color); break;
    case "checker": S.creamTile(ctx, x, y, c, r, color); break;
    case "carpet":  S.carpetTile(ctx, x, y, c, r, color); break;
    case "rug":     S.rugTile(ctx, x, y, c, r, color); break;
    default:
      // No pattern override — fall back to kind-specific drawing (grass, wall, etc.)
      switch (f) {
        case "grass": S.grassTile(ctx, x, y, c, r); break;
        case "cream": S.creamTile(ctx, x, y, c, r, color); break;
        case "lav":   S.lavTile(ctx, x, y, c, r, color); break;
        case "grey":  S.greyTile(ctx, x, y, color); break;
        case "carpet":S.carpetTile(ctx, x, y, c, r, color); break;
        case "rug":   S.rugTile(ctx, x, y, c, r, color); break;
        default: break;
      }
  }
}

/** Map a floor kind to its default pattern. */
function kindToPattern(f: Floor): FloorPattern | null {
  switch (f) {
    case "lav":    return "planks";
    case "grey":   return "grid";
    case "cream":  return "checker";
    case "carpet": return "carpet";
    case "rug":    return "rug";
    default: return null;
  }
}

// ------------------------------------------------------------------ //
//  Door helpers
// ------------------------------------------------------------------ //


/** Redraws the building's left and right side walls — call per-frame after room front walls so they always sit on top. */
export function drawBuildingSideWalls(ctx: Ctx, world: World) {
  ctx.imageSmoothingEnabled = false;
  const t = getWallTheme(world.wallTheme);
  const B = world.building;
  const baseY = (B.r0 + WALL_TOP_H + 1) * TILE;
  const sideTop = baseY - BACK_WALL_VIS;
  const sideH = B.r1 * TILE - sideTop;
  R(ctx, B.c0 * TILE, sideTop, TILE, sideH, t.side);
  R(ctx, B.c0 * TILE, sideTop, 2, sideH, t.light);
  R(ctx, B.c1 * TILE, sideTop, TILE, sideH, t.side);
  R(ctx, (B.c1 + 1) * TILE - 2, sideTop, 2, sideH, t.dark);
}

function doorSpanForSide(rect: Rect, side: Room["doorSide"], anchor?: number): [{ c: number; r: number }, { c: number; r: number }] {
  const horiz = side === "top" || side === "bottom";
  const midC = (horiz && anchor !== undefined) ? anchor : (rect.c0 + rect.c1) >> 1;
  const midR = (!horiz && anchor !== undefined) ? anchor : (rect.r0 + rect.r1) >> 1;
  if (side === "left")   return [{ c: rect.c0, r: midR - 2 }, { c: rect.c0, r: midR + 3 }];
  if (side === "right")  return [{ c: rect.c1, r: midR - 2 }, { c: rect.c1, r: midR + 3 }];
  if (side === "top")    return [{ c: midC - 2, r: rect.r0 }, { c: midC + 3, r: rect.r0 }];
  return [{ c: midC - 2, r: rect.r1 }, { c: midC + 2, r: rect.r1 }];
}

/** Returns the two tile positions that form the door gap for a room's primary door. */
export function getDoorTiles(room: Room): [{ c: number; r: number }, { c: number; r: number }] | null {
  if (!room.doorSide) return null;
  return doorSpanForSide(room.rect, room.doorSide, room.doorAnchor);
}

/** Returns true if the tile is strictly inside the room (not on the border). */
export function isInsideRoom(room: Room, c: number, r: number): boolean {
  const R = room.rect;
  return c > R.c0 && c < R.c1 && r > R.r0 && r < R.r1;
}

function drawDoorForSide(ctx: Ctx, room: Room, side: Room["doorSide"], anchor?: number) {
  const [t0, t1] = doorSpanForSide(room.rect, side, anchor);
  for (let tc = Math.min(t0.c, t1.c); tc <= Math.max(t0.c, t1.c); tc++)
    for (let tr = Math.min(t0.r, t1.r); tr <= Math.max(t0.r, t1.r); tr++)
      paintFloor(ctx, room.kind, tc, tr, room.customFloorColor, room.floorPattern);
}

/** Draw closed door panel(s) for a room — covers primary and optional secondary door side. */
export function drawClosedDoor(ctx: Ctx, room: Room) {
  if (!room.doorSide) return;
  drawDoorForSide(ctx, room, room.doorSide, room.doorAnchor);
  if (room.doorSide2 && !room.doorOpen2) drawDoorForSide(ctx, room, room.doorSide2);
}

/** Paints floor tiles over the front-wall band at the door position, creating an always-open archway. */
export function drawOpenDoorCutout(ctx: Ctx, room: Room, side: Room["doorSide"], theme: WallTheme = WALL_THEMES.orange.theme) {
  const [t0, t1] = doorSpanForSide(room.rect, side);
  const horiz = side === "top" || side === "bottom";
  const x = Math.min(t0.c, t1.c) * TILE;
  const y = Math.min(t0.r, t1.r) * TILE;
  const w = (Math.abs(t1.c - t0.c) + 1) * TILE;
  const h = horiz ? WALL_VIS : (Math.abs(t1.r - t0.r) + 1) * TILE;
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  const startC = Math.min(t0.c, t1.c);
  const endC   = Math.max(t0.c, t1.c);
  const startR = Math.floor(y / TILE);
  const endR   = Math.ceil((y + h) / TILE);
  for (let tc = startC; tc <= endC; tc++)
    for (let tr = startR; tr < endR; tr++)
      paintFloor(ctx, room.kind, tc, tr, room.customFloorColor, room.floorPattern);
  ctx.restore();
  // Jamb lines on each side + ceiling shadow for depth
  R(ctx, x, y, 2, h, theme.dark);
  R(ctx, x + w - 2, y, 2, h, theme.dark);
  R(ctx, x + 2, y, w - 4, 5, "rgba(0,0,0,0.22)");
}
