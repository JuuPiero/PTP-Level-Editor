// solver.ts
import type { Level, Pet, Coordinates, MovableBox, Exit, CrateInfo } from '../types/level';
import { MovableBoxDirection, KeyLockColor } from '../types/level';
import { applyPetSolutionEffects } from './levelUtils';

// --- TYPE DEFINITIONS ---

type GameState = Level;

type Move =
  | { type: 'solve'; petId: number; end: 'head' | 'tail'; path: [Coordinates, Coordinates]; exit: Exit; }
  | { type: 'reposition'; petId: number; end: 'head' | 'tail'; path: [Coordinates, Coordinates]; }
  | { type: 'move_box'; boxId: number; path: [Coordinates, Coordinates]; };

// --- UTILITIES ---

const MAX_SOLUTION_LENGTH = 300; // conservative cap on setup move sequences per stage

// Bresenham-like line cells (used for ribbon)
const getLineCells = (p1: Coordinates, p2: Coordinates): Coordinates[] => {
    const cells: Coordinates[] = [];
    let x0 = p1.x, y0 = p1.y;
    const x1 = p2.x, y1 = p2.y;
    const dx = Math.abs(x1 - x0);
    const sx = x0 < x1 ? 1 : -1;
    const dy = -Math.abs(y1 - y0);
    const sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;

    while (true) {
        cells.push({ x: x0, y: y0 });
        if (x0 === x1 && y0 === y1) break;
        const e2 = 2 * err;
        if (e2 >= dy) {
            err += dy;
            x0 += sx;
        }
        if (e2 <= dx) {
            err += dx;
            y0 += sy;
        }
    }
    return cells;
};

// simple string->number hash (djb2) for quicker map keys when needed
const fastHash = (s: string): number => {
    let hash = 5381;
    for (let i = 0; i < s.length; i++) {
        hash = ((hash << 5) + hash) + s.charCodeAt(i); /* hash * 33 + c */
        hash = hash | 0;
    }
    return hash >>> 0;
};

// --- PRUNING HELPERS ---

/**
 * Returns a conservative heuristic score for a state:
 * sum over pets of Manhattan distance to nearest compatible exit.
 * Lower is better.
 */
const stateHeuristicDistance = (state: GameState): number => {
    let sum = 0;
    for (const pet of state.pets) {
        const matchingExits = state.exits.filter(e => e.color === pet.color);
        if (matchingExits.length === 0) {
            sum += 1000;
            continue;
        }
        let best = Infinity;
        for (const ex of matchingExits) {
            const px = pet.positions[0].x;
            const py = pet.positions[0].y;
            const d = Math.abs(ex.position.x - px) + Math.abs(ex.position.y - py);
            if (d < best) best = d;
        }
        sum += best;
    }
    return sum;
};

/**
 * Detect inverse moves (simple reversal).
 */
const isInverse = (m1: Move, m2: Move): boolean => {
    if (m1.type !== m2.type) return false;
    const [s1, e1] = m1.path;
    const [s2, e2] = m2.path;
    const pathsInverse = s1.x === e2.x && s1.y === e2.y && e1.x === s2.x && e1.y === s2.y;
    if (!pathsInverse) return false;
    if ((m1.type === 'reposition' || m1.type === 'solve') && (m2.type === 'reposition' || m2.type === 'solve')) {
        return (m1 as any).petId === (m2 as any).petId && (m1 as any).end === (m2 as any).end;
    }
    if (m1.type === 'move_box' && m2.type === 'move_box') {
        return m1.boxId === m2.boxId;
    }
    return false;
};

/**
 * Detects simple 3-move oscillations like A -> B -> A -> B.
 */
function detectOscillation(path: Move[]): boolean {
  if (path.length < 3) return false;
  const m1 = path[path.length - 3];
  const m2 = path[path.length - 2];
  const m3 = path[path.length - 1];
  return isInverse(m1, m2) && isInverse(m2, m3);
}

/**
 * Quick deadlock detection for movable boxes.
 * Conservative: returns true when a box is in an obvious irrecoverable corner (no pushes)
 */
