/**
 * Tool Store - Manages active tool state
 */

import { create } from 'zustand'
import { subscribeWithSelector } from 'zustand/middleware'
import { immer } from 'zustand/middleware/immer'

// ============================================================================
// TYPES
// ============================================================================

export type ToolType = 'select' | 'pan' | 'link' | 'excerpt'

export interface LinkToolState {
  isActive: boolean
  sourceId: string | null  // Excerpt or anchor ID
  sourceType: 'excerpt' | 'pdf-region' | null
  sourcePosition: { x: number; y: number } | null
}

interface ToolState {
  // Active tool
  activeTool: ToolType
  
  // Link tool specific state
  linkTool: LinkToolState
  
  // Modifier keys
  modifiers: {
    shift: boolean
    ctrl: boolean
    alt: boolean
  }
}

interface ToolActions {
  // Tool selection
  setTool: (tool: ToolType) => void
  
  // Link tool
  startLinkFromExcerpt: (excerptId: string, position: { x: number; y: number }) => void
  startLinkFromPdf: (position: { x: number; y: number }) => void
  cancelLinkTool: () => void
  
  // Modifiers
  setModifier: (key: 'shift' | 'ctrl' | 'alt', value: boolean) => void
  
  // Helpers
  isLinkToolActive: () => boolean
}

type ToolStore = ToolState & ToolActions

// ============================================================================
// STORE
// ============================================================================

export const useToolStore = create<ToolStore>()(
  subscribeWithSelector(
    immer((set, get) => ({
      activeTool: 'select',
      
      linkTool: {
        isActive: false,
        sourceId: null,
        sourceType: null,
        sourcePosition: null,
      },
      
      modifiers: {
        shift: false,
        ctrl: false,
        alt: false,
      },

      setTool: (tool) => {
        set((state) => {
          state.activeTool = tool
          // Reset link tool when switching tools
          if (tool !== 'link') {
            state.linkTool = {
              isActive: false,
              sourceId: null,
              sourceType: null,
              sourcePosition: null,
            }
          }
        })
      },

      startLinkFromExcerpt: (excerptId, position) => {
        set((state) => {
          state.activeTool = 'link'
          state.linkTool = {
            isActive: true,
            sourceId: excerptId,
            sourceType: 'excerpt',
            sourcePosition: position,
          }
        })
      },

      startLinkFromPdf: (position) => {
        set((state) => {
          state.activeTool = 'link'
          state.linkTool = {
            isActive: true,
            sourceId: null,
            sourceType: 'pdf-region',
            sourcePosition: position,
          }
        })
      },

      cancelLinkTool: () => {
        set((state) => {
          state.linkTool = {
            isActive: false,
            sourceId: null,
            sourceType: null,
            sourcePosition: null,
          }
          state.activeTool = 'select'
        })
      },

      setModifier: (key, value) => {
        set((state) => {
          state.modifiers[key] = value
        })
      },

      isLinkToolActive: () => {
        const state = get()
        return state.activeTool === 'link' && state.linkTool.isActive
      },
    }))
  )
)
