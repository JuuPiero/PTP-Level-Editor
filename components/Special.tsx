
import React from 'react';
import type { Coordinates, Exit as ExitType, StoneWall as StoneWallType, ColoredPath, ColorWall, CrateInfo, RibbonInfo, MovableBox, ObstacleInfo, TreeRoot } from '../types/level';
import { MovableBoxDirection, LevelTheme } from '../types/level';
import { COLOR_HEX_MAP, getColorClassForNumber, hexToRgba, darkenColor } from '../types/colors';

const DEFAULT_COLOR_HEX = '#6B7280';

const leafCoverSvg = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Cpath d='M 50,0 A 50,50 0 0,1 100,50 L 50,50 Z' fill='%2316a34a' opacity='0.6'/%3E%3Cpath d='M 50,0 A 50,50 0 0,0 0,50 L 50,50 Z' fill='%2315803d' opacity='0.6'/%3E%3Cpath d='M 50,100 A 50,50 0 0,1 0,50 L 50,50 Z' fill='%2316a34a' opacity='0.6'/%3E%3Cpath d='M 50,100 A 50,50 0 0,0 100,50 L 50,50 Z' fill='%2315803d' opacity='0.6'/%3E%3Cpath d='M 20 80 Q 50 50 80 20' stroke='%2314532d' stroke-width='5' fill='none' stroke-linecap='round'/%3E%3Cpath d='M 20 20 Q 50 50 80 80' stroke='%2314532d' stroke-width='5' fill='none' stroke-linecap='round'/%3E%3Ccircle cx='50' cy='50' r='10' fill='%23166534'/%3E%3C/svg%3E")`;

interface SpecialComponentProps {
    height: number;
    isDimmed?: boolean;
    visualOffset?: { x: number; y: number };
}

interface ExitProps extends SpecialComponentProps {
    exit: ExitType;
    theme: LevelTheme;
}

export const Exit: React.FC<ExitProps> = ({ exit, height, theme, isDimmed, visualOffset }) => {
    const { position, color, special } = exit;
    const { layerColors, iceCount, count, isPermanent } = special;
  
    const isSpooky = theme === LevelTheme.Spooky;
    const mainColorHex = isSpooky ? '#9F44D3' : (COLOR_HEX_MAP[color] || '#9CA3AF');
    const layer1Hex = layerColors?.[0] !== undefined ? COLOR_HEX_MAP[layerColors[0]] : null;
    const layer2Hex = layerColors?.[1] !== undefined ? COLOR_HEX_MAP[layerColors[1]] : null;

    const isFrozen = iceCount > 0;
    const showCount = count > 0;
  
    const baseStyle: React.CSSProperties = {
      position: 'absolute',
      borderRadius: '50%',
      animation: 'spin 4s linear infinite',
      transition: 'opacity 0.3s ease-in-out',
    };
  
    const mainVortexStyle: React.CSSProperties = {
      ...baseStyle,
      width: '100%',
      height: '100%',
      background: isSpooky
        ? `radial-gradient(circle, #a855f7 10%, #4c1d95 40%, black 70%)`
        : `radial-gradient(circle, ${mainColorHex} 20%, transparent 70%), radial-gradient(circle, black 40%, ${mainColorHex} 75%)`,
    };
  
    const layer1VortexStyle: React.CSSProperties = {
      ...baseStyle,
      width: '70%',
      height: '70%',
      background: `radial-gradient(circle, ${layer1Hex} 20%, transparent 70%), radial-gradient(circle, black 40%, ${layer1Hex} 75%)`,
      animationName: 'spin-reverse',
      animationDuration: '3.5s',
    };
  
    const layer2VortexStyle: React.CSSProperties = {
      ...baseStyle,
      width: '40%',
      height: '40%',
      background: `radial-gradient(circle, ${layer2Hex} 20%, transparent 70%), radial-gradient(circle, black 40%, ${layer2Hex} 75%)`,
      animationDuration: '3s',
    };
  
    const containerStyle: React.CSSProperties = {
      gridColumn: position.x + 1,
      gridRow: height - position.y,
      zIndex: visualOffset ? 50 : 5,
      pointerEvents: 'none',
      transform: visualOffset ? `translate(${visualOffset.x}px, ${visualOffset.y}px) scale(1.1)` : 'none',
      filter: visualOffset ? 'drop-shadow(0 5px 8px rgba(0,0,0,0.5))' : 'none',
    };
  
    return (
      <div style={containerStyle} className={`w-full h-full flex items-center justify-center p-1 relative transition-opacity ${isDimmed && !visualOffset ? 'opacity-40' : ''}`}>
          <style>{`
            @keyframes spin {
              from { transform: rotate(0deg); }
              to { transform: rotate(360deg); }
            }
            @keyframes spin-reverse {
              from { transform: rotate(360deg); }
              to { transform: rotate(0deg); }
            }
          `}</style>

          {isPermanent && (
            <>
              <div 
                className="absolute inset-0 rounded-full"
                style={{ 
                  border: '4px solid #FBBF24',
                  boxShadow: '0 0 8px #FBBF24, inset 0 0 8px #FBBF24',
                  zIndex: 1,
                }}
              />
              <div
                className="absolute -top-1 w-full text-center text-2xl font-bold text-yellow-300 pointer-events-none"
                style={{ textShadow: '0 0 6px black, 0 0 6px black', zIndex: 2 }}
                aria-label="Permanent Exit"
              >
                ∞
              </div>
            </>
          )}
          
          <div style={mainVortexStyle}></div>
          {layer1Hex && <div style={layer1VortexStyle}></div>}
          {layer2Hex && <div style={layer2VortexStyle}></div>}
  
          {(showCount || isFrozen) && (
            <div className="absolute flex items-center justify-center gap-2" style={{ textShadow: '0 0 5px black, 0 0 5px black' }}>
                {showCount && (
                  <span className={`font-bold text-2xl ${getColorClassForNumber(count)}`}>
                    {count}
                  </span>
                )}
                {isFrozen && (
                  <span className="text-white text-2xl flex items-center">
                    🍃<span className="text-lg tabular-nums -ml-1 font-bold">{iceCount}</span>
                  </span>
                )}
            </div>
          )}
      </div>
    );
};

