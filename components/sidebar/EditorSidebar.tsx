
import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react'; 
import type { Level, SelectedObject, EditorTool, DrawingState } from '../../types/level';
import { Color } from '../../types/colors';
import { ToolPanel } from '../panels/ToolPanel';
import { ColorPickerPanel } from '../panels/ColorPickerPanel';
import { LevelSettingsPanel } from '../panels/LevelSettingsPanel';
import { ActionsPanel } from '../panels/ActionsPanel';
import { PropertiesPanel } from '../PropertiesPanel';
import { useSelectedObjectData } from '../../hooks/useSelectedObjectData';
import { AiMechanicCoderPanel } from '../panels/AiMechanicCoderPanel';
import { LevelStatsPanel } from '../panels/LevelStatsPanel';

// Small reusable hook
function useClickOutside(ref: React.RefObject<HTMLElement>, onClickOutside: () => void) {
  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        onClickOutside();
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [ref, onClickOutside]);
}

interface EditorSidebarProps {
  level: Level;
  mode: 'edit' | 'play';
  selectedTool: EditorTool;
  selectedColor: Color;
  selectedObject: SelectedObject | null;
  drawingState: DrawingState;
  isSolving: boolean;
  isSolutionPlaying: boolean;
  solutionPlaybackIndex: number;
  fileInputRef: React.RefObject<HTMLInputElement>;
  guideSolver: boolean;
  onGuideSolverChange: (checked: boolean) => void;
  hasRecordedSolution: boolean;
  onLevelChange: (newLevel: Level) => void;
  onToolChange: (tool: EditorTool) => void;
  onColorChange: (color: Color) => void;
  onSizeChange: (width: number, height: number) => void;
  onLoadClick: () => void;
  onFileLoad: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onSaveUnityAsset: () => void;
  onSolveLevel: () => void;
  onPlaySolution: () => void;
  onStopSolution: () => void;
  onDrawingStateChange: (newState: DrawingState) => void;
}

const GameRulesPanel: React.FC = () => {
    const [isExpanded, setIsExpanded] = useState(false);

    return (
        <div className="mt-4 pt-4 border-t border-gray-700">
            <h2 
                className="text-lg font-semibold text-white mb-3 flex justify-between items-center cursor-pointer"
                onClick={() => setIsExpanded(!isExpanded)}
                aria-expanded={isExpanded}
                aria-controls="game-rules-content"
            >
                <span>Game Rules</span>
                <svg xmlns="http://www.w3.org/2000/svg" className={`h-5 w-5 transition-transform transform ${isExpanded ? 'rotate-180' : ''}`} viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
            </h2>
            {isExpanded && (
                <div 
                    id="game-rules-content" 
                    className="text-sm text-gray-300 bg-gray-900/50 p-3 rounded-md border border-gray-700 space-y-3"
                >
                    <div>
                        <h3 className="font-bold text-teal-400">Objective</h3>
                        <p>Guide all pets to an exit of the matching color.</p>
                    </div>
                    <div>
                        <h3 className="font-bold text-teal-400">Core Mechanics</h3>
                        <ul className="list-disc list-inside space-y-1 pl-2">
                            <li><strong className="text-white">Movement:</strong> Drag a pet from its head or tail. Pets cannot move through walls, obstacles, or other pets.</li>
                            <li><strong className="text-white">Colored Paths:</strong> Pets can only travel on colored paths that match their own color.</li>
                            <li><strong className="text-white">Solving:</strong> A pet is "solved" when it enters a valid exit. This triggers various effects.</li>
                        </ul>
                    </div>
                    <div>
                        <h3 className="font-bold text-teal-400">Special Objects & Rules</h3>
                        <ul className="list-disc list-inside space-y-1 pl-2">
                            <li><strong className="text-white">Exits:</strong> May have multiple layers of color or require a certain number of pets to enter before disappearing. Permanent exits never disappear.</li>
                            <li><strong className="text-white">Stone Walls:</strong> Are destroyed after a set number of pets are solved.</li>
                             <li><strong className="text-white">Movable Boxes:</strong> Can be pushed by the player to clear or block paths.</li>
                            <li><strong className="text-white">Color Walls:</strong> Disappear only when the very last pet of that color is solved.</li>
                            <li><strong className="text-white">Ice/Leaves:</strong> Freezes an object. One layer melts each time any pet is solved.</li>
                            <li><strong className="text-white">Keys & Locks:</strong> A pet with a key unlocks all pets with a matching lock color when solved.</li>
                            <li><strong className="text-white">Scissors:</strong> A pet with scissors will cut the ribbon when solved.</li>
                            <li><strong className="text-white">Single Direction:</strong> These pets can only be moved from their head.</li>
                            <li><strong className="text-white">Hidden Pets:</strong> Emerge after a specific number of other pets are solved.</li>
                            <li><strong className="text-white">Bomb Pets:</strong> Explodes when solved, destroying any adjacent breakable objects (like Stones or Crates).</li>
                        </ul>
                    </div>
                </div>
            )}
        </div>
    );
};

