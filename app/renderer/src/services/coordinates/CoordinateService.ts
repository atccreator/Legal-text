/**
 * Unified Coordinate Service
 * 
 * Provides comprehensive coordinate transformations between:
 * - Screen Space (browser viewport)
 * - Panel Space (PDF panel or Workspace panel)  
 * - World Space (infinite canvas)
 * - PDF Space (document coordinates)
 * 
 * Uses reactive stores for viewport state and supports efficient batch updates.
 */

import { usePdfViewportStore } from '../../store/pdfViewportStore'
import { useWorkspaceViewportStore } from '../../store/workspaceViewportStore'
import { useLinkStore } from '../../store/linkStore'
import {
  ScreenPoint,
  WorldPoint,
  PDFPoint,
  NormalizedPDFPoint,
  PanelPoint,
  Anchor,
  PDFRegionAnchor,
  PDFTextAnchor,
  CanvasObjectAnchor,
  CanvasPointAnchor,
  PDFRect,
  ScreenRect,
  WorldRect,
  NormalizedRect,
  LinkEndpoints,
  ICoordinateService,
  PDFViewportState,
  WorkspaceViewportState,
  Link,
} from './types'

// Re-export types for convenience
export * from './types'

// Constants
const PDF_DPI = 72  // Standard PDF DPI
const PAGE_GAP = 10 // Gap between PDF pages in pixels

/**
 * Check if a point is a normalized PDF point (0-1 range)
 */
function isNormalizedPDFPoint(point: PDFPoint | NormalizedPDFPoint): point is NormalizedPDFPoint {
  return point.x >= 0 && point.x <= 1 && point.y >= 0 && point.y <= 1
}

/**
 * Coordinate Service Implementation
 */
class CoordinateService implements ICoordinateService {
  private dirtyLinks = new Set<string>()
  private frameRequested = false
  private listeners = new Map<string, Set<() => void>>()
  
  // Cached link endpoints for fast access
  private linkEndpointsCache = new Map<string, LinkEndpoints>()
  
  // Unsubscribe functions for store subscriptions
  private unsubscribes: (() => void)[] = []
  
  // Canvas objects registry (for object anchor resolution)
  private canvasObjects = new Map<string, { position: WorldPoint; size: { width: number; height: number } }>()
  
  // Flag to track if subscriptions are set up
  private subscriptionsInitialized = false

  constructor() {
    // Don't setup subscriptions immediately - do it lazily
    // This prevents circular dependency issues at module load time
  }
  
  /**
   * Initialize subscriptions lazily
   */
  private ensureSubscriptions() {
    if (this.subscriptionsInitialized) return
    this.subscriptionsInitialized = true
    this.setupSubscriptions()
  }

  // ============================================================================
  // STORE SUBSCRIPTIONS
  // ============================================================================

  private setupSubscriptions() {
    try {
      // Listen to PDF viewport changes
      const unsubPdf = usePdfViewportStore.subscribe(
        (state) => [state.scrollTop, state.scrollLeft, state.zoom, state.panelRect],
        () => this.markAllLinksDirty('pdf-viewport-change')
      )
      
      // Listen to workspace viewport changes  
      const unsubWorkspace = useWorkspaceViewportStore.subscribe(
        (state) => [state.worldX, state.worldY, state.scale, state.panelRect],
        () => this.markAllLinksDirty('workspace-viewport-change')
      )
      
      // Listen to link changes
      const unsubLinks = useLinkStore.subscribe(
        (state) => state.links,
        (links) => {
          links.forEach(link => this.dirtyLinks.add(link.id))
          this.scheduleUpdate()
        }
      )

      this.unsubscribes = [unsubPdf, unsubWorkspace, unsubLinks]
    } catch (error) {
      console.warn('[CoordinateService] Failed to setup subscriptions:', error)
    }
  }

  // ============================================================================
  // PDF ↔ SCREEN TRANSFORMS
  // ============================================================================

