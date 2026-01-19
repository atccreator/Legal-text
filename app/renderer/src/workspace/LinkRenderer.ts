import { Container, Graphics } from 'pixi.js'

export interface LinkEndpoints {
  start: { x: number; y: number }
  end: { x: number; y: number }
}

interface LinkVisualOptions {
  color?: number
  width?: number
  alpha?: number
  highlighted?: boolean
}

const DEFAULT_OPTIONS: Required<LinkVisualOptions> = {
  color: 0x6366f1, // indigo-500
  width: 2.5,
  alpha: 0.85,
  highlighted: false,
}

export class LinkRenderer {
  private container: Container
  private graphicsMap = new Map<string, Graphics>()

  constructor(container: Container) {
    this.container = container
  }

  /**
   * Create or update a Bezier link with optional styling
   */
  renderLink(id: string, endpoints: LinkEndpoints, options?: LinkVisualOptions) {
    let g = this.graphicsMap.get(id)

    if (!g) {
      g = new Graphics()
      this.graphicsMap.set(id, g)
      this.container.addChild(g)
      
      // Ensure links render below nodes
      this.container.setChildIndex(g, 0)
    }

    const opts = { ...DEFAULT_OPTIONS, ...options }
    this.drawBezier(g, endpoints.start, endpoints.end, opts)
  }

  /**
   * Highlight a link
   */
  highlightLink(id: string, highlighted: boolean) {
    const g = this.graphicsMap.get(id)
    if (!g) return
    
    // Redraw with highlight state would require storing endpoints
    // For now, just adjust alpha
    g.alpha = highlighted ? 1 : 0.85
  }

  /**
   * Remove a link
   */
  removeLink(id: string) {
    const g = this.graphicsMap.get(id)
    if (!g) return

    g.destroy()
    this.graphicsMap.delete(id)
  }

  /**
   * Core Bezier drawing logic with LiquidText-like styling
   */
  private drawBezier(
    g: Graphics,
    start: { x: number; y: number },
    end: { x: number; y: number },
    options: Required<LinkVisualOptions>
  ) {
    g.clear()

    // Calculate control points for smooth S-curve
    const dx = end.x - start.x
    const dy = end.y - start.y
    const distance = Math.sqrt(dx * dx + dy * dy)
    
    // Adaptive control point distance based on link length
    const controlOffset = Math.min(Math.abs(dx) * 0.5, distance * 0.4)
    
    const cp1 = { 
      x: start.x + controlOffset, 
      y: start.y 
    }
    const cp2 = { 
      x: end.x - controlOffset, 
      y: end.y 
    }

    // Draw the bezier path
    g.moveTo(start.x, start.y)
    g.bezierCurveTo(
      cp1.x, cp1.y,
      cp2.x, cp2.y,
      end.x, end.y
    )

    // Apply styling - PixiJS v8 API
    const strokeWidth = options.highlighted ? options.width + 1 : options.width
    const strokeColor = options.highlighted ? 0x4f46e5 : options.color
    
    g.stroke({
      width: strokeWidth,
      color: strokeColor,
      alpha: options.alpha,
      cap: 'round',
      join: 'round',
    })
    
    // Draw small circle at start point (connection indicator)
    g.circle(start.x, start.y, 4)
    g.fill({ color: strokeColor, alpha: options.alpha })
  }

  /**
   * Get all link IDs
   */
  getLinkIds(): string[] {
    return Array.from(this.graphicsMap.keys())
  }

  /**
   * Cleanup
   */
  destroy() {
    this.graphicsMap.forEach(g => g.destroy())
    this.graphicsMap.clear()
  }
}
