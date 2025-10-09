
import React from 'react';

interface LevelSolvedModalProps {
  onReset: () => void;
  onSaveAndEdit: () => void;
}

export const LevelSolvedModal: React.FC<LevelSolvedModalProps> = ({ onReset, onSaveAndEdit }) => {
  return (
    <div className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center z-50 text-white">
      <h2 className="text-5xl font-bold text-yellow-400 mb-4">Level Solved!</h2>
      <div className="flex gap-4">
        <button onClick={onReset} className="px-6 py-3 rounded-lg font-bold bg-blue-600 hover:bg-blue-500 transition-transform transform hover:scale-105">Reset & Play Again</button>
        <button onClick={onSaveAndEdit} className="px-6 py-3 rounded-lg font-bold bg-teal-600 hover:bg-teal-500 transition-transform transform hover:scale-105">Save Progress & Edit</button>
      </div>
    </div>
  );
};