  /**
   * Convert PDF coordinates to screen coordinates
   * 
   * @param point - PDF point (absolute or normalized)
   * @returns Screen point or null if conversion not possible
   */
  pdfToScreen(point: PDFPoint | NormalizedPDFPoint): ScreenPoint | null {
    const pdfState = usePdfViewportStore.getState()
    const { pageDimensions, scrollTop, scrollLeft, zoom, panelRect } = pdfState
    
    if (!panelRect) return null
    
    const pageDim = pageDimensions.get(point.pageIndex)
    if (!pageDim) return null
    
    // Calculate cumulative page offset (vertical stacking)
    let pageTop = 0
    for (let i = 0; i < point.pageIndex; i++) {
      const dim = pageDimensions.get(i)
      if (dim) {
        pageTop += dim.height + PAGE_GAP
      }
    }
    
    // Convert to page-relative pixels
    let pageX: number
    let pageY: number
    
    if (isNormalizedPDFPoint(point)) {
      // Normalized coordinates (0-1)
      pageX = point.x * pageDim.width
      pageY = point.y * pageDim.height
    } else {
      // Absolute PDF coordinates (72 DPI points)
      // Scale from PDF points to rendered pixels
      const pdfPoint = point as PDFPoint
      const scale = pageDim.width / (pageDim.width / zoom)  // Account for current zoom
      pageX = pdfPoint.x * scale
      pageY = pdfPoint.y * scale
    }
    
    // Apply scroll offset and zoom, get screen position
    const screenX = panelRect.left + (pageX - scrollLeft) * zoom
    const screenY = panelRect.top + (pageTop + pageY - scrollTop) * zoom
    
    return { x: screenX, y: screenY }
  }

  /**
   * Convert screen coordinates to PDF coordinates
   * 
   * @param point - Screen point
   * @param documentId - Target document ID
   * @returns PDF point or null if point is not in PDF panel
   */
  screenToPdf(point: ScreenPoint, documentId: string): PDFPoint | null {
    const pdfState = usePdfViewportStore.getState()
    const { pageDimensions, scrollTop, scrollLeft, zoom, panelRect } = pdfState
    
    if (!panelRect) return null
    
    // Check if point is within PDF panel
    if (!this.isPointInPdfPanel(point)) return null
    
    // Convert screen to panel-relative coordinates
    const panelX = (point.x - panelRect.left) / zoom + scrollLeft
    const panelY = (point.y - panelRect.top) / zoom + scrollTop
    
    // Find which page the point is on
    let cumulativeTop = 0
    let pageIndex = 0
    
    for (const [idx, dim] of pageDimensions.entries()) {
      const pageBottom = cumulativeTop + dim.height + PAGE_GAP
      if (panelY >= cumulativeTop && panelY < pageBottom) {
        pageIndex = idx
        break
      }
      cumulativeTop = pageBottom
    }
    
    const pageDim = pageDimensions.get(pageIndex)
    if (!pageDim) return null
    
    // Calculate page-relative position
    let pageTop = 0
    for (let i = 0; i < pageIndex; i++) {
      const dim = pageDimensions.get(i)
      if (dim) {
        pageTop += dim.height + PAGE_GAP
      }
    }
    
    const pdfX = panelX
    const pdfY = panelY - pageTop
    
    return {
      documentId,
      pageIndex,
      x: pdfX,
      y: pdfY,
    }
  }

  // ============================================================================
  // SCREEN ↔ WORLD TRANSFORMS
  // ============================================================================

  /**
   * Convert screen coordinates to world coordinates
   * 
   * Formula: worldX = (screenX - panelLeft - worldOffsetX) / scale
   */
  screenToWorld(point: ScreenPoint): WorldPoint | null {
    this.ensureSubscriptions()
    const wsState = useWorkspaceViewportStore.getState()
    const { worldX, worldY, scale, panelRect } = wsState
    
    if (!panelRect) return null
    
    // Check if point is in workspace panel
    if (!this.isPointInWorkspacePanel(point)) return null
    
    const worldPosX = (point.x - panelRect.left - worldX) / scale
    const worldPosY = (point.y - panelRect.top - worldY) / scale
    
    return { x: worldPosX, y: worldPosY }
  }

  /**
   * Convert world coordinates to screen coordinates
   * 
   * Formula: screenX = worldX * scale + worldOffsetX + panelLeft
   */
  worldToScreen(point: WorldPoint): ScreenPoint | null {
    const wsState = useWorkspaceViewportStore.getState()
    const { worldX, worldY, scale, panelRect } = wsState
    
    if (!panelRect) return null
    
    const screenX = point.x * scale + worldX + panelRect.left
    const screenY = point.y * scale + worldY + panelRect.top
    
    return { x: screenX, y: screenY }
  }

  // ============================================================================
  // DIRECT PDF ↔ WORLD TRANSFORMS
  // ============================================================================

