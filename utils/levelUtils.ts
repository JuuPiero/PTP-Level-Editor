import type { Level, Coordinates, SelectedObject, Pet, Exit, CrateInfo, ColorWall, TreeRoot, GridData, MovableBox } from '../types/level';
import { LevelTheme, KeyLockColor } from '../types/level';
import { Color } from '../types/colors';

// A simple Min-Heap Priority Queue for A*
type AStarNode = { pos: Coordinates; g: number; f: number; body: Coordinates[]; parent: AStarNode | null };
class PriorityQueue {
    private heap: AStarNode[] = [];

    enqueue(item: AStarNode) {
        this.heap.push(item);
        this.bubbleUp(this.heap.length - 1);
    }

    dequeue(): AStarNode | undefined {
        if (this.isEmpty()) return undefined;
        this.swap(0, this.heap.length - 1);
        const item = this.heap.pop();
        if (!this.isEmpty()) {
            this.sinkDown(0);
        }
        return item;
    }

    isEmpty(): boolean {
        return this.heap.length === 0;
    }

    private bubbleUp(index: number) {
        let currentIdx = index;
        while (currentIdx > 0) {
            const parentIdx = Math.floor((currentIdx - 1) / 2);
            if (this.heap[currentIdx].f < this.heap[parentIdx].f) {
                this.swap(currentIdx, parentIdx);
                currentIdx = parentIdx;
            } else {
                break;
            }
        }
    }

    private sinkDown(index: number) {
        let currentIdx = index;
        const lastIdx = this.heap.length - 1;

        while (true) {
            let smallestChildIdx = currentIdx;
            const leftChildIdx = 2 * currentIdx + 1;
            const rightChildIdx = 2 * currentIdx + 2;

            if (leftChildIdx <= lastIdx && this.heap[leftChildIdx].f < this.heap[smallestChildIdx].f) {
                smallestChildIdx = leftChildIdx;
            }
            if (rightChildIdx <= lastIdx && this.heap[rightChildIdx].f < this.heap[smallestChildIdx].f) {
                smallestChildIdx = rightChildIdx;
            }

            if (smallestChildIdx !== currentIdx) {
                this.swap(currentIdx, smallestChildIdx);
                currentIdx = smallestChildIdx;
            } else {
                break;
            }
        }
    }
    
    private swap(i: number, j: number) {
        [this.heap[i], this.heap[j]] = [this.heap[j], this.heap[i]];
    }
}


export const createDefaultLevel = (width: number, height: number): Level => {
  return {
    level: 1,
    time: 120,
    isHardLevel: false,
    levelName: 'Level_1',
    levelDifficulty: 0,
    gridData: {
      width,
      height,
      strGrid: Array.from({ length: height }, () => Array(width).fill('1').join(',')),
    },
    pets: [],
    exits: [],
    solution: [],
    stoneWalls: [],
    coloredPaths: [],
    colorWalls: [],
    crateInfos: [],
    ribbonInfo: { listPositions: [] },
    movableBoxes: [],
    obstacleInfos: [],
    treeRoots: [],
    theme: LevelTheme.Classic,
  };
};

export const getTreeRootSegments = (root: TreeRoot): Coordinates[] => {
    const segments: Coordinates[] = [];
    for (let i = 0; i <= root.length; i++) {
        segments.push({
            x: root.position.x + i * root.direction.x,
            y: root.position.y + i * root.direction.y,
        });
    }
    return segments;
};


