import React from 'react';
import type { EditorTool } from '../../types/level';

interface ToolPanelProps {
  selectedTool: EditorTool;
  isDrawing: boolean;
  onToolChange: (tool: EditorTool) => void;
  onFinishDrawing: () => void;
}

const tools: EditorTool[] = [
    'pet', 'exit', 'stone', 'wall',
    'colored_path', 'color_wall', 'crate', 
    'ribbon', 'movable_box', 'obstacle', 'tree_root', 'eraser'
];

export const ToolPanel: React.FC<ToolPanelProps> = ({ selectedTool, isDrawing, onToolChange, onFinishDrawing }) => {
  return (
    <div>
      <h2 className="text-lg font-semibold text-white mb-3">Tools</h2>
      <div className="grid grid-cols-2 gap-2">
        {tools.map(tool => (
          <button
            key={tool}
            onClick={() => onToolChange(tool)}
            className={`capitalize px-4 py-2 rounded-lg font-bold text-white transition-all transform hover:scale-105 ${selectedTool === tool ? 'bg-teal-600 ring-2 ring-white' : 'bg-gray-700 hover:bg-gray-600'}`}
          >
            {tool.replace('_', ' ')}
          </button>
        ))}
        {isDrawing && (
          <button
            onClick={onFinishDrawing}
            className="col-span-2 mt-2 px-4 py-3 bg-green-600 hover:bg-green-500 rounded-lg font-bold text-white transition-transform transform hover:scale-105"
          >
            Finish Drawing
          </button>
        )}
      </div>
    </div>
  );
};