  /**
   * Convert PDF coordinates directly to world coordinates
   * Useful for creating links from PDF to canvas
   */
  pdfToWorld(point: PDFPoint | NormalizedPDFPoint): WorldPoint | null {
    // First convert to screen
    const screenPoint = this.pdfToScreen(point)
    if (!screenPoint) return null
    
    // Then convert screen to world
    // For cross-panel transforms, we need to handle the case where
    // the screen point is in PDF panel but target is world space
    const wsState = useWorkspaceViewportStore.getState()
    const { worldX, worldY, scale, panelRect } = wsState
    
    if (!panelRect) return null
    
    // Convert screen to world coordinates
    const worldPosX = (screenPoint.x - panelRect.left - worldX) / scale
    const worldPosY = (screenPoint.y - panelRect.top - worldY) / scale
    
    return { x: worldPosX, y: worldPosY }
  }

  /**
   * Convert world coordinates to PDF coordinates
   * Useful for finding what PDF content is at a canvas position
   */
  worldToPdf(point: WorldPoint, documentId: string): PDFPoint | null {
    // First convert to screen
    const screenPoint = this.worldToScreen(point)
    if (!screenPoint) return null
    
    // Then convert screen to PDF
    return this.screenToPdf(screenPoint, documentId)
  }

  // ============================================================================
  // ANCHOR TRANSFORMS
  // ============================================================================

  /**
   * Convert any anchor type to screen coordinates
   */
  anchorToScreen(anchor: Anchor): ScreenPoint | null {
    switch (anchor.type) {
      case 'pdf-region':
        return this.pdfRegionAnchorToScreen(anchor)
      case 'pdf-text':
        return this.pdfTextAnchorToScreen(anchor)
      case 'canvas-object':
        return this.canvasObjectAnchorToScreen(anchor)
      case 'canvas-point':
        return this.canvasPointAnchorToScreen(anchor)
      default:
        return null
    }
  }

  /**
   * Convert any anchor type to world coordinates
   */
  anchorToWorld(anchor: Anchor): WorldPoint | null {
    const screenPoint = this.anchorToScreen(anchor)
    if (!screenPoint) return null
    
    // For PDF anchors, we need direct conversion
    if (anchor.type === 'pdf-region' || anchor.type === 'pdf-text') {
      const wsState = useWorkspaceViewportStore.getState()
      const { worldX, worldY, scale, panelRect } = wsState
      if (!panelRect) return null
      
      return {
        x: (screenPoint.x - panelRect.left - worldX) / scale,
        y: (screenPoint.y - panelRect.top - worldY) / scale,
      }
    }
    
    // For canvas anchors, just use screenToWorld
    return this.screenToWorld(screenPoint)
  }

  private pdfRegionAnchorToScreen(anchor: PDFRegionAnchor): ScreenPoint | null {
    const pdfState = usePdfViewportStore.getState()
    const pageDim = pdfState.pageDimensions.get(anchor.pageIndex)
    const panelRect = pdfState.panelRect
    
    if (!pageDim || !panelRect) return null
    
    // Calculate cumulative page offset
    let pageTop = 0
    for (let i = 0; i < anchor.pageIndex; i++) {
      const dim = pdfState.pageDimensions.get(i)
      if (dim) {
        pageTop += dim.height + PAGE_GAP
      }
    }
    
    // Use center-right of selection as anchor point for outgoing link
    const pageX = (anchor.rect.x + anchor.rect.w) * pageDim.width
    const pageY = (anchor.rect.y + anchor.rect.h / 2) * pageDim.height
    
    // Apply scroll offset and zoom
    const screenX = panelRect.left + (pageX - pdfState.scrollLeft) * pdfState.zoom
    const screenY = panelRect.top + (pageTop + pageY - pdfState.scrollTop) * pdfState.zoom
    
    return { x: screenX, y: screenY }
  }

  private pdfTextAnchorToScreen(anchor: PDFTextAnchor): ScreenPoint | null {
    // If we have bounding rects, use the first one
    if (anchor.boundingRects && anchor.boundingRects.length > 0) {
      const firstRect = anchor.boundingRects[0]
      if (firstRect) {
        return this.pdfRegionAnchorToScreen({
          type: 'pdf-region',
          documentId: anchor.documentId,
          pageIndex: anchor.pageIndex,
          rect: firstRect,
        })
      }
    }
    
    // Fallback: can't resolve without bounding rects
    return null
  }

