
import React from 'react';
import { GameBoard } from './components/GameBoard';
import { EditorSidebar } from './components/sidebar/EditorSidebar';
import { useLevelEditor } from './hooks/useLevelEditor';
import { LevelSolvedModal } from './components/modals/LevelSolvedModal';

const App: React.FC = () => {
  const {
    level,
    mode,
    selectedTool,
    selectedColor,
    selectedObject,
    drawingState,
    isDragging,
    editDragState,
    playDragState,
    levelSolved,
    fileInputRef,
    isRecording,
    isSolving,
    animatedLevel,
    isSolutionPlaying,
    isAnimating,
    solutionPlaybackIndex,
    guideSolver,
    disappearingWalls,
    draggedVisuals,
    pathVisualization,
    handlers,
  } = useLevelEditor();

  return (
    <div className={`min-h-screen flex flex-col font-sans antialiased relative`}>
      <header className="p-4 text-center border-b border-gray-700 shadow-lg bg-gray-800/50">
        <h1 className="text-3xl font-bold text-teal-400 tracking-wider">Pet Tunnel Puzzle - Editor</h1>
      </header>
      
      <div className={`flex-1 flex w-full max-w-screen-2xl mx-auto p-4 gap-4 ${isSolutionPlaying || isAnimating ? 'pointer-events-none' : ''}`}>
        <EditorSidebar
          level={level}
          mode={mode}
          selectedTool={selectedTool}
          selectedColor={selectedColor}
          selectedObject={selectedObject}
          drawingState={drawingState}
          isSolving={isSolving}
          isSolutionPlaying={isSolutionPlaying}
          solutionPlaybackIndex={solutionPlaybackIndex}
          fileInputRef={fileInputRef}
          guideSolver={guideSolver}
          onGuideSolverChange={handlers.setGuideSolver}
          hasRecordedSolution={level.solution && level.solution.length > 0}
          onLevelChange={handlers.setLevel}
          onToolChange={handlers.handleToolChange}
          onColorChange={handlers.handleColorChange}
          onSizeChange={handlers.handleSizeChange}
          onLoadClick={handlers.handleLoadClick}
          onFileLoad={handlers.handleFileLoad}
          onSaveUnityAsset={handlers.handleSaveUnityAsset}
          onSolveLevel={handlers.handleSolveLevel}
          onPlaySolution={handlers.handlePlaySolution}
          onStopSolution={handlers.handleStopSolution}
          onDrawingStateChange={handlers.setDrawingState}
        />

        <main className="flex-1 flex flex-col items-center p-4 bg-gray-800/50 rounded-lg border border-gray-700">
          <div className="flex justify-between w-full items-center mb-4 px-2">
              <h2 className="text-2xl font-bold text-white">{level.levelName} <span className="text-lg font-normal text-gray-400">- {mode === 'edit' ? 'Editing' : 'Playing'}</span></h2>
              <div className="flex items-center gap-4">
                {mode === 'play' && (
                    <button 
                        onClick={handlers.toggleRecording} 
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg font-bold text-white transition-all transform hover:scale-105 ${
                            isRecording
                            ? 'bg-red-600 hover:bg-red-500 animate-pulse' 
                            : 'bg-gray-600 hover:bg-gray-500'
                        }`}
                        aria-pressed={isRecording}
                    >
                        <span className={`w-3 h-3 rounded-full ${isRecording ? 'bg-white' : 'bg-red-500'}`}></span>
                        {isRecording ? 'Recording' : 'Record Solution'}
                    </button>
                )}
                <button onClick={handlers.toggleMode} className={`px-6 py-2 rounded-lg font-bold text-white transition-transform transform hover:scale-105 ${mode === 'edit' ? 'bg-green-600 hover:bg-green-500' : 'bg-red-600 hover:bg-red-500'}`}>
                    {mode === 'edit' ? 'Play Level' : 'Save & Edit'}
                </button>
              </div>
          </div>
          
          <div className="relative flex items-center justify-center bg-gray-900/50 p-4 rounded-lg overflow-auto">
              <GameBoard 
                level={animatedLevel ?? level}
                mode={mode} 
                selectedObject={selectedObject}
                isDragging={isDragging}
                editDragState={mode === 'edit' ? editDragState : null}
                playDragState={mode === 'play' ? playDragState : null}
                disappearingWalls={disappearingWalls}
                draggedVisuals={mode === 'edit' ? draggedVisuals : null}
                pathVisualization={mode === 'edit' ? pathVisualization : null}
                onGridMouseDown={mode === 'edit' ? handlers.handleEditorMouseDown : handlers.handlePlayModeMouseDown}
                onGridMouseMove={mode === 'edit' ? handlers.handleEditorMouseMove : handlers.handlePlayModeMouseMove}
                onGridMouseUp={mode === 'edit' ? handlers.handleEditorMouseUp : handlers.handlePlayModeMouseUp}
                onGridMouseLeave={mode === 'edit' ? () => handlers.handleEditorMouseUp(null) : () => handlers.handlePlayModeMouseUp(null)}
              />
              
              {levelSolved && (
                <LevelSolvedModal
                    onReset={handlers.handleResetToEditState}
                    onSaveAndEdit={handlers.handleSaveAndReturnToEdit}
                />
              )}
          </div>
        </main>
      </div>
    </div>
  );
};

export default App;
