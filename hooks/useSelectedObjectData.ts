
import { useMemo } from 'react';
import type { Level, SelectedObject, Pet, Exit, StoneWall, ColoredPath, ColorWall, CrateInfo, RibbonInfo, MovableBox, ObstacleInfo, TreeRoot } from '../types/level';

// A union type of all possible full object data structures, with their type explicitly added.
export type SelectedObjectData =
  | (Pet & { type: 'pet' })
  | (Exit & { type: 'exit' })
  | (StoneWall & { type: 'stone' })
  | (ColoredPath & { type: 'colored_path' })
  | (ColorWall & { type: 'color_wall' })
  | (CrateInfo & { type: 'crate' })
  | (RibbonInfo & { type: 'ribbon' })
  | (MovableBox & { type: 'movable_box' })
  | (ObstacleInfo & { type: 'obstacle' })
  | (TreeRoot & { type: 'tree_root' });


export const useSelectedObjectData = (level: Level, selectedObject: SelectedObject | null): SelectedObjectData | null => {
    const selectedObjectData: SelectedObjectData | null = useMemo(() => {
        if (!selectedObject) return null;

        switch (selectedObject.type) {
            case 'pet': {
                const obj = level.pets.find(p => p.id === selectedObject.id);
                return obj ? { ...obj, type: 'pet' } : null;
            }
            case 'exit': {
                const obj = level.exits.find(e => e.position.x === selectedObject.pos.x && e.position.y === selectedObject.pos.y);
                return obj ? { ...obj, type: 'exit' } : null;
            }
            case 'stone': {
                const obj = level.stoneWalls.find(s => s.position.x === selectedObject.pos.x && s.position.y === selectedObject.pos.y);
                return obj ? { ...obj, type: 'stone' } : null;
            }
            case 'colored_path': {
                const obj = level.coloredPaths.find(p => p.position.x === selectedObject.pos.x && p.position.y === selectedObject.pos.y);
                return obj ? { ...obj, type: 'colored_path' } : null;
            }
            case 'color_wall': {
                const obj = level.colorWalls.find(w => w.position.x === selectedObject.pos.x && w.position.y === selectedObject.pos.y);
                return obj ? { ...obj, type: 'color_wall' } : null;
            }
            case 'crate': {
                const obj = level.crateInfos.find(c => c.id === selectedObject.id);
                return obj ? { ...obj, type: 'crate' } : null;
            }
            case 'ribbon': {
                // Ribbon is a singleton, so we can just return it with the type if it exists.
                return level.ribbonInfo ? { ...level.ribbonInfo, type: 'ribbon' } : null;
            }
            case 'movable_box': {
                const obj = level.movableBoxes.find(b => b.id === selectedObject.id);
                return obj ? { ...obj, type: 'movable_box' } : null;
            }
            case 'obstacle': {
                const obj = level.obstacleInfos.find(o => o.id === selectedObject.id);
                return obj ? { ...obj, type: 'obstacle' } : null;
            }
            case 'tree_root': {
                const obj = level.treeRoots.find(r => r.id === selectedObject.id);
                return obj ? { ...obj, type: 'tree_root' } : null;
            }
            default:
                return null;
        }
    }, [level, selectedObject]);

    return selectedObjectData;
};