  private canvasObjectAnchorToScreen(anchor: CanvasObjectAnchor): ScreenPoint | null {
    const obj = this.canvasObjects.get(anchor.objectId)
    if (!obj) return null
    
    // Calculate connection point based on specified side
    let worldPoint: WorldPoint = { ...obj.position }
    const halfW = obj.size.width / 2
    const halfH = obj.size.height / 2
    
    switch (anchor.connectionPoint) {
      case 'left':
        worldPoint.x -= halfW
        break
      case 'right':
        worldPoint.x += halfW
        break
      case 'top':
        worldPoint.y -= halfH
        break
      case 'bottom':
        worldPoint.y += halfH
        break
      case 'center':
      default:
        // Use center position
        break
    }
    
    return this.worldToScreen(worldPoint)
  }

  private canvasPointAnchorToScreen(anchor: CanvasPointAnchor): ScreenPoint | null {
    return this.worldToScreen(anchor.point)
  }

  // ============================================================================
  // RECT TRANSFORMS
  // ============================================================================

  /**
   * Convert PDF rectangle to screen rectangle
   */
  pdfRectToScreen(rect: PDFRect | { documentId: string; pageIndex: number; rect: NormalizedRect }): ScreenRect | null {
    const pdfState = usePdfViewportStore.getState()
    const pageDim = pdfState.pageDimensions.get(rect.pageIndex)
    const panelRect = pdfState.panelRect
    
    if (!pageDim || !panelRect) return null
    
    let x: number, y: number, width: number, height: number
    
    if ('rect' in rect) {
      // Normalized rect
      x = rect.rect.x * pageDim.width
      y = rect.rect.y * pageDim.height
      width = rect.rect.w * pageDim.width
      height = rect.rect.h * pageDim.height
    } else {
      // Absolute rect
      x = rect.x
      y = rect.y
      width = rect.width
      height = rect.height
    }
    
    // Calculate page offset
    let pageTop = 0
    for (let i = 0; i < rect.pageIndex; i++) {
      const dim = pdfState.pageDimensions.get(i)
      if (dim) {
        pageTop += dim.height + PAGE_GAP
      }
    }
    
    // Apply scroll and zoom
    const screenX = panelRect.left + (x - pdfState.scrollLeft) * pdfState.zoom
    const screenY = panelRect.top + (pageTop + y - pdfState.scrollTop) * pdfState.zoom
    const screenWidth = width * pdfState.zoom
    const screenHeight = height * pdfState.zoom
    
    // Check visibility
    const isFullyVisible = 
      screenX >= panelRect.left &&
      screenY >= panelRect.top &&
      screenX + screenWidth <= panelRect.right &&
      screenY + screenHeight <= panelRect.bottom
    
    const isPartiallyVisible =
      screenX + screenWidth >= panelRect.left &&
      screenY + screenHeight >= panelRect.top &&
      screenX <= panelRect.right &&
      screenY <= panelRect.bottom
    
    return {
      x: screenX,
      y: screenY,
      width: screenWidth,
      height: screenHeight,
      isFullyVisible,
      isPartiallyVisible,
    }
  }

  /**
   * Convert world rectangle to screen rectangle
   */
  worldRectToScreen(rect: WorldRect): ScreenRect | null {
    const wsState = useWorkspaceViewportStore.getState()
    const { worldX, worldY, scale, panelRect } = wsState
    
    if (!panelRect) return null
    
    const screenX = rect.x * scale + worldX + panelRect.left
    const screenY = rect.y * scale + worldY + panelRect.top
    const screenWidth = rect.width * scale
    const screenHeight = rect.height * scale
    
    const isFullyVisible = 
      screenX >= panelRect.left &&
      screenY >= panelRect.top &&
      screenX + screenWidth <= panelRect.right &&
      screenY + screenHeight <= panelRect.bottom
    
    const isPartiallyVisible =
      screenX + screenWidth >= panelRect.left &&
      screenY + screenHeight >= panelRect.top &&
      screenX <= panelRect.right &&
      screenY <= panelRect.bottom
    
    return {
      x: screenX,
      y: screenY,
      width: screenWidth,
      height: screenHeight,
      isFullyVisible,
      isPartiallyVisible,
    }
  }

  // ============================================================================
  // BOUNDS CHECKING
  // ============================================================================

  /**
   * Check if a screen point is within the PDF panel
   */
  isPointInPdfPanel(point: ScreenPoint): boolean {
    const panelRect = usePdfViewportStore.getState().panelRect
    if (!panelRect) return false
    
    return (
      point.x >= panelRect.left &&
      point.x <= panelRect.right &&
      point.y >= panelRect.top &&
      point.y <= panelRect.bottom
    )
  }

