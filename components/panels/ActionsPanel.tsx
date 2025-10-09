import React from 'react';

interface ActionsPanelProps {
  isSolving: boolean;
  guideSolver: boolean;
  hasRecordedSolution: boolean;
  onGuideSolverChange: (checked: boolean) => void;
  onLoadClick: () => void;
  onSaveUnityAsset: () => void;
  onSolveLevel: () => void;
  fileInputRef: React.RefObject<HTMLInputElement>;
  onFileLoad: (event: React.ChangeEvent<HTMLInputElement>) => void;
}

export const ActionsPanel: React.FC<ActionsPanelProps> = ({ 
  isSolving, guideSolver, hasRecordedSolution, onGuideSolverChange,
  onLoadClick, onSaveUnityAsset, onSolveLevel, fileInputRef, onFileLoad 
}) => {
  return (
    <div>
      <h2 className="text-lg font-semibold text-white mb-3">Actions</h2>
      <div className="flex flex-col gap-2">
        <button 
          onClick={onLoadClick} 
          disabled={isSolving}
          className="w-full px-4 py-3 bg-blue-600 hover:bg-blue-500 rounded-lg font-bold text-white transition-all transform hover:scale-105 disabled:bg-gray-500 disabled:cursor-not-allowed disabled:transform-none"
        >
          Load Level...
        </button>
        <input type="file" ref={fileInputRef} onChange={onFileLoad} className="hidden" accept=".json,.yaml,.yml,.asset" />
        <button 
          onClick={onSaveUnityAsset} 
          disabled={isSolving}
          className="w-full px-4 py-3 bg-teal-600 hover:bg-teal-500 rounded-lg font-bold text-white transition-all transform hover:scale-105 disabled:bg-gray-500 disabled:cursor-not-allowed disabled:transform-none"
        >
          Save Unity Asset
        </button>
        <button
          onClick={onSolveLevel}
          disabled={isSolving}
          className={`w-full px-4 py-3 rounded-lg font-bold text-white transition-all transform hover:scale-105 disabled:cursor-not-allowed disabled:transform-none ${
            isSolving ? 'bg-yellow-700 animate-pulse' : 'bg-yellow-600 hover:bg-yellow-500'
          }`}
        >
          {isSolving ? 'Solving...' : 'Solve Level'}
        </button>

        <div className="flex items-center justify-start gap-2 mt-3 pt-3 border-t border-gray-700">
          <input
            type="checkbox"
            id="guideSolver"
            checked={guideSolver}
            onChange={(e) => onGuideSolverChange(e.target.checked)}
            disabled={!hasRecordedSolution || isSolving}
            className="h-5 w-5 bg-gray-700 border-gray-600 rounded text-teal-500 focus:ring-teal-500 disabled:opacity-50 disabled:cursor-not-allowed"
            aria-describedby="guideSolverDescription"
          />
          <div>
            <label htmlFor="guideSolver" className={`text-sm font-medium ${!hasRecordedSolution || isSolving ? 'text-gray-500' : 'text-gray-300'}`}>
              Learn from my recording
            </label>
            <p id="guideSolverDescription" className="text-xs text-gray-400">
              Guides the solver with your recorded path.
            </p>
          </div>
        </div>

      </div>
    </div>
  );
};