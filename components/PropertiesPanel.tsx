import React from 'react';
import { Level, StoneWall, Pet, PetSpecialInfo, Exit, ExitSpecialInfo, CrateInfo, KeyLockColor, MovableBox, MovableBoxDirection, ObstacleInfo, TreeRoot } from '../types/level';
import { PetColor, Color, LayerColors } from '../types/colors';
import type { SelectedObjectData } from '../../hooks/useSelectedObjectData';

interface PropertiesPanelProps {
  selectedObjectData: SelectedObjectData | null;
  level: Level;
  onLevelChange: (newLevel: Level) => void;
}

export const PropertiesPanel: React.FC<PropertiesPanelProps> = ({ selectedObjectData, level, onLevelChange }) => {
  if (!selectedObjectData) {
    return null;
  }

  const handleStoneWallChange = (prop: keyof StoneWall, value: any) => {
    if (selectedObjectData?.type !== 'stone') return;
    const newLevel = structuredClone(level);
    const stone = newLevel.stoneWalls.find(
      sw => sw.position.x === selectedObjectData.position.x && sw.position.y === selectedObjectData.position.y
    );
    if (stone) {
      (stone as any)[prop] = value;
      onLevelChange(newLevel);
    }
  };

  const handlePetSpecialChange = (prop: keyof PetSpecialInfo, value: any) => {
    const newLevel = structuredClone(level);
    const pet = newLevel.pets.find(p => p.id === (selectedObjectData as Pet).id);
    if (pet) {
      (pet.special as any)[prop] = value;
      // When layer colors are edited, the raw value from the asset file is no longer valid.
      if (prop === 'layerColors') {
        delete pet.special.rawLayerColors;
      }
      onLevelChange(newLevel);
    }
  };

  const handlePetKeyLockChange = (prop: 'keyColor' | 'lockColor', value: any) => {
    const newLevel = structuredClone(level);
    const pet = newLevel.pets.find(p => p.id === (selectedObjectData as Pet).id);
    if (pet) {
      const newKeyLock = pet.special.keyLock ? { ...pet.special.keyLock } : { keyColor: KeyLockColor.Unk, lockColor: KeyLockColor.Unk };
      newKeyLock[prop] = parseInt(value, 10);

      if (newKeyLock.keyColor === KeyLockColor.Unk && newKeyLock.lockColor === KeyLockColor.Unk) {
        pet.special.keyLock = null;
      } else {
        pet.special.keyLock = newKeyLock;
      }
      onLevelChange(newLevel);
    }
  };
  
  const handleExitChange = (prop: keyof ExitSpecialInfo, value: any) => {
    if (selectedObjectData?.type !== 'exit') return;
    const newLevel = structuredClone(level);
    const exit = newLevel.exits.find(
      e => e.position.x === selectedObjectData.position.x && e.position.y === selectedObjectData.position.y
    );
    if (exit) {
      (exit.special as any)[prop] = value;
      if (prop === 'layerColors') {
        delete exit.special.rawLayerColors;
      }
      onLevelChange(newLevel);
    }
  };
  
  const handleCrateChange = (prop: keyof CrateInfo, value: any) => {
    const newLevel = structuredClone(level);
    const crate = newLevel.crateInfos.find(c => c.id === (selectedObjectData as CrateInfo).id);
    if (crate) {
      (crate as any)[prop] = value;
      onLevelChange(newLevel);
    }
  };
  
  const handleMovableBoxChange = (prop: keyof MovableBox, value: any) => {
    const newLevel = structuredClone(level);
    const box = newLevel.movableBoxes.find(b => b.id === (selectedObjectData as MovableBox).id);
    if (box) {
      (box as any)[prop] = value;
      onLevelChange(newLevel);
    }
  };
  
  const handleTreeRootChange = (prop: keyof TreeRoot, value: any) => {
    const newLevel = structuredClone(level);
    const root = newLevel.treeRoots.find(r => r.id === (selectedObjectData as TreeRoot).id);
    if (root) {
      (root as any)[prop] = value;
      onLevelChange(newLevel);
    }
  };

  const renderStoneWallProperties = (stone: StoneWall) => (
    <div>
      <h3 className="text-md font-semibold text-white mb-2">Stone Wall</h3>
      <div className="flex flex-col gap-3">
        <div>
          <label htmlFor="stoneCount" className="block text-sm font-medium text-gray-300 mb-1">
            Hit Count
          </label>
          <input
            type="number"
            id="stoneCount"
            min="1"
            value={stone.count}
            onChange={(e) => handleStoneWallChange('count', parseInt(e.target.value, 10) || 1)}
            className="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-white focus:ring-teal-500 focus:border-teal-500"
          />
        </div>
        <div>
          <label htmlFor="stoneIceCount" className="block text-sm font-medium text-gray-300 mb-1">
            Ice Count
          </label>
          <input
            type="number"
            id="stoneIceCount"
            min="0"
            value={stone.iceCount ?? 0}
            onChange={(e) => handleStoneWallChange('iceCount', parseInt(e.target.value, 10) || 0)}
            className="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-white focus:ring-teal-500 focus:border-teal-500"
          />
        </div>
      </div>
    </div>
  );
  
  const renderPetProperties = (pet: Pet) => {
    const special = pet.special;
    
    const handleLayerChange = (layerIndex: 0 | 1, value: string) => {
        const newColor = value === '' ? null : parseInt(value, 10);
        const currentLayers = pet.special.layerColors || [];
        
        let newLayers: (Color | null)[] = [...currentLayers];
        if (newLayers.length <= layerIndex) {
            newLayers.length = layerIndex + 1;
            newLayers.fill(null, currentLayers.length);
        }

        newLayers[layerIndex] = newColor as Color | null;

        if (layerIndex === 0 && newColor === null) {
            newLayers[1] = null;
        }
        
        while (newLayers.length > 0 && newLayers[newLayers.length - 1] === null) {
            newLayers.pop();
        }

        const finalLayers = newLayers.filter(c => c !== null) as Color[];
        handlePetSpecialChange('layerColors', finalLayers.length > 0 ? finalLayers : null);
    };

    const layer1Value = (special.layerColors || [])[0] ?? '';
    const layer2Value = (special.layerColors || [])[1] ?? '';
    const isLayer2Disabled = layer1Value === '';
    
    const keyLockOptions = Object.keys(KeyLockColor).filter(k => isNaN(Number(k)));

    const formatColorName = (color: Color) => {
        return Color[color] ? Color[color].replace(/([A-Z])/g, ' $1').trim() : 'Unknown';
    }

    return (
      <div className="flex flex-col gap-3">
        <h3 className="text-md font-semibold text-white mb-0">Pet {pet.editorName} - Special</h3>
        
        <div>
          <label htmlFor="layer1Color" className="block text-sm font-medium text-gray-300 mb-1">Layer 1 Color</label>
          <select 
            id="layer1Color"
            value={layer1Value}
            onChange={(e) => handleLayerChange(0, e.target.value)}
            className="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-white focus:ring-teal-500 focus:border-teal-500"
          >
            <option value="">None</option>
            {LayerColors.map(color => (
                <option key={`l1-${color}`} value={color}>{formatColorName(color)}</option>
            ))}
          </select>
        </div>
        
        <div>
          <label htmlFor="layer2Color" className="block text-sm font-medium text-gray-300 mb-1">Layer 2 Color</label>
          <select 
            id="layer2Color"
            value={layer2Value}
            onChange={(e) => handleLayerChange(1, e.target.value)}
            disabled={isLayer2Disabled}
            className="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-white focus:ring-teal-500 focus:border-teal-500 disabled:opacity-50"
          >
            <option value="">None</option>
            {LayerColors.map(color => (
                <option key={`l2-${color}`} value={color}>{formatColorName(color)}</option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="petCount" className="block text-sm font-medium text-gray-300 mb-1">Hit Count</label>
          <input type="number" id="petCount" min="0" value={special.count ?? 0} onChange={e => handlePetSpecialChange('count', parseInt(e.target.value, 10) || 0)} className="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-white focus:ring-teal-500 focus:border-teal-500" />
        </div>

        <div>
          <label htmlFor="iceCount" className="block text-sm font-medium text-gray-300 mb-1">Ice Count</label>
          <input type="number" id="iceCount" min="0" value={special.iceCount} onChange={e => handlePetSpecialChange('iceCount', parseInt(e.target.value) || 0)} className="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-white focus:ring-teal-500 focus:border-teal-500" />
        </div>
        
        <div>
          <label htmlFor="hiddenCount" className="block text-sm font-medium text-gray-300 mb-1">Hidden Count</label>
          <input type="number" id="hiddenCount" min="0" value={special.hiddenCount} onChange={e => handlePetSpecialChange('hiddenCount', parseInt(e.target.value) || 0)} className="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-white focus:ring-teal-500 focus:border-teal-500" />
        </div>

        <div>
          <label htmlFor="timeExplode" className="block text-sm font-medium text-gray-300 mb-1">Time to Explode</label>
          <input type="number" id="timeExplode" min="0" value={special.timeExplode ?? 0} onChange={e => handlePetSpecialChange('timeExplode', parseInt(e.target.value, 10) || 0)} className="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-white focus:ring-teal-500 focus:border-teal-500" />
        </div>

        <div>
          <label htmlFor="keyColor" className="block text-sm font-medium text-gray-300 mb-1">Key Color</label>
          <select 
            id="keyColor"
            value={special.keyLock?.keyColor ?? KeyLockColor.Unk}
            onChange={(e) => handlePetKeyLockChange('keyColor', e.target.value)}
            className="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-white focus:ring-teal-500 focus:border-teal-500"
          >
            {keyLockOptions.map(key => (
              <option key={key} value={KeyLockColor[key as keyof typeof KeyLockColor]}>{key}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="lockColor" className="block text-sm font-medium text-gray-300 mb-1">Lock Color</label>
          <select 
            id="lockColor"
            value={special.keyLock?.lockColor ?? KeyLockColor.Unk}
            onChange={(e) => handlePetKeyLockChange('lockColor', e.target.value)}
            className="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-white focus:ring-teal-500 focus:border-teal-500"
          >
            {keyLockOptions.map(key => (
              <option key={key} value={KeyLockColor[key as keyof typeof KeyLockColor]}>{key}</option>
            ))}
          </select>
        </div>

        <div className="flex items-center justify-between">
           <label htmlFor="hasScissor" className="text-sm font-medium text-gray-300">Has Scissor</label>
           <input type="checkbox" id="hasScissor" checked={special.hasScissor} onChange={e => handlePetSpecialChange('hasScissor', e.target.checked)} className="h-5 w-5 bg-gray-700 border-gray-600 rounded text-teal-500 focus:ring-teal-500" />
        </div>
         <div className="flex items-center justify-between">
           <label htmlFor="isSingleDirection" className="text-sm font-medium text-gray-300">Single Direction</label>
           <input type="checkbox" id="isSingleDirection" checked={special.isSingleDirection} onChange={e => handlePetSpecialChange('isSingleDirection', e.target.checked)} className="h-5 w-5 bg-gray-700 border-gray-600 rounded text-teal-500 focus:ring-teal-500" />
        </div>
      </div>
    );
  };
  
  const renderExitProperties = (exit: Exit) => {
    const special = exit.special;
    
    const handleLayerChange = (layerIndex: 0 | 1, value: string) => {
        const newColor = value === '' ? null : parseInt(value, 10);
        const currentLayers = special.layerColors || [];
        
        let newLayers: (Color | null)[] = [...currentLayers];
        if (newLayers.length <= layerIndex) {
            newLayers.length = layerIndex + 1;
            newLayers.fill(null, currentLayers.length);
        }

        newLayers[layerIndex] = newColor as Color | null;

        if (layerIndex === 0 && newColor === null) {
            newLayers[1] = null;
        }
        
        while (newLayers.length > 0 && newLayers[newLayers.length - 1] === null) {
            newLayers.pop();
        }

        const finalLayers = newLayers.filter(c => c !== null) as Color[];
        handleExitChange('layerColors', finalLayers.length > 0 ? finalLayers : null);
    };

    const layer1Value = (special.layerColors || [])[0] ?? '';
    const layer2Value = (special.layerColors || [])[1] ?? '';
    const isLayer2Disabled = layer1Value === '';

    const formatColorName = (color: Color) => {
        return Color[color] ? Color[color].replace(/([A-Z])/g, ' $1').trim() : 'Unknown';
    }
    
    return (
        <div className="flex flex-col gap-3">
            <h3 className="text-md font-semibold text-white mb-0">Exit Special</h3>
            <div>
              <label htmlFor="exitCount" className="block text-sm font-medium text-gray-300 mb-1">Hit Count</label>
              <input type="number" id="exitCount" min="0" value={special.count ?? 0} onChange={e => handleExitChange('count', parseInt(e.target.value, 10) || 0)} className="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-white focus:ring-teal-500 focus:border-teal-500" />
            </div>
            <div>
              <label htmlFor="exitIceCount" className="block text-sm font-medium text-gray-300 mb-1">Ice Count</label>
              <input type="number" id="exitIceCount" min="0" value={special.iceCount} onChange={e => handleExitChange('iceCount', parseInt(e.target.value, 10) || 0)} className="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-white focus:ring-teal-500 focus:border-teal-500" />
            </div>
            <div>
              <label htmlFor="exitLayer1Color" className="block text-sm font-medium text-gray-300 mb-1">Layer 1 Color</label>
              <select 
                id="exitLayer1Color"
                value={layer1Value}
                onChange={(e) => handleLayerChange(0, e.target.value)}
                className="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-white focus:ring-teal-500 focus:border-teal-500"
              >
                <option value="">None</option>
                {LayerColors.map(color => (
                    <option key={`ex-l1-${color}`} value={color}>{formatColorName(color)}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="exitLayer2Color" className="block text-sm font-medium text-gray-300 mb-1">Layer 2 Color</label>
              <select 
                id="exitLayer2Color"
                value={layer2Value}
                onChange={(e) => handleLayerChange(1, e.target.value)}
                disabled={isLayer2Disabled}
                className="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-white focus:ring-teal-500 focus:border-teal-500 disabled:opacity-50"
              >
                <option value="">None</option>
                {LayerColors.map(color => (
                    <option key={`ex-l2-${color}`} value={color}>{formatColorName(color)}</option>
                ))}
              </select>
            </div>
             <div className="flex items-center justify-between">
               <label htmlFor="exitIsPermanent" className="text-sm font-medium text-gray-300">Is Permanent</label>
               <input type="checkbox" id="exitIsPermanent" checked={special.isPermanent} onChange={e => handleExitChange('isPermanent', e.target.checked)} className="h-5 w-5 bg-gray-700 border-gray-600 rounded text-teal-500 focus:ring-teal-500" />
            </div>
        </div>
    );
  };
  
  const renderCrateProperties = (crate: CrateInfo) => (
    <div>
      <h3 className="text-md font-semibold text-white mb-2">Crate</h3>
      <div>
        <label htmlFor="requiredSnake" className="block text-sm font-medium text-gray-300 mb-1">
          Required Snake
        </label>
        <input
          type="number"
          id="requiredSnake"
          min="0"
          value={crate.requiredSnake}
          onChange={(e) => handleCrateChange('requiredSnake', parseInt(e.target.value, 10) || 0)}
          className="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-white focus:ring-teal-500 focus:border-teal-500"
        />
      </div>
    </div>
  );

  const renderMovableBoxProperties = (box: MovableBox) => (
    <div>
      <h3 className="text-md font-semibold text-white mb-2">Movable Box</h3>
      <div>
        <label htmlFor="boxDirection" className="block text-sm font-medium text-gray-300 mb-1">Direction</label>
        <select
          id="boxDirection"
          value={box.direction}
          onChange={(e) => handleMovableBoxChange('direction', parseInt(e.target.value, 10))}
          className="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-white focus:ring-teal-500 focus:border-teal-500"
        >
          <option value={MovableBoxDirection.None}>None</option>
          <option value={MovableBoxDirection.Vertical}>Vertical</option>
          <option value={MovableBoxDirection.Horizontal}>Horizontal</option>
        </select>
      </div>
    </div>
  );
  
  const renderObstacleProperties = (obstacle: ObstacleInfo) => (
    <div>
      <h3 className="text-md font-semibold text-white mb-2">Obstacle</h3>
      <div className="flex flex-col gap-3">
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">ID</label>
          <p className="text-sm text-gray-400 bg-gray-800 border border-gray-600 rounded-md px-3 py-2">{obstacle.id}</p>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">Positions</label>
          <div className="text-xs text-gray-400 bg-gray-800 border border-gray-600 rounded-md p-2 max-h-24 overflow-y-auto">
            {obstacle.listPositions.map((pos, i) => (
              <span key={i} className="block font-mono">{`{ x: ${pos.x}, y: ${pos.y} }`}</span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );

  const renderTreeRootProperties = (root: TreeRoot) => {
    const directionToString = (dir: {x: number, y: number}) => {
        if (dir.x === 1) return 'Right';
        if (dir.x === -1) return 'Left';
        if (dir.y === 1) return 'Up';
        if (dir.y === -1) return 'Down';
        return 'Right';
    };

    const stringToDirection = (str: string) => {
        if (str === 'Right') return { x: 1, y: 0 };
        if (str === 'Left') return { x: -1, y: 0 };
        if (str === 'Up') return { x: 0, y: 1 };
        if (str === 'Down') return { x: 0, y: -1 };
        return { x: 1, y: 0 };
    };

    return (
        <div>
            <h3 className="text-md font-semibold text-white mb-2">Tree Root</h3>
            <div className="flex flex-col gap-3">
                <div>
                    <label htmlFor="treeRootLength" className="block text-sm font-medium text-gray-300 mb-1">Length</label>
                    <input
                        type="number"
                        id="treeRootLength"
                        min="1"
                        value={root.length}
                        onChange={(e) => handleTreeRootChange('length', parseInt(e.target.value, 10) || 1)}
                        className="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-white focus:ring-teal-500 focus:border-teal-500"
                    />
                </div>
                <div>
                    <label htmlFor="treeRootDirection" className="block text-sm font-medium text-gray-300 mb-1">Direction</label>
                    <select
                        id="treeRootDirection"
                        value={directionToString(root.direction)}
                        onChange={(e) => handleTreeRootChange('direction', stringToDirection(e.target.value))}
                        className="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-white focus:ring-teal-500 focus:border-teal-500"
                    >
                        <option>Right</option>
                        <option>Left</option>
                        <option>Up</option>
                        <option>Down</option>
                    </select>
                </div>
            </div>
        </div>
    );
  };

  const renderProperties = () => {
      switch (selectedObjectData.type) {
          case 'stone': return renderStoneWallProperties(selectedObjectData);
          case 'pet': return renderPetProperties(selectedObjectData);
          case 'exit': return renderExitProperties(selectedObjectData);
          case 'crate': return renderCrateProperties(selectedObjectData);
          case 'movable_box': return renderMovableBoxProperties(selectedObjectData);
          case 'obstacle': return renderObstacleProperties(selectedObjectData);
          case 'tree_root': return renderTreeRootProperties(selectedObjectData);
          default: return null;
      }
  };

  return (
    <div className="mt-4 pt-4 border-t border-gray-700">
      <h2 className="text-lg font-semibold text-white mb-3">Properties</h2>
      {renderProperties()}
    </div>
  );
};