  /**
   * Check if a screen point is within the workspace panel
   */
  isPointInWorkspacePanel(point: ScreenPoint): boolean {
    const panelRect = useWorkspaceViewportStore.getState().panelRect
    if (!panelRect) return false
    
    return (
      point.x >= panelRect.left &&
      point.x <= panelRect.right &&
      point.y >= panelRect.top &&
      point.y <= panelRect.bottom
    )
  }

  /**
   * Get which panel contains the screen point
   */
  getContainingPanel(point: ScreenPoint): 'pdf' | 'workspace' | null {
    this.ensureSubscriptions()
    if (this.isPointInPdfPanel(point)) return 'pdf'
    if (this.isPointInWorkspacePanel(point)) return 'workspace'
    return null
  }

  // ============================================================================
  // LINK CALCULATIONS
  // ============================================================================

  /**
   * Calculate screen endpoints for a link
   */
  calculateLinkEndpoints(link: Link): LinkEndpoints {
    const sourceScreen = this.anchorToScreen(link.sourceAnchor)
    const targetScreen = this.anchorToScreen(link.targetAnchor)
    
    const sourceInPanel = sourceScreen ? (
      this.isPointInPdfPanel(sourceScreen) || this.isPointInWorkspacePanel(sourceScreen)
    ) : false
    
    const targetInPanel = targetScreen ? (
      this.isPointInPdfPanel(targetScreen) || this.isPointInWorkspacePanel(targetScreen)
    ) : false
    
    return {
      source: sourceScreen || { x: -1000, y: -1000 },
      target: targetScreen || { x: -1000, y: -1000 },
      isVisible: sourceScreen !== null && targetScreen !== null,
      sourceInPanel,
      targetInPanel,
    }
  }

  /**
   * Calculate link endpoints for legacy Link format (from/to structure)
   * Maintains backward compatibility with existing link store
   */
  calculateLegacyLinkEndpoints(link: { 
    from: { documentId: string; pageIndex: number; rect: NormalizedRect }; 
    to: { position: { x: number; y: number } } 
  }): LinkEndpoints {
    const pdfScreen = this.pdfRegionAnchorToScreen({
      type: 'pdf-region',
      documentId: link.from.documentId,
      pageIndex: link.from.pageIndex,
      rect: link.from.rect,
    })
    
    const canvasScreen = this.worldToScreen(link.to.position)
    
    const sourceInPanel = pdfScreen ? this.isPointInPdfPanel(pdfScreen) : false
    const targetInPanel = canvasScreen ? this.isPointInWorkspacePanel(canvasScreen) : false
    
    return {
      source: pdfScreen || { x: -1000, y: -1000 },
      target: canvasScreen || { x: -1000, y: -1000 },
      isVisible: pdfScreen !== null && canvasScreen !== null,
      sourceInPanel,
      targetInPanel,
    }
  }

  // ============================================================================
  // VIEWPORT UPDATES
  // ============================================================================

  /**
   * Update PDF viewport state
   */
  updatePdfViewport(state: Partial<PDFViewportState>): void {
    const store = usePdfViewportStore.getState()
    
    if (state.scrollTop !== undefined || state.scrollLeft !== undefined) {
      store.setScroll(
        state.scrollTop ?? store.scrollTop,
        state.scrollLeft ?? store.scrollLeft
      )
    }
    
    if (state.zoom !== undefined) {
      store.setZoom(state.zoom)
    }
    
    if (state.panelRect !== undefined) {
      store.setPanelRect(state.panelRect)
    }
    
    if (state.pageDimensions) {
      state.pageDimensions.forEach((dim, pageIndex) => {
        store.setPageDimensions(pageIndex, dim.width, dim.height)
      })
    }
  }

  /**
   * Update workspace viewport state
   */
  updateWorkspaceViewport(state: Partial<WorkspaceViewportState>): void {
    const store = useWorkspaceViewportStore.getState()
    
    if (state.worldX !== undefined && state.worldY !== undefined && state.scale !== undefined) {
      store.setWorldTransform(state.worldX, state.worldY, state.scale)
    } else {
      if (state.worldX !== undefined || state.worldY !== undefined) {
        store.setWorldPosition(
          state.worldX ?? store.worldX,
          state.worldY ?? store.worldY
        )
      }
      
      if (state.scale !== undefined) {
        store.setScale(state.scale)
      }
    }
    
    if (state.panelRect !== undefined) {
      store.setPanelRect(state.panelRect)
    }
  }