function isBoxDeadlocked(state: GameState, box: MovableBox): boolean {
    // If box is on an exit tile, it's fine — not deadlocked
    for (const ex of state.exits) {
        if (ex.position.x === box.listPositions[0].x && ex.position.y === box.listPositions[0].y) return false;
    }

    // If box has empty adjacent and can be moved, it's OK.
    // We'll conservatively check 2D corner: box blocked on two orthogonal sides by static obstacles.
    const { width, height } = state.gridData;
    const occ = new Set<string>();
    state.gridData.strGrid.forEach((rowStr, r) => rowStr.split(',').forEach((cell, c) => { if (cell === '0') occ.add(`${c},${height - 1 - r}`); }));
    state.stoneWalls.forEach(s => occ.add(`${s.position.x},${s.position.y}`));
    state.colorWalls.forEach(w => occ.add(`${w.position.x},${w.position.y}`));
    state.crateInfos.forEach(c => c.listPositions.forEach(p => occ.add(`${p.x},${p.y}`)));
    state.pets.forEach(p => p.positions.forEach(pos => occ.add(`${pos.x},${pos.y}`)));
    // treat other boxes as obstacles
    state.movableBoxes.forEach(b => b.listPositions.forEach(pos => occ.add(`${pos.x},${pos.y}`)));

    const p = box.listPositions[0];
    const neighbors = [
        { x: p.x + 1, y: p.y }, { x: p.x - 1, y: p.y },
        { x: p.x, y: p.y + 1 }, { x: p.x, y: p.y - 1 }
    ];

    // If box is against two obstacles forming a corner
    const blocked = neighbors.map(n => (n.x < 0 || n.x >= width || n.y < 0 || n.y >= height) || occ.has(`${n.x},${n.y}`));
    // check corner pairs
    if ((blocked[0] && blocked[2]) || (blocked[0] && blocked[3]) || (blocked[1] && blocked[2]) || (blocked[1] && blocked[3])) {
        return true;
    }
    return false;
}

// --- CORE HELPERS (original logic preserved) ---

const isPetMovable = (pet: Pet, state: GameState): boolean => {
    if (pet.special.iceCount > 0) return false;
    if (pet.special.keyLock?.lockColor !== KeyLockColor.Unk && pet.special.keyLock?.lockColor !== undefined) return false;
    const cratePositions = new Set<string>();
    state.crateInfos.forEach(crate => {
        if (crate.requiredSnake > 0) {
            crate.listPositions.forEach(pos => cratePositions.add(`${pos.x},${pos.y}`));
        }
    });
    if (pet.positions.some(pos => cratePositions.has(`${pos.x},${pos.y}`))) {
        return false;
    }
    return true;
};

/**
 * Improved state->string key that includes relevant dynamic features:
 * - pet positions & IDs & color/layers
 * - boxes positions
 * - crate counts
 * - stone walls, color walls positions
 * - exits (position + special)
 * - ribbon positions (explicit coordinates)
 *
 * This key is used for caching/pruning; keep it compact but complete enough.
 */
function stateToKey(state: GameState): string {
    const sortedPets = [...state.pets].sort((a, b) => a.id - b.id);
    const sortedBoxes = [...state.movableBoxes].sort((a, b) => a.id - b.id);
    const sortedCrates = [...state.crateInfos].sort((a, b) => a.id - b.id);
    const sortedStones = [...state.stoneWalls].sort((a, b) => a.position.x - b.position.x || a.position.y - b.position.y);
    const sortedColorWalls = [...state.colorWalls].sort((a, b) => a.position.x - b.position.x || a.position.y - b.position.y);
    const sortedExits = [...state.exits].sort((a, b) => a.position.x - b.position.x || a.position.y - b.position.y);
    const parts: string[] = [];
    sortedPets.forEach(p => {
        const special = p.special;
        const layerStr = special.layerColors?.length ? special.layerColors.join(',') : '';
        const specialKey = `L:${layerStr}|I:${special.iceCount}|H:${special.hiddenCount}|C:${special.count}|Lock:${special.keyLock?.lockColor??-1}|Key:${special.keyLock?.keyColor??-1}|Sc:${special.hasScissor ? 1 : 0}|Sd:${special.isSingleDirection ? 1 : 0}`;
        parts.push(`P(${p.id}):clr${p.color}@[${p.positions.map(pos => `${pos.x},${pos.y}`).join(';')}]<${specialKey}>`);
    });
    sortedBoxes.forEach(b => parts.push(`B(${b.id}):[${b.listPositions.map(pos => `${pos.x},${pos.y}`).join(';')}]`));
    sortedCrates.forEach(c => parts.push(`C(${c.id}):${c.requiredSnake}`));
    sortedStones.forEach(s => parts.push(`S(${s.position.x},${s.position.y}):C${s.count},I${s.iceCount ?? 0}`));
    sortedColorWalls.forEach(w => parts.push(`W(${w.position.x},${w.position.y}):${w.color}`));
    sortedExits.forEach(e => {
        const specialKey = `Clr:${e.color}|I:${e.special.iceCount}|C:${e.special.count}|L:${e.special.layerColors?.join(',')||''}`;
        parts.push(`E(${e.position.x},${e.position.y})<${specialKey}>`);
    });
    // include exact ribbon positions so cache distinguishes ribbon states
    if (state.ribbonInfo && state.ribbonInfo.listPositions.length > 0) {
        parts.push(`R:[${state.ribbonInfo.listPositions.map(p => `${p.x},${p.y}`).join(';')}]`);
    }
    return parts.join('||');
}

