import React, { forwardRef, useState, useEffect } from 'react';
import type { EditorTool } from '../../types/level';
import { Color, PetColor, COLOR_HEX_MAP, darkenColor } from '../../types/colors';
import type { SelectedObjectData } from '../../hooks/useSelectedObjectData';

interface ColorPickerPanelProps {
  selectedTool: EditorTool;
  selectedColor: Color;
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  onColorChange: (color: Color) => void;
  selectedObjectData: SelectedObjectData | null;
}

const toolsWithColorPicker: EditorTool[] = ['pet', 'exit', 'colored_path', 'color_wall'];

export const ColorPickerPanel = forwardRef<HTMLDivElement, ColorPickerPanelProps>(
  ({ selectedTool, selectedColor, isOpen, setIsOpen, onColorChange, selectedObjectData }, ref) => {
    
    if (!toolsWithColorPicker.includes(selectedTool)) {
      return null;
    }

    const [displayColors, setDisplayColors] = useState<Color[]>([selectedColor]);

    useEffect(() => {
        let colors: Color[] = [];
        if (selectedObjectData) {
            switch (selectedObjectData.type) {
                case 'pet':
                case 'exit':
                    colors.push(selectedObjectData.color);
                    if (selectedObjectData.special.layerColors) {
                        colors.push(...selectedObjectData.special.layerColors);
                    }
                    break;
                case 'colored_path':
                case 'color_wall':
                    colors.push(selectedObjectData.color);
                    break;
            }
        }

        if (colors.length > 0) {
            setDisplayColors(colors);
        } else {
            // Fallback to the selected color from the tool if no object is selected
            setDisplayColors([selectedColor]);
        }
    }, [selectedObjectData, selectedColor]);

    const primaryColor = displayColors[0] ?? Color.Unk;
    const mainColorHex = COLOR_HEX_MAP[primaryColor] || '#6B7280';
    const mainBorderColor = darkenColor(mainColorHex, 20);
    
    return (
      <div ref={ref}>
        <h2 className="text-lg font-semibold text-white mb-3">Color</h2>
        <div className="relative">
          <button
            onClick={() => setIsOpen(!isOpen)}
            style={{ backgroundColor: mainColorHex, borderColor: mainBorderColor }}
            className="w-full h-12 rounded-lg border-2 flex items-center justify-between px-4 font-bold text-white shadow-lg transition-transform transform hover:scale-105"
            aria-label={`Selected color: ${Color[primaryColor] || 'Unknown'}. Click to change.`}
          >
            <span className="capitalize">{Color[primaryColor] ? Color[primaryColor].replace(/([A-Z])/g, ' $1').trim() : 'Unknown'}</span>
            <div className="flex items-center gap-1.5">
              {displayColors.map((color, index) => {
                const swatchColor = COLOR_HEX_MAP[color];
                const swatchBorderColor = darkenColor(swatchColor, 20);
                return (
                  <div
                    key={index}
                    style={{ backgroundColor: swatchColor, borderColor: swatchBorderColor }}
                    className={`w-5 h-5 rounded-full border-2 shadow-md ${index === 0 ? 'ring-2 ring-white/70' : ''}`}
                    title={`${index === 0 ? 'Primary' : `Layer ${index}`}: ${Color[color] ? Color[color].replace(/([A-Z])/g, ' $1').trim() : 'Unknown'}`}
                  ></div>
                );
              })}
            </div>
          </button>
          {isOpen && (
            <div className="absolute top-full mt-2 w-full bg-gray-700 p-2 rounded-lg shadow-xl z-10 border border-gray-600">
              <div className="grid grid-cols-6 gap-2">
                {PetColor.map(color => {
                  const swatchColor = COLOR_HEX_MAP[color];
                  const swatchBorderColor = darkenColor(swatchColor, 20);
                  return (
                    <button
                      key={color}
                      onClick={() => onColorChange(color)}
                      aria-label={`Select color ${Color[color]}`}
                      style={{ backgroundColor: swatchColor, borderColor: swatchBorderColor }}
                      className={`w-10 h-10 rounded-full border-2 transition-transform transform hover:scale-110 ${selectedColor === color ? 'ring-2 ring-offset-2 ring-offset-gray-700 ring-white' : ''}`}
                    >
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }
);