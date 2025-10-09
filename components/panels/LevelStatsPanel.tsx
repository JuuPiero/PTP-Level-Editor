
import React from 'react';

interface LevelStatsPanelProps {
  totalPets: number;
  totalHoles: number;
}

export const LevelStatsPanel: React.FC<LevelStatsPanelProps> = ({ totalPets, totalHoles }) => {
  return (
    <div>
      <h2 className="text-lg font-semibold text-white mb-3">Level Stats</h2>
      <div className="grid grid-cols-2 gap-2 text-center bg-gray-900/50 p-3 rounded-lg border border-gray-700">
        <div>
          <p className="text-sm text-gray-400">Total Pets</p>
          <p className="text-2xl font-bold text-teal-400" aria-label={`Total pets: ${totalPets}`}>{totalPets}</p>
        </div>
        <div>
          <p className="text-sm text-gray-400">Total Holes</p>
          <p className="text-2xl font-bold text-violet-400" aria-label={`Total holes: ${totalHoles}`}>{totalHoles}</p>
        </div>
      </div>
    </div>
  );
};
