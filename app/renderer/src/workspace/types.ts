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

export interface Link {
  id: string
  from: PdfAnchor
  to: WorkspaceNode
  // Visual customization
  color?: number
  // Link state
  highlighted?: boolean
}

// Screen coordinates (pixels on viewport)
export interface ScreenPoint {
  x: number
  y: number
}

// World coordinates (Pixi world space)
export interface WorldPoint {
  x: number
  y: number
}