export const StoneWallComponent: React.FC<{ stone: StoneWallType; height: number; theme: LevelTheme; isDimmed?: boolean; visualOffset?: { x: number; y: number }; }> = ({ stone, height, theme, isDimmed, visualOffset }) => {
  const style: React.CSSProperties = {
    gridColumn: stone.position.x + 1,
    gridRow: height - stone.position.y,
    zIndex: visualOffset ? 50 : 6,
    pointerEvents: 'none',
    transform: visualOffset ? `translate(${visualOffset.x}px, ${visualOffset.y}px) scale(1.1)` : 'none',
    filter: visualOffset ? 'drop-shadow(0 5px 8px rgba(0,0,0,0.5))' : 'none',
  };

  const isIced = stone.iceCount > 0;
  const isWinter = theme === LevelTheme.Winter;
  const isSpooky = theme === LevelTheme.Spooky;

  const baseBg = isSpooky ? 'bg-gray-800' : 'bg-gray-600';
  const baseBorder = isSpooky ? 'border-gray-700' : 'border-gray-500';
  const bgImage = isSpooky ? 'none' : `url("data:image/svg+xml,%3Csvg width='20' height='20' viewBox='0 0 20 20' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M0 0h10v10H0V0zm10 10h10v10H10V10z' fill='%234a5568' fill-opacity='0.4' fill-rule='evenodd'/%3E%3C/svg%3E")`;
  
  const dynamicStyle: React.CSSProperties = { ...style, backgroundImage: bgImage };

  return (
    <div style={dynamicStyle} className={`w-full h-full flex items-center justify-center p-1 ${baseBg} border-2 ${baseBorder} rounded-md relative transition-opacity ${isDimmed && !visualOffset ? 'opacity-40' : ''}`}>
       {isWinter && (
        <div className="absolute top-0 left-[-2px] right-[-2px] h-1/2 bg-white rounded-t-md" style={{ borderBottom: '2px solid #e5e7eb' }}></div>
       )}
       {isSpooky && (
         <div className="absolute inset-0 bg-purple-900/20 rounded-md border-2 border-purple-700/50" />
       )}
       {isIced && (
        <div className="absolute inset-0 bg-blue-300/60 border-2 border-blue-200/80 rounded-md" />
       )}
       <div className="relative flex items-center justify-center gap-1">
          <span className={`font-bold text-2xl drop-shadow-[0_1.2px_1.2px_rgba(0,0,0,0.9)] ${getColorClassForNumber(stone.count)}`}>
            {stone.count}
          </span>
          {isIced && (
            <span className="text-xl flex items-center text-white" style={{ textShadow: '0 0 5px black' }}>
              ❄️<span className="text-base tabular-nums -ml-1 font-bold">{stone.iceCount}</span>
            </span>
          )}
       </div>
    </div>
  );
};