export const EditorSidebar: React.FC<EditorSidebarProps> = ({
  level,
  mode,
  selectedTool,
  selectedColor,
  selectedObject,
  drawingState,
  isSolving,
  isSolutionPlaying,
  solutionPlaybackIndex,
  fileInputRef,
  guideSolver,
  onGuideSolverChange,
  hasRecordedSolution,
  onLevelChange,
  onToolChange,
  onColorChange,
  onSizeChange,
  onLoadClick,
  onFileLoad,
  onSaveUnityAsset,
  onSolveLevel,
  onPlaySolution,
  onStopSolution,
  onDrawingStateChange
}) => {
  const [isColorPickerOpen, setIsColorPickerOpen] = useState(false);
  const colorPickerRef = useRef<HTMLDivElement>(null);
  
  const selectedObjectData = useSelectedObjectData(level, selectedObject);

  const { totalPets, totalHoles } = useMemo(() => {
    let petCount = 0;
    let holeCount = 0;

    level.pets.forEach(pet => {
      petCount += 1; // Count the base pet
      if (pet.special.layerColors) {
        petCount += pet.special.layerColors.length; // Add layers
      }
    });

    level.exits.forEach(exit => {
      holeCount += 1; // Count the base exit/hole
      if (exit.special.layerColors) {
        holeCount += exit.special.layerColors.length; // Add layers
      }
    });

    return { totalPets: petCount, totalHoles: holeCount };
  }, [level.pets, level.exits]);

  useClickOutside(colorPickerRef, () => setIsColorPickerOpen(false));

  const handleColorSelect = useCallback((color: Color) => {
    onColorChange(color);
    setIsColorPickerOpen(false);
  }, [onColorChange]);

  const handleFinishDrawing = useCallback(() => {
    onDrawingStateChange({ type: 'pet', id: null });
  }, [onDrawingStateChange]);

  return (
    <aside className="w-80 bg-gray-800/50 p-4 rounded-lg border border-gray-700 flex flex-col gap-6 overflow-y-auto">
      <ToolPanel
        selectedTool={selectedTool}
        isDrawing={drawingState.id !== null}
        onToolChange={onToolChange}
        onFinishDrawing={handleFinishDrawing}
      />

      <LevelStatsPanel totalPets={totalPets} totalHoles={totalHoles} />

      <ColorPickerPanel
        selectedTool={selectedTool}
        selectedColor={selectedColor}
        selectedObjectData={selectedObjectData}
        isOpen={isColorPickerOpen}
        setIsOpen={setIsColorPickerOpen}
        onColorChange={handleColorSelect}
        ref={colorPickerRef}
      />

      {mode === 'edit' && (
        <>
          <LevelSettingsPanel
            level={level}
            onLevelChange={onLevelChange}
            onSizeChange={onSizeChange}
            isSolutionPlaying={isSolutionPlaying}
            solutionPlaybackIndex={solutionPlaybackIndex}
            onPlaySolution={onPlaySolution}
            onStopSolution={onStopSolution}
          />
          <ActionsPanel
            isSolving={isSolving}
            guideSolver={guideSolver}
            hasRecordedSolution={hasRecordedSolution}
            onGuideSolverChange={onGuideSolverChange}
            onLoadClick={onLoadClick}
            onSaveUnityAsset={onSaveUnityAsset}
            onSolveLevel={onSolveLevel}
            fileInputRef={fileInputRef}
            onFileLoad={onFileLoad}
          />
          <AiMechanicCoderPanel />
          <GameRulesPanel />
        </>
      )}

      <PropertiesPanel
        selectedObjectData={selectedObjectData}
        level={level}
        onLevelChange={onLevelChange}
      />
    </aside>
  );
};
