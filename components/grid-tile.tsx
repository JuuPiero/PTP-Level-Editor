

import React from 'react';

interface GridTileProps {
  x: number;
  y: number;
  gridWidth: number;
  gridHeight: number;
  isWall: boolean;
  isSelected: boolean;
  onMouseDown: () => void;
}

export const GridTile: React.FC<GridTileProps> = ({ x, y, gridWidth, gridHeight, isWall, isSelected, onMouseDown }) => {
  const style: React.CSSProperties = {
    gridColumn: x + 1,
    gridRow: gridHeight - y,
    zIndex: 1,
  };

  const className = `
    border border-black/20 box-border
    ${isWall 
      ? 'bg-black cursor-not-allowed' 
      : 'bg-gray-800 transition-colors hover:bg-gray-700'
    }
    ${isSelected ? '!bg-teal-500/40 border-teal-400' : ''}
  `;

  return (
    <div
      onMouseDown={onMouseDown}
      className={className}
      style={style}
    />
  );
};
