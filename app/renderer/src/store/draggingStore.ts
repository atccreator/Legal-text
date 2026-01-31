import { create } from 'zustand'
import { subscribeWithSelector } from 'zustand/middleware'
import { PdfAnchor, ScreenPoint } from '../workspace/types'

/**
 * State for link dragging interaction
 * Manages the "ghost link" that appears while dragging from PDF to canvas
 */
interface DraggingState {
  // Is drag in progress
  isDragging: boolean
  
  // Source anchor from PDF
  sourceAnchor: PdfAnchor | null
  
  // Source screen position (right edge of selection)
  sourceScreenPos: ScreenPoint | null
  
  // Current pointer position (where the ghost link ends)
  currentPointerPos: ScreenPoint | null
  
  // Drop zone state
  isOverDropZone: boolean
  
  // Actions
  startDrag: (anchor: PdfAnchor, screenPos: ScreenPoint) => void
  updateDrag: (pointerPos: ScreenPoint) => void
  setOverDropZone: (isOver: boolean) => void
  endDrag: () => { anchor: PdfAnchor; dropPosition: ScreenPoint } | null
  cancelDrag: () => void
}

export const useDraggingStore = create<DraggingState>()(
  subscribeWithSelector((set, get) => ({
    isDragging: false,
    sourceAnchor: null,
    sourceScreenPos: null,
    currentPointerPos: null,
    isOverDropZone: false,

    startDrag: (anchor, screenPos) => {
      console.log('[DraggingStore] Drag started from PDF selection')
      set({
        isDragging: true,
        sourceAnchor: anchor,
        sourceScreenPos: screenPos,
        currentPointerPos: screenPos,
        isOverDropZone: false,
      })
    },

    updateDrag: (pointerPos) => {
      if (!get().isDragging) return
      set({ currentPointerPos: pointerPos })
    },

    setOverDropZone: (isOver) => {
      set({ isOverDropZone: isOver })
    },

    endDrag: () => {
      const state = get()
      if (!state.isDragging || !state.sourceAnchor || !state.currentPointerPos) {
        get().cancelDrag()
        return null
      }

      const result = {
        anchor: state.sourceAnchor,
        dropPosition: state.currentPointerPos,
      }

      console.log('[DraggingStore] Drag ended at', result.dropPosition)
      
      set({
        isDragging: false,
        sourceAnchor: null,
        sourceScreenPos: null,
        currentPointerPos: null,
        isOverDropZone: false,
      })

      return result
    },

    cancelDrag: () => {
      console.log('[DraggingStore] Drag cancelled')
      set({
        isDragging: false,
        sourceAnchor: null,
        sourceScreenPos: null,
        currentPointerPos: null,
        isOverDropZone: false,
      })
    },
  }))
)
