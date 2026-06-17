"use client";

import { useEffect, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";
import { TILE, COLS, ROWS, NATIVE_W, NATIVE_H, SCALE, person, SKINS } from "@/lib/sprites";
import {
  buildWorld,
  drawBase,
  drawObject,
  drawNpc,
  rebuildWalk,
  rebuildFloors,
  tileCenterPx,
  approachTile,
  objectById,
  MIN_SPAN,
  isInsideRoom,
  drawClosedDoor,
  drawOpenDoorCutout,
  drawFrontWall,
  drawBuildingSideWalls,
  WALL_THEMES,
  FLOOR_KINDS,
  FLOOR_PATTERNS,
  getWallTheme,
  STATUS_COLOR,
  STATUS_ICON,
  type WorldObject,
  type Room,
  type Patch,
  type Rect,
  type Facing,
  type Floor,
  type FloorPattern,
} from "@/lib/world";
import { bfs, nearestWalkable, type Tile } from "@/lib/pathfind";

const BACK_W = NATIVE_W * SCALE;
const BACK_H = NATIVE_H * SCALE;

type CatalogEntry = {
  kind: string;
  label: string;
  w: number;
  h: number;
  sittable?: boolean;
  sitFacing?: Facing;
};

type CatalogCategory = { name: string; items: CatalogEntry[] };

const ITEM_CATALOG: CatalogCategory[] = [
  {
    name: "Desks",
    items: [
      { kind: "deskMon1", label: "Workstation (single)", w: 4, h: 3 },
      { kind: "deskMon2", label: "Workstation (dual)", w: 5, h: 3 },
      { kind: "deskTower", label: "Workstation (tower)", w: 5, h: 3 },
    ],
  },
  {
    name: "Seating",
    items: [
      { kind: "chair", label: "Chair", w: 1, h: 1, sittable: true, sitFacing: "up" },
      { kind: "gamingChair", label: "Gaming chair", w: 1, h: 1, sittable: true, sitFacing: "up" },
      { kind: "tubUp", label: "Armchair (facing up)", w: 1, h: 1, sittable: true, sitFacing: "up" },
      { kind: "tubDown", label: "Armchair (facing down)", w: 1, h: 1, sittable: true, sitFacing: "down" },
      { kind: "tubLeft", label: "Armchair (facing left)", w: 1, h: 1, sittable: true, sitFacing: "left" },
      { kind: "tubRight", label: "Armchair (facing right)", w: 1, h: 1, sittable: true, sitFacing: "right" },
      { kind: "sofa", label: "Sofa", w: 7, h: 2 },
    ],
  },
  {
    name: "Tables",
    items: [
      { kind: "roundTable", label: "Round table", w: 3, h: 3 },
      { kind: "ovalTable", label: "Conference table", w: 4, h: 4 },
    ],
  },
  {
    name: "Storage",
    items: [
      { kind: "rack", label: "Storage rack", w: 5, h: 2 },
      { kind: "bookshelf", label: "Shelf", w: 4, h: 2 },
      { kind: "whiteCabinet", label: "Book cabinet", w: 4, h: 5 },
      { kind: "locker", label: "Locker", w: 1, h: 2 },
    ],
  },
  {
    name: "Decor",
    items: [
      { kind: "plant", label: "Plant", w: 1, h: 2 },
      { kind: "fiddleLeafFig", label: "Fiddle Leaf Fig", w: 2, h: 3 },
      { kind: "floorLamp", label: "Floor lamp", w: 1, h: 2 },
      { kind: "tv", label: "TV", w: 2, h: 2 },
      { kind: "whiteboard", label: "Whiteboard", w: 3, h: 2 },
      { kind: "easel", label: "Chart easel", w: 2, h: 3 },
      { kind: "officeWindow", label: "Window", w: 3, h: 3 },
    ],
  },
];
const SPEED = 4; // native px per frame — smooth tile-to-tile walk
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

const LAYOUT_KEY = "pixle-office-layout-v4";
const WHO_KEY = "pixle-who-v1";
const posKey = (name: string) => `pixle-pos-v1-${name.toLowerCase()}`;

const TEAM_MEMBERS = ["Sagar", "Pramit", "Neel", "Manjima"] as const;
type TeamMember = typeof TEAM_MEMBERS[number];

// Map display name (any case) → SKINS key
const NAME_TO_SKIN_KEY: Record<string, keyof typeof SKINS> = {
  sagar:    "sagar",
  pramit:   "pramit",
  neel:     "neel",
  manjima: "manjima",
};
const getSkinKey = (name: string): keyof typeof SKINS =>
  NAME_TO_SKIN_KEY[name.toLowerCase()] ?? "sagar";

const DEFAULT_LAYOUT = {"building":{"c0":22,"r0":22,"c1":82,"r1":75},"buildingFloor":"lav","buildingFloorColor":"#ae9066","wallTheme":"charcoal","rooms":[{"id":"room_1","label":"Meeting Room 2","rect":{"c0":82,"r0":23,"c1":101,"r1":43},"doorSide":"left","kind":"lav","customFloorColor":"#ae9066"},{"id":"room_3","label":"Meeting Room 1","rect":{"c0":2,"r0":39,"c1":22,"r1":58},"doorSide":"right","kind":"lav","customFloorColor":"#ae9066"},{"id":"room_4","label":"Reception","rect":{"c0":2,"r0":64,"c1":22,"r1":86},"doorSide":"right","doorAnchor":70,"doorSide2":"bottom","doorOpen2":true,"kind":"lav","customFloorColor":"#ae9066"}],"patches":[{"id":"rug1","rect":{"c0":36,"r0":39,"c1":72,"r1":64},"kind":"rug","customFloorColor":"#a88661"}],"objects":[{"id":"deskTower_4","label":"Workstation (tower)","kind":"deskTower","c":59,"r":57,"w":5,"h":3,"scale":1.45},{"id":"deskTower_11","label":"Workstation (tower)","kind":"deskTower","c":45,"r":57,"w":5,"h":3,"scale":1.45},{"id":"deskTower_12","label":"Workstation (tower)","kind":"deskTower","c":52,"r":57,"w":5,"h":3,"scale":1.45},{"id":"deskTower_18","label":"Workstation (tower)","kind":"deskTower","c":59,"r":44,"w":5,"h":3,"scale":1.45},{"id":"deskTower_19","label":"Workstation (tower)","kind":"deskTower","c":45,"r":44,"w":5,"h":3,"scale":1.45},{"id":"deskTower_20","label":"Workstation (tower)","kind":"deskTower","c":52,"r":44,"w":5,"h":3,"scale":1.45},{"id":"chair_7","label":"Chair","kind":"chair","c":47,"r":60,"w":1,"h":1,"scale":2.5,"sittable":true,"sitFacing":"up"},{"id":"chair_13","label":"Chair","kind":"chair","c":61,"r":60,"w":1,"h":1,"scale":2.5,"sittable":true,"sitFacing":"up"},{"id":"chair_14","label":"Chair","kind":"chair","c":54,"r":60,"w":1,"h":1,"scale":2.5,"sittable":true,"sitFacing":"up"},{"id":"chair_15","label":"Chair","kind":"chair","c":47,"r":48,"w":1,"h":1,"scale":2.5,"sittable":true,"sitFacing":"up"},{"id":"chair_16","label":"Chair","kind":"chair","c":54,"r":48,"w":1,"h":1,"scale":2.5,"sittable":true,"sitFacing":"up"},{"id":"chair_17","label":"Chair","kind":"chair","c":61,"r":48,"w":1,"h":1,"scale":2.5,"sittable":true,"sitFacing":"up"},{"id":"chair_65","label":"Chair","kind":"chair","c":16,"r":50,"w":1,"h":1,"scale":2.5,"rotation":270,"sittable":true,"sitFacing":"left"},{"id":"chair_66","label":"Chair","kind":"chair","c":8,"r":50,"w":1,"h":1,"scale":2.5,"rotation":270,"sittable":true,"sitFacing":"left"},{"id":"chair_67","label":"Chair","kind":"chair","c":10,"r":54,"w":1,"h":1,"scale":2.5,"rotation":180,"sittable":true,"sitFacing":"down"},{"id":"chair_68","label":"Chair","kind":"chair","c":14,"r":54,"w":1,"h":1,"scale":2.5,"rotation":180,"sittable":true,"sitFacing":"down"},{"id":"chair_69","label":"Chair","kind":"chair","c":10,"r":47,"w":1,"h":1,"scale":2.5,"rotation":0,"sittable":true,"sitFacing":"up"},{"id":"chair_72","label":"Chair","kind":"chair","c":14,"r":47,"w":1,"h":1,"scale":2.5,"sittable":true,"sitFacing":"up"},{"id":"gamingChair_34","label":"Gaming chair","kind":"gamingChair","c":60,"r":25,"w":1,"h":1,"scale":3,"sittable":true,"sitFacing":"up"},{"id":"gamingChair_79","label":"Gaming chair","kind":"gamingChair","c":7,"r":70,"w":1,"h":1,"scale":3,"sittable":true,"sitFacing":"up"},{"id":"sofa_21","label":"Sofa","kind":"sofa","c":76,"r":50,"w":7,"h":2,"scale":2.2,"rotation":90},{"id":"sofa_82","label":"Sofa","kind":"sofa","c":17,"r":82,"w":7,"h":2,"scale":1.75,"rotation":90},{"id":"roundTable_22","label":"Round table","kind":"roundTable","c":74,"r":50,"w":3,"h":3,"scale":1.55},{"id":"roundTable_46","label":"Round table","kind":"roundTable","c":6,"r":82,"w":3,"h":3},{"id":"ovalTable_50","label":"Conference table","kind":"ovalTable","c":91,"r":32,"w":4,"h":4,"scale":1.52},{"id":"locker_23","label":"Locker","kind":"locker","c":99,"r":22,"w":1,"h":2,"scale":3},{"id":"locker_35","label":"Locker","kind":"locker","c":45,"r":23,"w":1,"h":2,"scale":3,"rotation":90},{"id":"locker_37","label":"Locker","kind":"locker","c":20,"r":64,"w":1,"h":2,"scale":3},{"id":"locker_73","label":"Locker","kind":"locker","c":4,"r":39,"w":1,"h":2,"scale":3},{"id":"locker_74","label":"Locker","kind":"locker","c":7,"r":39,"w":1,"h":2,"scale":3},{"id":"locker_86","label":"Locker","kind":"locker","c":49,"r":23,"w":1,"h":2,"scale":3,"rotation":90},{"id":"bookshelf_24","label":"Shelf","kind":"bookshelf","c":86,"r":23,"w":4,"h":2,"scale":2.2},{"id":"bookshelf_77","label":"Shelf","kind":"bookshelf","c":3,"r":36,"w":4,"h":2,"scale":1.01},{"id":"whiteCabinet_31","label":"Book cabinet","kind":"whiteCabinet","c":27,"r":22,"w":4,"h":5,"scale":1.7},{"id":"whiteCabinet_40","label":"Book cabinet","kind":"whiteCabinet","c":5,"r":62,"w":4,"h":5,"scale":1.62},{"id":"plant_25","label":"Plant","kind":"plant","c":95,"r":22,"w":1,"h":2,"scale":2.57},{"id":"plant_32","label":"Plant","kind":"plant","c":80,"r":56,"w":1,"h":2,"scale":3},{"id":"plant_83","label":"Plant","kind":"plant","c":17,"r":85,"w":1,"h":2,"scale":3},{"id":"fiddleLeafFig_27","label":"Fiddle Leaf Fig","kind":"fiddleLeafFig","c":78,"r":23,"w":2,"h":3,"scale":1.63},{"id":"fiddleLeafFig_47","label":"Fiddle Leaf Fig","kind":"fiddleLeafFig","c":12,"r":64,"w":2,"h":3,"scale":1.23},{"id":"fiddleLeafFig_76","label":"Fiddle Leaf Fig","kind":"fiddleLeafFig","c":19,"r":38,"w":2,"h":3,"scale":1.52},{"id":"tv_28","label":"TV","kind":"tv","c":47,"r":21,"w":2,"h":2,"scale":3},{"id":"rack_29","label":"Storage rack","kind":"rack","c":57,"r":23,"w":5,"h":2,"scale":2.47},{"id":"whiteboard_38","label":"Whiteboard","kind":"whiteboard","c":70,"r":21,"w":3,"h":2,"scale":2.33},{"id":"whiteboard_48","label":"Whiteboard","kind":"whiteboard","c":15,"r":59,"w":3,"h":2},{"id":"easel_39","label":"Chart easel","kind":"easel","c":64,"r":39,"w":2,"h":3,"scale":2.72},{"id":"easel_75","label":"Chart easel","kind":"easel","c":14,"r":38,"w":2,"h":3,"scale":2.21,"rotation":0},{"id":"deskMon2_59","label":"Workstation (dual)","kind":"deskMon2","c":10,"r":49,"w":5,"h":3,"scale":1.64},{"id":"deskMon2_80","label":"Workstation (dual)","kind":"deskMon2","c":6,"r":72,"w":5,"h":3,"scale":1.51,"rotation":180},{"id":"tubDown_54","label":"Armchair","kind":"tubDown","c":93,"r":39,"w":1,"h":1,"scale":3,"rotation":180,"sittable":true,"sitFacing":"up"},{"id":"tubDown_57","label":"Armchair","kind":"tubDown","c":93,"r":28,"w":1,"h":1,"scale":3,"sittable":true,"sitFacing":"down"},{"id":"tubLeft_42","label":"Armchair","kind":"tubLeft","c":4,"r":83,"w":1,"h":1,"scale":3,"sittable":true,"sitFacing":"left"},{"id":"tubLeft_56","label":"Armchair","kind":"tubLeft","c":87,"r":33,"w":1,"h":1,"scale":2.85,"sittable":true,"sitFacing":"left"},{"id":"tubRight_58","label":"Armchair","kind":"tubRight","c":98,"r":33,"w":1,"h":1,"scale":3,"sittable":true,"sitFacing":"right"},{"id":"officeWindow_1","label":"Window","kind":"officeWindow","c":64,"r":76,"w":3,"h":3,"scale":1.5002039473697546},{"id":"officeWindow_2","label":"Window","kind":"officeWindow","c":68,"r":76,"w":3,"h":3,"scale":1.5002039473697546},{"id":"officeWindow_5","label":"Window","kind":"officeWindow","c":33,"r":76,"w":3,"h":3,"scale":1.5002039473697546},{"id":"officeWindow_6","label":"Window","kind":"officeWindow","c":33,"r":19,"w":3,"h":3,"scale":1.5002039473697546},{"id":"officeWindow_7","label":"Window","kind":"officeWindow","c":37,"r":19,"w":3,"h":3,"scale":1.5002039473697546},{"id":"officeWindow_8","label":"Window","kind":"officeWindow","c":41,"r":19,"w":3,"h":3,"scale":1.5002039473697546},{"id":"officeWindow_9","label":"Window","kind":"officeWindow","c":37,"r":76,"w":3,"h":3,"scale":1.5002039473697546},{"id":"officeWindow_10","label":"Window","kind":"officeWindow","c":41,"r":76,"w":3,"h":3,"scale":1.5002039473697546},{"id":"officeWindow_11","label":"Window","kind":"officeWindow","c":18,"r":87,"w":3,"h":3,"scale":1.5002039473697546},{"id":"officeWindow_12","label":"Window","kind":"officeWindow","c":4,"r":87,"w":3,"h":3,"scale":1.5002039473697546},{"id":"officeWindow_13","label":"Window","kind":"officeWindow","c":10,"r":35,"w":3,"h":3,"scale":1.5002039473697546},{"id":"officeWindow_15","label":"Window","kind":"officeWindow","c":14,"r":35,"w":3,"h":3,"scale":1.5002039473697546},{"id":"officeWindow_16","label":"Window","kind":"officeWindow","c":89,"r":19,"w":3,"h":3,"scale":1.5002039473697546},{"id":"officeWindow_17","label":"Window","kind":"officeWindow","c":93,"r":19,"w":3,"h":3,"scale":1.5002039473697546},{"id":"officeWindow_18","label":"Window","kind":"officeWindow","c":90,"r":44,"w":3,"h":3,"scale":1.5002039473697546},{"id":"officeWindow_19","label":"Window","kind":"officeWindow","c":94,"r":44,"w":3,"h":3,"scale":1.5002039473697546},{"id":"rack","label":"Storage rack","kind":"rack","c":11,"r":5,"w":5,"h":2},{"id":"plantA","label":"Plant","kind":"plant","c":17,"r":5,"w":1,"h":2},{"id":"chart","label":"Chart easel","kind":"easel","c":19,"r":5,"w":2,"h":3},{"id":"shelfT","label":"Shelf","kind":"bookshelf","c":24,"r":5,"w":4,"h":2},{"id":"plantB","label":"Plant","kind":"plant","c":30,"r":5,"w":1,"h":2},{"id":"wb","label":"Whiteboard","kind":"whiteboard","c":32,"r":5,"w":3,"h":2},{"id":"plantFig","label":"Fiddle Leaf Fig","kind":"fiddleLeafFig","c":38,"r":5,"w":2,"h":3},{"id":"deskA","label":"Workstation","kind":"deskMon2","c":15,"r":14,"w":5,"h":3},{"id":"deskB","label":"Workstation","kind":"deskMon1","c":22,"r":14,"w":4,"h":3},{"id":"sagarChair","label":"Chair — click to sit","kind":"chair","c":61,"r":48,"w":1,"h":1,"sittable":true,"sitFacing":"up"},{"id":"chB","label":"Chair — click to sit","kind":"chair","c":23,"r":17,"w":1,"h":1,"sittable":true,"sitFacing":"up"},{"id":"deskC","label":"Workstation","kind":"deskTower","c":15,"r":21,"w":5,"h":3},{"id":"deskD","label":"Workstation","kind":"deskMon2","c":22,"r":21,"w":4,"h":3},{"id":"chC","label":"Chair — click to sit","kind":"chair","c":17,"r":24,"w":1,"h":1,"sittable":true,"sitFacing":"up"},{"id":"ltv","label":"TV","kind":"tv","c":32,"r":13,"w":2,"h":2},{"id":"ltable","label":"Round table","kind":"roundTable","c":32,"r":20,"w":3,"h":3},{"id":"lc1","label":"Armchair — click to sit","kind":"tubDown","c":33,"r":19,"w":1,"h":1,"sittable":true,"sitFacing":"down"},{"id":"lc2","label":"Armchair — click to sit","kind":"tubUp","c":33,"r":24,"w":1,"h":1,"sittable":true,"sitFacing":"up"},{"id":"mtable","label":"Conference table","kind":"longTable","c":84,"r":28,"w":14,"h":4},{"id":"mc1","label":"Chair — click to sit","kind":"tubUp","c":42,"r":14,"w":1,"h":1,"sittable":true,"sitFacing":"up"},{"id":"mc2","label":"Chair — click to sit","kind":"tubDown","c":42,"r":21,"w":1,"h":1,"sittable":true,"sitFacing":"down"},{"id":"llamp","label":"Floor lamp","kind":"floorLamp","c":43,"r":12,"w":1,"h":2},{"id":"shelfL","label":"Shelf","kind":"bookshelf","c":4,"r":7,"w":4,"h":2},{"id":"plantL","label":"Plant","kind":"plant","c":4,"r":16,"w":1,"h":2},{"id":"locker","label":"Locker","kind":"locker","c":4,"r":24,"w":1,"h":2},{"id":"gchair","label":"Gaming chair — click to sit","kind":"gamingChair","c":5,"r":28,"w":1,"h":1,"sittable":true,"sitFacing":"up"},{"id":"sofa","label":"Sofa","kind":"sofa","c":11,"r":36,"w":7,"h":2},{"id":"coffee","label":"Coffee table","kind":"roundTable","c":13,"r":40,"w":3,"h":2},{"id":"sc1","label":"Armchair — click to sit","kind":"tubRight","c":11,"r":41,"w":1,"h":1,"sittable":true,"sitFacing":"right"},{"id":"sc2","label":"Armchair — click to sit","kind":"tubLeft","c":18,"r":41,"w":1,"h":1,"sittable":true,"sitFacing":"left"},{"id":"oTR1","label":"Tree","kind":"treeRound","c":3,"r":0,"w":5,"h":6},{"id":"oTP1","label":"Pine","kind":"treePine","c":13,"r":0,"w":4,"h":6},{"id":"oBsh1","label":"Bush","kind":"bush","c":20,"r":3,"w":2,"h":2},{"id":"oTP2","label":"Pine","kind":"treePine","c":80,"r":0,"w":4,"h":6},{"id":"oTR2","label":"Tree","kind":"treeRound","c":87,"r":0,"w":5,"h":6},{"id":"oBsh2","label":"Bush","kind":"bush","c":76,"r":3,"w":2,"h":2},{"id":"oTC1","label":"Tree","kind":"treeCluster","c":85,"r":47,"w":5,"h":7},{"id":"oBsh3","label":"Bush","kind":"bush","c":93,"r":55,"w":2,"h":2},{"id":"oTP3","label":"Pine","kind":"treePine","c":24,"r":78,"w":4,"h":6},{"id":"oTC2","label":"Tree","kind":"treeCluster","c":45,"r":78,"w":5,"h":7},{"id":"oBsh4","label":"Bush","kind":"bush","c":57,"r":82,"w":2,"h":2},{"id":"oTR3","label":"Tree","kind":"treeRound","c":63,"r":78,"w":5,"h":6},{"id":"oBsh5","label":"Bush","kind":"bush","c":75,"r":82,"w":2,"h":2},{"id":"oTP4","label":"Pine","kind":"treePine","c":84,"r":78,"w":4,"h":6},{"id":"mlamp","label":"Floor lamp","kind":"floorLamp","c":25,"r":36,"w":1,"h":2},{"id":"cab1","label":"Book cabinet","kind":"whiteCabinet","c":34,"r":33,"w":4,"h":5},{"id":"cab2","label":"Book cabinet","kind":"whiteCabinet","c":29,"r":33,"w":4,"h":5},{"id":"otable","label":"Table","kind":"ovalTable","c":31,"r":39,"w":5,"h":3},{"id":"deskTower_1","label":"Workstation (tower)","kind":"deskTower","c":25,"r":26,"w":5,"h":3},{"id":"deskTower_2","label":"Workstation (tower)","kind":"deskTower","c":43,"r":57,"w":5,"h":3},{"id":"deskTower_3","label":"Workstation (tower)","kind":"deskTower","c":51,"r":57,"w":5,"h":3},{"id":"chair_8","label":"Chair","kind":"chair","c":53,"r":60,"w":1,"h":1,"sittable":true,"sitFacing":"up"},{"id":"chair_10","label":"Chair","kind":"chair","c":45,"r":60,"w":1,"h":1,"sittable":true,"sitFacing":"up"},{"id":"chair_45","label":"Chair","kind":"chair","c":8,"r":70,"w":1,"h":1,"scale":2.5,"sittable":true,"sitFacing":"up"},{"id":"chair_60","label":"Chair","kind":"chair","c":12,"r":46,"w":1,"h":1,"scale":2.5,"sittable":true,"sitFacing":"up"},{"id":"chair_61","label":"Chair","kind":"chair","c":12,"r":47,"w":1,"h":1,"scale":2.5,"sittable":true,"sitFacing":"up"},{"id":"chair_62","label":"Chair","kind":"chair","c":13,"r":48,"w":1,"h":1,"scale":2.5,"sittable":true,"sitFacing":"up"},{"id":"chair_63","label":"Chair","kind":"chair","c":14,"r":49,"w":1,"h":1,"scale":2.5,"sittable":true,"sitFacing":"up"},{"id":"chair_64","label":"Chair","kind":"chair","c":15,"r":50,"w":1,"h":1,"scale":2.5,"sittable":true,"sitFacing":"up"},{"id":"chair_70","label":"Chair","kind":"chair","c":12,"r":48,"w":1,"h":1,"scale":2.5,"rotation":0,"sittable":true,"sitFacing":"up"},{"id":"chair_71","label":"Chair","kind":"chair","c":48,"r":61,"w":1,"h":1,"scale":2.5,"sittable":true,"sitFacing":"up"},{"id":"gamingChair_9","label":"Gaming chair","kind":"gamingChair","c":63,"r":55,"w":1,"h":1,"sittable":true,"sitFacing":"up"},{"id":"sofa_30","label":"Sofa","kind":"sofa","c":27,"r":23,"w":7,"h":2,"scale":2.04},{"id":"ovalTable_78","label":"Conference table","kind":"ovalTable","c":6,"r":72,"w":4,"h":4,"scale":1.66},{"id":"locker_36","label":"Locker","kind":"locker","c":42,"r":22,"w":1,"h":2,"scale":3},{"id":"plant_5","label":"Plant","kind":"plant","c":55,"r":44,"w":1,"h":2},{"id":"plant_6","label":"Plant","kind":"plant","c":46,"r":44,"w":1,"h":2},{"id":"floorLamp_26","label":"Floor lamp","kind":"floorLamp","c":79,"r":74,"w":1,"h":2,"scale":3},{"id":"floorLamp_49","label":"Floor lamp","kind":"floorLamp","c":4,"r":63,"w":1,"h":2,"scale":2.34},{"id":"floorLamp_85","label":"Floor lamp","kind":"floorLamp","c":12,"r":63,"w":1,"h":2,"scale":2.16},{"id":"tv_84","label":"TV","kind":"tv","c":7,"r":73,"w":2,"h":2,"scale":3},{"id":"deskMon1_44","label":"Workstation (single)","kind":"deskMon1","c":7,"r":72,"w":4,"h":3,"scale":1.45,"rotation":180},{"id":"tubDown_33","label":"Armchair","kind":"tubDown","c":40,"r":25,"w":1,"h":1,"scale":3,"sittable":true,"sitFacing":"down"},{"id":"tubDown_51","label":"Armchair","kind":"tubDown","c":76,"r":34,"w":1,"h":1,"sittable":true,"sitFacing":"down"},{"id":"tubDown_52","label":"Armchair","kind":"tubDown","c":99,"r":33,"w":1,"h":1,"scale":3,"rotation":90,"sittable":true,"sitFacing":"down"},{"id":"tubDown_53","label":"Armchair","kind":"tubDown","c":92,"r":42,"w":1,"h":1,"scale":3,"rotation":180,"sittable":true,"sitFacing":"up"},{"id":"tubDown_55","label":"Armchair","kind":"tubDown","c":100,"r":34,"w":1,"h":1,"scale":3,"rotation":90,"sittable":true,"sitFacing":"down"},{"id":"tubLeft_41","label":"Armchair","kind":"tubLeft","c":4,"r":87,"w":1,"h":1,"scale":3,"sittable":true,"sitFacing":"left"},{"id":"tubLeft_43","label":"Armchair","kind":"tubLeft","c":4,"r":84,"w":1,"h":1,"scale":3,"sittable":true,"sitFacing":"left"},{"id":"tubRight_81","label":"Armchair","kind":"tubRight","c":19,"r":78,"w":1,"h":1,"scale":3,"sittable":true,"sitFacing":"right"},{"id":"officeWindow_3","label":"Window","kind":"officeWindow","c":41,"r":76,"w":3,"h":3,"scale":1.5002039473697546},{"id":"officeWindow_4","label":"Window","kind":"officeWindow","c":37,"r":76,"w":3,"h":3,"scale":1.5002039473697546},{"id":"officeWindow_14","label":"Window","kind":"officeWindow","c":14,"r":34,"w":3,"h":3,"scale":1.5002039473697546},{"id":"officeWindow_1","kind":"officeWindow","label":"Window","c":69,"r":78,"w":3,"h":3}],"gallery":["rack","plantA","chart","shelfT","plantB","wb","plantFig","deskA","deskB","sagarChair","chB","deskC","deskD","chC","ltv","ltable","lc1","lc2","mtable","mc1","mc2","llamp","shelfL","plantL","locker","gchair","sofa","coffee","sc1","sc2","oTR1","oTP1","oBsh1","oTP2","oTR2","oBsh2","oTC1","oBsh3","oTP3","oTC2","oBsh4","oTR3","oBsh5","oTP4","mlamp","cab1","cab2","otable","deskTower_1","deskTower_2","deskTower_3","chair_8","chair_10","chair_45","chair_60","chair_61","chair_62","chair_63","chair_64","chair_70","chair_71","gamingChair_9","sofa_30","ovalTable_78","locker_36","plant_5","plant_6","floorLamp_26","floorLamp_49","floorLamp_85","tv_84","deskMon1_44","tubDown_33","tubDown_51","tubDown_52","tubDown_53","tubDown_55","tubLeft_41","tubLeft_43","tubRight_81","officeWindow_3","officeWindow_4","officeWindow_14","officeWindow_1"],"deletedRooms":[],"addedRooms":[],"deletedPatches":[]};

type SaveData = {
  building: Rect;
  buildingFloor?: Floor;
  buildingFloorColor?: string;
  buildingFloorPattern?: FloorPattern;
  wallTheme?: string;
  rooms: { id: string; label?: string; rect: Rect; doorSide?: Room["doorSide"] | null; doorAnchor?: number; doorSide2?: Room["doorSide"]; doorOpen2?: boolean; kind?: Floor; customFloorColor?: string; floorPattern?: FloorPattern; wallTheme?: string }[];
  patches: { id: string; rect: Rect; kind?: Floor; customFloorColor?: string; floorPattern?: FloorPattern }[];
  objects: WorldObject[];
  gallery: string[];
  deletedRooms?: string[];
  addedRooms?: Room[];
  deletedPatches?: string[];
};

type Sel =
  | { kind: "object"; obj: WorldObject }
  | { kind: "patch"; patch: Patch }
  | { kind: "room"; room: Room }
  | { kind: "building" };

type ApiHandle = {
  scale: (d: number) => void;
  rotate: (step: 90 | -90) => void;
  duplicate: () => void;
  duplicateBuilding: () => void;
  duplicateRoom: () => void;
  remove: () => void;
  deleteRoom: () => void;
  setDoorSide: (side: Room["doorSide"]) => void;
  setDoorAnchor: (v: number) => void;
  deleteDoor: () => void;
  addDoor: (side: Room["doorSide"]) => void;
  addSecondDoor: () => void;
  deleteSecondDoor: () => void;
  toggleDoorOpen2: () => void;
  removePatch: () => void;
  addFromCatalog: (entry: CatalogEntry, tileC?: number, tileR?: number) => void;
  removeAll: () => void;
  deselect: () => void;
  save: () => void;
  setFloorKind: (kind: Floor) => void;
  setFloorPattern: (pattern: FloorPattern) => void;
  setWallTheme: (theme: string) => void;
  setCustomWallColor: (hex: string) => void;
  setCustomFloorColor: (hex: string) => void;
  goToDesk: () => void;
  goToNpc: (npcId: string) => void;
  goToRandomRoom: () => string | null;
};

function ItemPreview({ entry }: { entry: CatalogEntry }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const SIZE = 80;
    canvas.width = SIZE;
    canvas.height = SIZE;
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, SIZE, SIZE);

    const nW = entry.w * TILE;
    const nH = entry.h * TILE;
    const pad = 8;
    const scale = Math.min((SIZE - pad * 2) / nW, (SIZE - pad * 2) / nH);
    const sw = nW * scale;
    const sh = nH * scale;

    ctx.save();
    ctx.translate(Math.round((SIZE - sw) / 2), Math.round((SIZE - sh) / 2));
    ctx.scale(scale, scale);
    drawObject(ctx, { id: "_prev", kind: entry.kind, label: entry.label, c: 0, r: 0, w: entry.w, h: entry.h });
    ctx.restore();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return <canvas ref={canvasRef} className="libItemCanvas" />;
}