// --- applyMove & friends (preserve original semantics) ---

const applyMove = (state: GameState, move: Move): GameState => {
    const newState = structuredClone(state);
    if (move.type === 'solve') {
        const petToMove = newState.pets.find(p => p.id === move.petId);
        const exit = newState.exits.find(e => e.position.x === move.exit.position.x && e.position.y === move.exit.position.y);
        
        if (petToMove && exit) {
            const positionsBeforeMove = [...petToMove.positions];
            const [startPos, endPos] = move.path;

            // move the pet onto the exit tile (head or tail)
            petToMove.positions = (move.end === 'head')
                ? [endPos, ...positionsBeforeMove.slice(0, -1)]
                : [...positionsBeforeMove.slice(1), endPos];
            petToMove.headPos = petToMove.positions[0];

            // Delegate to applyPetSolutionEffects which also handles Ribbon, layer morphing, etc.
            // But we must preserve the contract: applyPetSolutionEffects expects the state, pet object, exit and original positions.
            // It returns an object with .nextLevel — keep using it.
            return applyPetSolutionEffects(newState, petToMove, exit, move.end, positionsBeforeMove).nextLevel;
        }
    } else if (move.type === 'reposition') {
        const pet = newState.pets.find(p => p.id === move.petId);
        if (pet) {
            const [_, nextPos] = move.path;
            pet.positions = (move.end === 'head')
                ? [nextPos, ...pet.positions.slice(0, -1)]
                : [...pet.positions.slice(1), nextPos];
            pet.headPos = pet.positions[0];
        }
    } else if (move.type === 'move_box') {
        const box = newState.movableBoxes.find(b => b.id === move.boxId);
        if (box) {
            const [startPos, nextPos] = move.path;
            const delta = { x: nextPos.x - startPos.x, y: nextPos.y - startPos.y };
            box.listPositions = box.listPositions.map(p => ({ x: p.x + delta.x, y: p.y + delta.y }));
        }
    }
    return newState;
};

const applyMoveSequence = (state: GameState, moves: Move[]): GameState => {
    return moves.reduce((accState, move) => applyMove(accState, move), state);
};

const formatSolution = (initialLevel: Level, allMoves: Move[]): string[] => {
    if (allMoves.length === 0) return [];
    
    const formatted: string[] = [];
    let currentLevel = structuredClone(initialLevel);
    let petPathBuffer: { petId: number; end: 'head' | 'tail'; path: Coordinates[] } | null = null;

    const flushPetPath = () => {
        if (petPathBuffer && petPathBuffer.path.length > 1) {
            formatted.push(`PET:${petPathBuffer.petId}:${petPathBuffer.end}:${petPathBuffer.path.map(p => `${p.x},${p.y}`).join('>')}`);
        }
        petPathBuffer = null;
    };

    for (const move of allMoves) {
        if (move.type === 'move_box') {
            flushPetPath();
            const box = currentLevel.movableBoxes.find(b => b.id === move.boxId);
            if (box) {
                const initialPosStr = box.listPositions.map(p => `${p.x},${p.y}`).join(';');
                const [refTileBefore, refTileAfter] = move.path;
                const delta = { x: refTileAfter.x - refTileBefore.x, y: refTileAfter.y - refTileBefore.y };
                const finalPosStr = box.listPositions.map(p => `${p.x + delta.x},${p.y + delta.y}`).join(';');
                formatted.push(`BOX:${move.boxId}:${initialPosStr}>${finalPosStr}`);
            }
        } else { 
            const [startPos, endPos] = move.path;
            if (petPathBuffer && (petPathBuffer.petId !== move.petId || petPathBuffer.end !== move.end)) {
                flushPetPath();
            }

            if (!petPathBuffer) {
                petPathBuffer = { petId: move.petId, end: move.end, path: [startPos, endPos] };
            } else {
                petPathBuffer.path.push(endPos);
            }
        }
        currentLevel = applyMove(currentLevel, move);
    }
    flushPetPath();
    return formatted;
};

