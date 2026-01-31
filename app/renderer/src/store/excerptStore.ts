/**
 * Excerpt Store - Manages excerpts extracted from PDFs
 * 
 * Uses Immer for immutable updates and Zustand for state management.
 */

import { create } from 'zustand'
import { subscribeWithSelector } from 'zustand/middleware'
import { immer } from 'zustand/middleware/immer'
import type { NormalizedRect } from '../workspace/types'

// ============================================================================
// TYPES
// ============================================================================

export interface PDFSourceAnchor {
  documentId: string
  pageIndex: number
  rect: NormalizedRect
  text?: string
}

export interface Excerpt {
  id: string
  // Source information
  source: PDFSourceAnchor
  // World position on canvas
  position: { x: number; y: number }
  // Size (auto-calculated or user-adjusted)
  size: { width: number; height: number }
  // Visual state
  selected: boolean
  highlighted: boolean
  // Metadata
  createdAt: number
  label?: string
  color: string
}

export interface ExcerptLink {
  id: string
  // Source (PDF anchor)
  sourceId: string // Excerpt ID
  // Visual properties
  color: string
  highlighted: boolean
  // Animation state
  animating: boolean
}

// ============================================================================
// STORE STATE
// ============================================================================

interface ExcerptState {
  // Excerpts on canvas
  excerpts: Map<string, Excerpt>
  
  // Links between PDF and excerpts
  links: Map<string, ExcerptLink>
  
  // Selection state
  selectedExcerptIds: Set<string>
  
  // Hover state
  hoveredExcerptId: string | null
  hoveredLinkId: string | null
}

interface ExcerptActions {
  // Excerpt CRUD
  createExcerpt: (source: PDFSourceAnchor, dropPosition: { x: number; y: number }) => Excerpt
  updateExcerptPosition: (id: string, position: { x: number; y: number }) => void
  updateExcerptSize: (id: string, size: { width: number; height: number }) => void
  deleteExcerpt: (id: string) => void
  
  // Selection
  selectExcerpt: (id: string, additive?: boolean) => void
  deselectExcerpt: (id: string) => void
  clearSelection: () => void
  selectAll: () => void
  
  // Hover
  setHoveredExcerpt: (id: string | null) => void
  setHoveredLink: (id: string | null) => void
  
  // Highlighting
  highlightExcerpt: (id: string, highlighted: boolean) => void
  highlightLink: (id: string, highlighted: boolean) => void
  
  // Bulk operations
  deleteSelected: () => void
  clearAll: () => void
  
  // Getters
  getExcerpt: (id: string) => Excerpt | undefined
  getLink: (id: string) => ExcerptLink | undefined
  getExcerptBySource: (documentId: string, pageIndex: number) => Excerpt[]
}

type ExcerptStore = ExcerptState & ExcerptActions

// ============================================================================
// COLORS
// ============================================================================

const EXCERPT_COLORS = [
  '#6366f1', // Indigo
  '#8b5cf6', // Violet
  '#ec4899', // Pink
  '#f59e0b', // Amber
  '#10b981', // Emerald
  '#3b82f6', // Blue
] as const

function getRandomColor(): string {
  const index = Math.floor(Math.random() * EXCERPT_COLORS.length)
  return EXCERPT_COLORS[index] ?? EXCERPT_COLORS[0]
}

// ============================================================================
// DEFAULT EXCERPT SIZE
// ============================================================================

const DEFAULT_EXCERPT_SIZE = { width: 200, height: 80 }

// ============================================================================
// STORE IMPLEMENTATION
// ============================================================================

