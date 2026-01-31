import { create } from 'zustand'
import { subscribeWithSelector } from 'zustand/middleware'

/**
 * Workspace (PixiJS canvas) viewport state for coordinate mapping
 * 
 * The world container uses a center-origin coordinate system where:
 * - worldX/worldY represent the offset of the world container from panel center
 * - scale represents the zoom level
 * 
 * Screen to World formula:
 *   worldX = (screenX - panelCenterX - worldOffsetX) / scale
 *   worldY = (screenY - panelCenterY - worldOffsetY) / scale
 * 
 * World to Screen formula:
 *   screenX = worldX * scale + worldOffsetX + panelCenterX
 *   screenY = worldY * scale + worldOffsetY + panelCenterY
 */
interface WorkspaceViewportState {
  // Active workspace ID
  workspaceId: string | null
  
  // World container position (offset from panel origin)
  // In PixiJS, this is the world container's x/y position
  worldX: number
  worldY: number
  
  // Zoom scale
  scale: number
  
  // Workspace panel bounding rect (screen coordinates)
  panelRect: DOMRect | null
  
  // Viewport bounds in world coordinates (for culling)
  viewportBounds: { minX: number; minY: number; maxX: number; maxY: number } | null
  
  // Actions
  setWorkspaceId: (id: string | null) => void
  setWorldTransform: (x: number, y: number, scale: number) => void
  setWorldPosition: (x: number, y: number) => void
  setScale: (scale: number) => void
  setPanelRect: (rect: DOMRect | null) => void
  
  // Pan/zoom actions
  pan: (deltaX: number, deltaY: number) => void
  zoomAtPoint: (screenX: number, screenY: number, scaleFactor: number) => void
  centerOnPoint: (worldX: number, worldY: number) => void
  fitBounds: (bounds: { minX: number; minY: number; maxX: number; maxY: number }, padding?: number) => void
  
  // Coordinate conversion helpers
  worldToScreen: (worldX: number, worldY: number) => { x: number; y: number } | null
  screenToWorld: (screenX: number, screenY: number) => { x: number; y: number } | null
  
  // Utility helpers
  updateViewportBounds: () => void
  isPointInViewport: (worldX: number, worldY: number) => boolean
  isRectInViewport: (rect: { x: number; y: number; width: number; height: number }) => boolean
}

