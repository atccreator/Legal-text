/**
 * Workspace Types
 * 
 * Types for workspace objects, links, and anchors.
 * Re-exports coordinate types from the unified coordinate system.
 */

// Re-export coordinate types for convenience
export type {
  ScreenPoint,
  WorldPoint,
  PDFPoint,
  NormalizedPDFPoint,
  PanelPoint,
  Rect,
  ScreenRect,
  WorldRect,
  PDFRect,
  PDFRegionAnchor,
  PDFTextAnchor,
  CanvasObjectAnchor,
  CanvasPointAnchor,
  Anchor,
  BaseCanvasObject,
  ExcerptObject,
  NoteObject,
  ImageObject,
  ShapeObject,
  GroupObject,
  CanvasObject,
  LinkStyle,
  LinkMetadata,
  Link as UnifiedLink,
  LinkEndpoints,
} from '../services/coordinates/types'

// ============================================================================
// LEGACY TYPES (for backward compatibility)
// ============================================================================

// Normalized rectangle (0-1 range relative to page)
export interface NormalizedRect {
  x: number
  y: number
  w: number
  h: number
}

export interface PdfAnchor {
  documentId: string
  pageIndex: number
  rect: NormalizedRect
  // Optional: extracted text content
  text?: string
}

export interface WorkspaceNode {
  id: string
  position: {
    x: number
    y: number
  }
  // Node dimensions
  size?: {
    width: number
    height: number
  }
  // Optional content/label
  content?: string
  // Visual state
  selected?: boolean
  // Connection point offset
  connectionPoint?: 'left' | 'right' | 'top' | 'bottom'
}

// Link types based on how it was created
export type LinkType = 'excerpt' | 'reference' | 'annotation'

// Visual properties for link rendering
export interface LinkVisual {
  color: number
  width: number
  opacity: number
  // Curve style
  curveStyle: 'bezier' | 'straight' | 'stepped'
  // Animation
  animated?: boolean
  dashPattern?: number[]
}

// Metadata for link
export interface LegacyLinkMetadata {
  createdAt: number
  label?: string
  notes?: string
  tags?: string[]
}

/**
 * Legacy Link interface (PDF anchor → Workspace node)
 * This is the current working format used by linkStore
 */
export interface Link {
  id: string
  from: PdfAnchor
  to: WorkspaceNode
  // Link classification
  type?: LinkType
  // Visual customization
  color?: number
  visual?: Partial<LinkVisual>
  // Metadata
  metadata?: LegacyLinkMetadata
  // Link state
  highlighted?: boolean
}

// ============================================================================
// DRAGGING STATE
// ============================================================================

// Dragging state for link creation
export interface DraggingLinkState {
  active: boolean
  // Source anchor (PDF selection)
  source: PdfAnchor | null
  // Current pointer position (screen coords)
  currentPosition: { x: number; y: number } | null
  // Source position (screen coords, cached for performance)
  sourceScreenPosition: { x: number; y: number } | null
}

// ============================================================================
// LINK ANCHOR (for bidirectional links)
// ============================================================================

// Link anchor for bidirectional links (future)
export interface LinkAnchor {
  containerId: string     // PDF page or canvas element
  position: { x: number; y: number }   // Local coordinates
  bounds: NormalizedRect  // Selection bounds
  globalPosition: { x: number; y: number }  // Cached global coords
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Convert a PdfAnchor to the new PDFRegionAnchor format
 */
export function pdfAnchorToPDFRegionAnchor(anchor: PdfAnchor): import('../services/coordinates/types').PDFRegionAnchor {
  const result: import('../services/coordinates/types').PDFRegionAnchor = {
    type: 'pdf-region',
    documentId: anchor.documentId,
    pageIndex: anchor.pageIndex,
    rect: anchor.rect,
  }
  if (anchor.text !== undefined) {
    result.text = anchor.text
  }
  return result
}

/**
 * Convert a WorkspaceNode to a CanvasPointAnchor
 */
export function workspaceNodeToCanvasPointAnchor(
  node: WorkspaceNode,
  workspaceId: string
): import('../services/coordinates/types').CanvasPointAnchor {
  return {
    type: 'canvas-point',
    workspaceId,
    point: {
      x: node.position.x,
      y: node.position.y,
    },
  }
}

/**
 * Convert legacy Link to unified Link format
 */
export function legacyLinkToUnifiedLink(
  link: Link,
  workspaceId: string
): import('../services/coordinates/types').Link {
  const result: import('../services/coordinates/types').Link = {
    id: link.id,
    sourceAnchor: pdfAnchorToPDFRegionAnchor(link.from),
    targetAnchor: workspaceNodeToCanvasPointAnchor(link.to, workspaceId),
    bidirectional: false,
  }
  
  if (link.visual || link.color !== undefined) {
    const style: import('../services/coordinates/types').LinkStyle = {
      color: link.visual?.color ?? link.color ?? 0x6366f1,
      width: link.visual?.width ?? 2.5,
      opacity: link.visual?.opacity ?? 0.85,
      curveStyle: link.visual?.curveStyle ?? 'bezier',
    }
    if (link.visual?.animated !== undefined) {
      style.animated = link.visual.animated
    }
    if (link.visual?.dashPattern !== undefined) {
      style.dashPattern = link.visual.dashPattern
    }
    result.style = style
  }
  
  if (link.metadata) {
    const metadata: import('../services/coordinates/types').LinkMetadata = {
      createdAt: link.metadata.createdAt,
    }
    if (link.metadata.label !== undefined) {
      metadata.label = link.metadata.label
    }
    if (link.metadata.notes !== undefined) {
      metadata.notes = link.metadata.notes
    }
    if (link.metadata.tags !== undefined) {
      metadata.tags = link.metadata.tags
    }
    result.metadata = metadata
  }
  
  if (link.highlighted !== undefined) {
    result.highlighted = link.highlighted
  }
  
  return result
}