// Bresenham's line algorithm to find all cells on a line between two points.
export const getLineCells = (p1: Coordinates, p2: Coordinates): Coordinates[] => {
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

// FIX: Define addWallsToObstacles helper function to avoid code duplication and fix 'not defined' error.
const addWallsToObstacles = (obstacles: Set<string>, gridData: GridData) => {
    const { strGrid, height } = gridData;
    strGrid.forEach((rowStr, r) => {
        rowStr.split(',').forEach((cell, c) => {
            if (cell === '0') {
                obstacles.add(`${c},${height - 1 - r}`);
            }
        });
    });
};

interface ObstacleSetOptions {
    ignorePetId?: number;
    ignoreBoxId?: number;
    // A specific tile that should not be an obstacle (for pathfinding destination)
    destination?: Coordinates;
}

/**
 * Builds a set of all occupied/impassable coordinates for collision detection.
 * @param level The current level state.
 * @param options Options to ignore certain objects (e.g., the object being moved).
 * @returns A Set of strings in "x,y" format representing obstacle coordinates.
 */
const buildObstacleSet = (level: Level, options: ObstacleSetOptions = {}): Set<string> => {
    const obstacles = new Set<string>();
    const { gridData, pets, stoneWalls, colorWalls, crateInfos, movableBoxes, obstacleInfos, treeRoots, exits, ribbonInfo } = level;

    addWallsToObstacles(obstacles, gridData);

    pets.forEach(p => { 
        if (p.id !== options.ignorePetId) {
            p.positions.forEach(seg => obstacles.add(`${seg.x},${seg.y}`));
        }
    });

    stoneWalls.forEach(sw => obstacles.add(`${sw.position.x},${sw.position.y}`));
    colorWalls.forEach(cw => obstacles.add(`${cw.position.x},${cw.position.y}`));
    crateInfos.forEach(c => c.listPositions.forEach(pos => obstacles.add(`${pos.x},${pos.y}`)));
    
    movableBoxes.forEach(b => {
        if (b.id !== options.ignoreBoxId) {
            b.listPositions.forEach(pos => obstacles.add(`${pos.x},${pos.y}`));
        }
    });
    
    obstacleInfos.forEach(o => o.listPositions.forEach(pos => obstacles.add(`${pos.x},${pos.y}`)));
    treeRoots.forEach(r => getTreeRootSegments(r).forEach(pos => obstacles.add(`${pos.x},${pos.y}`)));

    exits.forEach(exit => {
        const isDestination = options.destination && exit.position.x === options.destination.x && exit.position.y === options.destination.y;
        if (!isDestination) {
             obstacles.add(`${exit.position.x},${exit.position.y}`);
        }
    });

    if (ribbonInfo?.listPositions.length > 0) {
        if (ribbonInfo.listPositions.length > 1) {
            // A ribbon is defined by its first two points, consistent with rendering and selection logic.
            getLineCells(ribbonInfo.listPositions[0], ribbonInfo.listPositions[1])
                .forEach(cell => obstacles.add(`${cell.x},${cell.y}`));
        } else {
            // If there's only one point, it's also an obstacle.
            const pos = ribbonInfo.listPositions[0];
            obstacles.add(`${pos.x},${pos.y}`);
        }
    }

    return obstacles;
}


interface GetObjectOptions {
    ignorePetId?: number;
    ignoreCrateId?: number;
    ignoreBoxId?: number;
    ignoreObstacleId?: number;
}

export const getObjectAtCoords = (coords: Coordinates, currentLevel: Level, ignore: GetObjectOptions = {}): SelectedObject | null => {
    // Precedence matters here. Movable objects should be checked before static obstacles.
    for (const pet of currentLevel.pets) {
        if (pet.id === ignore.ignorePetId) continue;
        if (pet.positions.some(pos => pos.x === coords.x && pos.y === coords.y)) return { type: 'pet', id: pet.id };
    }
    for (const obstacle of currentLevel.obstacleInfos) {
        if (obstacle.id === ignore.ignoreObstacleId) continue;
        if (obstacle.listPositions.some(pos => pos.x === coords.x && pos.y === coords.y)) return { type: 'obstacle', id: obstacle.id };
    }
    for (const box of currentLevel.movableBoxes) {
        if (box.id === ignore.ignoreBoxId) continue;
        if (box.listPositions.some(pos => pos.x === coords.x && pos.y === coords.y)) return { type: 'movable_box', id: box.id };
    }
    for (const crate of currentLevel.crateInfos) {
        if (crate.id === ignore.ignoreCrateId) continue;
        if (crate.listPositions.some(pos => pos.x === coords.x && pos.y === coords.y)) return { type: 'crate', id: crate.id };
    }
    for (const root of currentLevel.treeRoots) {
        const segments = getTreeRootSegments(root);
        if (segments.some(pos => pos.x === coords.x && pos.y === coords.y)) {
            return { type: 'tree_root', id: root.id };
        }
    }
    if (currentLevel.ribbonInfo && currentLevel.ribbonInfo.listPositions.length > 0) {
        const { listPositions } = currentLevel.ribbonInfo;
        if (listPositions.length > 1) {
            const p1 = listPositions[0];
            const p2 = listPositions[1];
            const lineCells = getLineCells(p1, p2);
            if (lineCells.some(cell => cell.x === coords.x && cell.y === coords.y)) {
                return { type: 'ribbon' };
            }
        } else { // 1 point
            if (listPositions[0].x === coords.x && listPositions[0].y === coords.y) {
                 return { type: 'ribbon' };
            }
        }
    }
    const exit = currentLevel.exits.find(e => e.position.x === coords.x && e.position.y === coords.y);
    if (exit) return { type: 'exit', pos: coords };

    const stone = currentLevel.stoneWalls.find(sw => sw.position.x === coords.x && sw.position.y === coords.y);
    if (stone) return { type: 'stone', pos: coords };
    
    const colorWall = currentLevel.colorWalls.find(cw => cw.position.x === coords.x && cw.position.y === coords.y);
    if (colorWall) return { type: 'color_wall', pos: coords };
    
    const coloredPath = currentLevel.coloredPaths.find(cp => cp.position.x === coords.x && cp.position.y === coords.y);
    if (coloredPath) return { type: 'colored_path', pos: coords };

    const { gridData } = currentLevel;
    const { height, strGrid } = gridData;
    const gridY = height - 1 - coords.y;

    if (strGrid && gridY >= 0 && gridY < strGrid.length) {
        const row = strGrid[gridY].split(',');
        if (coords.x >= 0 && coords.x < row.length && row[coords.x] === '0') {
            return { type: 'wall', pos: coords };
        }
    }

    return null;
};

const heuristic = (a: Coordinates, b: Coordinates): number => {
    return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
};

export const findPath = (start: Coordinates, end: Coordinates, currentLevel: Level, movingPetId?: number): Coordinates[] | null => {
    const movingPet = currentLevel.pets.find(p => p.id === movingPetId);
    if (!movingPet) return null;

    const movingEnd = (start.x === movingPet.headPos.x && start.y === movingPet.headPos.y) ? 'head' : 'tail';

    const { gridData, exits, coloredPaths } = currentLevel;
    const { width, height } = gridData;

    const staticObstacles = buildObstacleSet(currentLevel, { 
        ignorePetId: movingPetId,
        destination: end 
    });
    
    const coloredPathMap = new Map(coloredPaths.map(p => [`${p.position.x},${p.position.y}`, p.color]));
    
    if (staticObstacles.has(`${end.x},${end.y}`)) return null;
    const destPathColor = coloredPathMap.get(`${end.x},${end.y}`);
    if (destPathColor !== undefined && destPathColor !== movingPet.color) return null;
    const destinationExit = exits.find(e => e.position.x === end.x && e.position.y === end.y);
    if (destinationExit && (destinationExit.color !== movingPet.color || (destinationExit.special.iceCount ?? 0) > 0)) return null;

    const getStateKey = (body: Coordinates[]) => body.map(p => `${p.x},${p.y}`).join(',');
    
    const openSet = new PriorityQueue();
    const gScores = new Map<string, number>();

    const startBody = movingPet.positions;
    const startBodyKey = getStateKey(startBody);
    gScores.set(startBodyKey, 0);

    openSet.enqueue({ 
        pos: start, 
        g: 0, 
        f: heuristic(start, end), 
        body: startBody,
        parent: null 
    });

    while (!openSet.isEmpty()) {
        const currentNode = openSet.dequeue()!;

        const currentBodyKey = getStateKey(currentNode.body);
        if ((gScores.get(currentBodyKey) ?? Infinity) < currentNode.g) {
            continue;
        }

        if (currentNode.pos.x === end.x && currentNode.pos.y === end.y) {
            const path: Coordinates[] = [];
            let curr: AStarNode | null = currentNode;
            while (curr) {
                path.unshift(curr.pos);
                curr = curr.parent;
            }
            return path.slice(1);
        }
        
        const { pos, body } = currentNode;
        for (const [dx, dy] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) {
            const neighborPos = { x: pos.x + dx, y: pos.y + dy };
            const neighborKey = `${neighborPos.x},${neighborPos.y}`;

            if (neighborPos.x < 0 || neighborPos.x >= width || neighborPos.y < 0 || neighborPos.y >= height || staticObstacles.has(neighborKey)) {
                continue;
            }

            const pathColor = coloredPathMap.get(neighborKey);
            if (pathColor !== undefined && pathColor !== movingPet.color) {
                continue;
            }

            const nextBody = movingEnd === 'head' ? [neighborPos, ...body.slice(0, -1)] : [...body.slice(1), neighborPos];
            const bodyWithoutNewEnd = movingEnd === 'head' ? nextBody.slice(1) : nextBody.slice(0, -1);
            if (bodyWithoutNewEnd.some(p => p.x === neighborPos.x && p.y === neighborPos.y)) {
                continue;
            }

            const tentativeGScore = currentNode.g + 1;
            const nextBodyKey = getStateKey(nextBody);
            
            if ((gScores.get(nextBodyKey) ?? Infinity) <= tentativeGScore) {
                continue;
            }
            
            gScores.set(nextBodyKey, tentativeGScore);
            
            const newNode: AStarNode = {
                pos: neighborPos,
                g: tentativeGScore,
                f: tentativeGScore + heuristic(neighborPos, end),
                body: nextBody,
                parent: currentNode,
            };

            openSet.enqueue(newNode);
        }
    }

    return null; // No path found
};
  
export const canMoveBox = (boxId: number, newPositions: Coordinates[], currentLevel: Level): boolean => {
    const { width, height } = currentLevel.gridData;
  
    const obstacles = buildObstacleSet(currentLevel, {
        ignoreBoxId: boxId
    });
  
    for (const pos of newPositions) {
      if (pos.x < 0 || pos.x >= width || pos.y < 0 || pos.y >= height || obstacles.has(`${pos.x},${pos.y}`)) return false;
    }
  
    return true;
};

export const isPetBodyPositionValid = (
    newPositions: Coordinates[],
    pet: Pet,
    levelState: Level
): boolean => {
    const { gridData, coloredPaths, exits } = levelState;
    const { width, height } = gridData;

    const obstacles = buildObstacleSet(levelState, { ignorePetId: pet.id });
    const coloredPathMap = new Map(coloredPaths.map(p => [`${p.position.x},${p.position.y}`, p.color]));
    
    for (const pos of newPositions) {
        if (pos.x < 0 || pos.x >= width || pos.y < 0 || pos.y >= height) return false;

        const posKey = `${pos.x},${pos.y}`;

        if (obstacles.has(posKey)) {
            const exit = exits.find(e => e.position.x === pos.x && e.position.y === pos.y);
            const isLastSegment = pos === newPositions[0] || pos === newPositions[newPositions.length - 1];

            if (!isLastSegment || !exit || exit.color !== pet.color || (exit.special.iceCount ?? 0) > 0) {
                return false;
            }
        }
        
        const pathColor = coloredPathMap.get(posKey);
        if (pathColor !== undefined && pathColor !== pet.color) return false;
    }
    
    const bodySet = new Set<string>();
    for (const pos of newPositions) {
        const key = `${pos.x},${pos.y}`;
        if (bodySet.has(key)) return false;
        bodySet.add(key);
    }

    return true;
};

/**
 * Simulates a pet's movement along a path of coordinates.
 * @param startPositions The initial full body positions of the pet.
 * @param path The sequence of coordinates the pet's head or tail will occupy. The first coordinate should match the head/tail's start position.
 * @param end Which end of the pet is moving ('head' or 'tail').
 * @returns An array of position arrays, representing the pet's full body at each step of the path.
 */
export const simulatePetPath = (startPositions: Coordinates[], path: Coordinates[], end: 'head' | 'tail'): Coordinates[][] => {
    if (path.length < 2) {
        return [startPositions];
    }
    const history: Coordinates[][] = [startPositions];
    let currentPositions = [...startPositions];

    for (let i = 1; i < path.length; i++) {
        const nextSegment = path[i];
        let newPositions: Coordinates[];
        if (end === 'head') {
            newPositions = [nextSegment, ...currentPositions.slice(0, -1)];
        } else { // tail
            newPositions = [...currentPositions.slice(1), nextSegment];
        }
        history.push(newPositions);
        currentPositions = newPositions;
    }
    return history;
};

/**
 * Applies all game state changes that occur when a pet is solved.
 * This is a pure function that takes a level state and returns a new, updated state.
 * @param prevLevel The level state before the pet is solved.
 * @param petToSolve The pet object that is being solved. This object is from the `prevLevel` state.
 * @param solvedExit The exit object the pet entered.
 * @param solvedEnd The end of the pet ('head' or 'tail') that entered the exit.
 * @param previousPositions The pet's body positions from before its final move into the exit.
 * @returns A new Level object with all changes applied.
 */
export const applyPetSolutionEffects = (
    prevLevel: Level, 
    petToSolve: Pet, 
    solvedExit: Exit, 
    solvedEnd: 'head' | 'tail', 
    previousPositions: Coordinates[]
): { nextLevel: Level; removedWalls: ColorWall[] } => {
    const newLevel = structuredClone(prevLevel);
    const removedWalls: ColorWall[] = [];

    const petToSolveIndex = newLevel.pets.findIndex(p => p.id === petToSolve.id);
    if (petToSolveIndex === -1) return { nextLevel: prevLevel, removedWalls: [] };
    
    const originalSolvedPet = newLevel.pets[petToSolveIndex];
    const solvedExitIndex = newLevel.exits.findIndex(e => e.position.x === solvedExit.position.x && e.position.y === solvedExit.position.y);

    // --- GLOBAL EFFECTS OF SOLVING A PET ---
    // These effects trigger every time a pet reaches an exit, regardless of whether the pet or exit is consumed.
    // 1. Decrement ice counters
    newLevel.pets.forEach(p => { if (p.special.iceCount > 0) p.special.iceCount--; });
    newLevel.exits.forEach(e => { if (e.special.iceCount > 0) e.special.iceCount--; });

    // 2. Decrement crate counters and remove if they reach 0
    newLevel.crateInfos = newLevel.crateInfos.map(c => {
        if (c.requiredSnake > 0) {
            return { ...c, requiredSnake: c.requiredSnake - 1 };
        }
        return c;
    }).filter(c => c.requiredSnake !== 0);

    // 3. Decrement hidden counters
    newLevel.pets.forEach(p => { if (p.special.hiddenCount > 0) p.special.hiddenCount--; });

    // 4. Decrement stone counters for ALL walls and remove if count reaches 0
    newLevel.stoneWalls = newLevel.stoneWalls.map(s => {
        return { ...s, count: Math.max(0, s.count - 1) };
    }).filter(s => s.count > 0);

    // --- EFFECTS ON THE SPECIFIC PET AND EXIT ---

    // A. Handle Keys: If the solved pet had a key, check if it was the last one.
    const keyColorOfSolvedPet = originalSolvedPet.special.keyLock?.keyColor;
    if (keyColorOfSolvedPet !== undefined && keyColorOfSolvedPet !== KeyLockColor.Unk) {
        const remainingKeys = newLevel.pets.filter(p => p.id !== originalSolvedPet.id && p.special.keyLock?.keyColor === keyColorOfSolvedPet).length;
        
        if (remainingKeys === 0) { // Last key of this color is gone
            newLevel.pets.forEach(p => {
                if (p.special.keyLock?.lockColor === keyColorOfSolvedPet) {
                    p.special.keyLock.lockColor = KeyLockColor.Unk;
                    if (p.special.keyLock.keyColor === KeyLockColor.Unk) {
                        p.special.keyLock = null;
                    }
                }
            });
        }
    }

    // B. Handle Scissor
    if (originalSolvedPet.special.hasScissor) {
        newLevel.ribbonInfo.listPositions = [];
    }

    // Determine if the pet will be "consumed" (removed or morphed) by this action.
    // A pet with count 0 is treated as having 1 hit point.
    const petWillBeConsumed = (originalSolvedPet.special.count ?? 0) <= 1;
    
    // C. Handle Pet Consumption (based on Hit Count)
    const petHitCount = originalSolvedPet.special.count ?? 0;
    let petIsConsumed = true; // Assume pet will be consumed (morphed or removed)

    if (petHitCount > 0) {
        const petToUpdate = newLevel.pets[petToSolveIndex];
        petToUpdate.special.count = petHitCount - 1;
        if (petToUpdate.special.count > 0) {
            // Pet survives this "hit", is not consumed.
            petIsConsumed = false;
            // It retracts to a single segment at the exit's position.
            const newPos = { ...solvedExit.position };
            petToUpdate.positions = [newPos];
            petToUpdate.headPos = newPos;
        }
    }
    
    // D. Handle Pet Layers & Removal (only if consumed)
    if (petIsConsumed) {
        const hasLayers = originalSolvedPet.special.layerColors && originalSolvedPet.special.layerColors.length > 0;
        if (hasLayers) {
            // The pet has layers, so it "morphs" instead of disappearing.
            const petToUpdate = newLevel.pets[petToSolveIndex];
            
            // Update color and remaining layers
            petToUpdate.color = originalSolvedPet.special.layerColors![0];
            const remainingLayers = originalSolvedPet.special.layerColors!.slice(1);

            // Reset all special properties for the new layer
            petToUpdate.special = {
                layerColors: remainingLayers.length > 0 ? remainingLayers : null,
                rawLayerColors: undefined,
                iceCount: 0,
                hiddenCount: 0,
                keyLock: null,
                hasScissor: false,
                isSingleDirection: false,
                count: 0, // Reset count for the new layer
                timeExplode: 0,
            };

            // The pet reverts to its position from before it entered the exit.
            petToUpdate.positions = previousPositions;
            petToUpdate.headPos = previousPositions[0];
        } else {
            // No layers left, remove the pet entirely.
            newLevel.pets.splice(petToSolveIndex, 1);
        }
    }
    
    // E. Handle Exit Consumption (based on Hit Count)
    if (solvedExitIndex !== -1) {
        const currentExit = newLevel.exits[solvedExitIndex];
        // A count of 0 or undefined is treated as 1 use.
        const exitHitCount = currentExit.special.count > 0 ? currentExit.special.count : 1;
        
        if (exitHitCount > 0) {
            currentExit.special.count = exitHitCount - 1;

            // Only consume the exit if its count reaches 0 and it is not permanent.
            if (currentExit.special.count === 0 && !currentExit.special.isPermanent) {
                const hasExitLayers = currentExit.special.layerColors && currentExit.special.layerColors.length > 0;

                if (hasExitLayers) {
                    // Morph exit into next layer
                    const nextColor = currentExit.special.layerColors![0];
                    const remainingLayers = currentExit.special.layerColors!.slice(1);
                    
                    currentExit.color = nextColor;
                    currentExit.special.layerColors = remainingLayers.length > 0 ? remainingLayers : null;
                    currentExit.special.rawLayerColors = undefined; // Raw value is now invalid
                    
                    // After morphing, reset its hit count to 1 for the new layer.
                    currentExit.special.count = 1;

                } else {
                    // Remove the exit
                    newLevel.exits.splice(solvedExitIndex, 1);
                }
            }
        }
    }

    // F. HANDLE COLOR WALL REMOVAL
    // This check must be performed on the state BEFORE any changes were made (`prevLevel`).
    // A wall is removed only if the action "consumes" the pet (removes it or morphs it)
    // AND this pet is the last one on the board that currently has or will have this color.
    if (petWillBeConsumed) {
        const solvingColor = petToSolve.color;

        const countPetsWithColor = (level: Level, color: Color): number => {
            return level.pets.reduce((count, pet) => {
                const petColors = [pet.color, ...(pet.special.layerColors || [])];
                if (petColors.includes(color)) {
                    return count + 1;
                }
                return count;
            }, 0);
        };

        const totalPetsWithSolvingColor = countPetsWithColor(prevLevel, solvingColor);

        if (totalPetsWithSolvingColor === 1) {
            // This is the last pet that can be this color. Find and mark walls for removal.
            const wallsToRemove = prevLevel.colorWalls.filter(wall => wall.color === solvingColor);
            if (wallsToRemove.length > 0) {
                removedWalls.push(...wallsToRemove);
                
                // Update the new level state by filtering out the removed walls.
                const wallPositionsToRemove = new Set(wallsToRemove.map(w => `${w.position.x},${w.position.y}`));
                newLevel.colorWalls = newLevel.colorWalls.filter(wall => !wallPositionsToRemove.has(`${wall.position.x},${wall.position.y}`));
            }
        }
    }
    
    // G. HANDLE TREE ROOT SHRINKING (global)
    newLevel.treeRoots = newLevel.treeRoots.map(root => {
        return { ...root, length: root.length - 1 };
    }).filter(root => root.length > 0);

    return { nextLevel: newLevel, removedWalls };
};