// --- PATHFINDING & MOVE GENERATION (preserve ribbon as obstacle) ---

const findClearPath = (start: Coordinates, end: Coordinates, state: GameState, petId: number, movingEnd: 'head' | 'tail'): Coordinates[] | null => {
    const { width, height } = state.gridData;
    const pet = state.pets.find(p => p.id === petId)!;
    
    const obstacles = new Set<string>();
    state.gridData.strGrid.forEach((rowStr, r) => rowStr.split(',').forEach((cell, c) => { if (cell === '0') obstacles.add(`${c},${height - 1 - r}`); }));
    state.pets.forEach(p => { if (p.id !== petId) p.positions.forEach(pos => obstacles.add(`${pos.x},${pos.y}`)); });
    state.stoneWalls.forEach(s => obstacles.add(`${s.position.x},${s.position.y}`));
    state.crateInfos.forEach(c => c.listPositions.forEach(p => obstacles.add(`${p.x},${p.y}`)));
    state.movableBoxes.forEach(b => b.listPositions.forEach(p => obstacles.add(`${p.x},${p.y}`)));
    state.colorWalls.forEach(w => obstacles.add(`${w.position.x},${w.position.y}`));
    state.obstacleInfos.forEach(o => o.listPositions.forEach(p => obstacles.add(`${p.x},${p.y}`)));
    state.exits.forEach(e => { if (e.position.x !== end.x || e.position.y !== end.y) obstacles.add(`${e.position.x},${e.position.y}`); });
    
    // Ribbon blocks path unless traversed via its logic (we consider it obstacle here)
    if (state.ribbonInfo && state.ribbonInfo.listPositions.length > 0) {
        const listPositions = state.ribbonInfo.listPositions;
        if (listPositions.length > 1) {
            const lineCells = getLineCells(listPositions[0], listPositions[1]);
            lineCells.forEach(cell => obstacles.add(`${cell.x},${cell.y}`));
        } else if (listPositions.length === 1) {
            obstacles.add(`${listPositions[0].x},${listPositions[0].y}`);
        }
    }

    const coloredPathMap = new Map<string, number>();
    state.coloredPaths.forEach(p => coloredPathMap.set(`${p.position.x},${p.position.y}`, p.color));

    const queue: Coordinates[][] = [[start]];
    const visited = new Set<string>([`${start.x},${start.y}`]);
    let head = 0;

    while (head < queue.length) {
        const path = queue[head++];
        const currentPos = path[path.length - 1];

        if (currentPos.x === end.x && currentPos.y === end.y) {
            return path.slice(1);
        }
        
        // simulate how the pet's body would be if it followed this partial path by one step
        let tempPetPositions = [...pet.positions];
        if (path.length > 1) {
            tempPetPositions = movingEnd === 'head' ? [path[1], ...pet.positions.slice(0, -1)] : [...pet.positions.slice(1), path[1]];
        }
        const currentBody = new Set<string>(tempPetPositions.map(p => `${p.x},${p.y}`));
        currentBody.delete(`${currentPos.x},${currentPos.y}`);

        for (const dir of [{ x: 0, y: 1 }, { x: 0, y: -1 }, { x: 1, y: 0 }, { x: -1, y: 0 }]) {
            const nextPos = { x: currentPos.x + dir.x, y: currentPos.y + dir.y };
            const key = `${nextPos.x},${nextPos.y}`;

            if (nextPos.x >= 0 && nextPos.x < width && nextPos.y >= 0 && nextPos.y < height && !visited.has(key) && !obstacles.has(key) && !currentBody.has(key)) {
                const pathColor = coloredPathMap.get(key);
                if (pathColor !== undefined && pathColor !== pet.color) continue;
                
                visited.add(key);
                queue.push([...path, nextPos]);
            }
        }
    }
    return null;
};