export const ColoredPathComponent: React.FC<{ path: ColoredPath; height: number, isDimmed?: boolean; visualOffset?: { x: number; y: number }; }> = ({ path, height, isDimmed, visualOffset }) => {
  const style: React.CSSProperties = {
    gridColumn: path.position.x + 1,
    gridRow: height - path.position.y,
    zIndex: visualOffset ? 50 : 2,
    pointerEvents: 'none',
    transform: visualOffset ? `translate(${visualOffset.x}px, ${visualOffset.y}px) scale(1.1)` : 'none',
    filter: visualOffset ? 'drop-shadow(0 5px 8px rgba(0,0,0,0.5))' : 'none',
  };
  const colorHex = COLOR_HEX_MAP[path.color] || DEFAULT_COLOR_HEX;
  const bgColor = hexToRgba(colorHex, 0.3);

  return (
    <div style={style} className={`w-full h-full p-2 transition-opacity ${isDimmed && !visualOffset ? 'opacity-40' : ''}`}>
      <div style={{ backgroundColor: bgColor, width: '100%', height: '100%', borderRadius: '9999px' }} />
    </div>
  );
};

export const ColorWallComponent: React.FC<{ wall: ColorWall; height: number; isDimmed?: boolean; isDisappearing?: boolean; visualOffset?: { x: number; y: number }; }> = ({ wall, height, isDimmed, isDisappearing, visualOffset }) => {
  const style: React.CSSProperties = {
    gridColumn: wall.position.x + 1,
    gridRow: height - wall.position.y,
    zIndex: visualOffset ? 50 : 3,
    pointerEvents: 'none',
    transform: visualOffset ? `translate(${visualOffset.x}px, ${visualOffset.y}px) scale(1.1)` : 'none',
    filter: visualOffset ? 'drop-shadow(0 5px 8px rgba(0,0,0,0.5))' : 'none',
  };
  const colorHex = COLOR_HEX_MAP[wall.color] || DEFAULT_COLOR_HEX;
  const borderColor = darkenColor(colorHex, 20);

  return (
    <div style={style} className={`w-full h-full p-1 transition-opacity ${isDimmed && !visualOffset ? 'opacity-40' : ''} ${isDisappearing ? 'scale-out' : ''}`}>
      <div style={{ backgroundColor: colorHex, borderColor: borderColor, borderWidth: '2px', borderRadius: '0.375rem' }} className="w-full h-full" />
    </div>
  );
};

const woodTextureSvg = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='80' height='80' viewBox='0 0 80 80'%3E%3Cg fill='%23854d0e' fill-opacity='0.4'%3E%3Cpath d='M0 0h80v2H0zM0 4h80v2H0zM0 8h80v2H0zM0 12h80v2H0zM0 16h80v2H0zM0 20h80v2H0zM0 24h80v2H0zM0 28h80v2H0zM0 32h80v2H0zM0 36h80v2H0zM0 40h80v2H0zM0 44h80v2H0zM0 48h80v2H0zM0 52h80v2H0zM0 56h80v2H0zM0 60h80v2H0zM0 64h80v2H0zM0 68h80v2H0zM0 72h80v2H0zM0 76h80v2H0z'/%3E%3Cpath d='M0 0h2v80H0zM4 0h2v80H4zM8 0h2v80H8zM12 0h2v80H12zM16 0h2v80H16zM20 0h2v80H20zM24 0h2v80H24zM28 0h2v80H28zM32 0h2v80H32zM36 0h2v80H36zM40 0h2v80H40zM44 0h2v80H44zM48 0h2v80H48zM52 0h2v80H52zM56 0h2v80H56zM60 0h2v80H60zM64 0h2v80H64zM68 0h2v80H68zM72 0h2v80H72zM76 0h2v80H76z'/%3E%3C/g%3E%3C/svg%3E")`;

