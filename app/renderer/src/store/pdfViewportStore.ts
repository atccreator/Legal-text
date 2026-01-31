import { create } from 'zustand'
import { subscribeWithSelector } from 'zustand/middleware'

// Constants for PDF layout
const PAGE_GAP = 10 // Gap between pages in pixels

// PDF viewport state for coordinate mapping
interface PdfViewportState {
  // Active document ID
  documentId: string | null
  
  // Page dimensions (actual rendered size in pixels)
  pageDimensions: Map<number, { width: number; height: number }>
  
  // Original page dimensions (PDF points at 72 DPI)
  originalPageDimensions: Map<number, { width: number; height: number }>
  
  // Page offsets (cumulative vertical position)
  pageOffsets: Map<number, { top: number; height: number }>
  
  // Scroll position within PDF viewport
  scrollTop: number
  scrollLeft: number
  
  // PDF viewport zoom level
  zoom: number
  
  // PDF panel bounding rect (screen coordinates)
  panelRect: DOMRect | null
  
  // Total content height (for scroll calculations)
  totalContentHeight: number
  
  // Actions
  setDocumentId: (id: string | null) => void
  setPageDimensions: (pageIndex: number, width: number, height: number) => void
  setOriginalPageDimensions: (pageIndex: number, width: number, height: number) => void
  setScroll: (top: number, left: number) => void
  setZoom: (zoom: number) => void
  setPanelRect: (rect: DOMRect | null) => void
  recalculatePageOffsets: () => void
  clearPageData: () => void
  
  // Coordinate conversion helpers
  pageToScreen: (pageIndex: number, normalizedX: number, normalizedY: number) => { x: number; y: number } | null
  screenToPage: (screenX: number, screenY: number) => { pageIndex: number; x: number; y: number } | null
  normalizedToPixels: (pageIndex: number, normalizedX: number, normalizedY: number) => { x: number; y: number } | null
  pixelsToNormalized: (pageIndex: number, pixelX: number, pixelY: number) => { x: number; y: number } | null
  
  // Visibility helpers
  isPageVisible: (pageIndex: number) => boolean
  getVisiblePages: () => number[]
}