const getSetupMoves = (state: GameState): Move[] => {
    const moves: Move[] = [];
    const { width, height } = state.gridData;
    const objectMap = new Map<string, any>();
    state.gridData.strGrid.forEach((rowStr, r) => rowStr.split(',').forEach((cell, c) => { if (cell === '0') objectMap.set(`${c},${height - 1 - r}`, { type: 'wall' }); }));
    state.coloredPaths.forEach(cp => objectMap.set(`${cp.position.x},${cp.position.y}`, { ...cp, type: 'colored_path' }));
    state.exits.forEach(e => objectMap.set(`${e.position.x},${e.position.y}`, { ...e, type: 'exit' }));
    state.stoneWalls.forEach(o => objectMap.set(`${o.position.x},${o.position.y}`, { ...o, type: 'stone' }));
    state.crateInfos.forEach(c => c.listPositions.forEach(p => objectMap.set(`${p.x},${p.y}`, { ...c, type: 'crate' })));
    state.colorWalls.forEach(w => objectMap.set(`${w.position.x},${w.position.y}`, { ...w, type: 'color_wall' }));
    state.obstacleInfos.forEach(o => o.listPositions.forEach(p => objectMap.set(`${p.x},${p.y}`, { ...o, type: 'obstacle' })));
    state.movableBoxes.forEach(b => b.listPositions.forEach(pos => objectMap.set(`${pos.x},${pos.y}`, { ...b, type: 'movable_box' })));
    state.pets.forEach(p => p.positions.forEach(pos => objectMap.set(`${pos.x},${pos.y}`, { ...p, type: 'pet' })));

    // mark ribbon tiles as special tiles in objectMap
    if (state.ribbonInfo && state.ribbonInfo.listPositions.length > 0) {
        const { listPositions } = state.ribbonInfo;
        if (listPositions.length > 1) {
            const lineCells = getLineCells(listPositions[0], listPositions[1]);
            lineCells.forEach(cell => objectMap.set(`${cell.x},${cell.y}`, { type: 'ribbon' }));
        } else if (listPositions.length === 1) {
            objectMap.set(`${listPositions[0].x},${listPositions[0].y}`, { type: 'ribbon' });
        }
    }

    for (const pet of state.pets) {
        if (!isPetMovable(pet, state)) continue;
        const endsToConsider: ('head' | 'tail')[] = pet.special.isSingleDirection ? ['head'] : ['head', 'tail'];
        if (pet.positions.length <= 1) continue;

        for (const end of endsToConsider) {
            const currentEndPos = (end === 'head') ? pet.positions[0] : pet.positions[pet.positions.length - 1];
            
            // bodyWithoutEnds: conservative estimate — exclude a virtual sentinel for the vacated tile
            const tempPetPositions = end === 'head' ? [ {x:-1, y:-1}, ...pet.positions.slice(0, -1) ] : [ ...pet.positions.slice(1), {x:-1, y:-1} ];
            const bodyWithoutEnds = new Set(tempPetPositions.map(p => `${p.x},${p.y}`));

            for (const dir of [{ x: 0, y: 1 }, { x: 0, y: -1 }, { x: 1, y: 0 }, { x: -1, y: 0 }]) {
                const nextPos = { x: currentEndPos.x + dir.x, y: currentEndPos.y + dir.y };
                if (nextPos.x < 0 || nextPos.x >= width || nextPos.y < 0 || nextPos.y >= height) continue;
                if (bodyWithoutEnds.has(`${nextPos.x},${nextPos.y}`)) continue;

                const objectOnTile = objectMap.get(`${nextPos.x},${nextPos.y}`);
                
                if (!objectOnTile || (objectOnTile.type === 'colored_path' && objectOnTile.color === pet.color)) {
                    moves.push({ type: 'reposition', petId: pet.id, end, path: [currentEndPos, nextPos] });
                }
            }
        }
    }

    for (const box of state.movableBoxes) {
        // Deadlock quick-check: if a box is obviously deadlocked we skip generating moves for it.
        if (isBoxDeadlocked(state, box)) continue;

        for (const dir of [{ x: 0, y: 1 }, { x: 0, y: -1 }, { x: 1, y: 0 }, { x: -1, y: 0 }]) {
             const canMoveDirection = (box.direction === MovableBoxDirection.None) || (box.direction === MovableBoxDirection.Horizontal && dir.y === 0) || (box.direction === MovableBoxDirection.Vertical && dir.x === 0);
             if (!canMoveDirection) continue;
             const newBoxPositions = box.listPositions.map(p => ({ x: p.x + dir.x, y: p.y + dir.y }));
             const isClear = newBoxPositions.every(p => {
                 if (p.x < 0 || p.x >= width || p.y < 0 || p.y >= height) return false;
                 const objOnTile = objectMap.get(`${p.x},${p.y}`);
                 // allow self-overlap / moving box from its own tiles
                 return !objOnTile || (objOnTile.type === 'movable_box' && objOnTile.id === box.id);
             });
             if (isClear) {
                 moves.push({ type: 'move_box', boxId: box.id, path: [box.listPositions[0], newBoxPositions[0]] });
             }
        }
    }
    return moves;
};

