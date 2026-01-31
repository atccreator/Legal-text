/**
 * React Hooks for Coordinate Service
 * 
 * Provides React-friendly access to the coordinate service
 * with automatic subscription management and reactive updates.
 */

import { useEffect, useState, useCallback } from 'react'
import { coordinateService } from './CoordinateService'
import type {
  ScreenPoint,
  WorldPoint,
  PDFPoint,
  NormalizedPDFPoint,
  LinkEndpoints,
  Anchor,
  ICoordinateService,
} from './types'

/**
 * Hook to subscribe to coordinate service updates
 * Returns a version number that increments on each update
 */
export function useCoordinateUpdates(): number {
  const [version, setVersion] = useState(0)
  
  useEffect(() => {
    const unsubscribe = coordinateService.subscribe('update', () => {
      setVersion(v => v + 1)
    })
    return unsubscribe
  }, [])
  
  return version
}

/**
 * Hook to get link endpoints with automatic updates
 */
export function useLinkEndpoints(linkId: string): LinkEndpoints | undefined {
  const [endpoints, setEndpoints] = useState<LinkEndpoints | undefined>(
    () => coordinateService.getLinkEndpoints(linkId)
  )
  
  useEffect(() => {
    const unsubscribe = coordinateService.subscribe('update', () => {
      setEndpoints(coordinateService.getLinkEndpoints(linkId))
    })
    
    // Initial fetch
    setEndpoints(coordinateService.getLinkEndpoints(linkId))
    
    return unsubscribe
  }, [linkId])
  
  return endpoints
}

/**
 * Hook to get all link endpoints with automatic updates
 */
export function useAllLinkEndpoints(): Map<string, LinkEndpoints> {
  const [endpoints, setEndpoints] = useState<Map<string, LinkEndpoints>>(
    () => coordinateService.getAllLinkEndpoints()
  )
  
  useEffect(() => {
    const unsubscribe = coordinateService.subscribe('update', () => {
      setEndpoints(coordinateService.getAllLinkEndpoints())
    })
    
    // Initial fetch
    setEndpoints(coordinateService.getAllLinkEndpoints())
    
    return unsubscribe
  }, [])
  
  return endpoints
}

/**
 * Hook for screen ↔ world coordinate conversion
 */
export function useWorldCoordinates() {
  const screenToWorld = useCallback((point: ScreenPoint): WorldPoint | null => {
    return coordinateService.screenToWorld(point)
  }, [])
  
  const worldToScreen = useCallback((point: WorldPoint): ScreenPoint | null => {
    return coordinateService.worldToScreen(point)
  }, [])
  
  return { screenToWorld, worldToScreen }
}

/**
 * Hook for screen ↔ PDF coordinate conversion
 */
export function usePdfCoordinates() {
  const pdfToScreen = useCallback((point: PDFPoint | NormalizedPDFPoint): ScreenPoint | null => {
    return coordinateService.pdfToScreen(point)
  }, [])
  
  const screenToPdf = useCallback((point: ScreenPoint, documentId: string): PDFPoint | null => {
    return coordinateService.screenToPdf(point, documentId)
  }, [])
  
  return { pdfToScreen, screenToPdf }
}

/**
 * Hook for anchor resolution
 */
export function useAnchorCoordinates() {
  const anchorToScreen = useCallback((anchor: Anchor): ScreenPoint | null => {
    return coordinateService.anchorToScreen(anchor)
  }, [])
  
  const anchorToWorld = useCallback((anchor: Anchor): WorldPoint | null => {
    return coordinateService.anchorToWorld(anchor)
  }, [])
  
  return { anchorToScreen, anchorToWorld }
}

/**
 * Hook for panel bounds checking
 */
export function usePanelBounds() {
  const isPointInPdfPanel = useCallback((point: ScreenPoint): boolean => {
    return coordinateService.isPointInPdfPanel(point)
  }, [])
  
  const isPointInWorkspacePanel = useCallback((point: ScreenPoint): boolean => {
    return coordinateService.isPointInWorkspacePanel(point)
  }, [])
  
  const getContainingPanel = useCallback((point: ScreenPoint): 'pdf' | 'workspace' | null => {
    return coordinateService.getContainingPanel(point)
  }, [])
  
  return { isPointInPdfPanel, isPointInWorkspacePanel, getContainingPanel }
}

/**
 * Hook to track mouse position in both screen and world coordinates
 */
export function useMouseCoordinates() {
  const [screenPos, setScreenPos] = useState<ScreenPoint | null>(null)
  const [worldPos, setWorldPos] = useState<WorldPoint | null>(null)
  const [panel, setPanel] = useState<'pdf' | 'workspace' | null>(null)
  
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      const screen: ScreenPoint = { x: e.clientX, y: e.clientY }
      setScreenPos(screen)
      setWorldPos(coordinateService.screenToWorld(screen))
      setPanel(coordinateService.getContainingPanel(screen))
    }
    
    window.addEventListener('mousemove', handleMouseMove)
    return () => window.removeEventListener('mousemove', handleMouseMove)
  }, [])
  
  return { screenPos, worldPos, panel }
}

/**
 * Hook to register and track a canvas object's position
 */
export function useCanvasObjectPosition(
  objectId: string,
  position: WorldPoint,
  size: { width: number; height: number }
) {
  // Register object on mount
  useEffect(() => {
    coordinateService.registerCanvasObject(objectId, position, size)
    
    return () => {
      coordinateService.unregisterCanvasObject(objectId)
    }
  }, [objectId, size.width, size.height])
  
  // Update position when it changes
  useEffect(() => {
    coordinateService.updateCanvasObjectPosition(objectId, position)
  }, [objectId, position.x, position.y])
}