export const useExcerptStore = create<ExcerptStore>()(
  subscribeWithSelector(
    immer((set, get) => ({
      // Initial state
      excerpts: new Map(),
      links: new Map(),
      selectedExcerptIds: new Set(),
      hoveredExcerptId: null,
      hoveredLinkId: null,

      // ========================================
      // EXCERPT CRUD
      // ========================================

      createExcerpt: (source, dropPosition) => {
        const id = crypto.randomUUID()
        const linkId = crypto.randomUUID()
        const color = getRandomColor()
        
        const excerpt: Excerpt = {
          id,
          source,
          position: dropPosition,
          size: DEFAULT_EXCERPT_SIZE,
          selected: false,
          highlighted: false,
          createdAt: Date.now(),
          color,
        }
        
        const link: ExcerptLink = {
          id: linkId,
          sourceId: id,
          color,
          highlighted: false,
          animating: true, // Start with animation
        }

        set((state) => {
          state.excerpts.set(id, excerpt)
          state.links.set(linkId, link)
        })
        
        // Turn off animation after delay
        setTimeout(() => {
          set((state) => {
            const l = state.links.get(linkId)
            if (l) l.animating = false
          })
        }, 500)

        console.log('[ExcerptStore] Created excerpt:', id)
        return excerpt
      },

      updateExcerptPosition: (id, position) => {
        set((state) => {
          const excerpt = state.excerpts.get(id)
          if (excerpt) {
            excerpt.position = position
          }
        })
      },

      updateExcerptSize: (id, size) => {
        set((state) => {
          const excerpt = state.excerpts.get(id)
          if (excerpt) {
            excerpt.size = size
          }
        })
      },

      deleteExcerpt: (id) => {
        set((state) => {
          // Delete excerpt
          state.excerpts.delete(id)
          
          // Delete associated links
          for (const [linkId, link] of state.links.entries()) {
            if (link.sourceId === id) {
              state.links.delete(linkId)
            }
          }
          
          // Remove from selection
          state.selectedExcerptIds.delete(id)
        })
      },

      // ========================================
      // SELECTION
      // ========================================

      selectExcerpt: (id, additive = false) => {
        set((state) => {
          if (!additive) {
            // Deselect all others
            state.excerpts.forEach((e) => { e.selected = false })
            state.selectedExcerptIds.clear()
          }
          
          const excerpt = state.excerpts.get(id)
          if (excerpt) {
            excerpt.selected = true
            state.selectedExcerptIds.add(id)
          }
        })
      },

      deselectExcerpt: (id) => {
        set((state) => {
          const excerpt = state.excerpts.get(id)
          if (excerpt) {
            excerpt.selected = false
          }
          state.selectedExcerptIds.delete(id)
        })
      },

      clearSelection: () => {
        set((state) => {
          state.excerpts.forEach((e) => { e.selected = false })
          state.selectedExcerptIds.clear()
        })
      },

      selectAll: () => {
        set((state) => {
          state.excerpts.forEach((e, id) => {
            e.selected = true
            state.selectedExcerptIds.add(id)
          })
        })
      },

      // ========================================
      // HOVER
      // ========================================

      setHoveredExcerpt: (id) => {
        set((state) => {
          state.hoveredExcerptId = id
        })
      },

      setHoveredLink: (id) => {
        set((state) => {
          state.hoveredLinkId = id
        })
      },

      // ========================================
      // HIGHLIGHTING
      // ========================================

      highlightExcerpt: (id, highlighted) => {
        set((state) => {
          const excerpt = state.excerpts.get(id)
          if (excerpt) {
            excerpt.highlighted = highlighted
          }
        })
      },

      highlightLink: (id, highlighted) => {
        set((state) => {
          const link = state.links.get(id)
          if (link) {
            link.highlighted = highlighted
          }
        })
      },

      // ========================================
      // BULK OPERATIONS
      // ========================================

      deleteSelected: () => {
        const selectedIds = Array.from(get().selectedExcerptIds)
        selectedIds.forEach((id) => get().deleteExcerpt(id))
      },

      clearAll: () => {
        set((state) => {
          state.excerpts.clear()
          state.links.clear()
          state.selectedExcerptIds.clear()
          state.hoveredExcerptId = null
          state.hoveredLinkId = null
        })
      },

      // ========================================
      // GETTERS
      // ========================================

      getExcerpt: (id) => get().excerpts.get(id),
      
      getLink: (id) => get().links.get(id),
      
      getExcerptBySource: (documentId, pageIndex) => {
        const excerpts: Excerpt[] = []
        get().excerpts.forEach((e) => {
          if (e.source.documentId === documentId && e.source.pageIndex === pageIndex) {
            excerpts.push(e)
          }
        })
        return excerpts
      },
    }))
  )
)

// ============================================================================
// SELECTORS
// ============================================================================

export const selectExcerpts = (state: ExcerptStore) => Array.from(state.excerpts.values())
export const selectLinks = (state: ExcerptStore) => Array.from(state.links.values())
export const selectSelectedExcerpts = (state: ExcerptStore) => 
  Array.from(state.selectedExcerptIds).map(id => state.excerpts.get(id)).filter(Boolean) as Excerpt[]