// --- CORE SOLVER LOGIC (direct solve preserved) ---

const findBestDirectSolve = (state: GameState): Move[] | null => {
    let bestSolve: { petId: number; end: 'head' | 'tail'; exit: Exit; path: Coordinates[] } | null = null;

    for (const pet of state.pets) {
        if (!isPetMovable(pet, state)) continue;

        for (const exit of state.exits) {
            // match by current pet color (original logic)
            if (pet.color === exit.color && (exit.special.iceCount ?? 0) === 0) {
                const endsToConsider: ('head' | 'tail')[] = pet.special.isSingleDirection ? ['head'] : ['head', 'tail'];
                if (pet.positions.length <= 1 && endsToConsider.includes('tail')) {
                    endsToConsider.splice(endsToConsider.indexOf('tail'), 1);
                }

                for (const end of endsToConsider) {
                    const startPos = (end === 'head') ? pet.positions[0] : pet.positions[pet.positions.length - 1];
                    const path = findClearPath(startPos, exit.position, state, pet.id, end);

                    if (path && (!bestSolve || path.length < bestSolve.path.length)) {
                        bestSolve = { petId: pet.id, end, exit, path };
                    }
                }
            }
        }
    }

    if (!bestSolve) return null;
    
    const sequence: Move[] = [];
    const pet = state.pets.find(p => p.id === bestSolve!.petId)!;
    const startPos = bestSolve.end === 'head' ? pet.positions[0] : pet.positions[pet.positions.length - 1];
    const pathWithStart = [startPos, ...bestSolve.path];

    for (let i = 0; i < pathWithStart.length - 1; i++) {
        const isLastMove = i === pathWithStart.length - 2;
        const move: Move = isLastMove 
            ? { type: 'solve', petId: bestSolve.petId, end: bestSolve.end, path: [pathWithStart[i], pathWithStart[i+1]], exit: bestSolve.exit }
            : { type: 'reposition', petId: bestSolve.petId, end: bestSolve.end, path: [pathWithStart[i], pathWithStart[i+1]] };
        sequence.push(move);
    }
    return sequence;
};

// --- A* search for setup sequence (replaces BFS) ---

let lastAstarNodes = 0;
let lastAstarDurationMs = 0;
let lastAstarCacheHits = 0;

type CacheEntry = { g: number; h: number };

class MinHeap<T> {
    items: T[] = [];
    compare: (a: T, b: T) => number;
    constructor(compare: (a: T, b: T) => number) { this.compare = compare; }
    size() { return this.items.length; }
    push(item: T) {
        this.items.push(item);
        this._siftUp(this.items.length - 1);
    }
    pop(): T | undefined {
        if (this.items.length === 0) return undefined;
        const top = this.items[0];
        const last = this.items.pop()!;
        if (this.items.length > 0) {
            this.items[0] = last;
            this._siftDown(0);
        }
        return top;
    }
    _siftUp(i: number) {
        while (i > 0) {
            const p = Math.floor((i - 1) / 2);
            if (this.compare(this.items[i], this.items[p]) < 0) {
                [this.items[i], this.items[p]] = [this.items[p], this.items[i]];
                i = p;
            } else break;
        }
    }
    _siftDown(i: number) {
        const n = this.items.length;
        while (true) {
            let smallest = i;
            const l = 2 * i + 1, r = 2 * i + 2;
            if (l < n && this.compare(this.items[l], this.items[smallest]) < 0) smallest = l;
            if (r < n && this.compare(this.items[r], this.items[smallest]) < 0) smallest = r;
            if (smallest === i) break;
            [this.items[i], this.items[smallest]] = [this.items[smallest], this.items[i]];
            i = smallest;
        }
    }
}

