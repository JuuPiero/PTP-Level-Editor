import yaml from 'js-yaml';
import type { Level, Pet, CrateInfo, MovableBox, PetSpecialInfo, ExitSpecialInfo, Coordinates } from '../types/level';
import { Color } from '../types/colors';
import { createDefaultLevel } from './levelUtils';
import { LevelTheme } from '../types/level';

export const triggerDownload = (filename: string, content: string, mimeType: string) => {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  
  setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
  }, 100);
};

const formatLayerColors = (colors: Color[] | null): string | null => {
  if (!colors || colors.length === 0) return null;
  return colors.map(c => c.toString(16).padStart(2, '0').padEnd(8, '0')).join('');
};

export const generateUnityAssetContent = (level: Level): string => {
    const levelToSave = structuredClone(level);
    
    const formatCoords = (c: Coordinates) => `{x: ${c.x}, y: ${c.y}}`;

    const lines: string[] = [];

    // Header
    lines.push(`%YAML 1.1`, `%TAG !u! tag:unity3d.com,2011:`, `--- !u!114 &11400000`);
    lines.push(`MonoBehaviour:`);
    lines.push(`  m_ObjectHideFlags: 0`, `  m_CorrespondingSourceObject: {fileID: 0}`, `  m_PrefabInstance: {fileID: 0}`, `  m_PrefabAsset: {fileID: 0}`);
    lines.push(`  m_GameObject: {fileID: 0}`, `  m_Enabled: 1`, `  m_EditorHideFlags: 0`, `  m_Script: {fileID: 11500000, guid: dda3f1ef032d9a3458c0a85fc2dcc90c, type: 3}`);
    lines.push(`  m_Name: ${levelToSave.levelName}`, `  m_EditorClassIdentifier: `);
    
    // Top-level properties
    lines.push(`  level: ${levelToSave.level}`, `  time: ${levelToSave.time}`, `  isHardLevel: ${levelToSave.isHardLevel ? 1 : 0}`);
    if (levelToSave.theme && levelToSave.theme !== LevelTheme.Classic) {
      lines.push(`  theme: ${levelToSave.theme}`);
    }

    // Solution
    if (levelToSave.solution?.length > 0) {
        lines.push(`  solution:`);
        levelToSave.solution.forEach(s => lines.push(`  - ${s}`));
    } else {
        lines.push(`  solution: []`);
    }

    // Pets
    if (levelToSave.pets?.length > 0) {
        lines.push(`  pets: `);
        levelToSave.pets.forEach(p => {
            lines.push(`  - headPos: ${formatCoords(p.headPos)}`);
            lines.push(`    positions: `);
            p.positions?.forEach(pos => lines.push(`    - ${formatCoords(pos)}`));
            lines.push(`    color: ${p.color}`);
            lines.push(`    special:`);
            const layerColorsValue = p.special.rawLayerColors ?? formatLayerColors(p.special.layerColors);
            lines.push(`      layerColors: ${layerColorsValue ?? ''}`);
            lines.push(`      iceCount: ${p.special.iceCount}`);
            lines.push(`      hiddenCount: ${p.special.hiddenCount}`);
            if (p.special.count && p.special.count > 0) {
              lines.push(`      count: ${p.special.count}`);
            }
            const keyLock = p.special.keyLock || { keyColor: -1, lockColor: -1 };
            lines.push(`      keyLock:`);
            lines.push(`        keyColor: ${keyLock.keyColor}`);
            lines.push(`        lockColor: ${keyLock.lockColor}`);
            lines.push(`      hasScissor: ${p.special.hasScissor ? 1 : 0}`);
            lines.push(`      isSingleDirection: ${p.special.isSingleDirection ? 1 : 0}`);
            lines.push(`      timeExplode: ${p.special.timeExplode ?? 0}`);
        });
    } else {
        lines.push(`  pets: []`);
    }

    // GridData
    lines.push(`  gridData:`);
    lines.push(`    width: ${levelToSave.gridData.width}`);
    lines.push(`    height: ${levelToSave.gridData.height}`);
    lines.push(`    strGrid: `);
    levelToSave.gridData.strGrid?.forEach(row => lines.push(`    - ${row}`));
    
    // Exits
    if (levelToSave.exits?.length > 0) {
        lines.push(`  exits: `);
        levelToSave.exits.forEach(e => {
            lines.push(`  - position: ${formatCoords(e.position)}`);
            lines.push(`    color: ${e.color}`);
            lines.push(`    special:`);
            const layerColorsValue = e.special.rawLayerColors ?? formatLayerColors(e.special.layerColors);
            if (e.special?.count && e.special.count > 0) {
              lines.push(`      count: ${e.special.count}`);
            }
            lines.push(`      iceCount: ${e.special?.iceCount || 0}`);
            lines.push(`      layerColors: ${layerColorsValue ?? ''}`);
            lines.push(`      isPermanent: ${e.special?.isPermanent ? 1 : 0}`);
        });
    } else {
        lines.push(`  exits: []`);
    }

    // StoneWalls
    if (levelToSave.stoneWalls?.length > 0) {
        lines.push(`  stoneWalls: `);
        levelToSave.stoneWalls.forEach(sw => {
          lines.push(`  - position: ${formatCoords(sw.position)}`);
          lines.push(`    count: ${sw.count}`);
        });
    } else {
        lines.push(`  stoneWalls: []`);
    }

    // ColoredPaths
    if (levelToSave.coloredPaths?.length > 0) {
        lines.push(`  coloredPaths: `);
        levelToSave.coloredPaths.forEach(cp => {
          lines.push(`  - position: ${formatCoords(cp.position)}`);
          lines.push(`    color: ${cp.color}`);
        });
    } else {
        lines.push(`  coloredPaths: []`);
    }
    
    // ColorWalls
    if (levelToSave.colorWalls?.length > 0) {
        lines.push(`  colorWalls: `);
        levelToSave.colorWalls.forEach(cw => {
          lines.push(`  - position: ${formatCoords(cw.position)}`);
          lines.push(`    color: ${cw.color}`);
        });
    } else {
        lines.push(`  colorWalls: []`);
    }

    // CrateInfos
    if (levelToSave.crateInfos?.length > 0) {
        lines.push(`  crateInfos: `);
        levelToSave.crateInfos.forEach(c => {
            lines.push(`  - listPositions: `);
            c.listPositions?.forEach(pos => lines.push(`    - ${formatCoords(pos)}`));
            lines.push(`    id: ${c.id}`);
            lines.push(`    requiredSnake: ${c.requiredSnake}`);
        });
    } else {
        lines.push(`  crateInfos: []`);
    }

    // RibbonInfo
    lines.push(`  ribbonInfo:`);
    if (levelToSave.ribbonInfo?.listPositions?.length > 0) {
        lines.push(`    listPositions: `);
        levelToSave.ribbonInfo.listPositions.forEach(pos => lines.push(`    - ${formatCoords(pos)}`));
    } else {
        lines.push(`    listPositions: []`);
    }

    // MovableBoxes
    if (levelToSave.movableBoxes?.length > 0) {
        lines.push(`  movableBoxes: `);
        levelToSave.movableBoxes.forEach(box => {
            lines.push(`  - points: `);
            box.listPositions?.forEach(pos => lines.push(`    - ${formatCoords(pos)}`));
            lines.push(`    direction: ${box.direction}`);
        });
    } else {
        lines.push(`  movableBoxes: []`);
    }

    // ObstacleInfos
    if (levelToSave.obstacleInfos?.length > 0) {
        lines.push(`  obstacleInfos: `);
        levelToSave.obstacleInfos.forEach(o => {
            lines.push(`  - listPositions: `);
            o.listPositions?.forEach(pos => lines.push(`    - ${formatCoords(pos)}`));
        });
    }

    // TreeRoots
    if (levelToSave.treeRoots?.length > 0) {
        lines.push(`  treeRoots: `);
        levelToSave.treeRoots.forEach(root => {
            lines.push(`  - position: ${formatCoords(root.position)}`);
            lines.push(`    direction: ${formatCoords(root.direction)}`);
            lines.push(`    length: ${root.length}`);
        });
    } else {
        lines.push(`  treeRoots: []`);
    }

    // Final properties
    lines.push(`  levelDifficulty: ${levelToSave.levelDifficulty}`);
    lines.push(`  levelName: ${levelToSave.levelName}`);
    return lines.join('\n') + '\n';
};

