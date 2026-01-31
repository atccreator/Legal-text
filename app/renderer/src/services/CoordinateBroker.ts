/**
 * Coordinate Broker - Legacy Compatibility Layer
 * 
 * This module provides backward compatibility with the original coordinate broker.
 * For new code, prefer using the unified coordinate service from './coordinates'.
 * 
 * @deprecated Use coordinateService from './coordinates' instead
 */

import { coordinateService } from './coordinates'
import type { ScreenPoint, WorldPoint, LinkEndpoints as NewLinkEndpoints } from './coordinates'

// Re-export types for backward compatibility
export type { ScreenPoint, WorldPoint }

// Legacy LinkEndpoints format (maps to new format)
export interface LinkEndpoints {
  pdfScreen: ScreenPoint
  canvasScreen: ScreenPoint
  isVisible: boolean
}

/**
 * Legacy Coordinate Broker wrapper
 * 
 * Wraps the new coordinate service to provide backward-compatible API
 * @deprecated Use coordinateService from './coordinates' instead
 */
class LegacyCoordinateBroker {
  /**
   * Mark all links as dirty for recalculation
   */
  markAllLinksDirty() {
    coordinateService.markAllLinksDirty('legacy-broker')
  }

  /**
   * Mark specific link as dirty
   */
  markLinkDirty(linkId: string) {
    coordinateService.markLinkDirty(linkId)
  }

  /**
   * Get cached endpoints for a link (legacy format)
   */
  getLinkEndpoints(linkId: string): LinkEndpoints | undefined {
    const newEndpoints = coordinateService.getLinkEndpoints(linkId)
    if (!newEndpoints) return undefined
    
    return {
      pdfScreen: newEndpoints.source,
      canvasScreen: newEndpoints.target,
      isVisible: newEndpoints.isVisible,
    }
  }

  /**
   * Get all cached endpoints (legacy format)
   */
  getAllLinkEndpoints(): Map<string, LinkEndpoints> {
    const newEndpoints = coordinateService.getAllLinkEndpoints()
    const legacyEndpoints = new Map<string, LinkEndpoints>()
    
    newEndpoints.forEach((endpoints, id) => {
      legacyEndpoints.set(id, {
        pdfScreen: endpoints.source,
        canvasScreen: endpoints.target,
        isVisible: endpoints.isVisible,
      })
    })
    
    return legacyEndpoints
  }

  /**
   * Force immediate calculation (synchronous)
   */
  forceCalculateAll(): Map<string, LinkEndpoints> {
    const newEndpoints = coordinateService.forceCalculateAll()
    const legacyEndpoints = new Map<string, LinkEndpoints>()
    
    newEndpoints.forEach((endpoints, id) => {
      legacyEndpoints.set(id, {
        pdfScreen: endpoints.source,
        canvasScreen: endpoints.target,
        isVisible: endpoints.isVisible,
      })
    })
    
    return legacyEndpoints
  }

  /**
   * Subscribe to updates
   */
  subscribe(listener: () => void): () => void {
    return coordinateService.subscribe('update', listener)
  }

  /**
   * Convert screen coordinates to workspace world coordinates
   */
  screenToWorkspace(screenPos: ScreenPoint): WorldPoint | null {
    return coordinateService.screenToWorld(screenPos)
  }

  /**
   * Convert workspace world coordinates to screen coordinates
   */
  workspaceNodeToScreen(worldPos: { x: number; y: number }): ScreenPoint | null {
    return coordinateService.worldToScreen(worldPos)
  }

  /**
   * Cleanup
   */
  destroy() {
    coordinateService.destroy()
  }
}

// Singleton instance for backward compatibility
export const coordinateBroker = new LegacyCoordinateBroker()

// Also export the new service for migration
export { coordinateService } from './coordinates'