const findSetupSequence = (initialState: GameState): Move[] | null => {
    const startTs = Date.now();
    lastAstarNodes = 0;
    lastAstarCacheHits = 0;

    // open queue holds {state, path, g, h, f}
    type Node = { state: GameState; path: Move[]; g: number; h: number; f: number; key: string };
    const open = new MinHeap<Node>((a, b) => a.f - b.f);

    const startKey = stateToKey(initialState);
    const startH = stateHeuristicDistance(initialState);
    open.push({ state: initialState, path: [], g: 0, h: startH, f: startH, key: startKey });

    const cache = new Map<string, CacheEntry>();
    cache.set(startKey, { g: 0, h: startH });

    // global visited (keeps best g for each key)
    lastAstarNodes = 0;
    const MAX_NODES = 40000;

    while (open.size() > 0 && lastAstarNodes < MAX_NODES) {
        const node = open.pop()!;
        lastAstarNodes++;

        const { state, path, g } = node;

        // If direct solve achievable here => return setup moves (not the solve moves)
        const direct = findBestDirectSolve(state);
        if (direct) {
            lastAstarDurationMs = Date.now() - startTs;
            lastAstarCacheHits = cache.size;
            return path;
        }

        const setupMoves = getSetupMoves(state);
        const parentH = node.h;

        for (const move of setupMoves) {
            const nextState = applyMove(state, move);
            const newPath = [...path, move];
            const newG = g + 1;
            const key = stateToKey(nextState);
            const h = stateHeuristicDistance(nextState);
            const f = newG + h;

            // prune trivial oscillations quickly
            if (detectOscillation(newPath)) continue;

            // if box deadlocked after move, prune
            if (move.type === 'move_box') {
                const box = nextState.movableBoxes.find(b => b.id === move.boxId);
                if (box && isBoxDeadlocked(nextState, box)) continue;
            }

            const prev = cache.get(key);
            if (prev) {
                lastAstarCacheHits++;
                // if we've seen better or equal g + better or equal h, skip
                if (prev.g <= newG && prev.h <= h) continue;
            }

            // progress pruning: if heuristic worse than parent and we've expended several steps, skip
            if (parentH !== undefined && h > parentH && newG > 8) {
                continue;
            }

            cache.set(key, { g: newG, h });
            open.push({ state: nextState, path: newPath, g: newG, h, f, key });
        }
    }

    lastAstarDurationMs = Date.now() - startTs;
    lastAstarCacheHits = cache.size;
    return null;
};

// --- IDA* (iterative deepening A*) fallback for deep searches (returns setup moves)
// Returns null if not found within maxBound iterations
const idaStar = (initialState: GameState, maxBound: number = 500): { moves: Move[] | null; nodes: number; maxDepthReached: number; timeMs: number } => {
    const start = Date.now();
    let nodes = 0;
    let maxDepthReached = 0;

    const h0 = stateHeuristicDistance(initialState);
    let bound = h0;

    // helper: depth-limited search with f = g + h <= bound
    const seenBest = new Map<string, number>(); // key -> best g seen

    function dfs(state: GameState, g: number, path: Move[], boundLocal: number, parentH: number | null): { found: boolean; nextBound: number | null; result?: Move[] } {
        nodes++;
        maxDepthReached = Math.max(maxDepthReached, path.length);
        const key = stateToKey(state);
        const h = stateHeuristicDistance(state);
        const f = g + h;
        if (f > boundLocal) return { found: false, nextBound: f };

        // direct solve check
        if (findBestDirectSolve(state)) {
            return { found: true, nextBound: null, result: path.slice() };
        }

        // repeated state prune
        const prevG = seenBest.get(key);
        if (prevG !== undefined && prevG <= g) return { found: false, nextBound: null };
        seenBest.set(key, g);

        const moves = getSetupMoves(state);
        if (moves.length === 0) return { found: false, nextBound: null };

        // order moves by heuristic after move
        const scored = moves.map(mv => ({ mv, score: stateHeuristicDistance(applyMove(state, mv)) }))
                          .sort((a, b) => a.score - b.score);

        let minNextBound: number | null = null;
        for (const { mv, score } of scored) {
            // oscillation prune
            const newPath = [...path, mv];
            if (detectOscillation(newPath)) continue;

            // deadlock prune for boxes
            if (mv.type === 'move_box') {
                const ns = applyMove(state, mv);
                const box = ns.movableBoxes.find(b => b.id === mv.boxId);
                if (box && isBoxDeadlocked(ns, box)) continue;
            }

            // conservative progress pruning (if child heuristic worsens significantly)
            if (parentH !== null && score > parentH && g + 1 > 8) continue;

            const ns = applyMove(state, mv);
            const res = dfs(ns, g + 1, newPath, boundLocal, score);
            if (res.found) return { found: true, nextBound: null, result: res.result };
            if (res.nextBound !== null) {
                if (minNextBound === null || res.nextBound < minNextBound) minNextBound = res.nextBound;
            }
        }
        return { found: false, nextBound: minNextBound };
    }

    while (bound <= maxBound) {
        seenBest.clear();
        const r = dfs(initialState, 0, [], bound, stateHeuristicDistance(initialState));
        if (r.found) {
            const timeMs = Date.now() - start;
            return { moves: r.result ?? [], nodes, maxDepthReached, timeMs };
        }
        if (r.nextBound === null) break;
        bound = Math.ceil(r.nextBound);
        // small safety: if bound grows too large, break
        if (bound > maxBound) break;
    }

    return { moves: null, nodes, maxDepthReached, timeMs: Date.now() - start };
};

