
import React, { useMemo, useRef } from 'react';
import type { Level, Coordinates, SelectedObject, ColorWall, TreeRoot, Pet } from '../types/level';
import { KeyLockColor } from '../types/level';
import type { EditDragState, PlayDragState } from '../hooks/useLevelEditor';
import { Pet as PetComponent } from './Pet';
import { Exit as ExitComponent, StoneWallComponent, ColoredPathComponent, ColorWallComponent, CrateComponent, RibbonComponent, IceComponent, MovableBoxComponent, ObstacleComponent, TreeRootComponent } from './Special';
import { GridTile } from './grid-tile';
import { getTreeRootSegments } from '../utils/levelUtils';

interface GameBoardProps {
  level: Level;
  mode: 'edit' | 'play';
  selectedObject: SelectedObject | null;
  isDragging: boolean;
  editDragState: EditDragState | null;
  playDragState: PlayDragState | null;
  disappearingWalls?: ColorWall[];
  draggedVisuals?: { type: SelectedObject['type']; id: any; offset: { x: number; y: number } } | null;
  pathVisualization?: Coordinates[][] | null;
  onGridMouseDown: (coords: Coordinates, e: React.MouseEvent) => void;
  onGridMouseMove?: (coords: Coordinates, e: React.MouseEvent) => void;
  onGridMouseUp?: (coords: Coordinates | null, e: React.MouseEvent) => void;
  onGridMouseLeave?: (e: React.MouseEvent) => void;
}