const parseLayerColorsFromAsset = (rawLayerColors: string | number | undefined | null): Color[] | null => {
    if (rawLayerColors === null || rawLayerColors === undefined) return null;
    
    const layerString = rawLayerColors.toString();
    if (layerString === "") return null;

    // Handle potential single number case (from JSON or parsing quirks like `layerColors: 0`)
    if (layerString.length < 8 && /^\d+$/.test(layerString)) {
        const colorVal = parseInt(layerString, 10);
        if (!isNaN(colorVal)) return [colorVal];
    }
    
    // Handle standard 8-char chunk hex string from .asset files
    const colors: Color[] = [];
    if (layerString.length > 0 && layerString.length % 8 === 0) {
        for (let i = 0; i < layerString.length; i += 8) {
            const chunk = layerString.substring(i, i + 8);
            // A chunk must have at least 2 chars for the hex code.
            if (chunk.length < 2) continue;
            const colorVal = parseInt(chunk.substring(0, 2), 16);
            if (!isNaN(colorVal)) {
                colors.push(colorVal);
            }
        }
    }

    // Return the parsed colors exactly, or null if no valid colors were found.
    return colors.length > 0 ? colors : null;
};

export const parseLevelFile = (file: File): Promise<{ loadedLevel: Level; newNextId: { pet: number, crate: number, movableBox: number, obstacle: number, treeRoot: number } }> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const text = e.target?.result;
                if (typeof text !== 'string') throw new Error("File content is not text.");
                
                const isAssetFile = file.name.endsWith('.asset');
                let loadedData: any;

                if (isAssetFile) {
                    const cleanedText = text.replace(/--- !u!\d+ &(\d+)/g, '---');
                    // This regex finds any `layerColors:` field that is empty on its line and adds `""` to make it valid YAML.
                    // This is followed by a regex that wraps any non-quoted layer color values in quotes.
                    let processedText = cleanedText
                        .replace(/(^\s*layerColors:)\s*$/gm, '$1 ""') 
                        .replace(/(layerColors:\s*)(?!")(\S+)/g, '$1"$2"');

                    const documents = yaml.loadAll(processedText, undefined, { schema: yaml.JSON_SCHEMA }) as any[];
                    loadedData = documents.find(doc => doc?.MonoBehaviour?.gridData)?.MonoBehaviour;
                    if (!loadedData) throw new Error("Could not find LevelSO data in the .asset file.");
                } else if (file.name.endsWith('.yaml') || file.name.endsWith('.yml')) {
                    loadedData = yaml.load(text, { schema: yaml.JSON_SCHEMA });
                } else {
                    loadedData = JSON.parse(text);
                }
                
                if (typeof loadedData !== 'object' || loadedData === null) throw new Error("Parsed data is not an object.");
                
                const data: Level = { ...createDefaultLevel(loadedData.gridData?.width || 8, loadedData.gridData?.height || 10), ...loadedData };
                if (!data.gridData || !Array.isArray(data.pets) || !Array.isArray(data.exits)) throw new Error('Invalid level file format.');

                data.theme = loadedData.theme || LevelTheme.Classic;
                data.levelDifficulty = data.levelDifficulty ?? (data.isHardLevel ? 3 : 0);
                
                let maxPetId = 0, maxCrateId = 0, maxBoxId = 0, maxObstacleId = 0, maxTreeRootId = 0;
                const defaultPetSpecial: PetSpecialInfo = { layerColors: null, iceCount: 0, hiddenCount: 0, keyLock: null, hasScissor: false, isSingleDirection: false, count: 0, timeExplode: 0 };
                const defaultExitSpecial: ExitSpecialInfo = { count: 0, iceCount: 0, layerColors: null, isPermanent: false };

                const originalPets = Array.isArray(data.pets) ? data.pets : [];
                data.pets = []; // Start with a clean slate

                originalPets.forEach((p: any, i: number) => {
                    p.id = p.id ?? (i + 1);
                    p.editorName = String.fromCharCode(65 + i);
                    p.special = { ...defaultPetSpecial, ...(p.special || {}) };
                    
                    // Sanitize positions array, filtering out any invalid entries.
                    p.positions = (Array.isArray(p.positions) ? p.positions : [])
                        .filter((pos: any) => pos && typeof pos.x === 'number' && typeof pos.y === 'number');

                    // If, after sanitizing, the pet has no valid positions, discard it.
                    if (p.positions.length === 0) {
                        return; // Skip this pet
                    }

                    // Enforce consistency: the head is always the first body segment.
                    p.headPos = p.positions[0];

                    const rawLayerColors = p.special.layerColors;
                    if (isAssetFile) {
                        p.special.rawLayerColors = rawLayerColors;
                        p.special.layerColors = parseLayerColorsFromAsset(rawLayerColors);
                    }
                    maxPetId = Math.max(maxPetId, p.id);
                    data.pets.push(p); // Add the validated pet back to the level
                });


                data.exits.forEach((e: any) => {
                    e.special = { ...defaultExitSpecial, ...(e.special || {}) };
                    e.special.isPermanent = !!e.special.isPermanent && e.special.isPermanent !== 0; // Sanitize to boolean
                    const rawLayerColors = e.special.layerColors;
                    if (isAssetFile) {
                        e.special.rawLayerColors = rawLayerColors;
                        e.special.layerColors = parseLayerColorsFromAsset(rawLayerColors);
                    }
                });
                
                data.stoneWalls = data.stoneWalls || [];
                data.stoneWalls.forEach((sw: any) => {
                    sw.iceCount = sw.iceCount ?? 0;
                });

                data.crateInfos = data.crateInfos || [];
                data.crateInfos.forEach((c: any, i: number) => {
                    c.id = c.id ?? (i + 1);
                    maxCrateId = Math.max(maxCrateId, c.id);
                });

                data.ribbonInfo = data.ribbonInfo || { listPositions: [] };
                
                data.movableBoxes = data.movableBoxes || [];
                data.movableBoxes.forEach((b: any, i: number) => {
                    b.id = b.id ?? (i + 1);
                    b.listPositions = b.points || b.offsetPoints || b.listPositions;
                    delete b.points;
                    delete b.offsetPoints;
                    maxBoxId = Math.max(maxBoxId, b.id);
                });

                data.obstacleInfos = data.obstacleInfos || [];
                data.obstacleInfos.forEach((o: any, i: number) => {
                    o.id = o.id ?? (i + 1);
                    maxObstacleId = Math.max(maxObstacleId, o.id);
                });
                
                data.treeRoots = data.treeRoots || [];
                data.treeRoots.forEach((r: any, i: number) => {
                    r.id = r.id ?? (i + 1);
                    maxTreeRootId = Math.max(maxTreeRootId, r.id);
                });


                data.levelName = `Level_${data.level}`;
                
                resolve({
                    loadedLevel: data,
                    newNextId: { pet: maxPetId + 1, crate: maxCrateId + 1, movableBox: maxBoxId + 1, obstacle: maxObstacleId + 1, treeRoot: maxTreeRootId + 1 },
                });

            } catch (error) {
                reject(error);
            }
        };
        reader.onerror = (error) => reject(error);
        reader.readAsText(file);
    });
};