// --- MAIN SOLVER (keeps step-by-step solution recording) ---

export const solveLevel = async (level: Level, hint: string[] | null): Promise<string[] | null> => {
    if (hint && hint.length > 0) {
        console.log("Using provided hint as solution.");
        return hint;
    }

    let currentState = structuredClone(level);
    const allMoves: Move[] = [];
    const MAX_STAGES = 100;

    for (let stage = 1; stage <= MAX_STAGES; stage++) {
        if (currentState.pets.length === 0) {
            return formatSolution(level, allMoves);
        }

        // yield to event loop (UI friendly)
        await new Promise(resolve => setTimeout(resolve, 0));

        // 1) Direct solves (always apply immediately)
        const directSolveSequence = findBestDirectSolve(currentState);
        if (directSolveSequence) {
            console.log(`Stage ${stage}: Direct solve found (${directSolveSequence.length} moves).`);
            allMoves.push(...directSolveSequence);
            currentState = applyMoveSequence(currentState, directSolveSequence);
            continue;
        }

        // 2) A* setup search (replaces BFS) with heuristic and pruning
        const astarStart = Date.now();
        const setupSequence = findSetupSequence(currentState);
        const astarDuration = Date.now() - astarStart;
        if (setupSequence && setupSequence.length > 0) {
            console.log(`Stage ${stage}: A* setup found ${setupSequence.length} moves (nodes ${lastAstarNodes}, time ${lastAstarDurationMs}ms, cacheSize ${lastAstarCacheHits}).`);
            allMoves.push(...setupSequence);
            currentState = applyMoveSequence(currentState, setupSequence);
            continue;
        }

        // 3) IDA* fallback (deeper)
        console.warn(`Stage ${stage}: A* failed — attempting IDA* fallback...`);
        const idaStart = Date.now();
        const idaResult = idaStar(currentState, 800);
        const idaDuration = Date.now() - idaStart;
        console.log(`Stage ${stage}: IDA* nodes ${idaResult.nodes}, maxDepth ${idaResult.maxDepthReached}, time ${idaResult.timeMs}ms.`);

        if (idaResult.moves !== null) {
            if (idaResult.moves.length > 0) {
                console.log(`Stage ${stage}: IDA* produced ${idaResult.moves.length} setup moves.`);
                allMoves.push(...idaResult.moves);
                currentState = applyMoveSequence(currentState, idaResult.moves);
                continue;
            } else {
                // empty array -> reached state with direct solve; re-loop to apply direct solve
                console.log(`Stage ${stage}: IDA* found state with direct solve (no setup moves needed). Re-evaluating direct solves.`);
                continue;
            }
        }

        console.error(`Stage ${stage}: Solver exhausted A* and IDA* — giving up.`);
        return null;
    }

    return currentState.pets.length === 0 ? formatSolution(level, allMoves) : null;
};