type PresenceUser = { name: string; c: number; r: number; x: number; y: number; facing: string; sitting: boolean; moving: boolean; status?: string };

// Socket singleton outside React so Strict Mode double-invoke doesn't create two connections
let _socket: Socket | null = null;
const getSocket = () => {
  if (!_socket) {
    const url = process.env.NEXT_PUBLIC_SOCKET_URL ?? "";
    _socket = url ? io(url) : io();
  }
  return _socket;
};

export default function Office() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const apiRef = useRef<ApiHandle | null>(null);
  const panRef = useRef({ x: 0, y: 0 });
  const editLayoutRef = useRef(false);
  const [editLayout, setEditLayout] = useState(false);
  const [selInfo, setSelInfo] = useState<{ kind: string; label: string; doorSide?: Room["doorSide"]; doorAnchor?: number; doorSide2?: Room["doorSide"]; doorOpen2?: boolean; floorKind?: Floor; floorPattern?: FloorPattern; wallTheme?: string; wallHex?: string; floorHex?: string } | null>(null);
  const [showLibrary, setShowLibrary] = useState(false);
  const [saved, setSaved] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [whoAmI, setWhoAmI] = useState<TeamMember | null>(null);
  const whoAmIRef = useRef<TeamMember | null>(null);
  const STATUS_KEY = "pixle-status-v1";
  type UserStatus = "online" | "busy" | "away";
  const [myStatus, setMyStatus] = useState<UserStatus>("online");
  const myStatusRef = useRef<UserStatus>("online");
  useEffect(() => {
    const v = sessionStorage.getItem(WHO_KEY);
    if (TEAM_MEMBERS.includes(v as TeamMember)) {
      whoAmIRef.current = v as TeamMember;
      setWhoAmI(v as TeamMember);
    }
    const s = localStorage.getItem(STATUS_KEY);
    if (s === "online" || s === "busy" || s === "away") {
      myStatusRef.current = s;
      setMyStatus(s);
    }
  }, []);
  const [npcModal, setNpcModal] = useState<{ id: string; name: string; status: string; slackUserId?: string } | null>(null);
  // Native-px position of the NPC that triggered the modal — updated every frame
  const npcModalPosRef = useRef<{ x: number; y: number } | null>(null);
  const [npcModalPos, setNpcModalPos] = useState<{ x: number; y: number } | null>(null);
  type MeetPrompt = { kind: "npc"; name: string } | { kind: "room"; name: string } | null;
  const [meetPrompt, setMeetPrompt] = useState<MeetPrompt>(null);
  const meetPromptRef = useRef<MeetPrompt>(null);
  const meetDismissedRef = useRef<MeetPrompt>(null);
  const dragEntryRef = useRef<CatalogEntry | null>(null);
  const dragHoverRef = useRef<{ c: number; r: number; entry: CatalogEntry } | null>(null);
  const currentRoomRef = useRef<string | null>(null);
  const npcModalRef = useRef<{ id: string; name: string; status: string; slackUserId?: string } | null>(null);
  const mousePxRef = useRef<{ x: number; y: number }>({ x: -999, y: -999 });
  const [remoteUsers, setRemoteUsers] = useState<Record<string, PresenceUser>>({});
  const remoteUsersRef = useRef<Record<string, PresenceUser>>({});
  const broadcastPositionRef = useRef<((p: PresenceUser) => void) | null>(null);
  const updatePresenceRef = useRef<((pos: { c: number; r: number; facing: string; sitting: boolean }) => void) | null>(null);
  // Populated after buildWorld() — maps lowercase name → assigned seat tile
  const seatByNameRef = useRef<Record<string, { c: number; r: number; facing: string }>>({});
  const [meetInviteToast, setMeetInviteToast] = useState<{ from: string; room: string } | null>(null);
  const goToRoomRef = useRef<((roomLabel: string) => void) | null>(null);

  const MEET_LINK = "https://meet.google.com/qzr-qkwn-bxx";
  const SLACK_TEAM_ID = "T_YOUR_TEAM_ID";
  const SLACK_CHANNEL_ID = "C_YOUR_CHANNEL_ID";
  const slackChannelUrl = `slack://channel?team=${SLACK_TEAM_ID}&id=${SLACK_CHANNEL_ID}`;
  const slackDmUrl = (userId: string) => `slack://user?team=${SLACK_TEAM_ID}&id=${userId}`;

  const SLACK_CHANNELS = [
    { name: "general",     id: "C_GENERAL_ID" },
    { name: "design",      id: "C_DESIGN_ID" },
    { name: "engineering", id: "C_ENGINEERING_ID" },
    { name: "random",      id: "C_RANDOM_ID" },
    { name: "office",      id: "C_OFFICE_ID" },
  ];

  const playTing = () => {
    try {
      const ac = new AudioContext();
      const osc = ac.createOscillator();
      const gain = ac.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(1318.5, ac.currentTime); // E6 — bright ting
      osc.frequency.exponentialRampToValueAtTime(880, ac.currentTime + 0.4);
      gain.gain.setValueAtTime(0.28, ac.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.55);
      osc.connect(gain);
      gain.connect(ac.destination);
      osc.start(ac.currentTime);
      osc.stop(ac.currentTime + 0.6);
      setTimeout(() => ac.close(), 1000);
    } catch { /* no audio permission */ }
  };

  const playChime = () => {
    try {
      const ac = new AudioContext();
      const gain = ac.createGain();
      gain.connect(ac.destination);
      [523.25, 659.25, 783.99].forEach((freq, i) => {
        const osc = ac.createOscillator();
        osc.type = "sine";
        osc.frequency.value = freq;
        const g = ac.createGain();
        g.gain.setValueAtTime(0, ac.currentTime + i * 0.12);
        g.gain.linearRampToValueAtTime(0.22, ac.currentTime + i * 0.12 + 0.04);
        g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + i * 0.12 + 0.6);
        osc.connect(g);
        g.connect(gain);
        osc.start(ac.currentTime + i * 0.12);
        osc.stop(ac.currentTime + i * 0.12 + 0.7);
      });
      setTimeout(() => ac.close(), 2000);
    } catch { /* no audio permission */ }
  };

  const socketRef = useRef<Socket | null>(null);

  const broadcastWave = () => socketRef.current?.emit("wave", { from: whoAmI ?? "Someone" });
  const broadcastChime = () => socketRef.current?.emit("chime", { from: whoAmI ?? "Someone" });
  const broadcastMeetInvite = (roomLabel: string) => socketRef.current?.emit("meet-invite", { from: whoAmI ?? "Someone", room: roomLabel });

  useEffect(() => {
    if (!whoAmI) return;

    const socket = getSocket();
    socketRef.current = socket;

    broadcastPositionRef.current = (pos: PresenceUser) => socket.emit("pos", pos);
    updatePresenceRef.current = (pos: { c: number; r: number; facing: string; sitting: boolean }) =>
      socket.emit("update-presence", { name: whoAmI, ...pos });

    const onConnect = () => {
      const savedRaw = localStorage.getItem(posKey(whoAmI.toLowerCase()));
      const saved = savedRaw ? JSON.parse(savedRaw) as { c: number; r: number; facing: string; sitting: boolean } : null;
      const seat = seatByNameRef.current[whoAmI.toLowerCase()];
      socket.emit("join", {
        name: whoAmI,
        c: saved?.c ?? seat?.c ?? 0,
        r: saved?.r ?? seat?.r ?? 0,
        facing: saved?.facing ?? seat?.facing ?? "down",
        sitting: saved?.sitting ?? false,
        status: myStatusRef.current,
      });
    };
    socket.on("connect", onConnect);
    if (socket.connected) onConnect();

    const onPos = (payload: PresenceUser) => {
      if (!payload?.name || payload.name === whoAmI) return;
      remoteUsersRef.current[payload.name] = payload;
    };
    socket.on("pos", onPos);

    const onSync = (state: Record<string, { name: string; c?: number; r?: number; facing?: string; sitting?: boolean }>) => {
      for (const [, pres] of Object.entries(state)) {
        if (pres.name === whoAmI) continue;
        if (!remoteUsersRef.current[pres.name]) {
          const seat = seatByNameRef.current[pres.name.toLowerCase()];
          const c = (pres.c !== undefined && pres.c !== 0) ? pres.c : (seat?.c ?? 0);
          const r = (pres.r !== undefined && pres.r !== 0) ? pres.r : (seat?.r ?? 0);
          const facing = pres.facing ?? seat?.facing ?? "down";
          const sp = tileCenterPx(c, r);
          remoteUsersRef.current[pres.name] = { name: pres.name, c, r, x: sp.x, y: sp.y, facing, sitting: pres.sitting ?? false, moving: false };
        }
      }
      setRemoteUsers({ ...remoteUsersRef.current });
    };
    socket.on("sync", onSync);

    const onJoin = ({ key, pres }: { key: string; pres: { name: string; c?: number; r?: number; facing?: string; sitting?: boolean } }) => {
      if (key === whoAmI) return;
      const name = pres?.name ?? key;
      if (!remoteUsersRef.current[name]) {
        const seat = seatByNameRef.current[name.toLowerCase()];
        const c = (pres?.c !== undefined && pres.c !== 0) ? pres.c : (seat?.c ?? 0);
        const r = (pres?.r !== undefined && pres.r !== 0) ? pres.r : (seat?.r ?? 0);
        const facing = pres?.facing ?? seat?.facing ?? "down";
        const sp = tileCenterPx(c, r);
        remoteUsersRef.current[name] = { name, c, r, x: sp.x, y: sp.y, facing, sitting: pres?.sitting ?? false, moving: false };
        setRemoteUsers({ ...remoteUsersRef.current });
      }
    };
    socket.on("join", onJoin);

    const onLeave = ({ key, name }: { key: string; name: string }) => {
      if (key === whoAmI) return;
      delete remoteUsersRef.current[key];
      if (name !== key) delete remoteUsersRef.current[name];
      setRemoteUsers({ ...remoteUsersRef.current });
    };
    socket.on("leave", onLeave);

    const onWave = () => playTing();
    const onChime = () => playChime();
    const onMeetInvite = ({ from, room }: { from: string; room: string }) => {
      if (!room) return;
      goToRoomRef.current?.(room);
      playChime();
      setMeetInviteToast({ from, room });
      setTimeout(() => setMeetInviteToast(null), 5000);
    };
    socket.on("wave", onWave);
    socket.on("chime", onChime);
    socket.on("meet-invite", onMeetInvite);

    return () => {
      socket.off("connect", onConnect);
      socket.off("pos", onPos);
      socket.off("sync", onSync);
      socket.off("join", onJoin);
      socket.off("leave", onLeave);
      socket.off("wave", onWave);
      socket.off("chime", onChime);
      socket.off("meet-invite", onMeetInvite);
      broadcastPositionRef.current = null;
      updatePresenceRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [whoAmI]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const world = buildWorld();

    // Build seat lookup for the join handler (NPC seats + Sagar's named chair)
    const seatMap: Record<string, { c: number; r: number; facing: string }> = {};
    for (const n of world.npcs) seatMap[n.id.toLowerCase()] = { c: n.c, r: n.r, facing: n.facing };
    const _sagarChairSeed = world.gallery.find((o) => o.id === "sagarChair") ?? world.objects.find((o) => o.id === "sagarChair");
    if (_sagarChairSeed) seatMap["sagar"] = { c: _sagarChairSeed.c, r: _sagarChairSeed.r, facing: _sagarChairSeed.sitFacing ?? "up" };
    seatByNameRef.current = seatMap;

    const originalRoomIds = new Set(world.rooms.map((r) => r.id));
    const originalPatchIds = new Set(world.patches.map((p) => p.id));


    // Always seed with the latest default layout (overrides any previously saved version)
    localStorage.setItem(LAYOUT_KEY, JSON.stringify(DEFAULT_LAYOUT));

    // Restore saved layout from localStorage
    const raw = typeof window !== "undefined" ? localStorage.getItem(LAYOUT_KEY) : null;
    if (raw) {
      try {
        const data: SaveData = JSON.parse(raw);
        Object.assign(world.building, data.building);
        if (data.buildingFloor !== undefined) world.buildingFloor = data.buildingFloor;
        if (data.buildingFloorColor !== undefined) world.buildingFloorColor = data.buildingFloorColor;
        if (data.buildingFloorPattern !== undefined) world.buildingFloorPattern = data.buildingFloorPattern;
        if (data.wallTheme !== undefined) world.wallTheme = data.wallTheme;
        for (const rs of data.rooms) {
          const room = world.rooms.find((r) => r.id === rs.id);
          if (room) {
            Object.assign(room.rect, rs.rect);
            if (rs.doorSide === null) room.doorSide = undefined;
            else if (rs.doorSide) room.doorSide = rs.doorSide;
            if (rs.doorAnchor !== undefined) room.doorAnchor = rs.doorAnchor;
            if (rs.doorSide2 !== undefined) room.doorSide2 = rs.doorSide2;
            if (rs.doorOpen2 !== undefined) room.doorOpen2 = rs.doorOpen2;
            if (rs.label !== undefined) room.label = rs.label;
            if (rs.kind !== undefined) room.kind = rs.kind;
            if (rs.customFloorColor !== undefined) room.customFloorColor = rs.customFloorColor;
            if (rs.floorPattern !== undefined) room.floorPattern = rs.floorPattern;
            if (rs.wallTheme !== undefined) room.wallTheme = rs.wallTheme;
          }
        }
        for (const ps of data.patches) {
          const patch = world.patches.find((p) => p.id === ps.id);
          if (patch) {
            Object.assign(patch.rect, ps.rect);
            if (ps.kind !== undefined) patch.kind = ps.kind;
            if (ps.customFloorColor !== undefined) patch.customFloorColor = ps.customFloorColor;
            if (ps.floorPattern !== undefined) patch.floorPattern = ps.floorPattern;
          }
        }
        for (const os of data.objects) {
          const obj = world.objects.find((o) => o.id === os.id) ?? world.gallery.find((o) => o.id === os.id);
          if (obj) {
            Object.assign(obj, os);
          } else if (os.kind) {
            // only restore dynamically-added objects if full shape is present (new save format)
            world.objects.push({ ...os });
          }
        }
        for (const gid of data.gallery) {
          const idx = world.objects.findIndex((o) => o.id === gid);
          if (idx >= 0) world.gallery.push(...world.objects.splice(idx, 1));
        }
        for (const did of (data.deletedRooms ?? [])) {
          const i = world.rooms.findIndex((r) => r.id === did);
          if (i >= 0) world.rooms.splice(i, 1);
        }
        for (const did of (data.deletedPatches ?? [])) {
          const i = world.patches.findIndex((p) => p.id === did);
          if (i >= 0) world.patches.splice(i, 1);
        }
        for (const ar of (data.addedRooms ?? [])) {
          if (!world.rooms.find((r) => r.id === ar.id))
            world.rooms.push({ ...ar, rect: { ...ar.rect } });
        }
        rebuildFloors(world);
      } catch { /* ignore corrupted save */ }
    }

    let idSeq = 0;
    const uid = (k: string) => `${k}_${++idSeq}`;

    const bg = document.createElement("canvas");
    bg.width = NATIVE_W;
    bg.height = NATIVE_H;
    const bgCtx = bg.getContext("2d")!;
    const redrawBase = () => {
      bgCtx.clearRect(0, 0, NATIVE_W, NATIVE_H);
      drawBase(bgCtx, world);
    };
    redrawBase();

    const frame = document.createElement("canvas");
    frame.width = NATIVE_W;
    frame.height = NATIVE_H;
    const fCtx = frame.getContext("2d")!;

    // ---- player ----
    const myName = whoAmIRef.current?.toLowerCase() ?? "";
    const myNpc = world.npcs.find((n) => n.id.toLowerCase() === myName);
    const myChair = myNpc
      ? (world.objects.find((o) => o.sittable && o.c === myNpc.c && o.r === myNpc.r) ?? null)
      : null;
    const sagarChair = objectById(world, "sagarChair");
    const startChair = myChair ?? (myName === "sagar" ? sagarChair : null);
    const B = world.building;

    // Restore last known position for this user
    type SavedPos = { c: number; r: number; facing: Facing; sitting: boolean };
    let savedPos: SavedPos | null = null;
    if (myName) {
      try {
        const raw = localStorage.getItem(posKey(myName));
        if (raw) savedPos = JSON.parse(raw) as SavedPos;
      } catch { /* ignore */ }
    }

    const spawnTile = savedPos
      ? { c: savedPos.c, r: savedPos.r }
      : startChair
        ? { c: startChair.c, r: startChair.r }
        : (nearestWalkable(world.walk, { c: Math.round((B.c0 + B.c1) / 2), r: Math.round((B.r0 + B.r1) / 2) }) ?? { c: B.c0 + 2, r: B.r0 + 2 });
    const startPx = tileCenterPx(spawnTile.c, spawnTile.r);
    const player = {
      tile: spawnTile as Tile,
      x: startPx.x,
      y: startPx.y,
      facing: (savedPos?.facing ?? startChair?.sitFacing ?? "down") as Facing,
      path: [] as Tile[],
      stepDist: 0,
      sitting: savedPos ? savedPos.sitting : !!startChair?.sittable,
      standTile: startChair ? (approachTile(startChair) as Tile) : spawnTile,
      pendingSit: null as { tile: Tile; facing: Facing } | null,
    };

    // Live interpolated positions for remote users (keyed by name)
    const remoteState: Record<string, { x: number; y: number; stepDist: number }> = {};

    let hover: { c: number; r: number } | null = null;
    let sel: Sel | null = null;
    let destMarker: Tile | null = null;
    let lastTapT = 0;
    let lastTapTile = { c: -9, r: -9 };

    type Press = {
      sxN: number; syN: number; sxC: number; syC: number;
      panX0: number; panY0: number; tile: Tile;
      dragging: boolean; mode: "move" | "scale" | "edge" | "pan" | "door-drag" | null;
      handle: string | null; target: Sel | null;
      grabC?: number; grabR?: number; startTile?: Tile; startRect?: Rect;
      pivotX?: number; pivotY?: number; startDist?: number; startScale?: number;
    };
    let press: Press | null = null;

    // ---- helpers ----
    const toNativePx = (cx: number, cy: number) => {
      const rect = canvas.getBoundingClientRect();
      return {
        x: ((cx - rect.left) / rect.width) * NATIVE_W,
        y: ((cy - rect.top) / rect.height) * NATIVE_H,
      };
    };
    const toTile = (cx: number, cy: number) => {
      const p = toNativePx(cx, cy);
      return { c: Math.floor(p.x / TILE), r: Math.floor(p.y / TILE) };
    };
    const objectAt = (c: number, r: number): WorldObject | null => {
      let found: WorldObject | null = null;
      for (const o of world.objects)
        if (c >= o.c && c < o.c + o.w && r >= o.r && r < o.r + o.h) found = o;
      return found;
    };
    const pick = (c: number, r: number): Sel | null => {
      const o = objectAt(c, r);
      if (o) return { kind: "object", obj: o };
      for (const p of world.patches) {
        const R = p.rect;
        if (c >= R.c0 && c <= R.c1 && r >= R.r0 && r <= R.r1) return { kind: "patch", patch: p };
      }
      for (const rm of world.rooms) {
        const R = rm.rect;
        if (c >= R.c0 && c <= R.c1 && r >= R.r0 && r <= R.r1) return { kind: "room", room: rm };
      }
      const B = world.building;
      if (c >= B.c0 && c <= B.c1 && r >= B.r0 && r <= B.r1) return { kind: "building" };
      return null;
    };
    const selRect = (s: Sel): Rect =>
      s.kind === "object"
        ? { c0: s.obj.c, r0: s.obj.r, c1: s.obj.c + s.obj.w - 1, r1: s.obj.r + s.obj.h - 1 }
        : s.kind === "patch" ? s.patch.rect : s.kind === "room" ? s.room.rect : world.building;

    type Handle = { id: string; xN: number; yN: number };
    const handlesFor = (s: Sel): Handle[] => {
      if (s.kind === "object") {
        const o = s.obj;
        const sc = o.scale ?? 1;
        const pivotX = (o.c + o.w / 2) * TILE;
        const pivotY = (o.r + o.h) * TILE;
        const x1 = pivotX + ((o.c + o.w) * TILE - pivotX) * sc;
        const y0 = pivotY + (o.r * TILE - pivotY) * sc;
        return [{ id: "scale", xN: x1, yN: y0 }];
      }
      const R = selRect(s);
      const x0 = R.c0 * TILE, y0 = R.r0 * TILE, x1 = (R.c1 + 1) * TILE, y1 = (R.r1 + 1) * TILE;
      const mx = (x0 + x1) / 2, my = (y0 + y1) / 2;
      const handles: Handle[] = [
        { id: "edge-top", xN: mx, yN: y0 },
        { id: "edge-bottom", xN: mx, yN: y1 },
        { id: "edge-left", xN: x0, yN: my },
        { id: "edge-right", xN: x1, yN: my },
      ];
      if (s.kind === "room" && s.room.doorSide) {
        const room = s.room;
        const horiz = room.doorSide === "top" || room.doorSide === "bottom";
        const midC = horiz && room.doorAnchor !== undefined ? room.doorAnchor : (R.c0 + R.c1) >> 1;
        const midR = !horiz && room.doorAnchor !== undefined ? room.doorAnchor : (R.r0 + R.r1) >> 1;
        const dxN = room.doorSide === "left" ? R.c0 * TILE + TILE / 2 :
                    room.doorSide === "right" ? R.c1 * TILE + TILE / 2 :
                    (midC + 0.5) * TILE;
        const dyN = room.doorSide === "top" ? R.r0 * TILE + TILE / 2 :
                    room.doorSide === "bottom" ? R.r1 * TILE + TILE / 2 :
                    (midR + 0.5) * TILE;
        handles.push({ id: "door", xN: dxN, yN: dyN });
      }
      return handles;
    };

    const syncSel = () => {
      if (!sel) return setSelInfo(null);
      const label =
        sel.kind === "object" ? sel.obj.label ?? sel.obj.kind
          : sel.kind === "patch" ? sel.patch.label
            : sel.kind === "room" ? sel.room.label : "Office (walls)";
      const wallHex = (theme: string) => theme.startsWith("#") ? theme : (WALL_THEMES[theme]?.theme.main ?? WALL_THEMES.orange.theme.main);
      const floorHex = (kind: Floor, custom?: string) => custom ?? (FLOOR_KINDS.find(f => f.kind === kind)?.color ?? "#e8dfc8");
      if (sel.kind === "room") {
        setSelInfo({ kind: "room", label, doorSide: sel.room.doorSide, doorAnchor: sel.room.doorAnchor, doorSide2: sel.room.doorSide2, doorOpen2: sel.room.doorOpen2, floorKind: sel.room.kind, floorPattern: sel.room.floorPattern, wallTheme: sel.room.wallTheme ?? world.wallTheme, wallHex: wallHex(sel.room.wallTheme ?? world.wallTheme), floorHex: floorHex(sel.room.kind, sel.room.customFloorColor) });
      } else if (sel.kind === "building") {
        setSelInfo({ kind: "building", label, floorKind: world.buildingFloor, floorPattern: world.buildingFloorPattern, wallTheme: world.wallTheme, wallHex: wallHex(world.wallTheme), floorHex: floorHex(world.buildingFloor, world.buildingFloorColor) });
      } else if (sel.kind === "patch") {
        setSelInfo({ kind: "patch", label, floorKind: sel.patch.kind, floorPattern: sel.patch.floorPattern, floorHex: floorHex(sel.patch.kind, sel.patch.customFloorColor) });
      } else {
        setSelInfo({ kind: sel.kind, label });
      }
    };


    // ---- player movement ----
    const standUp = () => {
      if (!player.sitting) return;
      player.sitting = false;
      const p = tileCenterPx(player.standTile.c, player.standTile.r);
      player.x = p.x; player.y = p.y;
      player.tile = { ...player.standTile };
    };
    const commandTo = (c: number, r: number) => {
      const obj = objectAt(c, r);
      const origin = player.sitting ? player.standTile : player.tile;
      if (obj?.sittable) {
        const ap = approachTile(obj);
        const goal = world.walk[ap.r]?.[ap.c] ? ap : nearestWalkable(world.walk, { c: obj.c, r: obj.r });
        if (!goal) return;
        const path = bfs(world.walk, origin, goal);
        if (!path) return;
        standUp();
        player.path = path; player.standTile = goal;
        player.pendingSit = { tile: { c: obj.c, r: obj.r }, facing: obj.sitFacing ?? "up" };
        destMarker = { c: obj.c, r: obj.r };
        return;
      }
      const goal: Tile | null = world.walk[r]?.[c] ? { c, r } : nearestWalkable(world.walk, { c, r });
      if (!goal) return;
      const path = bfs(world.walk, origin, goal);
      if (!path) return;
      standUp();
      player.path = path; player.standTile = goal; player.pendingSit = null;
      destMarker = goal;
    };

    // ---- edit operations (exposed to React buttons) ----
    const applyEdge = (s: Sel, handle: string, t: Tile) => {
      const R = s.kind === "patch" ? s.patch.rect : s.kind === "room" ? s.room.rect : world.building;
      if (handle === "edge-left") R.c0 = clamp(t.c, 0, R.c1 - MIN_SPAN);
      else if (handle === "edge-right") R.c1 = clamp(t.c, R.c0 + MIN_SPAN, COLS - 1);
      else if (handle === "edge-top") R.r0 = clamp(t.r, 0, R.r1 - MIN_SPAN);
      else if (handle === "edge-bottom") R.r1 = clamp(t.r, R.r0 + MIN_SPAN, ROWS - 1);
      rebuildFloors(world);
      redrawBase();
    };
    const applyMove = (s: Sel, t: Tile, p: Press) => {
      if (s.kind === "object") {
        s.obj.c = clamp(t.c - (p.grabC ?? 0), 0, COLS - s.obj.w);
        s.obj.r = clamp(t.r - (p.grabR ?? 0), 0, ROWS - s.obj.h);
        rebuildWalk(world);
      } else if (s.kind !== "building" && p.startRect && p.startTile) {
        const dc = t.c - p.startTile.c;
        const dr = t.r - p.startTile.r;
        const sr = p.startRect;
        const w = sr.c1 - sr.c0, h = sr.r1 - sr.r0;
        const R = s.kind === "patch" ? s.patch.rect : s.room.rect;
        R.c0 = clamp(sr.c0 + dc, 0, COLS - 1 - w);
        R.r0 = clamp(sr.r0 + dr, 0, ROWS - 1 - h);
        R.c1 = R.c0 + w; R.r1 = R.r0 + h;
        rebuildFloors(world);
        redrawBase();
      }
    };

    apiRef.current = {
      scale: (d) => {
        if (sel?.kind === "object") {
          sel.obj.scale = clamp((sel.obj.scale ?? 1) + d, 0.4, 3);
        }
      },
      duplicate: () => {
        if (sel?.kind !== "object") return;
        const o = sel.obj;
        const clone: WorldObject = {
          ...o, id: uid(o.kind),
          c: clamp(o.c + 1, 0, COLS - o.w), r: clamp(o.r + 1, 0, ROWS - o.h),
        };
        world.objects.push(clone);
        sel = { kind: "object", obj: clone };
        rebuildWalk(world);
        syncSel();
      },
      duplicateBuilding: () => {
        const B = world.building;
        const rw = Math.min(12, Math.floor((B.c1 - B.c0) * 0.35));
        const rh = Math.min(13, Math.floor((B.r1 - B.r0) * 0.35));
        const c0 = clamp(B.c0 + 2, 0, COLS - rw - 1);
        const r0 = clamp(B.r0 + 4, 0, ROWS - rh - 1);
        const newRoom: Room = {
          id: uid("room"),
          label: "New room",
          kind: "lav",
          rect: { c0, r0, c1: c0 + rw, r1: r0 + rh },
          doorSide: "left",
        };
        world.rooms.push(newRoom);
        sel = { kind: "room", room: newRoom };
        rebuildFloors(world);
        redrawBase();
        syncSel();
      },
      remove: () => {
        if (sel?.kind !== "object") return;
        const o = sel.obj;
        const i = world.objects.indexOf(o);
        if (i >= 0) world.objects.splice(i, 1);
        world.gallery.push(o);
        sel = null;
        rebuildWalk(world);
        syncSel();
      },
      deleteRoom: () => {
        if (sel?.kind !== "room") return;
        const i = world.rooms.indexOf(sel.room);
        if (i >= 0) world.rooms.splice(i, 1);
        sel = null;
        rebuildFloors(world);
        redrawBase();
        syncSel();
      },
      setDoorSide: (side) => {
        if (sel?.kind !== "room") return;
        sel.room.doorSide = side;
        sel.room.doorAnchor = undefined;
        rebuildFloors(world);
        redrawBase();
        syncSel();
      },
      setDoorAnchor: (v) => {
        if (sel?.kind !== "room") return;
        sel.room.doorAnchor = v;
        rebuildFloors(world);
        redrawBase();
        syncSel();
      },
      deleteDoor: () => {
        if (sel?.kind !== "room") return;
        sel.room.doorSide = undefined;
        sel.room.doorAnchor = undefined;
        sel.room.doorSide2 = undefined;
        sel.room.doorOpen2 = undefined;
        rebuildFloors(world);
        redrawBase();
        syncSel();
      },
      addDoor: (side) => {
        if (sel?.kind !== "room") return;
        sel.room.doorSide = side;
        sel.room.doorAnchor = undefined;
        rebuildFloors(world);
        redrawBase();
        syncSel();
      },
      addSecondDoor: () => {
        if (sel?.kind !== "room" || !sel.room.doorSide) return;
        const opp: Record<string, Room["doorSide"]> = { left: "right", right: "left", top: "bottom", bottom: "top" };
        sel.room.doorSide2 = opp[sel.room.doorSide];
        sel.room.doorOpen2 = false;
        rebuildFloors(world);
        redrawBase();
        syncSel();
      },
      deleteSecondDoor: () => {
        if (sel?.kind !== "room") return;
        sel.room.doorSide2 = undefined;
        sel.room.doorOpen2 = undefined;
        rebuildFloors(world);
        redrawBase();
        syncSel();
      },
      toggleDoorOpen2: () => {
        if (sel?.kind !== "room") return;
        sel.room.doorOpen2 = !sel.room.doorOpen2;
        syncSel();
      },
      removePatch: () => {
        if (sel?.kind !== "patch") return;
        const i = world.patches.indexOf(sel.patch);
        if (i >= 0) world.patches.splice(i, 1);
        sel = null;
        rebuildFloors(world);
        redrawBase();
        syncSel();
      },
      addFromCatalog: (entry, tileC, tileR) => {
        const B = world.building;
        const c = tileC !== undefined ? clamp(tileC, 0, COLS - entry.w) : clamp(B.c0 + 3, 0, COLS - entry.w);
        const r = tileR !== undefined ? clamp(tileR, 0, ROWS - entry.h) : clamp(B.r0 + 4, 0, ROWS - entry.h);
        const newObj: WorldObject = {
          id: uid(entry.kind),
          kind: entry.kind,
          label: entry.label,
          c, r,
          w: entry.w,
          h: entry.h,
          ...(entry.sittable ? { sittable: true, sitFacing: entry.sitFacing } : {}),
        };
        world.objects.push(newObj);
        sel = { kind: "object", obj: newObj };
        rebuildWalk(world);
        syncSel();
      },
      duplicateRoom: () => {
        if (sel?.kind !== "room") return;
        const r = sel.room;
        const clone: Room = {
          id: uid("room"),
          label: r.label,
          kind: r.kind,
          rect: { ...r.rect },
          doorSide: r.doorSide,
        };
        world.rooms.push(clone);
        sel = { kind: "room", room: clone };
        rebuildFloors(world);
        redrawBase();
        syncSel();
      },
      removeAll: () => {
        world.gallery.push(...world.objects.splice(0));
        sel = null;
        rebuildWalk(world);
        syncSel();
      },
      deselect: () => { sel = null; syncSel(); },
      rotate: (step) => {
        if (sel?.kind === "object") {
          sel.obj.rotation = (((sel.obj.rotation ?? 0) + step) % 360 + 360) % 360;
        }
      },
      save: () => {
        const deletedRooms = [...originalRoomIds].filter(
          (id) => !world.rooms.find((r) => r.id === id)
        );
        const addedRooms = world.rooms.filter((r) => !originalRoomIds.has(r.id))
          .map((r) => ({ ...r, rect: { ...r.rect } }));
        const deletedPatches = [...originalPatchIds].filter(
          (id) => !world.patches.find((p) => p.id === id)
        );
        const data: SaveData = {
          building: { ...world.building },
          buildingFloor: world.buildingFloor,
          buildingFloorColor: world.buildingFloorColor,
          buildingFloorPattern: world.buildingFloorPattern,
          wallTheme: world.wallTheme,
          rooms: world.rooms.map((r) => ({ id: r.id, label: r.label, rect: { ...r.rect }, doorSide: r.doorSide ?? null, doorAnchor: r.doorAnchor, doorSide2: r.doorSide2, doorOpen2: r.doorOpen2, kind: r.kind, customFloorColor: r.customFloorColor, floorPattern: r.floorPattern, wallTheme: r.wallTheme })),
          patches: world.patches.map((p) => ({ id: p.id, rect: { ...p.rect }, kind: p.kind, customFloorColor: p.customFloorColor, floorPattern: p.floorPattern })),
          objects: [...world.objects, ...world.gallery].map((o) => ({ ...o })),
          gallery: world.gallery.map((o) => o.id),
          deletedRooms,
          addedRooms,
          deletedPatches,
        };
        localStorage.setItem(LAYOUT_KEY, JSON.stringify(data));
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      },
      setFloorKind: (kind) => {
        // Color presets only change the color — look up the preset hex and store it.
        const presetColor = FLOOR_KINDS.find(f => f.kind === kind)?.color;
        if (!presetColor) return;
        if (sel?.kind === "building") {
          world.buildingFloorColor = presetColor;
        } else if (sel?.kind === "room") {
          sel.room.customFloorColor = presetColor;
        } else if (sel?.kind === "patch") {
          sel.patch.customFloorColor = presetColor;
        } else return;
        redrawBase();
        syncSel();
      },
      setFloorPattern: (pattern) => {
        if (sel?.kind === "building") {
          world.buildingFloorPattern = pattern;
        } else if (sel?.kind === "room") {
          sel.room.floorPattern = pattern;
        } else if (sel?.kind === "patch") {
          sel.patch.floorPattern = pattern;
        } else return;
        redrawBase();
        syncSel();
      },
      setWallTheme: (theme) => {
        if (sel?.kind === "building") {
          world.wallTheme = theme;
        } else if (sel?.kind === "room") {
          sel.room.wallTheme = theme;
        } else return;
        redrawBase();
        syncSel();
      },
      setCustomWallColor: (hex) => {
        if (sel?.kind === "building") {
          world.wallTheme = hex;
        } else if (sel?.kind === "room") {
          sel.room.wallTheme = hex;
        } else return;
        redrawBase();
        syncSel();
      },
      setCustomFloorColor: (hex) => {
        if (sel?.kind === "building") {
          world.buildingFloorColor = hex;
        } else if (sel?.kind === "room") {
          sel.room.customFloorColor = hex;
        } else if (sel?.kind === "patch") {
          sel.patch.customFloorColor = hex;
        } else return;
        redrawBase();
        syncSel();
      },
      goToDesk: () => {
        const desk = startChair ?? sagarChair;
        commandTo(desk.c, desk.r);
      },
      goToNpc: (npcId: string) => {
        const npc = world.npcs.find((n) => n.id === npcId);
        if (!npc) return;
        const goal = nearestWalkable(world.walk, { c: npc.c, r: npc.r });
        if (!goal) return;
        const origin = player.sitting ? player.standTile : player.tile;
        const path = bfs(world.walk, origin, goal);
        if (!path) return;
        standUp();
        player.path = path;
        player.standTile = goal;
        player.pendingSit = null;
        destMarker = goal;
      },
      goToRandomRoom: () => {
        const meetingRooms = world.rooms.filter((r) => r.label !== "Reception");
        if (!meetingRooms.length) return null;
        const idx = Math.floor(Math.random() * meetingRooms.length);
        const room = meetingRooms[idx];
        const R = room.rect;
        const centerC = Math.round((R.c0 + R.c1) / 2);
        const centerR = Math.round((R.r0 + R.r1) / 2);
        const goal = nearestWalkable(world.walk, { c: centerC, r: centerR });
        if (!goal) return null;
        const origin = player.sitting ? player.standTile : player.tile;
        const path = bfs(world.walk, origin, goal);
        if (!path) return null;
        standUp();
        player.path = path;
        player.standTile = goal;
        player.pendingSit = null;
        destMarker = goal;
        return room.label ?? "Meeting Room";
      },
    };

    // Let the broadcast handler navigate the local player to a named room
    goToRoomRef.current = (roomLabel: string) => {
      const room = world.rooms.find((r) => r.label === roomLabel);
      if (!room) return;
      const R = room.rect;
      const centerC = Math.round((R.c0 + R.c1) / 2);
      const centerR = Math.round((R.r0 + R.r1) / 2);
      const goal = nearestWalkable(world.walk, { c: centerC, r: centerR });
      if (!goal) return;
      const origin = player.sitting ? player.standTile : player.tile;
      const path = bfs(world.walk, origin, goal);
      if (!path) return;
      standUp();
      player.path = path;
      player.standTile = goal;
      player.pendingSit = null;
      destMarker = goal;
    };

    // ---- pointer ----
    const onDown = (e: MouseEvent) => {
      const p = toNativePx(e.clientX, e.clientY);
      const t = toTile(e.clientX, e.clientY);
      press = { sxN: p.x, syN: p.y, sxC: e.clientX, syC: e.clientY, panX0: panRef.current.x, panY0: panRef.current.y, tile: t, dragging: false, mode: null, handle: null, target: null };
      if (editLayoutRef.current && sel) {
        const h = handlesFor(sel).find((hh) => Math.hypot(hh.xN - p.x, hh.yN - p.y) <= 7);
        if (h) {
          press.dragging = true;
          press.handle = h.id;
          if (h.id === "scale" && sel.kind === "object") {
            const o = sel.obj;
            press.mode = "scale";
            press.pivotX = (o.c + o.w / 2) * TILE;
            press.pivotY = (o.r + o.h) * TILE;
            press.startDist = Math.max(3, Math.hypot(p.x - press.pivotX, p.y - press.pivotY));
            press.startScale = o.scale ?? 1;
          } else if (h.id === "door") {
            press.mode = "door-drag";
          } else {
            press.mode = "edge";
          }
          return;
        }
      }
      if (editLayoutRef.current) press.target = pick(t.c, t.r);
    };

    const onMove = (e: MouseEvent) => {
      const p = toNativePx(e.clientX, e.clientY);
      mousePxRef.current = p;
      const t = toTile(e.clientX, e.clientY);
      const inB = t.c >= 0 && t.r >= 0 && t.c < COLS && t.r < ROWS;
      hover = inB ? t : null;

      if (press && !press.dragging) {
        const nativeDist = Math.hypot(p.x - press.sxN, p.y - press.syN);
        const clientDist = Math.hypot(e.clientX - press.sxC, e.clientY - press.syC);
        if (nativeDist > 4 && press.target && editLayoutRef.current) {
          press.dragging = true;
          press.mode = "move";
          sel = press.target;
          syncSel();
          if (press.target.kind === "object") {
            press.grabC = press.tile.c - press.target.obj.c;
            press.grabR = press.tile.r - press.target.obj.r;
          } else if (press.target.kind !== "building") {
            press.startRect = { ...selRect(press.target) };
            press.startTile = { ...press.tile };
          }
        } else if (clientDist > 4 && !press.target) {
          press.dragging = true;
          press.mode = "pan";
        }
      }

      if (press?.dragging && press.mode === "pan") {
        const newX = press.panX0 + (e.clientX - press.sxC);
        const newY = press.panY0 + (e.clientY - press.syC);
        panRef.current = { x: newX, y: newY };
        setPan({ x: newX, y: newY });
        canvas.style.cursor = "grabbing";
        return;
      }

      if (press?.dragging && sel) {
        if (press.mode === "scale" && sel.kind === "object") {
          const d = Math.hypot(p.x - (press.pivotX ?? 0), p.y - (press.pivotY ?? 0));
          sel.obj.scale = clamp((press.startScale ?? 1) * (d / (press.startDist ?? 1)), 0.4, 3);
        } else if (press.mode === "edge" && press.handle) {
          applyEdge(sel, press.handle, t);
        } else if (press.mode === "door-drag" && sel.kind === "room" && sel.room.doorSide) {
          const room = sel.room;
          const R = room.rect;
          const horiz = room.doorSide === "top" || room.doorSide === "bottom";
          if (horiz) room.doorAnchor = clamp(t.c, R.c0 + 3, R.c1 - 3);
          else room.doorAnchor = clamp(t.r, R.r0 + 3, R.r1 - 3);
          rebuildFloors(world);
          redrawBase();
          syncSel();
        } else if (press.mode === "move") {
          applyMove(sel, t, press);
        }
        canvas.style.cursor = press.mode === "move" ? "grabbing" : "crosshair";
        return;
      }

      // hover cursor
      if (!inB) { canvas.style.cursor = "default"; return; }
      if (editLayoutRef.current && sel && handlesFor(sel).some((hh) => Math.hypot(hh.xN - p.x, hh.yN - p.y) <= 7)) {
        canvas.style.cursor = sel.kind === "object" ? "nwse-resize" : "crosshair";
      } else if (editLayoutRef.current) {
        const pk = pick(t.c, t.r);
        canvas.style.cursor = pk ? (pk.kind === "object" ? "grab" : "pointer") : "grab";
      } else {
        // pointer cursor when hovering a 👋 zone
        const onWave = waveZones.some((z) => p.x >= z.x && p.x <= z.x + z.w && p.y >= z.y && p.y <= z.y + z.h);
        canvas.style.cursor = onWave ? "pointer" : "default";
      }
    };

    const onUp = (e: MouseEvent) => {
      if (press?.dragging) { press = null; return; }
      const t = press?.tile ?? null;
      press = null;
      if (!t) return;

      // Hit-test 👋 wave zones first (canvas-px coords)
      if (!editLayoutRef.current) {
        const mp = toNativePx(e.clientX, e.clientY);
        const hit = waveZones.find((z) => mp.x >= z.x && mp.x <= z.x + z.w && mp.y >= z.y && mp.y <= z.y + z.h);
        if (hit) {
          playTing();
          broadcastWave();
          return; // wave only — don't walk or open modal
        }
      }

      const now = performance.now();
      const dbl = now - lastTapT < 320 && Math.abs(t.c - lastTapTile.c) <= 1 && Math.abs(t.r - lastTapTile.r) <= 1;
      if (dbl && !editLayoutRef.current) {
        lastTapT = 0;
        sel = null; syncSel();
        commandTo(t.c, t.r);
      } else {
        lastTapT = now; lastTapTile = t;
        if (editLayoutRef.current) {
          sel = pick(t.c, t.r);
          syncSel();
        } else {
          // Single-click on NPC sprite — open profile modal (no sound on open)
          // Check static NPCs first (only those not replaced by a live user)
          const liveNames = new Set(Object.keys(remoteUsersRef.current).map((n) => n.toLowerCase()));
          if (whoAmIRef.current) liveNames.add(whoAmIRef.current.toLowerCase());
          const clickedNpc = world.npcs.find((n) =>
            n.status !== "offline" &&
            !liveNames.has(n.id.toLowerCase()) &&
            t.c >= n.c - 1 && t.c <= n.c + 1 && t.r >= n.r - 1 && t.r <= n.r + 1
          );
          if (clickedNpc) {
            const modal = { id: clickedNpc.id, name: clickedNpc.name, status: clickedNpc.status, slackUserId: clickedNpc.slackUserId };
            npcModalRef.current = modal;
            const initPos = { x: clickedNpc.c * TILE + TILE / 2, y: clickedNpc.r * TILE - 36 };
            npcModalPosRef.current = initPos;
            setNpcModalPos(initPos);
            setNpcModal(modal);
          } else {
            // Check real-time (remote) users by their interpolated pixel position
            const mp = toNativePx(e.clientX, e.clientY);
            const clickedRemote = Object.entries(remoteState).find(([, rs]) => {
              const dx = mp.x - rs.x;
              const dy = mp.y - rs.y;
              return Math.hypot(dx, dy) <= TILE * 1.2;
            });
            if (clickedRemote) {
              const [name] = clickedRemote;
              const rs = remoteState[name];
              const modal = { id: name, name, status: remoteUsersRef.current[name]?.status ?? "online" };
              npcModalRef.current = modal;
              const initPos = { x: rs.x, y: rs.y - 40 };
              npcModalPosRef.current = initPos;
              setNpcModalPos(initPos);
              setNpcModal(modal);
            }
          }
        }
      }
    };

    canvas.addEventListener("mousedown", onDown);
    canvas.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);

    const onKey = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (k === "escape") { sel = null; syncSel(); return; }
      if (sel?.kind === "object") {
        const o = sel.obj;
        if (k === "delete" || k === "backspace") { e.preventDefault(); apiRef.current?.remove(); return; }
        if (k === "d" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); apiRef.current?.duplicate(); return; }
        if (k === "=" || k === "+") { e.preventDefault(); apiRef.current?.scale(0.1); return; }
        if (k === "-" || k === "_") { e.preventDefault(); apiRef.current?.scale(-0.1); return; }
        const mv: Record<string, [number, number]> = {
          arrowup: [0, -1], arrowdown: [0, 1], arrowleft: [-1, 0], arrowright: [1, 0],
        };
        if (mv[k]) {
          e.preventDefault();
          o.c = clamp(o.c + mv[k][0], 0, COLS - o.w);
          o.r = clamp(o.r + mv[k][1], 0, ROWS - o.h);
          rebuildWalk(world);
          return;
        }
      } else {
        const mv: Record<string, [number, number]> = {
          arrowup: [0, -1], w: [0, -1], arrowdown: [0, 1], s: [0, 1],
          arrowleft: [-1, 0], a: [-1, 0], arrowright: [1, 0], d: [1, 0],
        };
        if (!mv[k]) return;
        e.preventDefault();
        const base = player.sitting ? player.standTile : player.tile;
        if (world.walk[base.r + mv[k][1]]?.[base.c + mv[k][0]]) commandTo(base.c + mv[k][0], base.r + mv[k][1]);
      }
    };
    window.addEventListener("keydown", onKey);

    // ---- UI overlay helpers ----
    const X = (nx: number) => nx * SCALE;
    const roundRect = (x: number, y: number, w: number, h: number, rad: number) => {
      ctx.beginPath();
      ctx.moveTo(x + rad, y);
      ctx.arcTo(x + w, y, x + w, y + h, rad);
      ctx.arcTo(x + w, y + h, x, y + h, rad);
      ctx.arcTo(x, y + h, x, y, rad);
      ctx.arcTo(x, y, x + w, y, rad);
      ctx.closePath();
    };

    // Hit zones for 👋 buttons — rebuilt each frame, checked in onUp
    type WaveZone = { npcId: string; x: number; y: number; w: number; h: number };
    const waveZones: WaveZone[] = [];


    const drawPill = (cxN: number, headTopYN: number, label: string, dot: string, icon: string) => {
      const hN = 26;
      const dotR = 4.5;
      const padL = 14 + dotR * 2 + 6;
      const padR = icon ? 26 : 10;

      ctx.font = `700 ${7 * SCALE}px ui-sans-serif, system-ui, sans-serif`;
      const labelWN = (ctx.measureText(label).width / SCALE) + padL + padR;
      const xN = cxN - labelWN / 2;
      const yN = headTopYN - hN - 4;

      ctx.fillStyle = "rgba(0,0,0,0.30)";
      roundRect(X(xN + 1.5), X(yN + 1.5), X(labelWN), X(hN), 8); ctx.fill();
      ctx.fillStyle = "rgba(10,12,18,0.96)";
      roundRect(X(xN), X(yN), X(labelWN), X(hN), 8); ctx.fill();
      ctx.strokeStyle = dot; ctx.lineWidth = 1.5;
      roundRect(X(xN), X(yN), X(labelWN), X(hN), 8); ctx.stroke();
      ctx.fillStyle = dot;
      ctx.beginPath(); ctx.arc(X(xN + 14 + dotR), X(yN + hN / 2), X(dotR), 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#ffffff"; ctx.textBaseline = "middle";
      ctx.fillText(label, X(xN + 14 + dotR * 2 + 6), X(yN + hN / 2 + 0.5));
      if (icon) {
        ctx.font = `${6 * SCALE}px sans-serif`;
        ctx.fillText(icon, X(xN + labelWN - padR + 4), X(yN + hN / 2 + 0.5));
      }
      return { xN, yN, labelWN, hN };
    };

    // Unified character tag: name pill + 👋 button, drawn on the upscaled ctx.
    const drawCharTag = (cxN: number, headTopYN: number, label: string, dot: string, icon: string, waveId: string) => {
      const gapN = 4;
      const btnWN = 30;
      const { xN, yN, labelWN, hN } = drawPill(cxN - (30 + gapN) / 2, headTopYN, label, dot, icon);

      // — 👋 button —
      const bxN = xN + labelWN + gapN;
      const mp = mousePxRef.current;
      const hovered = mp.x >= bxN && mp.x <= bxN + btnWN && mp.y >= yN && mp.y <= yN + hN;
      ctx.fillStyle = "rgba(0,0,0,0.30)";
      roundRect(X(bxN + 1.5), X(yN + 1.5), X(btnWN), X(hN), 8); ctx.fill();
      ctx.fillStyle = hovered ? "rgba(70,80,105,0.97)" : "rgba(28,32,44,0.96)";
      roundRect(X(bxN), X(yN), X(btnWN), X(hN), 8); ctx.fill();
      ctx.strokeStyle = hovered ? "rgba(255,255,255,0.35)" : "rgba(255,255,255,0.10)";
      ctx.lineWidth = 1.5;
      roundRect(X(bxN), X(yN), X(btnWN), X(hN), 8); ctx.stroke();
      ctx.font = `${7 * SCALE}px sans-serif`; ctx.textBaseline = "middle";
      ctx.fillText("👋", X(bxN + (btnWN - 14) / 2), X(yN + hN / 2 + 0.5));

      waveZones.push({ npcId: waveId, x: bxN, y: yN, w: btnWN, h: hN });
    };

    const drawPlayerTag = (cxN: number, headTopYN: number) => {
      const st = myStatusRef.current;
      drawPill(cxN, headTopYN, "you", STATUS_COLOR[st], STATUS_ICON[st]);
    };

    // ---- loop ----
    let raf = 0;
    let broadcastFrame = 0;
    let persistFrame = 0;
    const loop = () => {
      // Broadcast position every 6 frames (~10 Hz at 60fps)
      if (++broadcastFrame >= 6) {
        broadcastFrame = 0;
        broadcastPositionRef.current?.({ name: whoAmIRef.current ?? "You", c: player.tile.c, r: player.tile.r, x: player.x, y: player.y, facing: player.facing, sitting: player.sitting, moving: player.path.length > 0, status: myStatusRef.current });
      }
      // Persist position every 60 frames (~1 Hz) so reload restores last location
      if (++persistFrame >= 60) {
        persistFrame = 0;
        const name = whoAmIRef.current?.toLowerCase();
        if (name) {
          const posSnapshot = { c: player.tile.c, r: player.tile.r, facing: player.facing, sitting: player.sitting };
          localStorage.setItem(posKey(name), JSON.stringify(posSnapshot));
          // Keep presence payload current so newly joining users see us at the right tile
          updatePresenceRef.current?.(posSnapshot);
        }
      }
      if (player.path.length) {
        const next = player.path[0];
        const tg = tileCenterPx(next.c, next.r);
        const dx = tg.x - player.x, dy = tg.y - player.y;
        const dist = Math.hypot(dx, dy);
        if (dist <= SPEED) {
          player.x = tg.x; player.y = tg.y; player.tile = { ...next }; player.path.shift();
        } else {
          player.x += (dx / dist) * SPEED; player.y += (dy / dist) * SPEED;
          if (Math.abs(dx) > Math.abs(dy)) player.facing = dx > 0 ? "right" : "left";
          else player.facing = dy > 0 ? "down" : "up";
          player.stepDist += SPEED;
        }
      } else if (player.pendingSit) {
        const ps = player.pendingSit;
        player.sitting = true; player.tile = { ...ps.tile };
        const cc = tileCenterPx(ps.tile.c, ps.tile.r);
        player.x = cc.x; player.y = cc.y; player.facing = ps.facing;
        player.pendingSit = null; destMarker = null;
      } else destMarker = null;
      const moving = player.path.length > 0;
      if (!moving) player.stepDist = 0;
      // one full stride cycle every 16px of travel (4 frames × 4px each)
      const step = moving ? (Math.floor(player.stepDist / 4) % 4) : 0;
      const footY = player.y + (player.sitting ? 4 : 8);

      fCtx.imageSmoothingEnabled = false;
      fCtx.clearRect(0, 0, NATIVE_W, NATIVE_H);
      fCtx.drawImage(bg, 0, 0);

      const items: Array<{ y: number; d: () => void }> = [];
      for (const o of world.objects) {
        items.push({
          y: (o.r + o.h) * TILE,
          d: () => {
            const s = o.scale ?? 1;
            const angle = ((o.rotation ?? 0) * Math.PI) / 180;
            if (s === 1 && angle === 0) { drawObject(fCtx, o); return; }
            const pivotX = (o.c + o.w / 2) * TILE;
            const pivotY = (o.r + o.h / 2) * TILE;
            fCtx.save();
            fCtx.translate(pivotX, pivotY);
            if (s !== 1) fCtx.scale(s, s);
            if (angle !== 0) fCtx.rotate(angle);
            fCtx.translate(-pivotX, -pivotY);
            drawObject(fCtx, o);
            fCtx.restore();
          },
        });
      }
      // Only draw NPC if that team member is NOT currently connected as a live user
      const onlineNames = new Set(
        Object.keys(remoteUsersRef.current).map((n) => n.toLowerCase())
      );
      // Also suppress the NPC for the local player's own character
      if (whoAmIRef.current) onlineNames.add(whoAmIRef.current.toLowerCase());
      for (const n of world.npcs) {
        if (n.status === "offline") continue;
        if (!onlineNames.has(n.id.toLowerCase())) {
          items.push({ y: (n.r + 1) * TILE, d: () => drawNpc(fCtx, n) });
        }
      }

      const mySkin = SKINS[getSkinKey(whoAmIRef.current ?? "sagar")];
      items.push({
        y: player.y + TILE,
        d: () => {
          person(fCtx, player.x, footY, mySkin, player.facing, moving ? step : 0);
        },
      });

      // Draw remote users (y-sorted with other items) — interpolate smoothly toward broadcast position
      for (const [name, ru] of Object.entries(remoteUsersRef.current)) {
        const skinKey = getSkinKey(name);
        // Lerp the live pixel position toward the remote-reported position (smooths out ~10 Hz updates)
        const rs = remoteState[name] ?? (remoteState[name] = { x: ru.x ?? tileCenterPx(ru.c, ru.r).x, y: ru.y ?? tileCenterPx(ru.c, ru.r).y, stepDist: 0 });
        const targetX = ru.x ?? tileCenterPx(ru.c, ru.r).x;
        const targetY = ru.y ?? tileCenterPx(ru.c, ru.r).y;
        const dx = targetX - rs.x, dy = targetY - rs.y;
        const dist = Math.hypot(dx, dy);
        // Snap if more than 3 tiles away (teleport / stale join position) to avoid perpetual lag
        if (dist > TILE * 3) {
          rs.x = targetX; rs.y = targetY; rs.stepDist = 0;
        } else if (dist > 0.5) {
          // Move toward remote position at local walk speed for smooth interpolation
          const step = Math.min(dist, SPEED);
          rs.x += (dx / dist) * step;
          rs.y += (dy / dist) * step;
          rs.stepDist += step;
        } else {
          rs.x = targetX; rs.y = targetY;
        }
        const ruMoving = ru.moving || dist > 1;
        const ruStep = ruMoving ? (Math.floor(rs.stepDist / 4) % 4) : 0;
        const ruFootY = rs.y + (ru.sitting ? 4 : 8);
        items.push({
          y: rs.y + TILE,
          d: () => {
            person(fCtx, rs.x, ruFootY, SKINS[skinKey], ru.facing as Facing, ruStep);
          },
        });
      }
      // Room front walls are y-sorted with objects so they composite correctly
      for (const room of world.rooms) {
        const rr = room.rect;
        const rt = getWallTheme(room.wallTheme ?? world.wallTheme);
        items.push({ y: (rr.r1 + 1) * TILE, d: () => drawFrontWall(fCtx, rr.c0 * TILE, rr.r1 * TILE, (rr.c1 - rr.c0 + 1) * TILE, rt) });
      }
      const dh = dragHoverRef.current;
      if (dh && editLayoutRef.current) {
        items.push({
          y: (dh.r + dh.entry.h) * TILE,
          d: () => {
            fCtx.save();
            fCtx.globalAlpha = 0.55;
            drawObject(fCtx, { id: "_drag", kind: dh.entry.kind, label: dh.entry.label, c: dh.c, r: dh.r, w: dh.entry.w, h: dh.entry.h });
            fCtx.restore();
          },
        });
      }
      // Building front wall is y-sorted with objects so items in front of it render on top
      const B = world.building;
      items.push({ y: (B.r1 + 1) * TILE, d: () => drawFrontWall(fCtx, B.c0 * TILE, B.r1 * TILE, (B.c1 - B.c0 + 1) * TILE, getWallTheme(world.wallTheme)) });

      items.sort((a, b) => a.y - b.y);
      for (const it of items) it.d();
      // Building side walls on top of all room front walls (corners stay clean)
      drawBuildingSideWalls(fCtx, world);

      // Draw closed door when player is outside the room; hide it when inside so the exit gap is visible
      const playerC = player.tile.c;
      const playerR = player.tile.r;
      for (const room of world.rooms) {
        if (!isInsideRoom(room, playerC, playerR)) drawClosedDoor(fCtx, room);
        // Always draw open-entry archways (overrides the wall band, no panel)
        if (room.doorOpen2 && room.doorSide2) drawOpenDoorCutout(fCtx, room, room.doorSide2);
      }

      ctx.imageSmoothingEnabled = false;
      ctx.clearRect(0, 0, BACK_W, BACK_H);
      ctx.drawImage(frame, 0, 0, BACK_W, BACK_H);
      ctx.imageSmoothingEnabled = true;

      if (destMarker) {
        const m = tileCenterPx(destMarker.c, destMarker.r);
        ctx.strokeStyle = "rgba(138,92,255,0.9)"; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(X(m.x), X(m.y), 10, 0, Math.PI * 2); ctx.stroke();
        ctx.fillStyle = "rgba(138,92,255,0.25)";
        ctx.beginPath(); ctx.arc(X(m.x), X(m.y), 6, 0, Math.PI * 2); ctx.fill();
      }

      // hover highlight (edit mode only)
      if (hover && !sel && !press?.dragging && editLayoutRef.current) {
        const pk = pick(hover.c, hover.r);
        if (pk) {
          const R = selRect(pk);
          ctx.strokeStyle = "rgba(255,255,255,0.5)"; ctx.lineWidth = 2;
          ctx.strokeRect(X(R.c0 * TILE) + 1, X(R.r0 * TILE) + 1, X((R.c1 - R.c0 + 1) * TILE) - 2, X((R.r1 - R.r0 + 1) * TILE) - 2);
        }
      }

      // drag-from-library drop target outline
      if (dh && editLayoutRef.current) {
        ctx.strokeStyle = "rgba(90,200,255,0.85)"; ctx.lineWidth = 2;
        ctx.setLineDash([6, 3]);
        ctx.strokeRect(X(dh.c * TILE) + 1, X(dh.r * TILE) + 1, X(dh.entry.w * TILE) - 2, X(dh.entry.h * TILE) - 2);
        ctx.setLineDash([]);
      }

      // selection box + handles
      if (sel) {
        let bx: number, by: number, bw: number, bh: number;
        if (sel.kind === "object") {
          const o = sel.obj; const s = o.scale ?? 1;
          const pivotX = (o.c + o.w / 2) * TILE, pivotY = (o.r + o.h) * TILE;
          const x0 = pivotX + (o.c * TILE - pivotX) * s, x1 = pivotX + ((o.c + o.w) * TILE - pivotX) * s;
          const y0 = pivotY + (o.r * TILE - pivotY) * s, y1 = pivotY;
          bx = X(x0); by = X(y0); bw = X(x1 - x0); bh = X(y1 - y0);
        } else {
          const R = selRect(sel);
          bx = X(R.c0 * TILE); by = X(R.r0 * TILE);
          bw = X((R.c1 - R.c0 + 1) * TILE); bh = X((R.r1 - R.r0 + 1) * TILE);
        }
        ctx.fillStyle = "rgba(90,200,255,0.10)";
        ctx.fillRect(bx, by, bw, bh);
        ctx.strokeStyle = "rgba(90,200,255,0.95)"; ctx.lineWidth = 3;
        ctx.strokeRect(bx + 1, by + 1, bw - 2, bh - 2);
        for (const h of handlesFor(sel)) {
          const hx = X(h.xN), hy = X(h.yN);
          if (h.id === "door") {
            ctx.fillStyle = "#ff8c42";
            ctx.beginPath(); ctx.arc(hx, hy, 8, 0, Math.PI * 2); ctx.fill();
            ctx.strokeStyle = "rgba(160,50,0,0.9)"; ctx.lineWidth = 2;
            ctx.beginPath(); ctx.arc(hx, hy, 8, 0, Math.PI * 2); ctx.stroke();
          } else {
            ctx.fillStyle = "#ffffff";
            ctx.fillRect(hx - 7, hy - 7, 14, 14);
            ctx.strokeStyle = "rgba(40,120,200,0.95)"; ctx.lineWidth = 2;
            ctx.strokeRect(hx - 7, hy - 7, 14, 14);
          }
        }
        if (sel.kind === "object") {
          const pct = Math.round((sel.obj.scale ?? 1) * 100);
          ctx.font = "600 16px ui-monospace, Menlo, monospace";
          ctx.fillStyle = "rgba(40,120,200,0.95)";
          roundRect(bx, by - 26, 64, 22, 6); ctx.fill();
          ctx.fillStyle = "#fff"; ctx.textBaseline = "middle";
          ctx.fillText(`${pct}%`, bx + 10, by - 14);
        }
      }

      // Update modal anchor position every frame so the card tracks the NPC
      if (npcModalRef.current) {
        const mn = world.npcs.find((n) => n.id === npcModalRef.current!.id);
        if (mn) {
          const newPos = { x: mn.c * TILE + TILE / 2, y: mn.r * TILE - 36 };
          const prev = npcModalPosRef.current;
          if (!prev || Math.abs(prev.x - newPos.x) > 0.5 || Math.abs(prev.y - newPos.y) > 0.5) {
            npcModalPosRef.current = newPos;
            setNpcModalPos(newPos);
          }
        }
      }

      waveZones.length = 0;
      // Tags for static NPCs (only when not replaced by a live user)
      if (!npcModalRef.current) {
        for (const n of world.npcs) {
          if (n.status === "offline") continue;
          if (!onlineNames.has(n.id.toLowerCase())) {
            const npcCxN = n.c * TILE + TILE / 2;
            const npcHeadTopYN = n.r * TILE - 36;
            drawCharTag(npcCxN, npcHeadTopYN, n.name, STATUS_COLOR[n.status], STATUS_ICON[n.status], n.id);
          }
        }
      }
      // Tags for remote live users — follow their interpolated pixel position
      for (const [name, ru] of Object.entries(remoteUsersRef.current)) {
        const rs = remoteState[name];
        if (!rs) continue;
        const ruStatus = (ru.status ?? "online") as keyof typeof STATUS_COLOR;
        const ruColor = STATUS_COLOR[ruStatus] ?? STATUS_COLOR["online"];
        const ruIcon = STATUS_ICON[ruStatus] ?? "";
        drawCharTag(rs.x, rs.y - 40, name, ruColor, ruIcon, name);
      }
      // No tag for the local player (you don't see your own name above your head)
      drawPlayerTag(player.x, player.y - 40);

      // ---- proximity & room-entry prompts ----
      const pc = player.tile.c, pr = player.tile.r;
      let newPrompt: typeof meetPromptRef.current = null;

      // Check proximity to static NPCs (not replaced by a live user)
      for (const n of world.npcs) {
        if (n.status === "offline") continue;
        if (onlineNames.has(n.id.toLowerCase())) continue;
        if (Math.abs(pc - n.c) <= 2 && Math.abs(pr - n.r) <= 2) {
          newPrompt = { kind: "npc", name: n.name };
          break;
        }
      }

      // Check proximity to live remote users (real-time)
      if (!newPrompt) {
        for (const [name, ru] of Object.entries(remoteUsersRef.current)) {
          if (Math.abs(pc - ru.c) <= 2 && Math.abs(pr - ru.r) <= 2) {
            newPrompt = { kind: "npc", name };
            break;
          }
        }
      }

      if (!newPrompt) {
        let foundRoom: string | null = null;
        for (const room of world.rooms) {
          // Skip meeting rooms — prompt should only appear outside meeting rooms
          if (room.label.toLowerCase().includes("meeting")) continue;
          if (isInsideRoom(room, pc, pr)) {
            newPrompt = { kind: "room", name: room.label };
            foundRoom = room.label;
            break;
          }
        }
        currentRoomRef.current = foundRoom;
      } else {
        currentRoomRef.current = null;
      }
      // Clear dismissed state when the trigger context changes
      const dismissed = meetDismissedRef.current;
      if (dismissed && (!newPrompt || dismissed.kind !== newPrompt.kind || dismissed.name !== newPrompt.name)) {
        meetDismissedRef.current = null;
      }
      // Suppress re-showing a prompt the user just dismissed for the same trigger
      const suppressed = meetDismissedRef.current;
      const effective = (suppressed && newPrompt && suppressed.kind === newPrompt.kind && suppressed.name === newPrompt.name)
        ? null : newPrompt;

      const prev = meetPromptRef.current;
      const changed =
        (!prev && effective) ||
        (prev && !effective) ||
        (prev && effective && (prev.kind !== effective.kind || prev.name !== effective.name));
      if (changed) {
        meetPromptRef.current = effective;
        setMeetPrompt(effective);
        // Play a soft ting when a new meet prompt appears (user came near someone or entered a room)
        if (effective) playTing();
      }

      // NPC desk/chair hover label — show "[Name]'s desk" when mouse is near their seat area
      if (!editLayoutRef.current) {
        const mp = mousePxRef.current;
        const hoverC = Math.floor(mp.x / TILE);
        const hoverR = Math.floor(mp.y / TILE);
        for (const n of world.npcs) {
          if (Math.abs(hoverC - n.c) <= 2 && Math.abs(hoverR - n.r) <= 3) {
            const labelText = `${n.name}'s desk`;
            const lx = X(mp.x);
            const ly = X(mp.y) - 18;
            ctx.font = `600 ${6 * SCALE}px ui-sans-serif, system-ui, sans-serif`;
            const tw = ctx.measureText(labelText).width;
            const pad = 10, th = 22;
            ctx.fillStyle = "rgba(10,12,18,0.90)";
            roundRect(lx - tw / 2 - pad, ly - th, tw + pad * 2, th, 6); ctx.fill();
            ctx.fillStyle = "#ffffff"; ctx.textBaseline = "middle";
            ctx.fillText(labelText, lx - tw / 2, ly - th / 2);
            break;
          }
        }
      }

      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      setZoom((z) => clamp(z * (e.deltaY < 0 ? 1.05 : 0.95), 0.25, 4));
    };
    canvas.addEventListener("wheel", onWheel, { passive: false });

    return () => {
      cancelAnimationFrame(raf);
      canvas.removeEventListener("mousedown", onDown);
      canvas.removeEventListener("mousemove", onMove);
      canvas.removeEventListener("wheel", onWheel);
      window.removeEventListener("mouseup", onUp);
      window.removeEventListener("keydown", onKey);
      apiRef.current = null;
    };
  }, []);

  useEffect(() => {
    editLayoutRef.current = editLayout;
    if (!editLayout) { apiRef.current?.deselect(); setShowLibrary(false); }
  }, [editLayout]);

  const isObj = selInfo?.kind === "object";
  return (
    <div className="officeWrap">
      <canvas
        ref={canvasRef}
        width={BACK_W}
        height={BACK_H}
        style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`, transformOrigin: "center center", transition: "transform 0.2s ease-out" }}
        onDragOver={(e) => {
          const entry = dragEntryRef.current;
          if (!editLayout || !entry) return;
          e.preventDefault();
          e.dataTransfer.dropEffect = "copy";
          const rect = canvasRef.current!.getBoundingClientRect();
          const nx = ((e.clientX - rect.left) / rect.width) * NATIVE_W;
          const ny = ((e.clientY - rect.top) / rect.height) * NATIVE_H;
          dragHoverRef.current = {
            c: clamp(Math.floor(nx / TILE), 0, COLS - entry.w),
            r: clamp(Math.floor(ny / TILE), 0, ROWS - entry.h),
            entry,
          };
        }}
        onDragLeave={() => { dragHoverRef.current = null; }}
        onDrop={(e) => {
          const entry = dragEntryRef.current;
          if (!entry) return;
          e.preventDefault();
          const dh = dragHoverRef.current;
          dragHoverRef.current = null;
          dragEntryRef.current = null;
          apiRef.current?.addFromCatalog(entry, dh?.c, dh?.r);
        }}
      />

      {!editLayout && whoAmI === "Sagar" && (
        <button className="editLayoutBtn" onClick={() => setEditLayout(true)}>
          Edit Layout
        </button>
      )}

      {editLayout && (
        <div className="editToolbar">
          <button
            className={`saveBtn${saved ? " saved" : ""}`}
            onClick={() => apiRef.current?.save()}
          >
            {saved ? "Saved ✓" : "Save layout"}
          </button>
          <button
            className={`libToggleBtn${showLibrary ? " active" : ""}`}
            onClick={() => setShowLibrary((v) => !v)}
          >
            Items library
          </button>
          <button
            className="removeAllBtn"
            onClick={() => {
              if (confirm("Remove all items from the layout? You can add them back from the Items Library.")) {
                apiRef.current?.removeAll();
              }
            }}
          >
            Remove all
          </button>
          <button className="doneBtn" onClick={() => setEditLayout(false)}>
            Done
          </button>
        </div>
      )}

      <div className="bottomRightStack">
        {whoAmI && (
          <div className="statusPicker">
            {(["online", "busy", "away"] as const).map((s) => (
              <button
                key={s}
                className={`statusPickerBtn${myStatus === s ? " active" : ""}`}
                onClick={() => {
                  myStatusRef.current = s;
                  setMyStatus(s);
                  localStorage.setItem(STATUS_KEY, s);
                }}
              >
                <span className="statusPickerDot" style={{ background: STATUS_COLOR[s] }} />
                <span className="statusPickerLabel">{s === "online" ? "Online" : s === "busy" ? "Busy" : "Away"}</span>
              </button>
            ))}
          </div>
        )}

        <div className="slackChannelStrip">
          <div className="slackChannelHeader">
            <span className="slackChannelLabel">Channels</span>
            <div className="slackAppIcons">
              <a href="https://meet.google.com" target="_blank" rel="noopener noreferrer" title="Google Meet" data-tooltip="Meet" className="slackAppIcon">
                <svg width="16" height="16" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M28 24L38.5 15V33L28 24Z" fill="#00832D"/>
                  <rect x="9" y="15" width="19" height="18" rx="2" fill="#00832D"/>
                  <path d="M9 31l5-5h14v7H11a2 2 0 01-2-2z" fill="#00832D"/>
                  <rect x="9" y="15" width="19" height="18" rx="2" fill="#00AC47"/>
                  <path d="M28 24L38.5 15V33L28 24Z" fill="#00AC47"/>
                  <path d="M9 33h19v-7H14l-5 5v2z" fill="#0066DA" opacity=".3"/>
                </svg>
              </a>
              <a href="https://mail.google.com" target="_blank" rel="noopener noreferrer" title="Gmail" data-tooltip="Gmail" className="slackAppIcon">
                <svg width="16" height="16" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M8 36h6V22L4 14v20a2 2 0 002 2z" fill="#4285F4"/>
                  <path d="M34 36h6a2 2 0 002-2V14l-10 8v14z" fill="#34A853"/>
                  <path d="M34 12l-10 8-10-8H8l16 12 16-12h-6z" fill="#EA4335"/>
                  <path d="M4 14l10 8V22L4 14z" fill="#C5221F"/>
                  <path d="M44 14l-10 8v-8l10-6v6z" fill="#1B6AA5" opacity=".5"/>
                  <path d="M8 12H4v2l10 8v-4L8 12z" fill="#C5221F"/>
                  <path d="M40 12h4v2l-10 8v-4l6-6z" fill="#1B6AA5" opacity=".5"/>
                  <rect x="4" y="12" width="40" height="24" rx="2" fill="none"/>
                  <path d="M4 14l20 14L44 14V12H4v2z" fill="#EA4335"/>
                  <path d="M4 14v2l20 13 20-13v-2L24 26 4 14z" fill="#FBBC04" opacity=".5"/>
                </svg>
              </a>
              <a href="https://drive.google.com" target="_blank" rel="noopener noreferrer" title="Google Drive" data-tooltip="Drive" className="slackAppIcon">
                <svg width="16" height="16" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M17 6L4 28h13l13-22H17z" fill="#0066DA"/>
                  <path d="M31 6L44 28H31L18 6h13z" fill="#00AC47"/>
                  <path d="M4 28l9 14h22l9-14H4z" fill="#FFBA00"/>
                </svg>
              </a>
              <a href={`slack://open?team=${SLACK_TEAM_ID}`} target="_blank" rel="noopener noreferrer" title="Slack" data-tooltip="Slack" className="slackAppIcon">
                <svg width="16" height="16" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M18 6a4 4 0 00-4 4v8h8V10a4 4 0 00-4-4z" fill="#E01E5A"/>
                  <path d="M6 18a4 4 0 004 4h8v-8H10a4 4 0 00-4 4z" fill="#E01E5A"/>
                  <path d="M30 6a4 4 0 014 4v8h-8V10a4 4 0 014-4z" fill="#36C5F0"/>
                  <path d="M42 18a4 4 0 01-4 4h-8v-8h8a4 4 0 014 4z" fill="#36C5F0"/>
                  <path d="M18 42a4 4 0 004-4v-8h-8v8a4 4 0 004 4z" fill="#2EB67D"/>
                  <path d="M6 30a4 4 0 004-4h8v8H10a4 4 0 01-4-4z" fill="#2EB67D"/>
                  <path d="M30 42a4 4 0 01-4-4v-8h8v8a4 4 0 01-4 4z" fill="#ECB22E"/>
                  <path d="M42 30a4 4 0 01-4-4h-8v8h8a4 4 0 004-4z" fill="#ECB22E"/>
                </svg>
              </a>
            </div>
          </div>
          <div className="slackChannelDivider" />
          <div className="slackChannelGrid">
            {SLACK_CHANNELS.slice(0, 5).map((ch) => (
              <a
                key={ch.id}
                className="slackChannelPill"
                href={`slack://channel?team=${SLACK_TEAM_ID}&id=${ch.id}`}
                target="_blank"
                rel="noopener noreferrer"
                title={`Open #${ch.name} in Slack`}
              >
                #{ch.name}
              </a>
            ))}
          </div>
        </div>

        <div className="zoomControls">
          <button onClick={() => setZoom((z) => clamp(z * 1.15, 0.25, 4))}>+</button>
          <span>{Math.round(zoom * 100)}%</span>
          <button onClick={() => setZoom((z) => clamp(z * 0.87, 0.25, 4))}>−</button>
          <button className="ghost" onClick={() => { setZoom(1); panRef.current = { x: 0, y: 0 }; setPan({ x: 0, y: 0 }); }} title="Reset zoom & position">↺</button>
          <button className="goToDeskBtn" onClick={() => { setZoom(1); panRef.current = { x: 0, y: 0 }; setPan({ x: 0, y: 0 }); apiRef.current?.deselect(); apiRef.current?.goToDesk(); }} title="Go to desk">Go to desk</button>
        </div>
      </div>

      {editLayout && selInfo && (
        <div className="selBar">
          <span className="selName">{selInfo.label}</span>
          {isObj ? (
            <>
              <button onClick={() => apiRef.current?.rotate(-90)} title="Rotate left">↺</button>
              <button onClick={() => apiRef.current?.rotate(90)} title="Rotate right">↻</button>
              <button onClick={() => apiRef.current?.scale(-0.15)} title="Smaller (−)">−</button>
              <button onClick={() => apiRef.current?.scale(0.15)} title="Bigger (+)">＋</button>
              <button onClick={() => apiRef.current?.duplicate()}>Dup</button>
              <button className="danger" onClick={() => apiRef.current?.remove()}>Del</button>
            </>
          ) : selInfo.kind === "building" ? (
            <>
              <span className="selHint">drag handles to resize</span>
              <span className="selHint selHint--sep">Wall:</span>
              {Object.entries(WALL_THEMES).map(([key, { label, theme }]) => (
                <button key={key} className={`colorSwatch${selInfo.wallTheme === key ? " active" : ""}`} style={{ background: theme.main }} title={label} onClick={() => apiRef.current?.setWallTheme(key)} />
              ))}
              <label className="colorPickerBtn" title="Custom wall color">
                <span style={{ background: selInfo.wallHex }} className="colorPickerSwatch" />
                <input type="color" value={selInfo.wallHex ?? "#d97030"} onChange={(e) => apiRef.current?.setCustomWallColor(e.target.value)} />
              </label>
              <span className="selHint selHint--sep">Floor pattern:</span>
              {FLOOR_PATTERNS.map(({ pattern, label, icon }) => (
                <button key={pattern} className={`patternBtn${selInfo.floorPattern === pattern ? " active" : ""}`} title={label} onClick={() => apiRef.current?.setFloorPattern(pattern)}>{icon}</button>
              ))}
              <span className="selHint selHint--sep">Floor color:</span>
              {FLOOR_KINDS.map(({ kind, label, color }) => (
                <button key={kind} className={`colorSwatch${selInfo.floorHex === color ? " active" : ""}`} style={{ background: color }} title={label} onClick={() => apiRef.current?.setFloorKind(kind)} />
              ))}
              <label className="colorPickerBtn" title="Custom floor color">
                <span style={{ background: selInfo.floorHex }} className="colorPickerSwatch" />
                <input type="color" value={selInfo.floorHex ?? "#e8dfc8"} onChange={(e) => apiRef.current?.setCustomFloorColor(e.target.value)} />
              </label>
              <button onClick={() => apiRef.current?.duplicateBuilding()}>Dup room</button>
            </>
          ) : selInfo.kind === "room" ? (
            <>
              <span className="selHint">drag edges to resize</span>
              <span className="selHint selHint--sep">Wall:</span>
              {Object.entries(WALL_THEMES).map(([key, { label, theme }]) => (
                <button key={key} className={`colorSwatch${selInfo.wallTheme === key ? " active" : ""}`} style={{ background: theme.main }} title={label} onClick={() => apiRef.current?.setWallTheme(key)} />
              ))}
              <label className="colorPickerBtn" title="Custom wall color">
                <span style={{ background: selInfo.wallHex }} className="colorPickerSwatch" />
                <input type="color" value={selInfo.wallHex ?? "#d97030"} onChange={(e) => apiRef.current?.setCustomWallColor(e.target.value)} />
              </label>
              <span className="selHint selHint--sep">Floor pattern:</span>
              {FLOOR_PATTERNS.map(({ pattern, label, icon }) => (
                <button key={pattern} className={`patternBtn${selInfo.floorPattern === pattern ? " active" : ""}`} title={label} onClick={() => apiRef.current?.setFloorPattern(pattern)}>{icon}</button>
              ))}
              <span className="selHint selHint--sep">Floor color:</span>
              {FLOOR_KINDS.map(({ kind, label, color }) => (
                <button key={kind} className={`colorSwatch${selInfo.floorHex === color ? " active" : ""}`} style={{ background: color }} title={label} onClick={() => apiRef.current?.setFloorKind(kind)} />
              ))}
              <label className="colorPickerBtn" title="Custom floor color">
                <span style={{ background: selInfo.floorHex }} className="colorPickerSwatch" />
                <input type="color" value={selInfo.floorHex ?? "#e8dfc8"} onChange={(e) => apiRef.current?.setCustomFloorColor(e.target.value)} />
              </label>
              {selInfo.doorSide ? (
                <>
                  <span className="selHint selHint--sep">Door:</span>
                  <button className={selInfo.doorSide === "top" ? "active" : ""} title="Move door to top wall" onClick={() => apiRef.current?.setDoorSide("top")}>↑</button>
                  <button className={selInfo.doorSide === "bottom" ? "active" : ""} title="Move door to bottom wall" onClick={() => apiRef.current?.setDoorSide("bottom")}>↓</button>
                  <button className={selInfo.doorSide === "left" ? "active" : ""} title="Move door to left wall" onClick={() => apiRef.current?.setDoorSide("left")}>←</button>
                  <button className={selInfo.doorSide === "right" ? "active" : ""} title="Move door to right wall" onClick={() => apiRef.current?.setDoorSide("right")}>→</button>
                  <span className="selHint">drag ⊙ to slide</span>
                  {!selInfo.doorSide2
                    ? <button title="Add a 2nd door on the opposite wall" onClick={() => apiRef.current?.addSecondDoor()}>+Door 2</button>
                    : <>
                        <button title={selInfo.doorOpen2 ? "2nd door always open — click to close" : "2nd door closed — click to open"} onClick={() => apiRef.current?.toggleDoorOpen2()}>
                          Door 2: {selInfo.doorOpen2 ? "open" : "closed"}
                        </button>
                        <button className="danger" title="Remove 2nd door" onClick={() => apiRef.current?.deleteSecondDoor()}>−Door 2</button>
                      </>
                  }
                  <button className="danger" title="Remove door" onClick={() => apiRef.current?.deleteDoor()}>−Door</button>
                </>
              ) : (
                <>
                  <span className="selHint selHint--sep">No door —</span>
                  <button onClick={() => apiRef.current?.addDoor("left")}>+Door</button>
                </>
              )}
              <button onClick={() => apiRef.current?.duplicateRoom()}>Dup</button>
              <button className="danger" onClick={() => apiRef.current?.deleteRoom()}>Delete</button>
            </>
          ) : selInfo.kind === "patch" ? (
            <>
              <span className="selHint">drag handles to resize</span>
              <span className="selHint selHint--sep">Pattern:</span>
              {FLOOR_PATTERNS.map(({ pattern, label, icon }) => (
                <button key={pattern} className={`patternBtn${selInfo.floorPattern === pattern ? " active" : ""}`} title={label} onClick={() => apiRef.current?.setFloorPattern(pattern)}>{icon}</button>
              ))}
              <span className="selHint selHint--sep">Color:</span>
              {FLOOR_KINDS.map(({ kind, label, color }) => (
                <button key={kind} className={`colorSwatch${selInfo.floorHex === color ? " active" : ""}`} style={{ background: color }} title={label} onClick={() => apiRef.current?.setFloorKind(kind)} />
              ))}
              <label className="colorPickerBtn" title="Custom color">
                <span style={{ background: selInfo.floorHex }} className="colorPickerSwatch" />
                <input type="color" value={selInfo.floorHex ?? "#e8dfc8"} onChange={(e) => apiRef.current?.setCustomFloorColor(e.target.value)} />
              </label>
              <button className="danger" onClick={() => apiRef.current?.removePatch()}>Delete</button>
            </>
          ) : (
            <span className="selHint">drag handles to resize</span>
          )}
          <button className="ghost" onClick={() => apiRef.current?.deselect()}>✕</button>
        </div>
      )}

      {meetPrompt && (
        <div className="meetPrompt">
          <div className="meetPromptInner">
            <span className="meetPromptIcon">📹</span>
            <div className="meetPromptText">
              {meetPrompt.kind === "npc"
                ? <><strong>{meetPrompt.name}</strong> is nearby — join a call?</>
                : <>You entered <strong>{meetPrompt.name}</strong> — start a meeting?</>
              }
            </div>
            <a className="meetPromptJoin" href={MEET_LINK} target="_blank" rel="noopener noreferrer" onClick={() => { playChime(); broadcastChime(); }}>
              Join Meet
            </a>
            <a className="meetPromptSlack" href={slackChannelUrl} target="_blank" rel="noopener noreferrer">
              Slack
            </a>
            <button className="meetPromptWave" title="Wave hello" onClick={() => { playTing(); broadcastWave(); }}>
              👋
            </button>
            <button className="meetPromptDismiss" onClick={() => {
              meetDismissedRef.current = meetPrompt;
              meetPromptRef.current = null;
              setMeetPrompt(null);
            }}>✕</button>
          </div>
        </div>
      )}

      {npcModal && (
        <div className="npcModalBackdrop" onClick={() => { setNpcModal(null); npcModalRef.current = null; npcModalPosRef.current = null; setNpcModalPos(null); }}>
          <div
            className="npcModalCard"
            style={(() => {
              if (!npcModalPos) return {};
              const vw = window.innerWidth;
              const canvasTop = (window.innerHeight - vw) / 2;
              const sx = (npcModalPos.x / NATIVE_W) * vw * zoom + pan.x + vw / 2 - (vw * zoom) / 2;
              const sy = (npcModalPos.y / NATIVE_H) * vw * zoom + pan.y + canvasTop + vw / 2 - (vw * zoom) / 2;
              return { position: "fixed" as const, left: sx, top: sy, transform: "translate(-50%, -100%)" };
            })()}
            onClick={(e) => e.stopPropagation()}
          >
            <button className="npcModalClose" onClick={() => { setNpcModal(null); npcModalRef.current = null; npcModalPosRef.current = null; setNpcModalPos(null); }}>✕</button>
            <div className="npcModalAvatar">
              <span className="npcModalAvatarInitial">{npcModal.name[0]}</span>
              <span className="npcModalStatusDot" style={{ background: npcModal.status === "online" ? "#22c55e" : npcModal.status === "away" ? "#eab308" : "#ef4444" }} />
            </div>
            <div className="npcModalName">{npcModal.name}</div>
            <div className="npcModalStatus" style={{ color: npcModal.status === "online" ? "#22c55e" : npcModal.status === "away" ? "#eab308" : "#ef4444" }}>
              {npcModal.status === "online" ? "Online" : npcModal.status === "away" ? "Away" : "Offline"}
            </div>
            <div className="npcModalActions">
              <button className="npcModalWaveBtn" onClick={() => { playTing(); broadcastWave(); }} title="Wave hello">
                👋
              </button>
              <button className="npcModalGoBtn" onClick={() => {
                apiRef.current?.goToNpc(npcModal.id);
                setNpcModal(null); npcModalRef.current = null; npcModalPosRef.current = null; setNpcModalPos(null);
              }}>
                Go to them
              </button>
              {npcModal.slackUserId && (
                <a className="npcModalSlackBtn" href={slackDmUrl(npcModal.slackUserId)} target="_blank" rel="noopener noreferrer" onClick={() => { setNpcModal(null); npcModalRef.current = null; npcModalPosRef.current = null; setNpcModalPos(null); }}>
                  Message on Slack
                </a>
              )}
              <button className="npcModalInviteBtn" onClick={() => {
                playChime();
                const alreadyInRoom = currentRoomRef.current && currentRoomRef.current !== "Reception";
                const roomLabel = alreadyInRoom
                  ? currentRoomRef.current!
                  : (apiRef.current?.goToRandomRoom() ?? "Meeting Room");
                broadcastMeetInvite(roomLabel);
                navigator.clipboard?.writeText(MEET_LINK).catch(() => {});
                setNpcModal(null); npcModalRef.current = null; npcModalPosRef.current = null; setNpcModalPos(null);
              }}>
                Invite to meeting
              </button>
            </div>
          </div>
        </div>
      )}

      {!whoAmI && (
        <div className="whoOverlay">
          <div className="whoCard">
            <div className="whoTitle">Who are you?</div>
            <div className="whoSubtitle">Pick your character to enter the office</div>
            <div className="whoGrid">
              {TEAM_MEMBERS.map((name) => (
                <button key={name} className="whoBtn"
                  onClick={() => { sessionStorage.setItem(WHO_KEY, name); whoAmIRef.current = name; setWhoAmI(name); playChime(); }}>
                  <span className="whoAvatar">{name[0]}</span>
                  <span className="whoName">{name}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {meetInviteToast && (
        <div className="meetInviteToast">
          <span className="meetInviteToastIcon">📹</span>
          <span><strong>{meetInviteToast.from}</strong> invited you to <strong>{meetInviteToast.room}</strong> — heading there!</span>
          <button className="meetInviteToastClose" onClick={() => setMeetInviteToast(null)}>✕</button>
        </div>
      )}

      {editLayout && showLibrary && (
        <div className="itemsLibrary">
          <div className="libHeader">
            <span className="libTitle">Items Library</span>
            <button className="libClose" onClick={() => setShowLibrary(false)}>✕</button>
          </div>
          <div className="libBody">
            {ITEM_CATALOG.map((cat) => (
              <div key={cat.name} className="libCategory">
                <div className="libCatName">{cat.name}</div>
                <div className="libGrid">
                  {cat.items.map((entry) => (
                    <button
                      key={entry.kind + entry.label}
                      className="libCard"
                      draggable
                      onDragStart={(e) => {
                        dragEntryRef.current = entry;
                        e.dataTransfer.effectAllowed = "copy";
                        const previewCanvas = e.currentTarget.querySelector("canvas");
                        if (previewCanvas) e.dataTransfer.setDragImage(previewCanvas, previewCanvas.width / 2, previewCanvas.height / 2);
                      }}
                      onDragEnd={() => { dragEntryRef.current = null; dragHoverRef.current = null; }}
                      onClick={() => apiRef.current?.addFromCatalog(entry)}
                      title={`Add ${entry.label}`}
                    >
                      <ItemPreview entry={entry} />
                      <span className="libCardName">{entry.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