export const useWorkspaceViewportStore = create<WorkspaceViewportState>()(
  subscribeWithSelector((set, get) => ({
    workspaceId: null,
    worldX: 0,
    worldY: 0,
    scale: 1,
    panelRect: null,
    viewportBounds: null,

    setWorkspaceId: (id) => {
      set({ workspaceId: id })
    },

    setWorldTransform: (x, y, scale) => {
      set({ worldX: x, worldY: y, scale })
      get().updateViewportBounds()
    },

    setWorldPosition: (x, y) => {
      set({ worldX: x, worldY: y })
      get().updateViewportBounds()
    },

    setScale: (scale) => {
      set({ scale })
      get().updateViewportBounds()
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
      get().updateViewportBounds()
    },

    pan: (deltaX, deltaY) => {
      set((state) => ({
        worldX: state.worldX + deltaX,
        worldY: state.worldY + deltaY,
      }))
      get().updateViewportBounds()
    },

    zoomAtPoint: (screenX, screenY, scaleFactor) => {
      const state = get()
      const panelRect = state.panelRect
      
      if (!panelRect) return
      
      // Get world position before zoom
      const worldBefore = state.screenToWorld(screenX, screenY)
      if (!worldBefore) return
      
      // Calculate new scale (clamped between 0.1 and 5)
      const newScale = Math.max(0.1, Math.min(5, state.scale * scaleFactor))
      
      // Calculate new world offset to keep the point stationary
      const newWorldX = screenX - panelRect.left - worldBefore.x * newScale
      const newWorldY = screenY - panelRect.top - worldBefore.y * newScale
      
      set({
        scale: newScale,
        worldX: newWorldX,
        worldY: newWorldY,
      })
      
      get().updateViewportBounds()
    },

    centerOnPoint: (worldX, worldY) => {
      const state = get()
      const panelRect = state.panelRect
      
      if (!panelRect) return
      
      // Center the world container such that the given world point is at panel center
      const newWorldOffsetX = panelRect.width / 2 - worldX * state.scale
      const newWorldOffsetY = panelRect.height / 2 - worldY * state.scale
      
      set({
        worldX: newWorldOffsetX,
        worldY: newWorldOffsetY,
      })
      
      get().updateViewportBounds()
    },

    fitBounds: (bounds, padding = 50) => {
      const state = get()
      const panelRect = state.panelRect
      
      if (!panelRect) return
      
      const boundsWidth = bounds.maxX - bounds.minX
      const boundsHeight = bounds.maxY - bounds.minY
      
      if (boundsWidth <= 0 || boundsHeight <= 0) return
      
      // Calculate scale to fit bounds with padding
      const availableWidth = panelRect.width - padding * 2
      const availableHeight = panelRect.height - padding * 2
      
      const scaleX = availableWidth / boundsWidth
      const scaleY = availableHeight / boundsHeight
      const newScale = Math.max(0.1, Math.min(5, Math.min(scaleX, scaleY)))
      
      // Calculate world offset to center bounds
      const centerX = (bounds.minX + bounds.maxX) / 2
      const centerY = (bounds.minY + bounds.maxY) / 2
      
      const newWorldX = panelRect.width / 2 - centerX * newScale
      const newWorldY = panelRect.height / 2 - centerY * newScale
      
      set({
        scale: newScale,
        worldX: newWorldX,
        worldY: newWorldY,
      })
      
      get().updateViewportBounds()
    },

    worldToScreen: (worldX, worldY) => {
      const state = get()
      const panelRect = state.panelRect
      
      if (!panelRect) return null
      
      const screenX = panelRect.left + state.worldX + worldX * state.scale
      const screenY = panelRect.top + state.worldY + worldY * state.scale
      
      return { x: screenX, y: screenY }
    },

    screenToWorld: (screenX, screenY) => {
      const state = get()
      const panelRect = state.panelRect
      
      if (!panelRect) return null
      
      const worldX = (screenX - panelRect.left - state.worldX) / state.scale
      const worldY = (screenY - panelRect.top - state.worldY) / state.scale
      
      return { x: worldX, y: worldY }
    },

    updateViewportBounds: () => {
      const state = get()
      const panelRect = state.panelRect
      
      if (!panelRect) {
        set({ viewportBounds: null })
        return
      }
      
      // Calculate world-space bounds of the visible viewport
      const topLeft = state.screenToWorld(panelRect.left, panelRect.top)
      const bottomRight = state.screenToWorld(panelRect.right, panelRect.bottom)
      
      if (!topLeft || !bottomRight) {
        set({ viewportBounds: null })
        return
      }
      
      set({
        viewportBounds: {
          minX: topLeft.x,
          minY: topLeft.y,
          maxX: bottomRight.x,
          maxY: bottomRight.y,
        },
      })
    },

    isPointInViewport: (worldX, worldY) => {
      const bounds = get().viewportBounds
      if (!bounds) return false
      
      return (
        worldX >= bounds.minX &&
        worldX <= bounds.maxX &&
        worldY >= bounds.minY &&
        worldY <= bounds.maxY
      )
    },

    isRectInViewport: (rect) => {
      const bounds = get().viewportBounds
      if (!bounds) return false
      
      // Check if rectangles overlap
      return !(
        rect.x + rect.width < bounds.minX ||
        rect.x > bounds.maxX ||
        rect.y + rect.height < bounds.minY ||
        rect.y > bounds.maxY
      )
    },
  }))
)