export const GameBoard: React.FC<GameBoardProps> = ({ level, mode, selectedObject, isDragging, editDragState, playDragState, disappearingWalls, draggedVisuals, pathVisualization, onGridMouseDown, onGridMouseMove, onGridMouseUp, onGridMouseLeave }) => {
  const { gridData, pets, exits, stoneWalls, coloredPaths, colorWalls, crateInfos, ribbonInfo, movableBoxes, obstacleInfos, treeRoots } = level;
  const { width, height } = gridData;
  const boardRef = useRef<HTMLDivElement>(null);
  
  const gridRows = useMemo(() => {
    if (!gridData.strGrid) return [];
    return [...gridData.strGrid].reverse().map(row => row.split(','));
  }, [gridData.strGrid]);

  const TILE_SIZE = Math.min(64, 900 / Math.max(width, height, 10));

  const allOccupiedCoords = useMemo(() => {
    const coords = new Set<string>();
    pets.forEach(p => p.positions.forEach(pos => coords.add(`${pos.x},${pos.y}`)));
    exits.forEach(e => coords.add(`${e.position.x},${e.position.y}`));
    stoneWalls.forEach(s => coords.add(`${s.position.x},${s.position.y}`));
    coloredPaths.forEach(p => coords.add(`${p.position.x},${p.position.y}`));
    colorWalls.forEach(w => coords.add(`${w.position.x},${w.position.y}`));
    crateInfos.forEach(c => c.listPositions.forEach(pos => coords.add(`${pos.x},${pos.y}`)));
    ribbonInfo.listPositions.forEach(pos => coords.add(`${pos.x},${pos.y}`));
    movableBoxes.forEach(b => b.listPositions.forEach(pos => coords.add(`${pos.x},${pos.y}`)));
    obstacleInfos.forEach(o => o.listPositions.forEach(pos => coords.add(`${pos.x},${pos.y}`)));
    treeRoots.forEach(r => getTreeRootSegments(r).forEach(pos => coords.add(`${pos.x},${pos.y}`)));
    return coords;
  }, [level]);

  const keyLockLinks = useMemo(() => {
    if (mode !== 'edit' || !selectedObject || selectedObject.type !== 'pet') {
      return [];
    }

    const selectedPet = level.pets.find(p => p.id === selectedObject.id);
    if (!selectedPet?.special.keyLock) {
      return [];
    }

    const links: { keyPet: any; lockPet: any; color: KeyLockColor }[] = [];
    const { keyColor, lockColor } = selectedPet.special.keyLock;

    if (keyColor !== KeyLockColor.Unk && keyColor !== undefined) {
      // Selected pet has a key, find locks
      const matchingLockPets = level.pets.filter(
        p => p.id !== selectedPet.id && p.special.keyLock?.lockColor === keyColor
      );
      matchingLockPets.forEach(lockPet => {
        links.push({ keyPet: selectedPet, lockPet, color: keyColor });
      });
    }

    if (lockColor !== KeyLockColor.Unk && lockColor !== undefined) {
      // Selected pet has a lock, find keys
      const matchingKeyPets = level.pets.filter(
        p => p.id !== selectedPet.id && p.special.keyLock?.keyColor === lockColor
      );
      matchingKeyPets.forEach(keyPet => {
        links.push({ keyPet, lockPet: selectedPet, color: lockColor });
      });
    }
    
    return links;
  }, [selectedObject, level.pets, mode]);

  const allColorWallsToRender = useMemo(() => {
    const disappearingKeys = new Set(disappearingWalls?.map(w => `${w.position.x},${w.position.y}`));

    const wallsToRender = level.colorWalls.map(wall => {
        const key = `${wall.position.x},${wall.position.y}`;
        return {
            wall,
            status: disappearingKeys.has(key) ? 'disappearing' : 'visible'
        };
    });
    
    disappearingWalls?.forEach(wall => {
        if (!wallsToRender.some(w => w.wall.position.x === wall.position.x && w.wall.position.y === wall.position.y)) {
            wallsToRender.push({ wall, status: 'disappearing' });
        }
    });

    return wallsToRender;
  }, [level.colorWalls, disappearingWalls]);

  const getCoordsFromEvent = (e: React.MouseEvent): Coordinates | null => {
      if (!boardRef.current) return null;
      const rect = boardRef.current.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      const x = Math.floor(mouseX / TILE_SIZE);
      const y = Math.floor((rect.height - mouseY) / TILE_SIZE);

      if (x < 0 || x >= width || y < 0 || y >= height) return null;
      return { x, y };
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    const coords = getCoordsFromEvent(e);
    if (coords) {
        onGridMouseDown(coords, e);
    }
  }

  const handleMouseMove = (e: React.MouseEvent) => {
      if (onGridMouseMove) {
          const coords = getCoordsFromEvent(e);
          if (coords) {
              onGridMouseMove(coords, e);
          }
      }
  };

  const handleMouseUp = (e: React.MouseEvent) => {
    if (onGridMouseUp) {
      onGridMouseUp(getCoordsFromEvent(e), e);
    }
  };
  
  const handleMouseLeave = (e: React.MouseEvent) => {
    if (onGridMouseLeave) {
        onGridMouseLeave(e);
    }
  }

  const gridStyle: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: `repeat(${width}, ${TILE_SIZE}px)`,
    gridTemplateRows: `repeat(${height}, ${TILE_SIZE}px)`,
    width: `${width * TILE_SIZE}px`,
    height: `${height * TILE_SIZE}px`,
    border: '2px solid #4a5568',
    backgroundColor: 'transparent',
    position: 'relative',
  };
  
  const cells = Array.from({ length: width * height }, (_, i) => {
    const x = i % width;
    const y = Math.floor(i / width);
    const gameY = height - 1 - y;
    const isWall = gridRows[gameY]?.[x] === '0';
    return { key: `${x}-${gameY}`, x, y: gameY, isWall };
  });

  const isSelected = (coords: Coordinates): boolean => {
    if (!selectedObject) return false;

    switch(selectedObject.type) {
      case 'pet':
        const pet = pets.find(p => p.id === selectedObject.id);
        return !!pet?.positions.some(p => p.x === coords.x && p.y === coords.y);
      case 'crate':
        const crate = crateInfos.find(c => c.id === selectedObject.id);
        return !!crate?.listPositions.some(p => p.x === coords.x && p.y === coords.y);
      case 'movable_box':
        const box = movableBoxes.find(b => b.id === selectedObject.id);
        return !!box?.listPositions.some(p => p.x === coords.x && p.y === coords.y);
      case 'obstacle':
        const obstacle = obstacleInfos.find(o => o.id === selectedObject.id);
        return !!obstacle?.listPositions.some(p => p.x === coords.x && p.y === coords.y);
      case 'tree_root':
        const root = treeRoots.find(r => r.id === selectedObject.id);
        return !!root && getTreeRootSegments(root).some(p => p.x === coords.x && p.y === coords.y);
      case 'ribbon':
        return !!ribbonInfo?.listPositions.some(p => p.x === coords.x && p.y === coords.y);
      case 'exit':
      case 'stone':
      case 'colored_path':
      case 'color_wall':
        return selectedObject.pos.x === coords.x && selectedObject.pos.y === coords.y;
      default:
        return false;
    }
  };

  const draggingPetId = playDragState?.pet.id;

  return (
    <div
        ref={boardRef}
        style={{ cursor: isDragging || !!playDragState ? 'grabbing' : 'default', width: gridStyle.width, height: gridStyle.height }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
    >
      <div style={gridStyle}>
        {cells.map(({ key, x, y, isWall }) => (
          <GridTile
            key={key}
            x={x}
            y={y}
            gridWidth={width}
            gridHeight={height}
            isWall={isWall}
            isSelected={isSelected({x,y})}
            onMouseDown={() => {}}
          />
        ))}

        {pets.map(pet =>
          pet.special.iceCount > 0
            ? pet.positions.map((pos, i) => (
                <IceComponent
                  key={`ice-${pet.id}-${i}`}
                  pos={pos}
                  height={height}
                  isDimmed={editDragState?.object.type === 'pet' && editDragState.object.id === pet.id}
                />
              ))
            : null
        )}

        {coloredPaths.map((path, i) => {
          const visualDragData = (draggedVisuals?.type === 'colored_path' && draggedVisuals.id.x === path.position.x && draggedVisuals.id.y === path.position.y) ? draggedVisuals : null;
          return <ColoredPathComponent key={`cp-${i}`} path={path} height={height} isDimmed={editDragState?.object.type === 'colored_path' && editDragState.object.pos.x === path.position.x && editDragState.object.pos.y === path.position.y} visualOffset={visualDragData?.offset} />
        })}
        {allColorWallsToRender.map(({ wall, status }, i) => {
           const visualDragData = (draggedVisuals?.type === 'color_wall' && draggedVisuals.id.x === wall.position.x && draggedVisuals.id.y === wall.position.y) ? draggedVisuals : null;
          return <ColorWallComponent key={`cw-${wall.position.x}-${wall.position.y}-${i}`} wall={wall} height={height} isDimmed={editDragState?.object.type === 'color_wall' && editDragState.object.pos.x === wall.position.x && editDragState.object.pos.y === wall.position.y} isDisappearing={status === 'disappearing'} visualOffset={visualDragData?.offset} />
        })}
        {crateInfos.map((crate, i) => {
           const visualDragData = (draggedVisuals?.type === 'crate' && draggedVisuals.id === crate.id) ? draggedVisuals : null;
          return <CrateComponent key={`cr-${i}`} crate={crate} height={height} isDimmed={editDragState?.object.type === 'crate' && editDragState.object.id === crate.id} visualOffset={visualDragData?.offset} />
        })}
        {movableBoxes.map((box, i) => {
          const visualDragData = (draggedVisuals?.type === 'movable_box' && draggedVisuals.id === box.id) ? draggedVisuals : null;
          return <MovableBoxComponent key={`mb-${i}`} box={box} height={height} mode={mode} isDimmed={editDragState?.object.type === 'movable_box' && editDragState.object.id === box.id} visualOffset={visualDragData?.offset} />
        })}
        {ribbonInfo && ribbonInfo.listPositions.length > 0 && <RibbonComponent ribbon={ribbonInfo} height={height} isDimmed={editDragState?.object.type === 'ribbon'} />}
        {exits.map((exit, i) => {
          const visualDragData = (draggedVisuals?.type === 'exit' && draggedVisuals.id.x === exit.position.x && draggedVisuals.id.y === exit.position.y) ? draggedVisuals : null;
          return <ExitComponent key={`e-${i}`} exit={exit} height={height} theme={level.theme} isDimmed={editDragState?.object.type === 'exit' && editDragState.object.pos.x === exit.position.x && editDragState.object.pos.y === exit.position.y} visualOffset={visualDragData?.offset} />
        })}
        {stoneWalls.map((stone, i) => {
          const visualDragData = (draggedVisuals?.type === 'stone' && draggedVisuals.id.x === stone.position.x && draggedVisuals.id.y === stone.position.y) ? draggedVisuals : null;
          return <StoneWallComponent key={`sw-${i}`} stone={stone} height={height} theme={level.theme} isDimmed={editDragState?.object.type === 'stone' && editDragState.object.pos.x === stone.position.x && editDragState.object.pos.y === stone.position.y} visualOffset={visualDragData?.offset} />
        })}
        {obstacleInfos.map((obstacle, i) => {
          const visualDragData = (draggedVisuals?.type === 'obstacle' && draggedVisuals.id === obstacle.id) ? draggedVisuals : null;
          return <ObstacleComponent key={`obs-${i}`} obstacle={obstacle} height={height} isDimmed={editDragState?.object.type === 'obstacle' && editDragState.object.id === obstacle.id} visualOffset={visualDragData?.offset} />
        })}
        {treeRoots.map((root, i) => {
          const visualDragData = (draggedVisuals?.type === 'tree_root' && draggedVisuals.id === root.id) ? draggedVisuals : null;
          return <TreeRootComponent key={`tr-${i}`} root={root} height={height} isDimmed={editDragState?.object.type === 'tree_root' && editDragState.object.id === root.id} visualOffset={visualDragData?.offset} />
        })}
        
        <svg
          width={width * TILE_SIZE}
          height={height * TILE_SIZE}
          style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none', zIndex: 10 }}
          aria-hidden="true"
        >
          {pathVisualization?.map((path, pathIndex) => {
              if (path.length < 2) return null;

              const pathPoints = path.map(segment => {
                  const x = segment.x * TILE_SIZE + TILE_SIZE / 2;
                  const y = (height - 1 - segment.y) * TILE_SIZE + TILE_SIZE / 2;
                  return `${x},${y}`;
              }).join(' ');

              return (
                  <polyline
                      key={`path-vis-${pathIndex}`}
                      points={pathPoints}
                      fill="none"
                      stroke="#FFFFFF"
                      strokeWidth={TILE_SIZE * 0.15}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeDasharray={`${TILE_SIZE * 0.2} ${TILE_SIZE * 0.15}`}
                      style={{ 
                          animation: 'pulse-white 2s ease-in-out infinite',
                          pointerEvents: 'none' 
                      }}
                  />
              );
          })}

          {pets.map(pet => {
            const visualDragData = (draggedVisuals?.type === 'pet' && draggedVisuals.id === pet.id) ? draggedVisuals : null;
            return (
              <PetComponent
                key={pet.id}
                pet={pet}
                mode={mode}
                gridHeight={height}
                tileSize={TILE_SIZE}
                theme={level.theme}
                isDimmed={editDragState?.object.type === 'pet' && editDragState.object.id === pet.id}
                isBeingDragged={pet.id === draggingPetId}
                visualOffset={visualDragData?.offset}
                onPetMouseDown={(coords, e) => onGridMouseDown(coords, e)}
              />
            );
          })}
          
          {keyLockLinks.map((link, index) => {
              const keyPetHead = link.keyPet.headPos;
              const lockPetTail = link.lockPet.positions[link.lockPet.positions.length - 1];

              if (!keyPetHead || !lockPetTail) {
                return null;
              }

              const x1 = keyPetHead.x * TILE_SIZE + TILE_SIZE / 2;
              const y1 = (height - 1 - keyPetHead.y) * TILE_SIZE + TILE_SIZE / 2;
              const x2 = lockPetTail.x * TILE_SIZE + TILE_SIZE / 2;
              const y2 = (height - 1 - lockPetTail.y) * TILE_SIZE + TILE_SIZE / 2;

              const strokeColor = link.color === KeyLockColor.Gold ? '#FBBF24' : '#E5E7EB';

              return (
                  <line
                      key={`link-${index}`}
                      x1={x1}
                      y1={y1}
                      x2={x2}
                      y2={y2}
                      stroke={strokeColor}
                      strokeWidth={TILE_SIZE * 0.1}
                      strokeLinecap="round"
                      strokeDasharray={`${TILE_SIZE * 0.2} ${TILE_SIZE * 0.15}`}
                      style={{ pointerEvents: 'none', filter: 'drop-shadow(0 0 2px rgba(0,0,0,0.7))' }}
                  />
              );
          })}


          {ribbonInfo && ribbonInfo.listPositions.length > 1 && (
              <line
                  x1={ribbonInfo.listPositions[0].x * TILE_SIZE + TILE_SIZE / 2}
                  y1={(height - 1 - ribbonInfo.listPositions[0].y) * TILE_SIZE + TILE_SIZE / 2}
                  x2={ribbonInfo.listPositions[1].x * TILE_SIZE + TILE_SIZE / 2}
                  y2={(height - 1 - ribbonInfo.listPositions[1].y) * TILE_SIZE + TILE_SIZE / 2}
                  stroke="#F472B6"
                  strokeWidth={TILE_SIZE * 0.1}
                  strokeLinecap="round"
                  strokeDasharray={`${TILE_SIZE * 0.2} ${TILE_SIZE * 0.1}`}
                  style={{ pointerEvents: 'none' }}
              />
          )}

        </svg>
        
        {mode === 'edit' && selectedObject && !isDragging && (
          <>
            {[...allOccupiedCoords].map(key => {
              const [x, y] = key.split(',').map(Number);
              const style: React.CSSProperties = {
                position: 'absolute',
                left: `${x * TILE_SIZE}px`,
                top: `${(height - 1 - y) * TILE_SIZE}px`,
                width: `${TILE_SIZE}px`,
                height: `${TILE_SIZE}px`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'white',
                fontSize: `${Math.max(8, TILE_SIZE * 0.2)}px`,
                textShadow: '0 0 4px black, 0 0 4px black',
                pointerEvents: 'none',
                zIndex: 12,
                fontFamily: 'monospace',
              };
              return <div key={`coord-${key}`} style={style}>({x},{y})</div>;
            })}
          </>
        )}

        {/* Ghost Renderer for drag-and-drop preview */}
        {mode === 'edit' && editDragState && (
          editDragState.currentPositions.map((pos, index) => {
              const outlineColor = editDragState.isValidDrop ? '#2dd4bf' : '#f87171'; // Teal for valid, Red for invalid
              const style: React.CSSProperties = {
                  position: 'absolute',
                  left: `${pos.x * TILE_SIZE}px`,
                  top: `${(height - 1 - pos.y) * TILE_SIZE}px`,
                  width: `${TILE_SIZE}px`,
                  height: `${TILE_SIZE}px`,
                  backgroundColor: editDragState.isValidDrop ? 'rgba(45, 212, 191, 0.2)' : 'rgba(248, 113, 113, 0.2)',
                  outline: `3px solid ${outlineColor}`,
                  outlineOffset: '-3px',
                  zIndex: 20,
                  pointerEvents: 'none',
                  opacity: 0.8,
                  borderRadius: '4px',
                  transition: 'background-color 0.2s ease, outline-color 0.2s ease',
              };
              return <div key={`ghost-${index}`} style={style} />;
          })
        )}
      </div>
    </div>
  );
};
