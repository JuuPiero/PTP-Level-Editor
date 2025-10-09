import type { Color } from './colors';

export interface Coordinates {
    x: number;
    y: number;
}

export interface GridData {
    width: number;
    height: number;
    strGrid: string[];
}

export interface ExitSpecialInfo {
    count: number;
    iceCount: number;
    layerColors: Color[] | null;
    rawLayerColors?: string | number;
    isPermanent: boolean;
}

export interface Exit {
    position: Coordinates;
    color: Color;
    special: ExitSpecialInfo;
}

export enum KeyLockColor {
    Silver,
    Gold,
    Unk = -1,
}

export interface PetSpecialInfoKeyLock {
    keyColor: KeyLockColor;
    lockColor: KeyLockColor;
}

export interface PetSpecialInfo {
    layerColors: Color[] | null;
    rawLayerColors?: string | number; // To store original value from .asset
    iceCount: number;
    hiddenCount: number;
    keyLock: PetSpecialInfoKeyLock | null;
    hasScissor: boolean;
    isSingleDirection: boolean;
    count: number;
    timeExplode: number;
}

export interface Pet {
    id: number; // Editor-only ID for tracking
    editorName: string; // Editor-only name ('A', 'B', etc.) for easy identification
    headPos: Coordinates;
    positions: Coordinates[];
    color: Color;
    special: PetSpecialInfo;
}

export interface StoneWall {
    position: Coordinates;
    count: number;
    iceCount: number;
}

export interface ColoredPath {
    position: Coordinates;
    color: Color;
}

export interface ColorWall {
    position: Coordinates;
    color: Color;
}

export interface CrateInfo {
    listPositions: Coordinates[];
    id: number;
    requiredSnake: number;
}

export interface RibbonInfo {
    listPositions: Coordinates[];
}

export enum MovableBoxDirection {
    None = 0,
    Vertical = 1,
    Horizontal = 2,
}

export interface MovableBox {
    id: number; // Editor-only
    listPositions: Coordinates[];
    direction: MovableBoxDirection;
}

export interface ObstacleInfo {
    id: number;
    listPositions: Coordinates[];
}

export interface TreeRoot {
    id: number;
    position: Coordinates; // The 'pole'
    direction: Coordinates; // e.g., {x: 1, y: 0} for right
    length: number;
}

export enum LevelTheme {
  Classic = 'Classic',
  Winter = 'Winter',
  Spooky = 'Spooky',
}

export interface Level {
    level: number;
    time: number;
    isHardLevel: boolean;
    solution: any[];
    pets: Pet[];
    gridData: GridData;
    exits: Exit[];
    stoneWalls: StoneWall[];
    coloredPaths: ColoredPath[];
    colorWalls: ColorWall[];
    crateInfos: CrateInfo[];
    ribbonInfo: RibbonInfo;
    movableBoxes: MovableBox[];
    obstacleInfos: ObstacleInfo[];
    treeRoots: TreeRoot[];
    levelDifficulty: number;
    levelName: string;
    theme: LevelTheme;
}

// Editor-specific types
export type EditorTool = 'pet' | 'exit' | 'stone' | 'wall' | 'colored_path' | 'color_wall' | 'crate' | 'ribbon' | 'movable_box' | 'obstacle' | 'tree_root' | 'eraser';

export type DrawingState = {
    type: 'pet' | 'crate' | 'movable_box' | 'obstacle';
    id: number | null;
};

export type SelectedObject =
  | { type: 'pet'; id: number }
  | { type: 'exit'; pos: Coordinates }
  | { type: 'stone'; pos: Coordinates }
  | { type: 'colored_path', pos: Coordinates }
  | { type: 'color_wall', pos: Coordinates }
  | { type: 'crate', id: number }
  | { type: 'ribbon' }
  | { type: 'movable_box', id: number }
  | { type: 'obstacle', id: number }
  | { type: 'tree_root', id: number }
  | { type: 'wall'; pos: Coordinates };