export const CrateComponent: React.FC<{ crate: CrateInfo; height: number, isDimmed?: boolean; visualOffset?: { x: number; y: number }; }> = ({ crate, height, isDimmed, visualOffset }) => {
  const { listPositions, requiredSnake } = crate;
  if (!listPositions || listPositions.length === 0) {
    return null;
  }

  const positionSet = new Set(listPositions.map(p => `${p.x},${p.y}`));
  const hasNeighbor = (x: number, y: number) => positionSet.has(`${x},${y}`);

  const topLeftMost = listPositions.reduce((topLeft, pos) => {
    if (pos.y > topLeft.y) return pos;
    if (pos.y === topLeft.y && pos.x < topLeft.x) return pos;
    return topLeft;
  }, listPositions[0]);

  return (
    <>
      {listPositions.map((pos, i) => {
        const isTopLeft = pos.x === topLeftMost.x && pos.y === topLeftMost.y;
        const style: React.CSSProperties = {
          gridColumn: pos.x + 1,
          gridRow: height - pos.y,
          zIndex: visualOffset ? 50 : 11,
          pointerEvents: 'none',
          backgroundColor: '#a16207',
          backgroundImage: woodTextureSvg,
          border: '2px solid #522c06',
          borderTopWidth: hasNeighbor(pos.x, pos.y + 1) ? 0 : '2px',
          borderBottomWidth: hasNeighbor(pos.x, pos.y - 1) ? 0 : '2px',
          borderLeftWidth: hasNeighbor(pos.x - 1, pos.y) ? 0 : '2px',
          borderRightWidth: hasNeighbor(pos.x + 1, pos.y) ? 0 : '2px',
          boxSizing: 'border-box',
          transform: visualOffset ? `translate(${visualOffset.x}px, ${visualOffset.y}px) scale(1.1)` : 'none',
          filter: visualOffset ? 'drop-shadow(0 5px 8px rgba(0,0,0,0.5))' : 'none',
        };

        return (
          <div
            key={`crate-${crate.id}-${i}`}
            style={style}
            className={`w-full h-full flex items-center justify-center transition-opacity ${isDimmed && !visualOffset ? 'opacity-40' : ''}`}
          >
            {isTopLeft && requiredSnake > 0 && (
              <span className={`font-bold text-xl drop-shadow-[0_1.2px_1.2px_rgba(0,0,0,0.9)] ${getColorClassForNumber(requiredSnake)}`}>
                {requiredSnake}
              </span>
            )}
          </div>
        );
      })}
    </>
  );
};

export const RibbonComponent: React.FC<{ ribbon: RibbonInfo; height: number, isDimmed?: boolean }> = ({ ribbon, height, isDimmed }) => {
  return (
    <>
      {ribbon.listPositions.map((pos, i) => (
        <div
          key={`ribbon-${i}`}
          style={{
            gridColumn: pos.x + 1,
            gridRow: height - pos.y,
            zIndex: 4,
            pointerEvents: 'none',
          }}
          className={`w-full h-full flex items-center justify-center p-2 transition-opacity ${isDimmed ? 'opacity-40' : ''}`}
        >
          <div className="w-full h-full bg-pink-400/50 border border-pink-500 rounded-full" />
        </div>
      ))}
    </>
  );
};

export const IceComponent: React.FC<{ pos: Coordinates; height: number, isDimmed?: boolean }> = ({ pos, height, isDimmed }) => {
  const style: React.CSSProperties = {
    gridColumn: pos.x + 1,
    gridRow: height - pos.y,
    zIndex: 9,
    pointerEvents: 'none',
  };

  return (
    <div style={style} className={`w-full h-full flex items-center justify-center p-[2px] relative transition-opacity ${isDimmed ? 'opacity-40' : ''}`}>
      <div className="w-full h-full bg-green-800/20 border-2 border-green-600/50 rounded-md" />
      <div 
        className="absolute inset-0 bg-contain bg-center bg-no-repeat rounded-md"
        style={{ backgroundImage: leafCoverSvg, transform: 'scale(1.1)', opacity: 0.7 }}
      />
    </div>
  );
};

