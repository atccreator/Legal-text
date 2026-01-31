/**
 * Unified Coordinate System - Type Definitions
 * 
 * This module defines the coordinate spaces used throughout the application:
 * 1. Screen Space - Browser viewport pixels
 * 2. Panel Space - Relative to each panel (PDF or Workspace)
 * 3. World Space - Infinite canvas coordinates
 * 4. PDF Space - PDF document coordinates (72 DPI points)
 */

// ============================================================================
// COORDINATE POINT TYPES
// ============================================================================

/**
 * Screen Space coordinates (browser viewport)
 * Origin: Top-left of browser window
 * Units: CSS pixels
 */
export interface ScreenPoint {
  x: number
  y: number
}

/**
 * Panel Space coordinates (within a panel)
 * Origin: Top-left of the panel container
 * Units: CSS pixels relative to panel
 */
export interface PanelPoint {
  x: number
  y: number
  panel: 'pdf' | 'workspace'
}

/**
 * World Space coordinates (infinite canvas)
 * Origin: Center of workspace (0,0)
 * Units: World units (1:1 at zoom=1)
 */
export interface WorldPoint {
  x: number
  y: number
  workspaceId?: string
}

/**
 * PDF Space coordinates
 * Origin: Top-left of the page
 * Units: PDF points (72 DPI)
 */
export interface PDFPoint {
  documentId: string
  pageIndex: number
  x: number  // PDF units (72 DPI points)
  y: number  // PDF units (72 DPI points)
}

/**
 * Normalized PDF coordinates (0-1 range)
 * Useful for device-independent positioning
 */
export interface NormalizedPDFPoint {
  documentId: string
  pageIndex: number
  x: number  // 0.0 to 1.0 (percentage of page width)
  y: number  // 0.0 to 1.0 (percentage of page height)
}

// ============================================================================
// RECTANGLE TYPES
// ============================================================================

/**
 * Generic rectangle with position and size
 */
export interface Rect {
  x: number
  y: number
  width: number
  height: number
}

/**
 * Normalized rectangle (0-1 range relative to page)
 */
export interface NormalizedRect {
  x: number
  y: number
  w: number
  h: number
}

/**
 * PDF region rectangle
 */
export interface PDFRect {
  documentId: string
  pageIndex: number
  x: number
  y: number
  width: number
  height: number
}

/**
 * Screen rectangle
 */
export interface ScreenRect extends Rect {
  // Additional properties for visibility checks
  isPartiallyVisible?: boolean
  isFullyVisible?: boolean
}

/**
 * World rectangle
 */
export interface WorldRect extends Rect {
  workspaceId?: string
}

// ============================================================================
// ANCHOR TYPES (for linking)
// ============================================================================

/**
 * PDF Region Anchor - links to a rectangular region in a PDF
 */
export interface PDFRegionAnchor {
  type: 'pdf-region'
  documentId: string
  pageIndex: number
  rect: NormalizedRect
  // Optional cached text content
  text?: string
}

/**
 * PDF Text Anchor - links to a text range in a PDF
 */
export interface PDFTextAnchor {
  type: 'pdf-text'
  documentId: string
  pageIndex: number
  textRange: { start: number; end: number }
  // Bounding rectangles for the text
  boundingRects?: NormalizedRect[]
  // Cached text content
  text?: string
}

/**
 * Canvas Object Anchor - links to an object on the canvas
 */
export interface CanvasObjectAnchor {
  type: 'canvas-object'
  workspaceId: string
  objectId: string
  // Optional connection point on the object
  connectionPoint?: 'left' | 'right' | 'top' | 'bottom' | 'center'
}

/**
 * Canvas Point Anchor - links to a specific point on the canvas
 */
export interface CanvasPointAnchor {
  type: 'canvas-point'
  workspaceId: string
  point: WorldPoint
}

/**
 * Union type for all anchor types
 */
export type Anchor = PDFRegionAnchor | PDFTextAnchor | CanvasObjectAnchor | CanvasPointAnchor

// ============================================================================
// CANVAS OBJECT TYPES
// ============================================================================

export interface BaseCanvasObject {
  id: string
  position: WorldPoint
  size: { width: number; height: number }
  rotation: number
  zIndex: number
  selected?: boolean
}

