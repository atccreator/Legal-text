/**
 * Drag Controller Store - Manages drag interactions for excerpt creation
 * 
 * Handles the full drag lifecycle:
 * 1. Selection in PDF
 * 2. Drag start (ghost preview)
 * 3. Cross-panel dragging
 * 4. Drop on canvas
 */

import { create } from 'zustand'
import { subscribeWithSelector } from 'zustand/middleware'
import { immer } from 'zustand/middleware/immer'
import type { NormalizedRect } from '../workspace/types'
import { coordinateService } from '../services/coordinates'

// ============================================================================
// TYPES
// ============================================================================

export type DragPhase = 'idle' | 'selecting' | 'ready' | 'dragging' | 'dropping'

export interface DragSource {
  documentId: string
  pageIndex: number
  rect: NormalizedRect
  text?: string
  // Screen position of selection (for ghost)
  screenRect: { x: number; y: number; width: number; height: number }
}

export interface DragState {
  // Current phase
  phase: DragPhase
  
  // Source data (from PDF)
  source: DragSource | null
  
  // Current pointer position (screen coords)
  pointerPosition: { x: number; y: number } | null
  
  // Source anchor point (where the link starts)
  sourceAnchor: { x: number; y: number } | null
  
  // Drop target info
  dropTarget: {
    panel: 'workspace' | null
    worldPosition: { x: number; y: number } | null
    isValid: boolean
  }
  
  // Visual feedback
  ghostOpacity: number
  linkProgress: number // 0-1 for animation
}

interface DragActions {
  // Selection flow
  startSelection: (documentId: string, pageIndex: number, startPoint: { x: number; y: number }) => void
  updateSelection: (currentPoint: { x: number; y: number }, pageWidth: number, pageHeight: number) => void
  completeSelection: (rect: NormalizedRect, screenRect: { x: number; y: number; width: number; height: number }, text?: string) => void
  
  // Drag flow
  startDrag: (pointerPos: { x: number; y: number }) => void
  updateDrag: (pointerPos: { x: number; y: number }) => void
  completeDrag: () => DragSource | null
  cancelDrag: () => void
  
  // Reset
  reset: () => void
  
  // Computed
  isOverWorkspace: () => boolean
}

type DragStore = DragState & DragActions

// ============================================================================
// INITIAL STATE
// ============================================================================

const initialState: DragState = {
  phase: 'idle',
  source: null,
  pointerPosition: null,
  sourceAnchor: null,
  dropTarget: {
    panel: null,
    worldPosition: null,
    isValid: false,
  },
  ghostOpacity: 0,
  linkProgress: 0,
}

// ============================================================================
// STORE IMPLEMENTATION
// ============================================================================

export const useDragController = create<DragStore>()(
  subscribeWithSelector(
    immer((set, get) => ({
      ...initialState,

      // ========================================
      // SELECTION FLOW
      // ========================================

      startSelection: (documentId, pageIndex, startPoint) => {
        set((state) => {
          state.phase = 'selecting'
          state.source = {
            documentId,
            pageIndex,
            rect: { x: startPoint.x, y: startPoint.y, w: 0, h: 0 },
            screenRect: { x: 0, y: 0, width: 0, height: 0 },
          }
        })
      },

      updateSelection: (currentPoint, pageWidth, pageHeight) => {
        set((state) => {
          if (!state.source || state.phase !== 'selecting') return
          
          const startX = state.source.rect.x
          const startY = state.source.rect.y
          
          // Calculate normalized rect (handle negative dimensions)
          const x = Math.min(startX, currentPoint.x)
          const y = Math.min(startY, currentPoint.y)
          const w = Math.abs(currentPoint.x - startX)
          const h = Math.abs(currentPoint.y - startY)
          
          state.source.rect = { x, y, w, h }
        })
      },

      completeSelection: (rect, screenRect, text) => {
        set((state) => {
          if (!state.source) return
          
          state.phase = 'ready'
          state.source.rect = rect
          state.source.screenRect = screenRect
          if (text !== undefined) {
            state.source.text = text
          }
          
          // Set source anchor at right edge of selection
          state.sourceAnchor = {
            x: screenRect.x + screenRect.width,
            y: screenRect.y + screenRect.height / 2,
          }
        })
      },

      // ========================================
      // DRAG FLOW
      // ========================================

      startDrag: (pointerPos) => {
        const state = get()
        if (state.phase !== 'ready' || !state.source) return

        set((s) => {
          s.phase = 'dragging'
          s.pointerPosition = pointerPos
          s.ghostOpacity = 0.8
          s.linkProgress = 0
        })

        // Animate link progress
        const animate = () => {
          const current = get()
          if (current.phase !== 'dragging') return
          
          set((s) => {
            s.linkProgress = Math.min(s.linkProgress + 0.1, 1)
          })
          
          if (get().linkProgress < 1) {
            requestAnimationFrame(animate)
          }
        }
        requestAnimationFrame(animate)
      },

      updateDrag: (pointerPos) => {
        const state = get()
        if (state.phase !== 'dragging') return

        // Check if over workspace panel
        const panel = coordinateService.getContainingPanel(pointerPos)
        const isOverWorkspace = panel === 'workspace'
        
        let worldPosition: { x: number; y: number } | null = null
        if (isOverWorkspace) {
          worldPosition = coordinateService.screenToWorld(pointerPos)
        }

        set((s) => {
          s.pointerPosition = pointerPos
          s.dropTarget = {
            panel: isOverWorkspace ? 'workspace' : null,
            worldPosition,
            isValid: isOverWorkspace && worldPosition !== null,
          }
          s.ghostOpacity = isOverWorkspace ? 0.95 : 0.7
        })
      },

      completeDrag: () => {
        const state = get()
        if (state.phase !== 'dragging' || !state.source) {
          get().reset()
          return null
        }

        const result = state.dropTarget.isValid ? { ...state.source } : null
        
        if (result) {
          // Animate drop
          set((s) => {
            s.phase = 'dropping'
            s.ghostOpacity = 0
          })
          
          // Delay reset to allow animation
          setTimeout(() => get().reset(), 300)
        } else {
          get().reset()
        }

        return result
      },

      cancelDrag: () => {
        set((s) => {
          s.ghostOpacity = 0
        })
        setTimeout(() => get().reset(), 150)
      },

      // ========================================
      // RESET
      // ========================================

      reset: () => {
        set(() => ({ ...initialState }))
      },

      // ========================================
      // COMPUTED
      // ========================================

      isOverWorkspace: () => {
        return get().dropTarget.panel === 'workspace'
      },
    }))
  )
)

// ============================================================================
// SELECTORS
// ============================================================================

export const selectIsDragging = (state: DragStore) => state.phase === 'dragging'
export const selectIsReady = (state: DragStore) => state.phase === 'ready'
export const selectDropTarget = (state: DragStore) => state.dropTarget
export const selectSourceAnchor = (state: DragStore) => state.sourceAnchor