interface MovableBoxProps {
    box: MovableBox;
    height: number;
    mode: 'edit' | 'play';
    isDimmed?: boolean;
    visualOffset?: { x: number; y: number };
}

export const MovableBoxComponent: React.FC<MovableBoxProps> = ({ box, height, mode, isDimmed, visualOffset }) => {
  const { listPositions, direction } = box;
  if (!listPositions || listPositions.length === 0) return null;
  
  const positionSet = new Set(listPositions.map(p => `${p.x},${p.y}`));
  const hasNeighbor = (x: number, y: number) => positionSet.has(`${x},${y}`);

  const topLeftMost = listPositions.reduce((topLeft, pos) => {
    if (pos.y > topLeft.y) return pos;
    if (pos.y === topLeft.y && pos.x < topLeft.x) return pos;
    return topLeft;
  }, listPositions[0]);

  const getArrows = () => {
    const arrowStyle: React.CSSProperties = {
        fontSize: '1rem',
        lineHeight: 1,
        color: 'black',
        position: 'absolute',
    };
    const containerStyle: React.CSSProperties = {
        transform: 'rotate(-45deg)',
        width: '100%',
        height: '100%',
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
    };

    switch(direction) {
      case MovableBoxDirection.Vertical: 
        return (
            <div style={containerStyle}>
                <div style={{...arrowStyle, top: '1px'}}>▲</div>
                <div style={{...arrowStyle, bottom: '1px'}}>▼</div>
            </div>
        );
      case MovableBoxDirection.Horizontal:
        return (
            <div style={containerStyle}>
                <div style={{...arrowStyle, left: '1px'}}>◀</div>
                <div style={{...arrowStyle, right: '1px'}}>▶</div>
            </div>
        );
      case MovableBoxDirection.None:
        return (
            <div style={containerStyle}>
                <div style={{...arrowStyle, top: '1px'}}>▲</div>
                <div style={{...arrowStyle, bottom: '1px'}}>▼</div>
                <div style={{...arrowStyle, left: '1px'}}>◀</div>
                <div style={{...arrowStyle, right: '1px'}}>▶</div>
            </div>
        );
      default: return null;
    }
  };

  return (
    <>
      {listPositions.map((pos, i) => {
        const isPlayMode = mode === 'play';
        const isTopLeft = pos.x === topLeftMost.x && pos.y === topLeftMost.y;
        const style: React.CSSProperties = {
          gridColumn: pos.x + 1,
          gridRow: height - pos.y,
          zIndex: visualOffset ? 50 : 11,
          pointerEvents: 'auto',
          cursor: isPlayMode ? 'grab' : 'default',
          backgroundColor: '#a16207',
          backgroundImage: woodTextureSvg,
          border: '2px solid #522c06',
          borderTopWidth: hasNeighbor(pos.x, pos.y + 1) ? 0 : '2px',
          borderBottomWidth: hasNeighbor(pos.x, pos.y - 1) ? 0 : '2px',
          borderLeftWidth: hasNeighbor(pos.x - 1, pos.y) ? 0 : '2px',
          borderRightWidth: hasNeighbor(pos.x + 1, pos.y) ? 0 : '2px',
          boxSizing: 'border-box',
          transform: visualOffset ? `translate(${visualOffset.x}px, ${visualOffset.y}px) scale(1.1)` : 'none',
          filter: visualOffset ? 'drop-shadow(0 5px 8px rgba(0,0,0,0.5))' : 'none',
        };
        
        const arrowContainerStyle: React.CSSProperties = {
            width: '60%',
            height: '60%',
            backgroundColor: 'rgba(255, 255, 255, 0.9)',
            borderRadius: '4px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transform: 'rotate(45deg)',
            fontFamily: 'sans-serif'
        };

        return (
          <div 
            key={`mbox-${box.id}-${i}`} 
            style={style} 
            className={`w-full h-full flex items-center justify-center transition-opacity ${isDimmed && !visualOffset ? 'opacity-40' : ''}`}
          >
            {isTopLeft && (
              <div style={arrowContainerStyle}>
                {getArrows()}
              </div>
            )}
          </div>
        );
      })}
    </>
  );
};

