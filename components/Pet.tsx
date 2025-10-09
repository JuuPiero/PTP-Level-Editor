import React, { useMemo } from 'react';
import type { Pet as PetType, Coordinates } from '../types/level';
import { KeyLockColor, LevelTheme } from '../types/level';
import { COLOR_HEX_MAP, Color, PetColor, getColorClassForNumber } from '../types/colors';

interface PetProps {
  pet: PetType;
  mode: 'edit' | 'play';
  gridHeight: number;
  tileSize: number;
  theme: LevelTheme;
  isDimmed?: boolean;
  isBeingDragged?: boolean;
  visualOffset?: { x: number; y: number };
  onPetMouseDown?: (coords: Coordinates, e: React.MouseEvent) => void;
}

const WinterScarf: React.FC<{ headX: number, headY: number, headRadius: number }> = ({ headX, headY, headRadius }) => (
    <g>
      <path
          d={`M ${headX - headRadius * 0.8},${headY + headRadius * 0.5} C ${headX - headRadius * 0.5},${headY + headRadius * 1.2} ${headX + headRadius * 0.5},${headY + headRadius * 1.2} ${headX + headRadius * 0.8},${headY + headRadius * 0.5}`}
          fill="none"
          stroke="#D3362D"
          strokeWidth={headRadius * 0.4}
          strokeLinecap="round"
      />
       <path
          d={`M ${headX - headRadius * 0.6},${headY + headRadius * 0.5} C ${headX - headRadius * 0.4},${headY + headRadius * 1.0} ${headX + headRadius * 0.4},${headY + headRadius * 1.0} ${headX + headRadius * 0.6},${headY + headRadius * 0.5}`}
          fill="none"
          stroke="#FFFFFF"
          strokeWidth={headRadius * 0.15}
          strokeLinecap="round"
      />
    </g>
);


