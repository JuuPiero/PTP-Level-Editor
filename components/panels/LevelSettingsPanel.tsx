import React from 'react';
import type { Level } from '../../types/level';
import { LevelTheme } from '../../types/level';

interface LevelSettingsPanelProps {
  level: Level;
  onLevelChange: (newLevel: Level) => void;
  onSizeChange: (newWidth: number, newHeight: number) => void;
  isSolutionPlaying: boolean;
  solutionPlaybackIndex: number;
  onPlaySolution: () => void;
  onStopSolution: () => void;
}

export const LevelSettingsPanel: React.FC<LevelSettingsPanelProps> = ({ 
  level, onLevelChange, onSizeChange, isSolutionPlaying, solutionPlaybackIndex, onPlaySolution, onStopSolution 
}) => {
  
  const handleLevelNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newLevelNumber = parseInt(e.target.value, 10) || 1;
    onLevelChange({ ...level, level: newLevelNumber, levelName: `Level_${newLevelNumber}` });
  };
  
  const handleGenericChange = (prop: keyof Level, value: any) => {
    onLevelChange({ ...level, [prop]: value });
  };

  const handleClearSolution = () => {
    onLevelChange({ ...level, solution: [] });
  };

  return (
    <div>
      <h2 className="text-lg font-semibold text-white mb-3">Level Settings</h2>
      <div className="flex flex-col gap-3">
        <div>
          <label htmlFor="levelName" className="block text-sm font-medium text-gray-300 mb-1">Level Name</label>
          <input type="text" id="levelName" value={level.levelName} readOnly className="w-full bg-gray-800 border border-gray-600 rounded-md px-3 py-2 text-gray-400 focus:ring-teal-500 focus:border-teal-500 cursor-default" />
        </div>
        <div>
          <label htmlFor="levelNumber" className="block text-sm font-medium text-gray-300 mb-1">Level Number</label>
          <input type="number" id="levelNumber" min="1" value={level.level} onChange={handleLevelNumberChange} className="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-white focus:ring-teal-500 focus:border-teal-500" />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label htmlFor="width" className="block text-sm font-medium text-gray-300 mb-1">Width</label>
            <input type="number" id="width" min="3" max="30" value={level.gridData.width} onChange={(e) => onSizeChange(parseInt(e.target.value, 10) || level.gridData.width, level.gridData.height)} className="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-white focus:ring-teal-500 focus:border-teal-500" />
          </div>
          <div>
            <label htmlFor="height" className="block text-sm font-medium text-gray-300 mb-1">Height</label>
            <input type="number" id="height" min="3" max="30" value={level.gridData.height} onChange={(e) => onSizeChange(level.gridData.width, parseInt(e.target.value, 10) || level.gridData.height)} className="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-white focus:ring-teal-500 focus:border-teal-500" />
          </div>
        </div>
        <div>
          <label htmlFor="time" className="block text-sm font-medium text-gray-300 mb-1">Time (seconds)</label>
          <input type="number" id="time" min="0" value={level.time} onChange={(e) => handleGenericChange('time', parseInt(e.target.value, 10) || 0)} className="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-white focus:ring-teal-500 focus:border-teal-500" />
        </div>
        <div>
          <label htmlFor="levelDifficulty" className="block text-sm font-medium text-gray-300 mb-1">Difficulty</label>
          <select
            id="levelDifficulty"
            value={level.levelDifficulty}
            onChange={(e) => handleGenericChange('levelDifficulty', parseInt(e.target.value, 10) || 0)}
            className="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-white focus:ring-teal-500 focus:border-teal-500"
          >
            <option value="0">Easy</option>
            <option value="1">Medium</option>
            <option value="2">Hard</option>
            <option value="3">Very Hard</option>
            <option value="4">Insane</option>
          </select>
        </div>
      </div>

      <div className="mt-4 pt-4 border-t border-gray-700">
        <h3 className="text-md font-semibold text-white mb-2">Visual Theme</h3>
        <div className="flex flex-col gap-2">
            {Object.values(LevelTheme).map(theme => (
                <button
                    key={theme}
                    onClick={() => handleGenericChange('theme', theme)}
                    className={`px-4 py-2 rounded-lg font-bold text-white transition-all transform hover:scale-105 ${level.theme === theme ? 'bg-teal-600 ring-2 ring-white' : 'bg-gray-700 hover:bg-gray-600'}`}
                >
                    {theme}
                </button>
            ))}
        </div>
      </div>

      <div className="mt-4 pt-4 border-t border-gray-700">
        <div className="flex justify-between items-center mb-2">
            <h3 className="text-md font-semibold text-white">Solution</h3>
            <div className="flex gap-2">
              {level.solution && level.solution.length > 0 && !isSolutionPlaying && (
                <button onClick={onPlaySolution} className="px-3 py-1 text-sm bg-green-600 hover:bg-green-500 rounded-md font-bold text-white transition-colors">Play</button>
              )}
               {isSolutionPlaying && (
                <button onClick={onStopSolution} className="px-3 py-1 text-sm bg-yellow-600 hover:bg-yellow-500 rounded-md font-bold text-white transition-colors">Stop</button>
              )}
              {level.solution && level.solution.length > 0 && (
                  <button onClick={handleClearSolution} disabled={isSolutionPlaying} className="px-3 py-1 text-sm bg-red-700 hover:bg-red-600 rounded-md font-bold text-white transition-colors disabled:bg-gray-500">Clear</button>
              )}
            </div>
        </div>
        {level.solution && level.solution.length > 0 ? (
            <>
              <p className="text-sm text-gray-300 mb-2">{level.solution.length} steps recorded.</p>
              <div
                className="w-full h-24 bg-gray-800 border border-gray-600 rounded-md p-2 text-xs text-gray-400 font-mono resize-none overflow-y-auto"
                aria-label="Recorded solution steps"
              >
                {level.solution.map((step, index) => (
                  <div key={index} className={`whitespace-nowrap overflow-hidden text-ellipsis transition-colors duration-150 ${index === solutionPlaybackIndex && isSolutionPlaying ? 'bg-teal-500/30 rounded -mx-1 px-1 text-white' : ''}`}>
                      {step}
                  </div>
                ))}
              </div>
            </>
        ) : (
            <p className="text-sm text-gray-400">No solution recorded.</p>
        )}
      </div>

    </div>
  );
};