export interface ExcerptObject extends BaseCanvasObject {
  type: 'excerpt'
  sourceAnchor: PDFTextAnchor | PDFRegionAnchor
  text: string
  snapshot?: string  // Base64 image data of PDF region
}

export interface NoteObject extends BaseCanvasObject {
  type: 'note'
  content: string
  backgroundColor: string
}

export interface ImageObject extends BaseCanvasObject {
  type: 'image'
  src: string
  originalSize: { width: number; height: number }
}

export interface ShapeObject extends BaseCanvasObject {
  type: 'shape'
  shapeType: 'rectangle' | 'ellipse' | 'line' | 'arrow'
  fillColor?: string
  strokeColor?: string
  strokeWidth?: number
}

export interface GroupObject extends BaseCanvasObject {
  type: 'group'
  children: string[]  // IDs of child objects
}

export type CanvasObject = ExcerptObject | NoteObject | ImageObject | ShapeObject | GroupObject

// ============================================================================
// LINK TYPES
// ============================================================================

export interface LinkStyle {
  color: number
  width: number
  opacity: number
  curveStyle: 'bezier' | 'straight' | 'stepped'
  animated?: boolean
  dashPattern?: number[]
}

export interface LinkMetadata {
  createdAt: number
  updatedAt?: number
  label?: string
  notes?: string
  tags?: string[]
}

export interface Link {
  id: string
  sourceAnchor: Anchor
  targetAnchor: Anchor
  style?: Partial<LinkStyle>
  bidirectional: boolean
  metadata?: LinkMetadata
  highlighted?: boolean
}

// ============================================================================
// VIEWPORT STATE TYPES
// ============================================================================

export interface PDFViewportState {
  documentId: string
  scrollTop: number
  scrollLeft: number
  zoom: number
  // Page layout information
  pageOffsets: Map<number, { top: number; height: number }>
  // Rendered page dimensions (actual pixels)
  pageDimensions: Map<number, { width: number; height: number }>
  // Panel bounds in screen coordinates
  panelRect: DOMRect | null
}

export interface WorkspaceViewportState {
  workspaceId: string
  // World container position (offset from panel center)
  worldX: number
  worldY: number
  // Zoom scale
  scale: number
  // Panel bounds in screen coordinates
  panelRect: DOMRect | null
}

// ============================================================================
// COORDINATE TRANSFORM RESULTS
// ============================================================================

export interface TransformResult<T> {
  point: T
  isVisible: boolean
  isPartiallyVisible?: boolean
}

export interface LinkEndpoints {
  source: ScreenPoint
  target: ScreenPoint
  isVisible: boolean
  sourceInPanel: boolean
  targetInPanel: boolean
}

// ============================================================================
// SERVICE INTERFACE
// ============================================================================

/**
 * Main Coordinate Service interface
 */
export interface ICoordinateService {
  // PDF ↔ Screen
  pdfToScreen(point: PDFPoint | NormalizedPDFPoint): ScreenPoint | null
  screenToPdf(point: ScreenPoint, documentId: string): PDFPoint | null
  
  // Screen ↔ World (Canvas)
  screenToWorld(point: ScreenPoint): WorldPoint | null
  worldToScreen(point: WorldPoint): ScreenPoint | null
  
  // Direct transforms (for link rendering)
  pdfToWorld(point: PDFPoint | NormalizedPDFPoint): WorldPoint | null
  worldToPdf(point: WorldPoint, documentId: string): PDFPoint | null
  
  // Anchor to screen
  anchorToScreen(anchor: Anchor): ScreenPoint | null
  anchorToWorld(anchor: Anchor): WorldPoint | null
  
  // Rect transforms
  pdfRectToScreen(rect: PDFRect | { documentId: string; pageIndex: number; rect: NormalizedRect }): ScreenRect | null
  worldRectToScreen(rect: WorldRect): ScreenRect | null
  
  // Bounds checking
  isPointInPdfPanel(screen: ScreenPoint): boolean
  isPointInWorkspacePanel(screen: ScreenPoint): boolean
  getContainingPanel(screen: ScreenPoint): 'pdf' | 'workspace' | null
  
  // Link calculations
  calculateLinkEndpoints(link: Link): LinkEndpoints
  
  // Viewport sync
  updatePdfViewport(state: Partial<PDFViewportState>): void
  updateWorkspaceViewport(state: Partial<WorkspaceViewportState>): void
}
