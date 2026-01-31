/**
 * CanvasWorkspace Component - Workspace panel with excerpt rendering
 * 
 * Features:
 * - Drop zone for excerpt creation
 * - Renders excerpt cards
 * - Infinite canvas with pan/zoom
 * - Framer Motion animations
 */

import { memo, useRef, useEffect, useState, useCallback, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, Move, ZoomIn, ZoomOut, Maximize2 } from 'lucide-react'
import { ExcerptCard } from './ExcerptCard'
import { useExcerptStore } from '../store/excerptStore'
import { useDragController } from '../store/dragController'
import { useWorkspaceViewportStore } from '../store/workspaceViewportStore'

export const CanvasWorkspace = memo(function CanvasWorkspace() {
  const containerRef = useRef<HTMLDivElement>(null)
  const [isPanning, setIsPanning] = useState(false)
  const lastPanPosition = useRef({ x: 0, y: 0 })
  
  // Viewport state - select only primitive values to prevent re-renders
  const worldX = useWorkspaceViewportStore((s) => s.worldX)
  const worldY = useWorkspaceViewportStore((s) => s.worldY)
  const scale = useWorkspaceViewportStore((s) => s.scale)
  const panelRect = useWorkspaceViewportStore((s) => s.panelRect)
  
  // Excerpts - select Map (stable) and memoize array to avoid getSnapshot warning
  const excerptsMap = useExcerptStore((s) => s.excerpts)
  const excerpts = useMemo(() => Array.from(excerptsMap.values()), [excerptsMap])
  
  // Drag state - select specific primitive values to avoid object reference issues
  const dragPhase = useDragController((s) => s.phase)
  const dropTargetPanel = useDragController((s) => s.dropTarget.panel)
  
  const isDropTarget = dragPhase === 'dragging' && dropTargetPanel === 'workspace'

  // Update panel rect on mount and resize - use store.getState() to avoid dependency issues
  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    
    const updateRect = () => {
      const rect = container.getBoundingClientRect()
      useWorkspaceViewportStore.getState().setPanelRect(rect)
    }
    
    updateRect()
    
    const resizeObserver = new ResizeObserver(updateRect)
    resizeObserver.observe(container)
    
    window.addEventListener('resize', updateRect)
    
    return () => {
      resizeObserver.disconnect()
      window.removeEventListener('resize', updateRect)
    }
  }, []) // Empty deps - use getState() inside

  // Initialize world position at center (only once when panel first gets a rect)
  const initializedRef = useRef(false)
  useEffect(() => {
    if (panelRect && !initializedRef.current) {
      initializedRef.current = true
      useWorkspaceViewportStore.getState().setWorldPosition(panelRect.width / 2, panelRect.height / 2)
    }
  }, [panelRect]) // Only depend on panelRect, use getState() for functions

  // Get store functions for handlers - use useCallback to memoize
  const clearSelection = useCallback(() => {
    useExcerptStore.getState().clearSelection()
  }, [])

  // Pan handling
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return
    if (e.target !== containerRef.current) return
    
    setIsPanning(true)
    lastPanPosition.current = { x: e.clientX, y: e.clientY }
    clearSelection()
  }, [clearSelection])

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isPanning) return
    
    const dx = e.clientX - lastPanPosition.current.x
    const dy = e.clientY - lastPanPosition.current.y
    
    // Use getState() to avoid dependency on worldX/worldY which change during pan
    const state = useWorkspaceViewportStore.getState()
    state.setWorldPosition(state.worldX + dx, state.worldY + dy)
    lastPanPosition.current = { x: e.clientX, y: e.clientY }
  }, [isPanning])

  const handleMouseUp = useCallback(() => {
    setIsPanning(false)
  }, [])

  // Zoom handling
  const handleWheel = useCallback((e: React.WheelEvent) => {
    if (!e.ctrlKey && !e.metaKey) return
    e.preventDefault()
    
    const scaleFactor = e.deltaY < 0 ? 1.1 : 0.9
    useWorkspaceViewportStore.getState().zoomAtPoint(e.clientX, e.clientY, scaleFactor)
  }, [])

  // Zoom controls
  const handleZoomIn = useCallback(() => {
    const rect = useWorkspaceViewportStore.getState().panelRect
    if (rect) {
      useWorkspaceViewportStore.getState().zoomAtPoint(
        rect.left + rect.width / 2,
        rect.top + rect.height / 2,
        1.2
      )
    }
  }, [])

  const handleZoomOut = useCallback(() => {
    const rect = useWorkspaceViewportStore.getState().panelRect
    if (rect) {
      useWorkspaceViewportStore.getState().zoomAtPoint(
        rect.left + rect.width / 2,
        rect.top + rect.height / 2,
        0.8
      )
    }
  }, [])

  const handleResetView = useCallback(() => {
    const store = useWorkspaceViewportStore.getState()
    store.centerOnPoint(0, 0)
    store.setScale(1)
  }, [])

  return (
    <div className="relative w-full h-full overflow-hidden">
      {/* Canvas container */}
      <div
        ref={containerRef}
        className="w-full h-full bg-gray-50"
        style={{
          cursor: isPanning ? 'grabbing' : 'grab',
          backgroundImage: `
            radial-gradient(circle, #e5e7eb 1px, transparent 1px)
          `,
          backgroundSize: `${20 * scale}px ${20 * scale}px`,
          backgroundPosition: `${worldX}px ${worldY}px`,
        }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
      >
        {/* Excerpt cards */}
        <AnimatePresence>
          {excerpts.map((excerpt) => (
            <ExcerptCard
              key={excerpt.id}
              excerpt={excerpt}
              scale={scale}
              worldOffset={{ x: worldX, y: worldY }}
              panelRect={panelRect}
            />
          ))}
        </AnimatePresence>
      </div>

      {/* Drop zone indicator */}
      <AnimatePresence>
        {isDropTarget && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-4 pointer-events-none rounded-2xl"
            style={{
              background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.05) 0%, rgba(139, 92, 246, 0.1) 100%)',
              border: '3px dashed rgba(99, 102, 241, 0.5)',
            }}
          >
            <div className="absolute inset-0 flex items-center justify-center">
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="text-center p-6 bg-white/90 backdrop-blur-sm rounded-2xl shadow-xl border border-indigo-100"
              >
                <motion.div
                  className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center"
                  animate={{
                    scale: [1, 1.1, 1],
                  }}
                  transition={{
                    duration: 1.5,
                    repeat: Infinity,
                    ease: 'easeInOut',
                  }}
                >
                  <Plus className="w-8 h-8 text-white" />
                </motion.div>
                <h3 className="text-lg font-semibold text-gray-800 mb-1">
                  Drop to Create Excerpt
                </h3>
                <p className="text-sm text-gray-500">
                  Release to add this selection to your workspace
                </p>
              </motion.div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Empty state */}
      {excerpts.length === 0 && dragPhase === 'idle' && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="text-center p-8 max-w-sm">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center">
              <Move className="w-8 h-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-semibold text-gray-700 mb-2">
              Your Workspace
            </h3>
            <p className="text-sm text-gray-500 leading-relaxed">
              Select text in the PDF and drag it here to create linked excerpts.
              Use <kbd className="px-1.5 py-0.5 bg-gray-100 rounded text-xs">Ctrl</kbd> + scroll to zoom.
            </p>
          </div>
        </div>
      )}

      {/* Zoom controls */}
      <div className="absolute bottom-4 right-4 flex items-center gap-1 bg-white rounded-lg shadow-lg border border-gray-200 p-1">
        <button
          onClick={handleZoomOut}
          className="p-2 hover:bg-gray-100 rounded-md transition-colors"
          title="Zoom out"
        >
          <ZoomOut size={18} className="text-gray-600" />
        </button>
        <div className="px-2 text-sm font-medium text-gray-600 min-w-[50px] text-center">
          {Math.round(scale * 100)}%
        </div>
        <button
          onClick={handleZoomIn}
          className="p-2 hover:bg-gray-100 rounded-md transition-colors"
          title="Zoom in"
        >
          <ZoomIn size={18} className="text-gray-600" />
        </button>
        <div className="w-px h-6 bg-gray-200" />
        <button
          onClick={handleResetView}
          className="p-2 hover:bg-gray-100 rounded-md transition-colors"
          title="Reset view"
        >
          <Maximize2 size={18} className="text-gray-600" />
        </button>
      </div>

      {/* Excerpt count badge */}
      {excerpts.length > 0 && (
        <div className="absolute top-4 right-4 px-3 py-1.5 bg-white rounded-full shadow-md border border-gray-200">
          <span className="text-sm font-medium text-gray-700">
            {excerpts.length} excerpt{excerpts.length !== 1 ? 's' : ''}
          </span>
        </div>
      )}
    </div>
  )
})

export default CanvasWorkspace
