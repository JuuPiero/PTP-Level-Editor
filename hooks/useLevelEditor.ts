
import React, { useState, useRef, useCallback, useEffect } from 'react';
import { MovableBoxDirection, KeyLockColor } from '../types/level';
import type { Level, Coordinates, SelectedObject, EditorTool, ColorWall, DrawingState, CrateInfo, MovableBox, Pet, ObstacleInfo, TreeRoot, PetSpecialInfo } from '../types/level';
import { Color } from '../types/colors';
import { createDefaultLevel, getObjectAtCoords, isPetBodyPositionValid, applyPetSolutionEffects, getLineCells, getTreeRootSegments, simulatePetPath, findPath, canMoveBox } from '../utils/levelUtils';
import { parseLevelFile, generateUnityAssetContent, triggerDownload } from '../utils/fileHandlers';
import { solveLevel } from '../utils/solver';

export interface EditDragState {
    object: SelectedObject;
    startCoords: Coordinates;
    startMouse: { x: number; y: number };
    currentPositions: Coordinates[];
    isValidDrop: boolean;
}

export interface PlayDragState {
    pet: Pet;
    end: 'head' | 'tail';
    dragPath: Coordinates[];
}

interface PlayBoxDragState {
    box: MovableBox;
    startCoords: Coordinates;
    initialBoxPositions: Coordinates[];
}

const isPetMovable = (pet: Pet, level: Level): boolean => {
    if ((pet.special.iceCount ?? 0) > 0) return false;
    if (pet.special.keyLock?.lockColor !== KeyLockColor.Unk && pet.special.keyLock?.lockColor !== undefined) return false;
    
    const cratePositions = new Set<string>();
    level.crateInfos.forEach(crate => {
        if (crate.requiredSnake > 0) {
            crate.listPositions.forEach(pos => cratePositions.add(`${pos.x},${pos.y}`));
        }
    });

    return !pet.positions.some(pos => cratePositions.has(`${pos.x},${pos.y}`));
};

