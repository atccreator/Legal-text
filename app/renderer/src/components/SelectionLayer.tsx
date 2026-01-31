/**
 * SelectionLayer Component - Handles PDF text selection and drag initiation
 * 
 * Features:
 * - Rectangle selection in PDF
 * - Drag handle for creating excerpts
 * - Smooth animations with Framer Motion
 */

import { memo, useRef, useState, useCallback, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { GripVertical, ArrowRight } from 'lucide-react'
import { useDragController } from '../store/dragController'
import { useExcerptStore } from '../store/excerptStore'
import { usePdfViewportStore } from '../store/pdfViewportStore'
import { coordinateService } from '../services/coordinates'
import type { NormalizedRect } from '../workspace/types'

interface SelectionLayerProps {
  documentId: string
  pageIndex: number
  width: number
  height: number
}

export const SelectionLayer = memo(function SelectionLayer({
  documentId,
  pageIndex,
  width,
  height,
}: SelectionLayerProps) {
  const layerRef = useRef<HTMLDivElement>(null)
  
  // Selection state
  const [isSelecting, setIsSelecting] = useState(false)
  const [selectionStart, setSelectionStart] = useState<{ x: number; y: number } | null>(null)
  const [selectionRect, setSelectionRect] = useState<{ x: number; y: number; w: number; h: number } | null>(null)
  const [completedSelection, setCompletedSelection] = useState<{
    rect: NormalizedRect
    screenRect: { x: number; y: number; width: number; height: number }
  } | null>(null)
  
  // Drag controller
  const dragPhase = useDragController((s) => s.phase)
  const startSelection = useDragController((s) => s.startSelection)
  const updateSelection = useDragController((s) => s.updateSelection)
  const startDrag = useDragController((s) => s.startDrag)
  const updateDrag = useDragController((s) => s.updateDrag)
  const completeDrag = useDragController((s) => s.completeDrag)
  const completeSelection = useDragController((s) => s.completeSelection)
  const reset = useDragController((s) => s.reset)
  
  // Excerpt store
  const createExcerpt = useExcerptStore((s) => s.createExcerpt)
  
  // Update viewport store with page dimensions
  useEffect(() => {
    usePdfViewportStore.getState().setPageDimensions(pageIndex, width, height)
  }, [pageIndex, width, height])

  // Handle mouse down - start selection
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return
    if (dragPhase === 'dragging') return
    
    const rect = layerRef.current?.getBoundingClientRect()
    if (!rect) return
    
    // Clear previous selection
    setCompletedSelection(null)
    reset()
    
    const x = (e.clientX - rect.left) / width
    const y = (e.clientY - rect.top) / height
    
    setIsSelecting(true)
    setSelectionStart({ x, y })
    setSelectionRect({ x, y, w: 0, h: 0 })
    
    // Start selection in drag controller with documentId and pageIndex
    startSelection(documentId, pageIndex, { x, y })
  }, [documentId, pageIndex, width, height, dragPhase, reset, startSelection])

  // Handle mouse move - update selection
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isSelecting || !selectionStart) return
    
    const rect = layerRef.current?.getBoundingClientRect()
    if (!rect) return
    
    const currentX = Math.max(0, Math.min(1, (e.clientX - rect.left) / width))
    const currentY = Math.max(0, Math.min(1, (e.clientY - rect.top) / height))
    
    // Calculate normalized rect (handle negative dimensions)
    const x = Math.min(selectionStart.x, currentX)
    const y = Math.min(selectionStart.y, currentY)
    const w = Math.abs(currentX - selectionStart.x)
    const h = Math.abs(currentY - selectionStart.y)
    
    setSelectionRect({ x, y, w, h })
    
    // Update drag controller
    updateSelection({ x: currentX, y: currentY }, width, height)
  }, [isSelecting, selectionStart, width, height, updateSelection])

  // Handle mouse up - complete selection
  const handleMouseUp = useCallback(() => {
    if (!isSelecting || !selectionRect) {
      setIsSelecting(false)
      return
    }
    
    // Check if selection is big enough
    const minSize = 0.01 // 1% of page
    if (selectionRect.w < minSize || selectionRect.h < minSize) {
      setIsSelecting(false)
      setSelectionRect(null)
      return
    }
    
    const rect = layerRef.current?.getBoundingClientRect()
    if (!rect) return
    
    // Calculate screen rect
    const screenRect = {
      x: rect.left + selectionRect.x * width,
      y: rect.top + selectionRect.y * height,
      width: selectionRect.w * width,
      height: selectionRect.h * height,
    }
    
    // Save completed selection
    setCompletedSelection({
      rect: selectionRect,
      screenRect,
    })
    
    // Update drag controller
    completeSelection(
      selectionRect,
      screenRect,
      'Selected text' // TODO: Extract actual text
    )
    
    setIsSelecting(false)
  }, [isSelecting, selectionRect, width, height, completeSelection])

  // Handle drag start from handle
  const handleDragStart = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault()
    e.stopPropagation()
    
    if (!completedSelection) return
    
    let clientX: number
    let clientY: number
    
    if ('touches' in e && e.touches.length > 0) {
      const touch = e.touches[0]
      if (!touch) return
      clientX = touch.clientX
      clientY = touch.clientY
    } else if ('clientX' in e) {
      clientX = e.clientX
      clientY = e.clientY
    } else {
      return
    }
    
    startDrag({ x: clientX, y: clientY })
    
    // Setup global move/end handlers
    const handleMove = (moveEvent: MouseEvent | TouchEvent) => {
      let moveX: number
      let moveY: number
      
      if ('touches' in moveEvent && moveEvent.touches.length > 0) {
        const touch = moveEvent.touches[0]
        if (!touch) return
        moveX = touch.clientX
        moveY = touch.clientY
      } else if ('clientX' in moveEvent) {
        moveX = moveEvent.clientX
        moveY = moveEvent.clientY
      } else {
        return
      }
      
      updateDrag({ x: moveX, y: moveY })
    }
    
    const handleEnd = () => {
      const result = completeDrag()
      
      if (result) {
        // Get world position from coordinate service
        const dropTarget = useDragController.getState().dropTarget
        if (dropTarget.worldPosition) {
          createExcerpt(
            {
              documentId: result.documentId,
              pageIndex: result.pageIndex,
              rect: result.rect,
              ...(result.text !== undefined && { text: result.text }),
            },
            dropTarget.worldPosition
          )
        }
      }
      
      // Clear selection after drop
      setCompletedSelection(null)
      
      window.removeEventListener('mousemove', handleMove)
      window.removeEventListener('mouseup', handleEnd)
      window.removeEventListener('touchmove', handleMove)
      window.removeEventListener('touchend', handleEnd)
    }
    
    window.addEventListener('mousemove', handleMove)
    window.addEventListener('mouseup', handleEnd)
    window.addEventListener('touchmove', handleMove, { passive: true })
    window.addEventListener('touchend', handleEnd)
  }, [completedSelection, startDrag, updateDrag, completeDrag, createExcerpt, documentId, pageIndex])

  // Render selection box
  const renderSelectionBox = () => {
    if (!selectionRect || (!isSelecting && !completedSelection)) return null
    
    const rect = completedSelection?.rect || selectionRect
    
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        style={{
          position: 'absolute',
          left: rect.x * width,
          top: rect.y * height,
          width: rect.w * width,
          height: rect.h * height,
          backgroundColor: 'rgba(99, 102, 241, 0.2)',
          border: '2px solid #6366f1',
          borderRadius: 4,
          boxShadow: '0 0 0 3px rgba(99, 102, 241, 0.15)',
          pointerEvents: 'none',
        }}
      />
    )
  }

  // Render drag handle
  const renderDragHandle = () => {
    if (!completedSelection || dragPhase === 'dragging') return null
    
    const { rect, screenRect } = completedSelection
    const handleX = rect.x * width + rect.w * width + 12
    const handleY = rect.y * height + rect.h * height / 2 - 20
    
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.8, x: -10 }}
        animate={{ opacity: 1, scale: 1, x: 0 }}
        exit={{ opacity: 0, scale: 0.8 }}
        transition={{ type: 'spring', stiffness: 400, damping: 25 }}
        style={{
          position: 'absolute',
          left: handleX,
          top: handleY,
          zIndex: 100,
        }}
      >
        {/* Drag handle button */}
        <motion.div
          className="flex items-center gap-2 px-3 py-2 rounded-xl cursor-grab active:cursor-grabbing"
          style={{
            backgroundColor: '#6366f1',
            color: 'white',
            boxShadow: '0 4px 15px rgba(99, 102, 241, 0.4)',
          }}
          whileHover={{ scale: 1.05, boxShadow: '0 6px 20px rgba(99, 102, 241, 0.5)' }}
          whileTap={{ scale: 0.95 }}
          onMouseDown={handleDragStart}
          onTouchStart={handleDragStart}
        >
          <GripVertical size={16} />
          <span className="text-sm font-medium">Drag to canvas</span>
          <ArrowRight size={16} />
        </motion.div>
        
        {/* Pulsing indicator */}
        <motion.div
          className="absolute -left-1 top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-indigo-400"
          animate={{
            scale: [1, 1.3, 1],
            opacity: [0.8, 0.4, 0.8],
          }}
          transition={{
            duration: 1.5,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />
      </motion.div>
    )
  }

  return (
    <div
      ref={layerRef}
      className="absolute inset-0"
      style={{ cursor: isSelecting ? 'crosshair' : 'default' }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      <AnimatePresence>
        {renderSelectionBox()}
        {renderDragHandle()}
      </AnimatePresence>
    </div>
  )
})

export default SelectionLayer