export const Pet: React.FC<PetProps> = ({ pet, mode, gridHeight, tileSize, theme, isDimmed, isBeingDragged, visualOffset, onPetMouseDown }) => {
  if (!pet.positions || pet.positions.length === 0 || !pet.headPos) {
    return null;
  }
  
  const special = pet.special;
  const isHidden = special.hiddenCount > 0;
  
  const getDisplayColors = (): { mainColor: string | null; layer1Color: string | null; layer2Color: string | null } => {
    if (isHidden) {
        return {
            mainColor: COLOR_HEX_MAP[Color.Hidden],
            layer1Color: null,
            layer2Color: null,
        };
    }

    const colorSequence = [
      pet.color,
      ...(pet.special.layerColors || []),
    ];

    const getColorHex = (colorEnum: Color | undefined | null): string | null => {
      if (colorEnum === undefined || colorEnum === null) {
        return null;
      }
      return COLOR_HEX_MAP[colorEnum] || null;
    };
    
    const mainColor = getColorHex(colorSequence[0]) || COLOR_HEX_MAP[Color.Unk];
    const layer1Color = getColorHex(colorSequence[1]);
    const layer2Color = getColorHex(colorSequence[2]);

    return { mainColor, layer1Color, layer2Color };
  };

  const { mainColor, layer1Color, layer2Color } = getDisplayColors();

  const bodyStrokeWidth = tileSize * 0.75;
  const layer1StrokeWidth = tileSize * 0.5;
  const layer2StrokeWidth = tileSize * 0.25;
  const headRadius = tileSize * 0.45;

  const pathPoints = pet.positions.map(segment => {
    const x = segment.x * tileSize + tileSize / 2;
    const y = (gridHeight - 1 - segment.y) * tileSize + tileSize / 2;
    return `${x},${y}`;
  }).join(' ');


  const head = pet.headPos;
  const headX = head.x * tileSize + tileSize / 2;
  const headY = (gridHeight - 1 - head.y) * tileSize + tileSize / 2;

  const tailInfo = useMemo(() => {
    if (pet.positions.length === 0) return null;

    const tailSegment = pet.positions[pet.positions.length - 1];
    const tailX = tailSegment.x * tileSize + tileSize / 2;
    const tailY = (gridHeight - 1 - tailSegment.y) * tileSize + tileSize / 2;

    if (pet.positions.length < 2) {
      return { tailX, tailY, angle: 0, hasVisual: false };
    }
    
    const prevSegment = pet.positions[pet.positions.length - 2];
    const prevX = prevSegment.x * tileSize + tileSize / 2;
    const prevY = (gridHeight - 1 - prevSegment.y) * tileSize + tileSize / 2;

    const angle = Math.atan2(tailY - prevY, tailX - prevX) * 180 / Math.PI;

    return { tailX, tailY, angle, hasVisual: true };
  }, [pet.positions, tileSize, gridHeight]);

  const tailX = tailInfo?.tailX ?? headX;
  const tailY = tailInfo?.tailY ?? headY;
  
  const isLocked = special.keyLock?.lockColor !== KeyLockColor.Unk && special.keyLock?.lockColor !== undefined;
  const isFrozen = special.iceCount > 0;
  const showCount = (special.count ?? 0) > 0;
  const petIsMovable = !isLocked && !isFrozen;
  const isEditable = mode === 'edit';
  
  const hasKey = !isHidden && special.keyLock && special.keyLock.keyColor !== KeyLockColor.Unk;
  const hasLock = !isHidden && special.keyLock && special.keyLock.lockColor !== KeyLockColor.Unk;
  const hasBomb = !isHidden && (special.timeExplode ?? 0) > 0;
  
  const hasBody = pet.positions.length > 1;
  const scissorTargetSegment = hasBody ? pet.positions[1] : head;
  const scissorX = scissorTargetSegment.x * tileSize + tileSize / 2;
  const scissorY = (gridHeight - 1 - scissorTargetSegment.y) * tileSize + tileSize / 2;

  const headCursorStyle = isEditable ? 'default' : (petIsMovable ? 'pointer' : 'not-allowed');
  const tailCursorStyle = isEditable ? 'default' : (petIsMovable && !special.isSingleDirection ? 'pointer' : 'not-allowed');
  
  const isSpooky = theme === LevelTheme.Spooky;

  const layers = [
    { color: mainColor, width: bodyStrokeWidth, radius: headRadius },
    { color: layer1Color, width: layer1StrokeWidth, radius: headRadius * (layer1StrokeWidth / bodyStrokeWidth) },
    { color: layer2Color, width: layer2StrokeWidth, radius: headRadius * (layer2StrokeWidth / bodyStrokeWidth) },
  ].filter(l => l.color);

  const isEditModeDrag = !!visualOffset;
  const isPlayModeDrag = !!isBeingDragged;
  
  const gStyle: React.CSSProperties = { 
    opacity: isDimmed && !isEditModeDrag ? 0.4 : 1, 
    transition: 'opacity 0.2s ease-in-out, transform 0.1s ease-out',
    transform: isEditModeDrag ? 'scale(1.1)' : 'none',
    filter: (isEditModeDrag || isPlayModeDrag) ? 'drop-shadow(0 4px 6px rgba(0,0,0,0.4))' : 'none',
    zIndex: (isEditModeDrag || isPlayModeDrag) ? 50 : 10,
  };

  const groupTransform = visualOffset ? `translate(${visualOffset.x}, ${visualOffset.y})` : undefined;


  return (
    <g style={gStyle} transform={groupTransform}>
      {pet.positions.length > 0 && layers.map((layer, index) => (
          <polyline
            key={`body-layer-${index}`}
            points={pathPoints}
            fill="none"
            stroke={layer.color!}
            strokeWidth={layer.width}
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ pointerEvents: 'none', transition: 'stroke 0.3s ease-in-out' }}
          />
      ))}

      {tailInfo?.hasVisual && mainColor && (
        <path
          d={`M 0 -${bodyStrokeWidth / 2} L ${bodyStrokeWidth * 0.7} 0 L 0 ${bodyStrokeWidth / 2} Z`}
          fill={mainColor}
          transform={`translate(${tailInfo.tailX}, ${tailInfo.tailY}) rotate(${tailInfo.angle})`}
          style={{ pointerEvents: 'none', transition: 'fill 0.3s ease-in-out' }}
        />
      )}

      <g
        style={{ cursor: headCursorStyle, pointerEvents: onPetMouseDown ? 'auto' : 'none' }}
        onMouseDown={(e) => {
          if (onPetMouseDown) {
            try { onPetMouseDown(pet.headPos, e); } catch (err) { /* ignore */ }
          }
        }}
      >
        {layers.map((layer, index) => (
          <circle 
            key={`head-layer-${index}`}
            cx={headX} 
            cy={headY} 
            r={layer.radius} 
            fill={layer.color!} 
            style={{ transition: 'fill 0.3s ease-in-out' }} 
          />
        ))}

        {isHidden ? (
          <>
            <circle cx={headX - headRadius * 0.35} cy={headY - headRadius * 0.3} r={headRadius * 0.15} fill="white" />
            <circle cx={headX + headRadius * 0.35} cy={headY - headRadius * 0.3} r={headRadius * 0.15} fill="white" />
          </>
        ) : (
          <>
            <circle cx={headX - headRadius * 0.35} cy={headY - headRadius * 0.3} r={headRadius * 0.2} fill={isSpooky ? "#facc15" : "white"} />
            <circle cx={headX + headRadius * 0.35} cy={headY - headRadius * 0.3} r={headRadius * 0.2} fill={isSpooky ? "#facc15" : "white"} />
            <circle cx={headX - headRadius * 0.3} cy={headY - headRadius * 0.35} r={headRadius * 0.1} fill={isSpooky ? "#dc2626" : "black"} />
            <circle cx={headX + headRadius * 0.4} cy={headY - headRadius * 0.35} r={headRadius * 0.1} fill={isSpooky ? "#dc2626" : "black"} />
            <circle cx={headX - headRadius * 0.2} cy={headY - headRadius * 0.6} r={headRadius * 0.05} fill={isSpooky ? "#b91c1c" : "black"} />
            <circle cx={headX + headRadius * 0.2} cy={headY - headRadius * 0.6} r={headRadius * 0.05} fill={isSpooky ? "#b91c1c" : "black"} />
          </>
        )}
        {theme === LevelTheme.Winter && <WinterScarf headX={headX} headY={headY} headRadius={headRadius} />}
      </g>
      
      {!isHidden && pet.editorName && (
          <foreignObject
            x={headX - headRadius}
            y={headY - headRadius}
            width={headRadius * 2}
            height={headRadius * 2}
            style={{ pointerEvents: 'none' }}
          >
              <div
                  className="w-full h-full flex items-center justify-center text-white font-bold"
                  style={{
                      fontSize: `${headRadius * 0.85}px`,
                      textShadow: '0 0 4px black, 0 0 4px black',
                      lineHeight: 1,
                  }}
              >
                  {pet.editorName}
              </div>
          </foreignObject>
      )}

      {isHidden && pet.positions.length > 1 && (() => {
          const targetSegment = pet.positions[pet.positions.length - 1];
          const segX = targetSegment.x * tileSize + tileSize / 2;
          const segY = (gridHeight - 1 - targetSegment.y) * tileSize + tileSize / 2;
          return (
              <foreignObject
                  key={`hidden-count-${pet.id}`}
                  x={segX - tileSize / 2}
                  y={segY - tileSize / 2}
                  width={tileSize}
                  height={tileSize}
                  style={{ pointerEvents: 'none' }}
              >
                  <div
                      className="w-full h-full flex items-center justify-center text-white font-bold"
                      style={{
                          fontSize: `${tileSize * 0.5}px`,
                          textShadow: '0px 0px 3px black, 0px 0px 3px black',
                      }}
                  >
                      {special.hiddenCount}
                  </div>
              </foreignObject>
          );
      })()}
      
      {pet.positions.length > 1 && (
         <circle
            cx={tailX}
            cy={tailY}
            r={headRadius}
            fill="transparent"
            style={{ cursor: tailCursorStyle, pointerEvents: onPetMouseDown ? 'auto' : 'none' }}
            onMouseDown={(e) => {
              if (onPetMouseDown) {
                const tailSeg = pet.positions[pet.positions.length - 1];
                try { onPetMouseDown(tailSeg, e); } catch (err) { /* ignore */ }
              }
            }}
        />
      )}
      
      {!isHidden && special.hasScissor && (
        <foreignObject 
          x={scissorX - headRadius} 
          y={scissorY - headRadius} 
          width={headRadius * 2} 
          height={headRadius * 2} 
          style={{ pointerEvents: 'none', overflow: 'visible' }}
        >
          <div
            className={`w-full h-full flex justify-center ${hasBody ? 'items-center' : 'items-end pb-1'}`}
            style={{ fontSize: `${headRadius * 0.8}px`, textShadow: '0px 0px 5px black' }}>
            <div className="flex items-center justify-center bg-black/40 rounded-full p-1 text-white font-bold">
                <span>✂️</span>
            </div>
          </div>
        </foreignObject>
      )}

      {!isHidden && (
        <>
          {(special.isSingleDirection || hasKey || hasBomb) && (
            <foreignObject x={headX - headRadius} y={headY - headRadius} width={headRadius * 2} height={headRadius * 2} style={{ pointerEvents: 'none', overflow: 'visible' }}>
              <div 
                className="w-full h-full flex items-start justify-center pt-1"
                style={{ fontSize: `${headRadius * 0.7}px`, textShadow: '0px 0px 5px black, 0px 0px 5px black' }}>
                <div className="flex items-center justify-center gap-1 bg-black/40 rounded-full px-2 py-1 text-white font-bold">
                     {special.isSingleDirection && <span>➡️</span>}
                     {hasKey && special.keyLock?.keyColor === KeyLockColor.Gold && <span>🔑</span>}
                     {hasKey && special.keyLock?.keyColor === KeyLockColor.Silver && <span style={{ filter: 'grayscale(1) brightness(1.5)' }}>🔑</span>}
                     {hasBomb && <span>💣</span>}
                 </div>
              </div>
            </foreignObject>
          )}
          {(isFrozen || hasLock || showCount) && pet.positions.length > 0 && (
            <foreignObject x={tailX - headRadius} y={tailY - headRadius} width={headRadius * 2} height={headRadius * 2} style={{ pointerEvents: 'none', overflow: 'visible' }}>
              <div
                className="w-full h-full flex items-end justify-center pb-1"
                style={{ fontSize: `${headRadius * 0.7}px`, textShadow: '0px 0px 5px black, 0px 0px 5px black' }}>
                <div className="flex items-center justify-center gap-1 bg-black/40 rounded-full px-2 py-1 text-white font-bold">
                  {showCount && <span className={`font-bold tabular-nums ${getColorClassForNumber(special.count ?? 0)}`}>{special.count}</span>}
                  {isFrozen && <span>🍃<span className="tabular-nums -ml-1 font-bold">{special.iceCount}</span></span>}
                  {hasLock && special.keyLock?.lockColor === KeyLockColor.Gold && <span>🔒</span>}
                  {hasLock && special.keyLock?.lockColor === KeyLockColor.Silver && <span style={{ filter: 'grayscale(1) brightness(1.5)' }}>🔒</span>}
                </div>
              </div>
            </foreignObject>
          )}
        </>
      )}
    </g>
  );
};
