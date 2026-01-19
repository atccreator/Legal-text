import { create } from 'zustand'
import { subscribeWithSelector } from 'zustand/middleware'

// PDF viewport state for coordinate mapping
interface PdfViewportState {
  // Page dimensions (actual rendered size)
  pageDimensions: Map<number, { width: number; height: number }>
  
  // Scroll position within PDF viewport
  scrollTop: number
  scrollLeft: number
  
  // PDF viewport zoom level
  zoom: number
  
  // PDF panel bounding rect (screen coordinates)
  panelRect: DOMRect | null
  
  // Actions
  setPageDimensions: (pageIndex: number, width: number, height: number) => void
  setScroll: (top: number, left: number) => void
  setZoom: (zoom: number) => void
  setPanelRect: (rect: DOMRect | null) => void
  
  // Coordinate conversion
  pageToScreen: (pageIndex: number, normalizedX: number, normalizedY: number) => { x: number; y: number } | null
}

export const usePdfViewportStore = create<PdfViewportState>()(
  subscribeWithSelector((set, get) => ({
    pageDimensions: new Map(),
    scrollTop: 0,
    scrollLeft: 0,
    zoom: 1,
    panelRect: null,

    setPageDimensions: (pageIndex, width, height) => {
      set((state) => {
        const newMap = new Map(state.pageDimensions)
        newMap.set(pageIndex, { width, height })
        return { pageDimensions: newMap }
      })
    },

    setScroll: (top, left) => {
      set({ scrollTop: top, scrollLeft: left })
    },

    setZoom: (zoom) => {
      set({ zoom })
    },

    setPanelRect: (rect) => {
      set({ panelRect: rect })
    },

    pageToScreen: (pageIndex, normalizedX, normalizedY) => {
      const state = get()
      const pageDim = state.pageDimensions.get(pageIndex)
      const panelRect = state.panelRect
      
      if (!pageDim || !panelRect) return null
      
      // Calculate page position based on page index (assuming vertical stacking)
      let pageTop = 0
      for (let i = 0; i < pageIndex; i++) {
        const dim = state.pageDimensions.get(i)
        if (dim) {
          pageTop += dim.height + 10 // 10px gap between pages
        }
      }
      
      // Convert normalized coords to page-relative pixels
      const pageX = normalizedX * pageDim.width
      const pageY = normalizedY * pageDim.height
      
      // Apply scroll offset and get screen position
      const screenX = panelRect.left + pageX - state.scrollLeft
      const screenY = panelRect.top + pageTop + pageY - state.scrollTop
      
      return { x: screenX, y: screenY }
    },
  }))
)
