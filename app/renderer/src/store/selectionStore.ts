import { create } from 'zustand'
import { subscribeWithSelector } from 'zustand/middleware'
import { PdfAnchor } from '../workspace/types'

// Selection mode
export type SelectionMode = 'none' | 'selecting' | 'selected'

interface SelectionState {
  // Current selection mode
  mode: SelectionMode
  
  // Multiple selections support
  selections: PdfAnchor[]
  
  // Currently active selection (most recent)
  activeSelection: PdfAnchor | null
  
  // Selection box visual state (for rendering)
  selectionBox: {
    x: number
    y: number
    width: number
    height: number
    pageIndex: number
  } | null
  
  // Actions
  startSelection: (pageIndex: number, x: number, y: number) => void
  updateSelection: (x: number, y: number, width: number, height: number) => void
  endSelection: (anchor: PdfAnchor) => void
  cancelSelection: () => void
  clearSelections: () => void
  addToMultiSelect: (anchor: PdfAnchor) => void
  removeFromMultiSelect: (index: number) => void
}

export const useSelectionStore = create<SelectionState>()(
  subscribeWithSelector((set, get) => ({
    mode: 'none',
    selections: [],
    activeSelection: null,
    selectionBox: null,

    startSelection: (pageIndex, x, y) => {
      set({
        mode: 'selecting',
        selectionBox: { x, y, width: 0, height: 0, pageIndex },
      })
    },

    updateSelection: (x, y, width, height) => {
      const state = get()
      if (!state.selectionBox) return
      
      set({
        selectionBox: {
          ...state.selectionBox,
          x,
          y,
          width,
          height,
        },
      })
    },

    endSelection: (anchor) => {
      set({
        mode: 'selected',
        activeSelection: anchor,
        selections: [...get().selections, anchor],
        selectionBox: null,
      })
    },

    cancelSelection: () => {
      set({
        mode: 'none',
        selectionBox: null,
      })
    },

    clearSelections: () => {
      set({
        mode: 'none',
        selections: [],
        activeSelection: null,
        selectionBox: null,
      })
    },

    addToMultiSelect: (anchor) => {
      set((state) => ({
        selections: [...state.selections, anchor],
      }))
    },

    removeFromMultiSelect: (index) => {
      set((state) => ({
        selections: state.selections.filter((_, i) => i !== index),
      }))
    },
  }))
)