export const usePdfViewportStore = create<PdfViewportState>()(
  subscribeWithSelector((set, get) => ({
    documentId: null,
    pageDimensions: new Map(),
    originalPageDimensions: new Map(),
    pageOffsets: new Map(),
    scrollTop: 0,
    scrollLeft: 0,
    zoom: 1,
    panelRect: null,
    totalContentHeight: 0,

    setDocumentId: (id) => {
      set({ documentId: id })
    },

    setPageDimensions: (pageIndex, width, height) => {
      set((state) => {
        const newMap = new Map(state.pageDimensions)
        newMap.set(pageIndex, { width, height })
        return { pageDimensions: newMap }
      })
      // Recalculate offsets when dimensions change
      get().recalculatePageOffsets()
    },

    setOriginalPageDimensions: (pageIndex, width, height) => {
      set((state) => {
        const newMap = new Map(state.originalPageDimensions)
        newMap.set(pageIndex, { width, height })
        return { originalPageDimensions: newMap }
      })
    },

    setScroll: (top, left) => {
      set({ scrollTop: top, scrollLeft: left })
    },

    setZoom: (zoom) => {
      set({ zoom })
    },

    setPanelRect: (rect) => {
      const current = get().panelRect
      // Only update if rect values actually changed to prevent infinite update loops
      if (current && rect &&
          current.x === rect.x && current.y === rect.y &&
          current.width === rect.width && current.height === rect.height) {
        return
      }
      set({ panelRect: rect })
    },

    recalculatePageOffsets: () => {
      const state = get()
      const newOffsets = new Map<number, { top: number; height: number }>()
      let cumulativeTop = 0
      
      // Sort page indices to ensure correct order
      const sortedIndices = Array.from(state.pageDimensions.keys()).sort((a, b) => a - b)
      
      for (const pageIndex of sortedIndices) {
        const dim = state.pageDimensions.get(pageIndex)
        if (dim) {
          newOffsets.set(pageIndex, { top: cumulativeTop, height: dim.height })
          cumulativeTop += dim.height + PAGE_GAP
        }
      }
      
      set({ 
        pageOffsets: newOffsets,
        totalContentHeight: cumulativeTop - PAGE_GAP // Remove last gap
      })
    },

    clearPageData: () => {
      set({
        pageDimensions: new Map(),
        originalPageDimensions: new Map(),
        pageOffsets: new Map(),
        totalContentHeight: 0,
      })
    },

    pageToScreen: (pageIndex, normalizedX, normalizedY) => {
      const state = get()
      const pageDim = state.pageDimensions.get(pageIndex)
      const pageOffset = state.pageOffsets.get(pageIndex)
      const panelRect = state.panelRect
      
      if (!pageDim || !panelRect) return null
      
      // Get page top offset
      const pageTop = pageOffset?.top ?? 0
      
      // Convert normalized coords to page-relative pixels
      const pageX = normalizedX * pageDim.width
      const pageY = normalizedY * pageDim.height
      
      // Apply scroll offset and zoom, get screen position
      const screenX = panelRect.left + (pageX - state.scrollLeft) * state.zoom
      const screenY = panelRect.top + (pageTop + pageY - state.scrollTop) * state.zoom
      
      return { x: screenX, y: screenY }
    },

    screenToPage: (screenX, screenY) => {
      const state = get()
      const panelRect = state.panelRect
      
      if (!panelRect) return null
      
      // Check if point is within panel
      if (screenX < panelRect.left || screenX > panelRect.right ||
          screenY < panelRect.top || screenY > panelRect.bottom) {
        return null
      }
      
      // Convert screen to content coordinates
      const contentX = (screenX - panelRect.left) / state.zoom + state.scrollLeft
      const contentY = (screenY - panelRect.top) / state.zoom + state.scrollTop
      
      // Find which page the point is on
      for (const [pageIndex, offset] of state.pageOffsets.entries()) {
        const dim = state.pageDimensions.get(pageIndex)
        if (!dim) continue
        
        if (contentY >= offset.top && contentY < offset.top + dim.height) {
          return {
            pageIndex,
            x: contentX,
            y: contentY - offset.top,
          }
        }
      }
      
      return null
    },

    normalizedToPixels: (pageIndex, normalizedX, normalizedY) => {
      const state = get()
      const pageDim = state.pageDimensions.get(pageIndex)
      
      if (!pageDim) return null
      
      return {
        x: normalizedX * pageDim.width,
        y: normalizedY * pageDim.height,
      }
    },

    pixelsToNormalized: (pageIndex, pixelX, pixelY) => {
      const state = get()
      const pageDim = state.pageDimensions.get(pageIndex)
      
      if (!pageDim) return null
      
      return {
        x: pixelX / pageDim.width,
        y: pixelY / pageDim.height,
      }
    },

    isPageVisible: (pageIndex) => {
      const state = get()
      const pageOffset = state.pageOffsets.get(pageIndex)
      const pageDim = state.pageDimensions.get(pageIndex)
      const panelRect = state.panelRect
      
      if (!pageOffset || !pageDim || !panelRect) return false
      
      const pageTop = pageOffset.top
      const pageBottom = pageTop + pageDim.height
      const viewTop = state.scrollTop
      const viewBottom = viewTop + panelRect.height / state.zoom
      
      // Page is visible if it overlaps with the view
      return pageBottom >= viewTop && pageTop <= viewBottom
    },

    getVisiblePages: () => {
      const state = get()
      const visiblePages: number[] = []
      
      for (const pageIndex of state.pageOffsets.keys()) {
        if (state.isPageVisible(pageIndex)) {
          visiblePages.push(pageIndex)
        }
      }
      
      return visiblePages.sort((a, b) => a - b)
    },
  }))
)