export const ObstacleComponent: React.FC<{ obstacle: ObstacleInfo; height: number, isDimmed?: boolean; visualOffset?: { x: number; y: number }; }> = ({ obstacle, height, isDimmed, visualOffset }) => {
    const { listPositions } = obstacle;
    if (!listPositions || listPositions.length === 0) {
      return null;
    }
  
    const positionSet = new Set(listPositions.map(p => `${p.x},${p.y}`));
    const hasNeighbor = (x: number, y: number) => positionSet.has(`${x},${y}`);
  
    return (
      <>
        {listPositions.map((pos, i) => {
          const style: React.CSSProperties = {
            gridColumn: pos.x + 1,
            gridRow: height - pos.y,
            zIndex: visualOffset ? 50 : 6,
            pointerEvents: 'none',
            transform: visualOffset ? `translate(${visualOffset.x}px, ${visualOffset.y}px) scale(1.1)` : 'none',
            filter: visualOffset ? 'drop-shadow(0 5px 8px rgba(0,0,0,0.5))' : 'none',
          };

          const hasN = hasNeighbor(pos.x, pos.y + 1);
          const hasS = hasNeighbor(pos.x, pos.y - 1);
          const hasW = hasNeighbor(pos.x - 1, pos.y);
          const hasE = hasNeighbor(pos.x + 1, pos.y);
  
          return (
            <div key={`obstacle-${obstacle.id}-${i}`} style={style} className={`w-full h-full relative transition-opacity ${isDimmed && !visualOffset ? 'opacity-40' : ''}`}>
                <div className="absolute w-1/2 h-1/2 top-1/4 left-1/4 bg-gray-500 rounded-sm"></div>
                {hasN && <div className="absolute w-1/2 h-1/2 top-0 left-1/4 bg-gray-500"></div>}
                {hasS && <div className="absolute w-1/2 h-1/2 bottom-0 left-1/4 bg-gray-500"></div>}
                {hasW && <div className="absolute w-1/2 h-1/2 top-1/4 left-0 bg-gray-500"></div>}
                {hasE && <div className="absolute w-1/2 h-1/2 top-1/4 right-0 bg-gray-500"></div>}
            </div>
          );
        })}
      </>
    );
};

export const TreeRootComponent: React.FC<{ root: TreeRoot; height: number; isDimmed?: boolean; visualOffset?: { x: number; y: number }; }> = ({ root, height, isDimmed, visualOffset }) => {
    const segments: Coordinates[] = [];
    for (let i = 0; i <= root.length; i++) {
        segments.push({
            x: root.position.x + i * root.direction.x,
            y: root.position.y + i * root.direction.y,
        });
    }

    const rootBranchSvg = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Crect width='100' height='100' fill='%236b462a' /%3E%3Cpath d='M20 0 V100 M80 0 V100' stroke='%234a2e1a' stroke-width='8' /%3E%3Cpath d='M10 20 Q50 30 90 40 M10 60 Q50 70 90 80' stroke='%234a2e1a' stroke-width='5' fill='none' /%3E%3C/svg%3E")`;

    return (
        <>
            {segments.map((pos, i) => {
                const isPole = i === 0;
                const style: React.CSSProperties = {
                    gridColumn: pos.x + 1,
                    gridRow: height - pos.y,
                    zIndex: visualOffset ? 50 : 6,
                    pointerEvents: 'none',
                    backgroundImage: rootBranchSvg,
                    backgroundSize: 'cover',
                    transform: visualOffset ? `translate(${visualOffset.x}px, ${visualOffset.y}px) scale(1.1)` : 'none',
                    filter: visualOffset ? 'drop-shadow(0 5px 8px rgba(0,0,0,0.5))' : 'none',
                };
                
                return (
                    <div
                        key={`root-${root.id}-${i}`}
                        style={style}
                        className={`w-full h-full p-1 relative transition-opacity ${isDimmed && !visualOffset ? 'opacity-40' : ''}`}
                    >
                       <div className={`absolute inset-0 border-2 ${isPole ? 'border-amber-900' : 'border-amber-950/50'}`}></div>
                    </div>
                );
            })}
        </>
    );
};