export const useLevelEditor = () => {
    // --- state ---
    const [level, setLevel] = useState<Level>(() => createDefaultLevel(12, 18));
    const levelRef = useRef<Level>(level); // keep a live ref to the real level to avoid cloning during drag
    useEffect(() => { levelRef.current = level; }, [level]);

    const [editStateBeforePlay, setEditStateBeforePlay] = useState<Level | null>(null);

    const [mode, setMode] = useState<'edit' | 'play'>('edit');
    const [selectedTool, setSelectedTool] = useState<EditorTool>('pet');
    const [selectedColor, setSelectedColor] = useState<Color>(Color.LightGreen);
    const [selectedObject, setSelectedObject] = useState<SelectedObject | null>(null);
    const [drawingState, setDrawingState] = useState<DrawingState>({ type: 'pet', id: null });

    const [isDragging, setIsDragging] = useState(false);
    const [editDragState, setEditDragState] = useState<EditDragState | null>(null);
    const editDragStateRef = useRef<EditDragState | null>(null);
    useEffect(() => { editDragStateRef.current = editDragState; }, [editDragState]);

    const [playDragState, setPlayDragState] = useState<PlayDragState | null>(null);
    const [playBoxDragState, setPlayBoxDragState] = useState<PlayBoxDragState | null>(null);
    const lastDragCoords = useRef<Coordinates | null>(null);
    const [draggedVisuals, setDraggedVisuals] = useState<{ type: SelectedObject['type']; id: any; offset: { x: number; y: number } } | null>(null);
    
    const [levelSolved, setLevelSolved] = useState(false);
    const [isRecording, setIsRecording] = useState(false);
    const [hasRecordedInSession, setHasRecordedInSession] = useState(false);
    const recordedSolution = useRef<string[]>([]);
    
    const [isSolving, setIsSolving] = useState(false);
    const [guideSolver, setGuideSolver] = useState(true);

    const [animatedLevel, setAnimatedLevel] = useState<Level | null>(null);
    const animatedLevelRef = useRef<Level | null>(null);
    useEffect(() => { animatedLevelRef.current = animatedLevel; }, [animatedLevel]);

    const [isSolutionPlaying, setIsSolutionPlaying] = useState(false);
    const solutionPlayerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const [solutionPlaybackIndex, setSolutionPlaybackIndex] = useState(-1);
    const [isAnimating, setIsAnimating] = useState(false);
    const [disappearingWalls, setDisappearingWalls] = useState<ColorWall[]>([]);
    const [pathVisualization, setPathVisualization] = useState<Coordinates[][] | null>(null);


    const nextId = useRef({ pet: 1, crate: 1, movableBox: 1, obstacle: 1, treeRoot: 1 });
    const fileInputRef = useRef<HTMLInputElement>(null);
    const animationFrameRef = useRef<number | null>(null);
    const pendingMoveFrame = useRef<number | null>(null);

    // keep a ref of last mouse position to throttle movement calculations
    const lastMouseClient = useRef<{ x: number; y: number } | null>(null);

    // --- utility: centralized updater (keeps ref in sync) ---
    const updateLevel = useCallback((updater: (draft: Level) => void | Level) => {
        setLevel(currentLevel => {
            const newLevel = structuredClone(currentLevel);
            const result = updater(newLevel);
            const ret = result || newLevel;
            levelRef.current = ret;
            return ret;
        });
    }, []);

    // Effect to update selectedColor when an object is selected
    useEffect(() => {
        if (selectedObject) {
            const currentLevel = levelRef.current;
            let objectColor: Color | undefined;
            switch (selectedObject.type) {
                case 'pet': {
                    const pet = currentLevel.pets.find(p => p.id === selectedObject.id);
                    if (pet) objectColor = pet.color;
                    break;
                }
                case 'exit': {
                    const exit = currentLevel.exits.find(e => e.position.x === selectedObject.pos.x && e.position.y === selectedObject.pos.y);
                    if (exit) objectColor = exit.color;
                    break;
                }
                case 'colored_path': {
                    const path = currentLevel.coloredPaths.find(p => p.position.x === selectedObject.pos.x && p.position.y === selectedObject.pos.y);
                    if (path) objectColor = path.color;
                    break;
                }
                case 'color_wall': {
                    const wall = currentLevel.colorWalls.find(w => w.position.x === selectedObject.pos.x && w.position.y === selectedObject.pos.y);
                    if (wall) objectColor = wall.color;
                    break;
                }
            }
            if (objectColor !== undefined) {
                setSelectedColor(objectColor);
            }
        }
    }, [selectedObject]);

    // Effect for calculating path visualization
    useEffect(() => {
        if (mode !== 'edit') {
            setPathVisualization(null);
            return;
        }

        let petToPathfind: Pet | null = null;
        let startPositions: Coordinates[] | null = null;

        // FIX: Replaced optional chaining with an explicit check to ensure proper type narrowing for TypeScript.
        if (editDragState && editDragState.object.type === 'pet') {
            petToPathfind = levelRef.current.pets.find(p => p.id === editDragState.object.id) ?? null;
            if (petToPathfind && editDragState.isValidDrop) {
                startPositions = editDragState.currentPositions;
            }
        } else if (selectedObject && selectedObject.type === 'pet' && !isDragging) {
            petToPathfind = levelRef.current.pets.find(p => p.id === selectedObject.id) ?? null;
            if (petToPathfind) {
                startPositions = petToPathfind.positions;
            }
        }

        if (!petToPathfind || !startPositions) {
            setPathVisualization(null);
            return;
        }

        const finalPetState = { ...petToPathfind, positions: startPositions, headPos: startPositions[0] };

        const tempLevelForPathfinding = structuredClone(levelRef.current);
        const petInTempLevelIndex = tempLevelForPathfinding.pets.findIndex(p => p.id === finalPetState.id);
        if (petInTempLevelIndex === -1) {
            setPathVisualization(null);
            return;
        }
        tempLevelForPathfinding.pets[petInTempLevelIndex] = finalPetState;

        const matchingExits = tempLevelForPathfinding.exits.filter(e => e.color === finalPetState.color && (e.special.iceCount ?? 0) === 0);
        
        if (matchingExits.length === 0) {
            setPathVisualization(null);
            return;
        }

        const calculatedPaths: Coordinates[][] = [];
        
        for (const exit of matchingExits) {
            let endsToConsider: ('head' | 'tail')[] = ['head'];
            if (!finalPetState.special.isSingleDirection && finalPetState.positions.length > 1) {
                endsToConsider.push('tail');
            }
            
            for (const end of endsToConsider) {
                 const startPos = (end === 'head') ? finalPetState.positions[0] : finalPetState.positions[finalPetState.positions.length - 1];
                 const path = findPath(startPos, exit.position, tempLevelForPathfinding, finalPetState.id);
                 if (path) {
                     calculatedPaths.push([startPos, ...path]);
                 }
            }
        }

        setPathVisualization(calculatedPaths.length > 0 ? calculatedPaths : null);

    }, [selectedObject, editDragState, level, mode, isDragging]);

    // helper: get positions of an object from the current level (uses levelRef)
    const getPositionsForObject = useCallback((obj: SelectedObject): Coordinates[] => {
        const lvl = levelRef.current;
        if (!lvl) return [];
        switch (obj.type) {
            case 'pet': {
                const p = lvl.pets.find(x => x.id === obj.id);
                return p ? [...p.positions] : [];
            }
            case 'crate': {
                const c = lvl.crateInfos.find(x => x.id === obj.id);
                return c ? [...c.listPositions] : [];
            }
            case 'movable_box': {
                const b = lvl.movableBoxes.find(x => x.id === obj.id);
                return b ? [...b.listPositions] : [];
            }
            case 'obstacle': {
                const o = lvl.obstacleInfos.find(x => x.id === obj.id);
                return o ? [...o.listPositions] : [];
            }
            case 'tree_root': {
                const r = lvl.treeRoots.find(x => x.id === obj.id);
                return r ? getTreeRootSegments(r) : [];
            }
            case 'ribbon': return lvl.ribbonInfo.listPositions ? [...lvl.ribbonInfo.listPositions] : [];
            case 'exit': case 'stone': case 'colored_path': case 'color_wall': case 'wall':
                return [obj.pos];
            default: return [];
        }
    }, []);

    const handleToolChange = useCallback((tool: EditorTool) => {
        setSelectedTool(tool);
        setSelectedObject(null);
        setDrawingState({ type: 'pet', id: null });
    }, []);

    const handleColorChange = useCallback((color: Color) => {
        setSelectedColor(color);
        const currentSelectedObject = selectedObject;
        if (!currentSelectedObject) return;

        updateLevel(draft => {
            switch (currentSelectedObject.type) {
                case 'pet':
                    draft.pets.find(p => p.id === currentSelectedObject.id)!.color = color;
                    break;
                case 'exit':
                    draft.exits.find(e => e.position.x === currentSelectedObject.pos.x && e.position.y === currentSelectedObject.pos.y)!.color = color;
                    break;
                case 'colored_path':
                    draft.coloredPaths.find(p => p.position.x === currentSelectedObject.pos.x && p.position.y === currentSelectedObject.pos.y)!.color = color;
                    break;
                case 'color_wall':
                    draft.colorWalls.find(w => w.position.x === currentSelectedObject.pos.x && w.position.y === currentSelectedObject.pos.y)!.color = color;
                    break;
            }
        });
    }, [selectedObject, updateLevel]);

    const handleSizeChange = useCallback((newWidth: number, newHeight: number) => {
        const clampedWidth = Math.max(3, Math.min(30, newWidth));
        const clampedHeight = Math.max(3, Math.min(30, newHeight));

        updateLevel(draft => {
            const newStrGrid: string[] = Array.from({ length: clampedHeight }, (_, y) =>
                Array.from({ length: clampedWidth }, (__, x) => {
                    const oldRow = draft.gridData.strGrid[draft.gridData.height - 1 - y];
                    return oldRow?.split(',')[x] ?? '1';
                }).join(',')
            ).reverse();

            draft.gridData.width = clampedWidth;
            draft.gridData.height = clampedHeight;
            draft.gridData.strGrid = newStrGrid;

            const isInBounds = (pos: Coordinates) => pos.x < clampedWidth && pos.y < clampedHeight;
            draft.pets = draft.pets.filter(p => p.positions.every(isInBounds));
            draft.exits = draft.exits.filter(e => isInBounds(e.position));
            draft.stoneWalls = draft.stoneWalls.filter(s => isInBounds(s.position));
            draft.coloredPaths = draft.coloredPaths.filter(p => isInBounds(p.position));
            draft.colorWalls = draft.colorWalls.filter(w => isInBounds(w.position));
            draft.crateInfos = draft.crateInfos.filter(c => c.listPositions.every(isInBounds));
            draft.movableBoxes = draft.movableBoxes.filter(b => b.listPositions.every(isInBounds));
            draft.obstacleInfos = draft.obstacleInfos.filter(o => o.listPositions.every(isInBounds));
            draft.treeRoots = draft.treeRoots.filter(r => getTreeRootSegments(r).every(isInBounds));
            if (draft.ribbonInfo) {
                draft.ribbonInfo.listPositions = draft.ribbonInfo.listPositions.filter(isInBounds);
            }
        });
        setSelectedObject(null);
    }, [updateLevel]);

    const handleLoadClick = useCallback(() => fileInputRef.current?.click(), []);

    const handleFileLoad = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            try {
                const { loadedLevel, newNextId } = await parseLevelFile(file);
                setLevel(loadedLevel);
                nextId.current = newNextId;
                setSelectedObject(null);
                levelRef.current = loadedLevel;
            } catch (error) {
                console.error("Failed to load level:", error);
                alert("Failed to parse level file. Check console for details.");
            }
        }
        if (event.target) event.target.value = '';
    }, []);

    const handleSaveUnityAsset = useCallback(() => {
        const content = generateUnityAssetContent(level);
        triggerDownload(`${level.levelName}.asset`, content, 'application/x-yaml');
    }, [level]);

    const handleSolveLevel = useCallback(async () => {
        setIsSolving(true);
        const hint = (guideSolver && level.solution?.length > 0) ? level.solution : null;
        try {
            const solution = await solveLevel(level, hint);
            if (solution) {
                updateLevel(draft => { draft.solution = solution; });
                alert(`Solver found a solution with ${solution.length} steps!`);
            } else {
                alert("Solver could not find a solution.");
            }
        } catch (e) {
            console.error("Solver failed with an error:", e);
            alert("Solver encountered an error. Check console for details.");
        }
        setIsSolving(false);
    }, [level, guideSolver, updateLevel]);
    
    const handleStopSolution = useCallback(() => {
        setIsSolutionPlaying(false);
        setSolutionPlaybackIndex(-1);
        if (solutionPlayerRef.current) clearTimeout(solutionPlayerRef.current);
        setAnimatedLevel(null);
    }, []);

    const handlePlaySolution = useCallback(() => {
        if (!level.solution || level.solution.length === 0) return;
        setIsSolutionPlaying(true);
        setSolutionPlaybackIndex(-1);
        setAnimatedLevel(editStateBeforePlay ?? level);
    }, [editStateBeforePlay, level]);
    
    useEffect(() => {
        if (!isSolutionPlaying || !level.solution) return;

        const playNextStep = (index: number, currentLevelState: Level) => {
            if (index >= level.solution.length) {
                handleStopSolution();
                return;
            }
            setSolutionPlaybackIndex(index);
            const step = level.solution[index];
            const parts = step.split(':');
            const type = parts[0];
            let nextLevelState = currentLevelState;

            if (type === 'PET') {
                const petId = parseInt(parts[1], 10);
                const end = parts[2] as 'head' | 'tail';
                const pathCoords = parts[3].split('>').map(p => { const [x, y] = p.split(',').map(Number); return { x, y }; });
                const pet = currentLevelState.pets.find(p => p.id === petId);
                if (pet) {
                     const petPositionFrames = simulatePetPath(pet.positions, pathCoords, end);
                    const finalPetPositions = petPositionFrames[petPositionFrames.length - 1];
                    
                    nextLevelState = structuredClone(currentLevelState);
                    const petInNewState = nextLevelState.pets.find(p => p.id === petId)!;
                    petInNewState.positions = finalPetPositions;
                    petInNewState.headPos = finalPetPositions[0];

                    const exit = nextLevelState.exits.find(e => e.position.x === pathCoords[pathCoords.length - 1].x && e.position.y === pathCoords[pathCoords.length - 1].y);
                    if(exit) {
                        const res = applyPetSolutionEffects(nextLevelState, pet, exit, end, pet.positions);
                        nextLevelState = res.nextLevel;
                    }
                }
            } else if (type === 'BOX') {
                nextLevelState = structuredClone(currentLevelState);
                const boxId = parseInt(parts[1], 10);
                const posStrings = parts[2].split('>');
                const finalPos = posStrings[1].split(';').map(p => { const [x, y] = p.split(',').map(Number); return { x, y }; });
                const box = nextLevelState.movableBoxes.find(b => b.id === boxId);
                if (box) box.listPositions = finalPos;
            }

            setAnimatedLevel(nextLevelState);
            solutionPlayerRef.current = setTimeout(() => playNextStep(index + 1, nextLevelState), 300);
        };
        
        playNextStep(0, animatedLevel ?? level);

        return () => { if (solutionPlayerRef.current) clearTimeout(solutionPlayerRef.current); };
    }, [isSolutionPlaying, level.solution]);

    const handleSaveAndReturnToEdit = useCallback(() => {
        if (hasRecordedInSession) {
            updateLevel(draft => {
                draft.solution = recordedSolution.current;
            });
        }
        
        setMode('edit');
        setLevelSolved(false);
        setIsRecording(false);
        recordedSolution.current = [];
        setHasRecordedInSession(false);
        setEditStateBeforePlay(null);
        setAnimatedLevel(null);
    }, [hasRecordedInSession, updateLevel]);

    const handleResetToEditState = useCallback(() => {
        if (editStateBeforePlay) {
            setLevel(editStateBeforePlay);
            levelRef.current = editStateBeforePlay;
            setLevelSolved(false);
            setIsRecording(false);
            recordedSolution.current = [];
            setHasRecordedInSession(false);
        }
    }, [editStateBeforePlay]);

    const toggleMode = useCallback(() => {
        if (mode === 'edit') {
            setEditStateBeforePlay(structuredClone(level));
            setMode('play');
            setSelectedObject(null);
            handleStopSolution();
            setHasRecordedInSession(false);
        } else {
            handleSaveAndReturnToEdit();
        }
    }, [mode, level, handleSaveAndReturnToEdit, handleStopSolution]);

    const toggleRecording = useCallback(() => {
        if (isRecording) {
            setIsRecording(false);
            if(recordedSolution.current.length > 0){
                updateLevel(draft => { draft.solution = recordedSolution.current; });
                recordedSolution.current = [];
            }
        } else {
            setIsRecording(true);
            setHasRecordedInSession(true);
            recordedSolution.current = [];
        }
    }, [isRecording, updateLevel]);

    const finishDrawing = useCallback(() => setDrawingState({ type: 'pet', id: null }), []);

    // Smooth animated visuals for dragged object (lerp)
    const runDragAnimation = useCallback((timestamp: number) => {
        setDraggedVisuals(prev => {
            if (!prev || !editDragStateRef.current?.startMouse) return null;
            
            const currentMouse = lastMouseClient.current ?? editDragStateRef.current.startMouse;
            const targetOffset = { x: currentMouse.x - editDragStateRef.current.startMouse.x, y: currentMouse.y - editDragStateRef.current.startMouse.y };
            
            const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
            const newOffset = {
                x: lerp(prev.offset.x, targetOffset.x, 0.2),
                y: lerp(prev.offset.y, targetOffset.y, 0.2),
            };

            return { ...prev, offset: newOffset };
        });

        animationFrameRef.current = requestAnimationFrame(runDragAnimation);
    }, []);

    useEffect(() => {
        return () => {
            if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
            if (pendingMoveFrame.current) cancelAnimationFrame(pendingMoveFrame.current);
            if (solutionPlayerRef.current) clearTimeout(solutionPlayerRef.current);
        };
    }, []);

    // --- Editor mouse down: improved eraser & drag init (lighter) ---
    const handleEditorMouseDown = useCallback((coords: Coordinates, e: React.MouseEvent) => {
        if (drawingState.id !== null) {
            finishDrawing();
            return;
        }

        const objectAtCoords = getObjectAtCoords(coords, levelRef.current);
        setSelectedObject(objectAtCoords);

        // Eraser behavior: remove object except walls unless explicit behavior for wall (you had earlier logic to convert grid)
        if (selectedTool === 'eraser' && objectAtCoords) {
            const objectToDelete = objectAtCoords;
            updateLevel(draft => {
                let found = false;
                switch (objectToDelete.type) {
                    case 'pet': { const id = objectToDelete.id; draft.pets = draft.pets.filter(p => p.id !== id); found = true; break; }
                    case 'exit': { const pos = objectToDelete.pos; draft.exits = draft.exits.filter(o => o.position.x !== pos.x || o.position.y !== pos.y); found = true; break; }
                    case 'stone': { const pos = objectToDelete.pos; draft.stoneWalls = draft.stoneWalls.filter(o => o.position.x !== pos.x || o.position.y !== pos.y); found = true; break; }
                    case 'colored_path': { const pos = objectToDelete.pos; draft.coloredPaths = draft.coloredPaths.filter(o => o.position.x !== pos.x || o.position.y !== pos.y); found = true; break; }
                    case 'color_wall': { const pos = objectToDelete.pos; draft.colorWalls = draft.colorWalls.filter(o => o.position.x !== pos.x || o.position.y !== pos.y); found = true; break; }
                    case 'crate': { const id = objectToDelete.id; draft.crateInfos = draft.crateInfos.filter(o => o.id !== id); found = true; break; }
                    case 'movable_box': { const id = objectToDelete.id; draft.movableBoxes = draft.movableBoxes.filter(o => o.id !== id); found = true; break; }
                    case 'obstacle': { const id = objectToDelete.id; draft.obstacleInfos = draft.obstacleInfos.filter(o => o.id !== id); found = true; break; }
                    case 'tree_root': { const id = objectToDelete.id; draft.treeRoots = draft.treeRoots.filter(r => r.id !== id); found = true; break; }
                    case 'ribbon': draft.ribbonInfo.listPositions = []; found = true; break;
                    case 'wall': { 
                        // keep behavior: change the grid cell back to empty when erasing a wall
                        const pos = objectToDelete.pos;
                        const gridY = draft.gridData.height - 1 - pos.y;
                        const row = draft.gridData.strGrid[gridY].split(',');
                        row[pos.x] = '1';
                        draft.gridData.strGrid[gridY] = row.join(',');
                        found = true; 
                        break; 
                    }
                }
                if (found) {
                    setSelectedObject(null);
                }
            });
            return;
        }

        // If there's an object and it's not a wall, start drag mode.
        if (objectAtCoords && objectAtCoords.type !== 'wall') {
            setIsDragging(true);

            // compute initial positions cheaply from levelRef
            const currentPositions = getPositionsForObject(objectAtCoords);

            let id: any;
            switch (objectAtCoords.type) {
                case 'pet': id = objectAtCoords.id; break;
                case 'crate': id = objectAtCoords.id; break;
                case 'movable_box': id = objectAtCoords.id; break;
                case 'obstacle': id = objectAtCoords.id; break;
                case 'tree_root': id = objectAtCoords.id; break;
                case 'exit': case 'stone': case 'colored_path': case 'color_wall': id = objectAtCoords.pos; break;
                case 'ribbon': id = 'ribbon'; break;
            }

            const initialDragState: EditDragState = { object: objectAtCoords, startCoords: coords, startMouse: { x: e.clientX, y: e.clientY }, currentPositions: currentPositions, isValidDrop: false };
            setEditDragState(initialDragState);
            editDragStateRef.current = initialDragState;

            setDraggedVisuals({ type: objectAtCoords.type, id: id, offset: { x: 0, y: 0 } });
            lastMouseClient.current = { x: e.clientX, y: e.clientY };

            // start RAF for smooth visuals if not already started
            if (!animationFrameRef.current) {
                animationFrameRef.current = requestAnimationFrame(runDragAnimation);
            }
        } else if (!objectAtCoords) {
            // placing new object (drawing)
            updateLevel(draft => {
                let newId: number;
                switch(selectedTool) {
                    case 'pet': newId = nextId.current.pet++; draft.pets.push({ id: newId, editorName: String.fromCharCode(64 + newId), headPos: coords, positions: [coords], color: selectedColor, special: { layerColors: null, iceCount: 0, hiddenCount: 0, keyLock: null, hasScissor: false, isSingleDirection: false, count: 0, timeExplode: 0 } }); setDrawingState({ type: 'pet', id: newId }); break;
                    case 'exit': draft.exits.push({ position: coords, color: selectedColor, special: { count: 0, iceCount: 0, layerColors: null, isPermanent: false } }); break;
                    case 'stone': draft.stoneWalls.push({ position: coords, count: 3, iceCount: 0 }); break;
                    case 'colored_path': draft.coloredPaths.push({ position: coords, color: selectedColor }); break;
                    case 'color_wall': draft.colorWalls.push({ position: coords, color: selectedColor }); break;
                    case 'wall': const gridY = draft.gridData.height - 1 - coords.y; const row = draft.gridData.strGrid[gridY].split(','); row[coords.x] = '0'; draft.gridData.strGrid[gridY] = row.join(','); break;
                    case 'crate': newId = nextId.current.crate++; draft.crateInfos.push({ id: newId, listPositions: [coords], requiredSnake: 1 }); setDrawingState({ type: 'crate', id: newId }); break;
                    case 'movable_box': newId = nextId.current.movableBox++; draft.movableBoxes.push({ id: newId, listPositions: [coords], direction: MovableBoxDirection.None }); setDrawingState({ type: 'movable_box', id: newId }); break;
                    case 'obstacle': newId = nextId.current.obstacle++; draft.obstacleInfos.push({ id: newId, listPositions: [coords] }); setDrawingState({ type: 'obstacle', id: newId }); break;
                    case 'tree_root': newId = nextId.current.treeRoot++; draft.treeRoots.push({ id: newId, position: coords, direction: { x: 1, y: 0 }, length: 3 }); break;
                    case 'ribbon': if (draft.ribbonInfo.listPositions.length < 2) draft.ribbonInfo.listPositions.push(coords); break;
                }
            });
        }
    }, [drawingState, selectedTool, selectedColor, updateLevel, finishDrawing, getPositionsForObject, runDragAnimation]);

    // --- Editor mouse move: throttled via RAF to reduce load ---
    const handleEditorMouseMove = useCallback((coords: Coordinates, e: React.MouseEvent) => {
        if (drawingState.id !== null) {
            // still drawing: mutate draft only when adding new tile to drawn object
            updateLevel(draft => {
                let item: Pet | CrateInfo | MovableBox | ObstacleInfo | undefined;
                let ignoreOptions: Parameters<typeof getObjectAtCoords>[2] = {};

                switch (drawingState.type) {
                    case 'pet': item = draft.pets.find(p => p.id === drawingState.id); ignoreOptions = { ignorePetId: drawingState.id }; break;
                    case 'crate': item = draft.crateInfos.find(c => c.id === drawingState.id); ignoreOptions = { ignoreCrateId: drawingState.id }; break;
                    case 'movable_box': item = draft.movableBoxes.find(b => b.id === drawingState.id); ignoreOptions = { ignoreBoxId: drawingState.id }; break;
                    case 'obstacle': item = draft.obstacleInfos.find(o => o.id === drawingState.id); ignoreOptions = { ignoreObstacleId: drawingState.id }; break;
                }
                if (!item) return;

                const positions = 'positions' in item ? item.positions : item.listPositions;
                if (positions.length === 0) return;
                
                const lastPos = positions[positions.length - 1];
                const isAdjacent = Math.abs(coords.x - lastPos.x) + Math.abs(coords.y - lastPos.y) === 1;
                const isOccupied = getObjectAtCoords(coords, draft, ignoreOptions);
                const isSelf = positions.some(p => p.x === coords.x && p.y === coords.y);
                
                if (isAdjacent && !isOccupied && !isSelf) {
                    positions.push(coords);
                    if ('headPos' in item) item.headPos = item.positions[0];
                }
            });
            return;
        }
        
        // if not dragging or no editDragState -> nothing
        if (!isDragging || !editDragStateRef.current) return;

        // update last mouse (for visuals lerp)
        lastMouseClient.current = { x: e.clientX, y: e.clientY };

        // throttle movement calculation to next RAF
        if (pendingMoveFrame.current) return;

        pendingMoveFrame.current = requestAnimationFrame(() => {
            pendingMoveFrame.current = null;
            const currentDragState = editDragStateRef.current;
            if (!currentDragState) return;

            // update dragged visuals offset immediately (cheap)
            setDraggedVisuals(prev => prev ? { ...prev, offset: { x: e.clientX - currentDragState.startMouse.x, y: e.clientY - currentDragState.startMouse.y } } : null);

            // compute delta in grid coords
            const delta = { x: coords.x - currentDragState.startCoords.x, y: coords.y - currentDragState.startCoords.y };

            // compute new positions without touching level state (read only)
            const originalPositions = getPositionsForObject(currentDragState.object);
            const newPositions = originalPositions.map(p => ({ x: p.x + delta.x, y: p.y + delta.y }));

            // validate boundaries and collisions using levelRef but ignoring the dragged object
            const lvl = levelRef.current;
            const checkBounds = (p: Coordinates) => p.x >= 0 && p.x < lvl.gridData.width && p.y >= 0 && p.y < lvl.gridData.height;

            // build ignore options to avoid counting the object's own current positions as collisions
            let ignoreOptions: Parameters<typeof getObjectAtCoords>[2] = {};
            switch (currentDragState.object.type) {
                case 'pet': ignoreOptions = { ignorePetId: currentDragState.object.id }; break;
                case 'crate': ignoreOptions = { ignoreCrateId: currentDragState.object.id }; break;
                case 'movable_box': ignoreOptions = { ignoreBoxId: currentDragState.object.id }; break;
                case 'obstacle': ignoreOptions = { ignoreObstacleId: currentDragState.object.id }; break;
                default: break;
            }

            let isValid = true;
            for (const p of newPositions) {
                if (!checkBounds(p) || getObjectAtCoords(p, lvl, ignoreOptions)) {
                    isValid = false;
                    break;
                }
            }

            // update lightweight UI drag state (no level clone)
            setEditDragState(prev => prev ? { ...prev, currentPositions: newPositions, isValidDrop: isValid } : prev);
        });
    }, [isDragging, drawingState, getPositionsForObject, updateLevel]);

    // --- Editor mouse up: commit move if valid (this is where we mutate the level once) ---
    const handleEditorMouseUp = useCallback((coords: Coordinates | null) => {
        if (animationFrameRef.current) {
            cancelAnimationFrame(animationFrameRef.current);
            animationFrameRef.current = null;
        }
        if (pendingMoveFrame.current) {
            cancelAnimationFrame(pendingMoveFrame.current);
            pendingMoveFrame.current = null;
        }

        if (drawingState.id !== null) return;

        const currentDragState = editDragStateRef.current;

        setIsDragging(false);
        setDraggedVisuals(null);

        if (currentDragState && currentDragState.isValidDrop && coords) {
            updateLevel(draft => {
                const delta = { x: coords.x - currentDragState.startCoords.x, y: coords.y - currentDragState.startCoords.y };
                const move = (p: Coordinates) => ({ x: p.x + delta.x, y: p.y + delta.y });
                const dragObject = currentDragState.object;

                switch (dragObject.type) {
                    case 'pet': { const pet = draft.pets.find(p => p.id === dragObject.id); if (pet) { pet.positions = pet.positions.map(move); pet.headPos = pet.positions[0]; } break; }
                    case 'exit': { const exit = draft.exits.find(e => e.position.x === dragObject.pos.x && e.position.y === dragObject.pos.y); if (exit) exit.position = move(exit.position); break; }
                    case 'stone': { const stone = draft.stoneWalls.find(s => s.position.x === dragObject.pos.x && s.position.y === dragObject.pos.y); if (stone) stone.position = move(stone.position); break; }
                    case 'colored_path': { const path = draft.coloredPaths.find(p => p.position.x === dragObject.pos.x && p.position.y === dragObject.pos.y); if (path) path.position = move(path.position); break; }
                    case 'color_wall': { const wall = draft.colorWalls.find(w => w.position.x === dragObject.pos.x && w.position.y === dragObject.pos.y); if (wall) wall.position = move(wall.position); break; }
                    case 'crate': { const crate = draft.crateInfos.find(c => c.id === dragObject.id); if (crate) crate.listPositions = crate.listPositions.map(move); break; }
                    case 'movable_box': { const box = draft.movableBoxes.find(b => b.id === dragObject.id); if (box) box.listPositions = box.listPositions.map(move); break; }
                    case 'obstacle': { const obs = draft.obstacleInfos.find(o => o.id === dragObject.id); if (obs) obs.listPositions = obs.listPositions.map(move); break; }
                    case 'tree_root': { const root = draft.treeRoots.find(r => r.id === dragObject.id); if(root) root.position = move(root.position); break; }
                    case 'ribbon': draft.ribbonInfo.listPositions = draft.ribbonInfo.listPositions.map(move); break;
                }
            });
        }

        setEditDragState(null);
    }, [drawingState, updateLevel]);

    // --- Play mode mouse handlers (kept but minor optimization: use refs where useful) ---
    const handlePlayModeMouseDown = useCallback((coords: Coordinates) => {
        if (isAnimating) return;
        const obj = getObjectAtCoords(coords, levelRef.current);
        if (obj?.type === 'pet') {
            const pet = levelRef.current.pets.find(p => p.id === obj.id);
            if (pet && isPetMovable(pet, levelRef.current)) {
                const isHead = pet.headPos.x === coords.x && pet.headPos.y === coords.y;
                const isTail = pet.positions.length > 1 && pet.positions[pet.positions.length - 1].x === coords.x && pet.positions[pet.positions.length - 1].y === coords.y;
                let end: 'head' | 'tail' | null = null;
                if (isHead) end = 'head';
                else if (isTail && !pet.special.isSingleDirection) end = 'tail';

                if (end) {
                    setPlayDragState({ pet, end, dragPath: [coords] });
                    setAnimatedLevel(structuredClone(levelRef.current));
                }
            }
        } else if (obj?.type === 'movable_box') {
            const box = levelRef.current.movableBoxes.find(b => b.id === obj.id);
            if (box) {
                setPlayBoxDragState({
                    box,
                    startCoords: coords,
                    initialBoxPositions: [...box.listPositions],
                });
                setAnimatedLevel(structuredClone(levelRef.current));
            }
        }
    }, [isAnimating]);

    const handlePlayModeMouseMove = useCallback((coords: Coordinates) => {
        if (isAnimating || !(playDragState || playBoxDragState) || !animatedLevelRef.current) return;
        
        if (playDragState) {
            if (lastDragCoords.current && lastDragCoords.current.x === coords.x && lastDragCoords.current.y === coords.y) {
                return;
            }
            lastDragCoords.current = coords;
        
            const { pet, dragPath, end } = playDragState;
            const currentPathEnd = dragPath[dragPath.length - 1];
        
            // Backtracking support
            if (dragPath.length > 1 && coords.x === dragPath[dragPath.length - 2].x && coords.y === dragPath[dragPath.length - 2].y) {
                const newDragPath = dragPath.slice(0, -1);
        
                // FIX: Use the pet's state at the start of the drag, not from `editStateBeforePlay` which can be stale.
                const initialPetPositions = playDragState.pet.positions;
                let newPositions = [...initialPetPositions];
                
                // Re-simulate the path from the beginning of the drag up to the new last point.
                for (let i = 1; i < newDragPath.length; i++) {
                    const nextPos = newDragPath[i];
                    newPositions = end === 'head'
                        ? [nextPos, ...newPositions.slice(0, -1)]
                        : [...newPositions.slice(1), nextPos];
                }
                
                const nextLevelState = structuredClone(animatedLevelRef.current);
                const petToUpdate = nextLevelState.pets.find(p => p.id === pet.id)!;
                petToUpdate.positions = newPositions;
                petToUpdate.headPos = newPositions[0];
        
                setAnimatedLevel(nextLevelState);
                setPlayDragState(s => s ? { ...s, dragPath: newDragPath } : null);
                return;
            }
        
            // Forward movement
            const isAdjacent = Math.abs(coords.x - currentPathEnd.x) + Math.abs(coords.y - currentPathEnd.y) === 1;
            if (!isAdjacent) return;
            
            const petInAnimatedLevel = animatedLevelRef.current.pets.find(p => p.id === pet.id)!;
            const newPositions = end === 'head' 
                ? [coords, ...petInAnimatedLevel.positions.slice(0, -1)]
                : [...petInAnimatedLevel.positions.slice(1), coords];
            
            if (isPetBodyPositionValid(newPositions, pet, animatedLevelRef.current)) {
                const nextLevelState = structuredClone(animatedLevelRef.current);
                const petToUpdate = nextLevelState.pets.find(p => p.id === pet.id)!;
                petToUpdate.positions = newPositions;
                petToUpdate.headPos = newPositions[0];
        
                setAnimatedLevel(nextLevelState);
                setPlayDragState(s => s ? { ...s, dragPath: [...s.dragPath, coords] } : null);
            }
        } else if (playBoxDragState) {
            if (lastDragCoords.current && lastDragCoords.current.x === coords.x && lastDragCoords.current.y === coords.y) {
                return;
            }
            lastDragCoords.current = coords;
            
            const { box } = playBoxDragState;
            const boxInAnimatedLevel = animatedLevelRef.current.movableBoxes.find(b => b.id === box.id)!;
            const currentPositions = boxInAnimatedLevel.listPositions;
    
            // if mouse is over any current box tile, do nothing
            if (currentPositions.some(p => p.x === coords.x && p.y === coords.y)) {
                return;
            }
    
            // Determine move direction based on which adjacent cell the mouse is in
            let moveDir = {x: 0, y: 0};
            let moved = false;
            for (const pos of currentPositions) {
                for (const dir of [{x:1,y:0},{x:-1,y:0},{x:0,y:1},{x:0,y:-1}]) {
                    if (pos.x + dir.x === coords.x && pos.y + dir.y === coords.y) {
                        moveDir = dir;
                        moved = true;
                        break;
                    }
                }
                if (moved) break;
            }
    
            if (!moved) return;
    
            // constrain
            if (box.direction === MovableBoxDirection.Horizontal) moveDir.y = 0;
            if (box.direction === MovableBoxDirection.Vertical) moveDir.x = 0;
            if (moveDir.x === 0 && moveDir.y === 0) return;
    
            const newPositions = currentPositions.map(p => ({ x: p.x + moveDir.x, y: p.y + moveDir.y }));
            
            if(canMoveBox(box.id, newPositions, animatedLevelRef.current)) {
                const nextLevelState = structuredClone(animatedLevelRef.current);
                const boxToUpdate = nextLevelState.movableBoxes.find(b => b.id === box.id)!;
                boxToUpdate.listPositions = newPositions;
                setAnimatedLevel(nextLevelState);
            }
        }
    }, [isAnimating, playDragState, playBoxDragState]);

    const handlePlayModeMouseUp = useCallback((coords: Coordinates | null) => {
        if (playDragState) {
             if (animatedLevelRef.current) {
                const finalLevel = structuredClone(animatedLevelRef.current);
                const pet = finalLevel.pets.find(p => p.id === playDragState.pet.id)!;
                const finalPos = playDragState.end === 'head' ? pet.positions[0] : pet.positions[pet.positions.length - 1];
                const exit = finalLevel.exits.find(e => e.position.x === finalPos.x && e.position.y === finalPos.y);
        
                let levelToCommit = finalLevel;
                if (exit && exit.color === pet.color && (exit.special.iceCount ?? 0) === 0) {
                    let positionsBeforeExit: Coordinates[];
                    if (playDragState.dragPath.length > 1) {
                        const petPositionFrames = simulatePetPath(
                            playDragState.pet.positions, // Start positions from before the drag
                            playDragState.dragPath,
                            playDragState.end
                        );
                        // The frame before the last one is the position before entering the exit
                        positionsBeforeExit = petPositionFrames[petPositionFrames.length - 2];
                    } else {
                        // No drag, just a click, so current positions are the ones before the solve.
                        positionsBeforeExit = pet.positions;
                    }

                    const res = applyPetSolutionEffects(finalLevel, pet, exit, playDragState.end, positionsBeforeExit);
                    levelToCommit = res.nextLevel;
                    
                    if (res.removedWalls.length > 0) {
                        setDisappearingWalls(res.removedWalls);
                        setTimeout(() => setDisappearingWalls([]), 500);
                    }
                    if (levelToCommit.pets.length === 0) {
                        setLevelSolved(true);
                    }
                }
                setLevel(levelToCommit);
                levelRef.current = levelToCommit;
        
                if (isRecording && playDragState.dragPath.length > 1) {
                    recordedSolution.current.push(`PET:${pet.id}:${playDragState.end}:${playDragState.dragPath.map(p => `${p.x},${p.y}`).join('>')}`);
                }
            }
            setPlayDragState(null);
        } else if (playBoxDragState) {
            if (animatedLevelRef.current) {
                const finalLevel = structuredClone(animatedLevelRef.current);
                setLevel(finalLevel);
                levelRef.current = finalLevel;

                if (isRecording) {
                    const movedBox = finalLevel.movableBoxes.find(b => b.id === playBoxDragState.box.id)!;
                    const initialPositions = playBoxDragState.initialBoxPositions;
                    
                    const moved = JSON.stringify(initialPositions) !== JSON.stringify(movedBox.listPositions);
                    if (moved) {
                        const initialPosStr = initialPositions.map(p => `${p.x},${p.y}`).join(';');
                        const finalPosStr = movedBox.listPositions.map(p => `${p.x},${p.y}`).join(';');
                        recordedSolution.current.push(`BOX:${movedBox.id}:${initialPosStr}>${finalPosStr}`);
                    }
                }
            }
            setPlayBoxDragState(null);
        } else {
            return;
        }

        setAnimatedLevel(null);
        lastDragCoords.current = null;
    }, [playDragState, playBoxDragState, isRecording]);

    // --- return public API ---
    return {
        level: animatedLevel ?? level,
        mode,
        selectedTool,
        selectedColor,
        selectedObject,
        drawingState,
        isDragging,
        editDragState,
        playDragState,
        levelSolved,
        fileInputRef,
        isRecording,
        isSolving,
        animatedLevel,
        isSolutionPlaying,
        isAnimating,
        solutionPlaybackIndex,
        guideSolver,
        disappearingWalls,
        draggedVisuals,
        pathVisualization,
        handlers: {
            setLevel,
            setGuideSolver,
            setDrawingState,
            handleToolChange,
            handleColorChange,
            handleSizeChange,
            handleLoadClick,
            handleFileLoad,
            handleSaveUnityAsset,
            handleSolveLevel,
            handlePlaySolution,
            handleStopSolution,
            toggleMode,
            toggleRecording,
            handleEditorMouseDown,
            handleEditorMouseMove,
            handleEditorMouseUp,
            handlePlayModeMouseDown,
            handlePlayModeMouseMove,
            handlePlayModeMouseUp,
            handleResetToEditState,
            handleSaveAndReturnToEdit
        },
    };
};