  // ============================================================================
  // CANVAS OBJECT REGISTRY
  // ============================================================================

  /**
   * Register a canvas object for anchor resolution
   */
  registerCanvasObject(id: string, position: WorldPoint, size: { width: number; height: number }): void {
    this.canvasObjects.set(id, { position, size })
  }

  /**
   * Update canvas object position
   */
  updateCanvasObjectPosition(id: string, position: WorldPoint): void {
    const obj = this.canvasObjects.get(id)
    if (obj) {
      obj.position = position
      this.markAllLinksDirty('object-moved')
    }
  }

  /**
   * Unregister a canvas object
   */
  unregisterCanvasObject(id: string): void {
    this.canvasObjects.delete(id)
  }

  // ============================================================================
  // DIRTY FLAG SYSTEM
  // ============================================================================

  /**
   * Mark all links as dirty for recalculation
   */
  markAllLinksDirty(reason?: string): void {
    const links = useLinkStore.getState().links
    links.forEach(link => this.dirtyLinks.add(link.id))
    this.scheduleUpdate()
    
    if (reason) {
      console.debug(`[CoordinateService] Links marked dirty: ${reason}`)
    }
  }

  /**
   * Mark specific link as dirty
   */
  markLinkDirty(linkId: string): void {
    this.dirtyLinks.add(linkId)
    this.scheduleUpdate()
  }

  /**
   * Schedule batch update in next animation frame
   */
  private scheduleUpdate(): void {
    if (this.frameRequested) return
    this.frameRequested = true
    
    requestAnimationFrame(() => {
      this.processUpdates()
      this.frameRequested = false
    })
  }

  /**
   * Process all dirty links and recalculate positions
   */
  private processUpdates(): void {
    if (this.dirtyLinks.size === 0) return
    
    const links = useLinkStore.getState().links
    const linksById = new Map(links.map(l => [l.id, l]))
    
    this.dirtyLinks.forEach(linkId => {
      const link = linksById.get(linkId)
      if (link) {
        // Support both new and legacy link formats
        const endpoints = this.calculateLegacyLinkEndpoints(link as any)
        this.linkEndpointsCache.set(linkId, endpoints)
      } else {
        this.linkEndpointsCache.delete(linkId)
      }
    })
    
    this.dirtyLinks.clear()
    
    // Notify listeners
    this.notifyListeners('update')
  }

  // ============================================================================
  // EVENT SYSTEM
  // ============================================================================

  /**
   * Subscribe to coordinate updates
   */
  subscribe(event: string, listener: () => void): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set())
    }
    this.listeners.get(event)!.add(listener)
    
    return () => {
      this.listeners.get(event)?.delete(listener)
    }
  }

  /**
   * Notify listeners of an event
   */
  private notifyListeners(event: string): void {
    this.listeners.get(event)?.forEach(listener => listener())
  }

  // ============================================================================
  // CACHE ACCESS
  // ============================================================================

  /**
   * Get cached endpoints for a link
   */
  getLinkEndpoints(linkId: string): LinkEndpoints | undefined {
    return this.linkEndpointsCache.get(linkId)
  }

  /**
   * Get all cached endpoints
   */
  getAllLinkEndpoints(): Map<string, LinkEndpoints> {
    return new Map(this.linkEndpointsCache)
  }

  /**
   * Force immediate calculation (synchronous)
   */
  forceCalculateAll(): Map<string, LinkEndpoints> {
    const links = useLinkStore.getState().links
    const results = new Map<string, LinkEndpoints>()
    
    links.forEach(link => {
      const endpoints = this.calculateLegacyLinkEndpoints(link as any)
      results.set(link.id, endpoints)
      this.linkEndpointsCache.set(link.id, endpoints)
    })
    
    return results
  }

  // ============================================================================
  // CLEANUP
  // ============================================================================

  /**
   * Cleanup all subscriptions and caches
   */
  destroy(): void {
    this.unsubscribes.forEach(unsub => unsub())
    this.listeners.clear()
    this.linkEndpointsCache.clear()
    this.dirtyLinks.clear()
    this.canvasObjects.clear()
  }
}

// Singleton instance
export const coordinateService = new CoordinateService()

// Default export for convenience
export default coordinateService
