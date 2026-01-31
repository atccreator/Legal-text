import { Container, Graphics, Text, TextStyle } from 'pixi.js'
import { createWorkspace } from './createWorkspace'
import { LinkRenderer } from './LinkRenderer'
import { PdfAnchor, Link, WorkspaceNode } from './types'
import { pdfSelectionController } from '../pdf/selection/PdfSelectionController'
import { useLinkStore } from '../store/linkStore'
import { usePdfViewportStore } from '../store/pdfViewportStore'
import { useWorkspaceViewportStore } from '../store/workspaceViewportStore'

// Constants for visual styling
const NODE_COLORS = {
  background: 0xffffff,
  border: 0x6366f1,
  borderSelected: 0x4f46e5,
  connectionPoint: 0x6366f1,
  shadow: 0x000000,
}

const NODE_DIMENSIONS = {
  width: 140,
  height: 70,
  borderRadius: 10,
  connectionRadius: 7,
}

export class WorkspaceController {
  private app!: any
  private world!: Container
  private grid!: any
  private scale = 1
  private resizeObserver!: ResizeObserver
  private linkRenderer!: LinkRenderer
  private nodeContainer!: Container
  private unsubscribes: (() => void)[] = []
  private nodeGraphicsMap = new Map<string, Graphics>()

  // PDF panel reference for coordinate mapping
  private pdfPanelElement: HTMLElement | null = null
  private containerElement: HTMLElement | null = null
  
  // Animation frame for smooth updates
  private animationFrameId: number | null = null
  
  // Pinch zoom state
  private lastPinchDistance = 0
  private isPinching = false

  constructor(container: HTMLElement) {
    console.log('[WorkspaceController] Constructor called')
    this.containerElement = container
    this.init(container)
  }

  private async init(container: HTMLElement) {
    console.log('[WorkspaceController] Initializing...')
    const { app, world, resizeObserver, grid } = await createWorkspace(container)

    this.app = app
    this.world = world
    this.grid = grid
    this.resizeObserver = resizeObserver

    // Center the world on screen initially
    this.world.x = this.app.screen.width / 2
    this.world.y = this.app.screen.height / 2

    // Create node container for workspace nodes
    this.nodeContainer = new Container()
    this.world.addChild(this.nodeContainer)

    this.setupInteraction()
    this.setupPinchZoom()
    this.linkRenderer = new LinkRenderer(this.world)

    // Subscribe to PDF selection events
    this.setupSelectionHandler()
    
    // Subscribe to link store changes
    this.setupLinkStoreSubscription()
    
    // Setup viewport tracking
    this.setupViewportTracking()
    
    // Start render loop for smooth link updates
    this.startRenderLoop()
  }

  /**
   * Setup viewport tracking for coordinate synchronization
   */
  private setupViewportTracking() {
    // Initialize workspace viewport store with panel rect
    const updatePanelRect = () => {
      if (this.containerElement) {
        const rect = this.containerElement.getBoundingClientRect()
        useWorkspaceViewportStore.getState().setPanelRect(rect)
      }
    }
    
    updatePanelRect()
    
    // Setup resize observer for panel rect updates
    const resizeObserver = new ResizeObserver(updatePanelRect)
    if (this.containerElement) {
      resizeObserver.observe(this.containerElement)
    }
    
    // Sync initial world transform
    this.syncViewportState()
  }
  
  /**
   * Sync current world transform to viewport store
   */
  private syncViewportState() {
    useWorkspaceViewportStore.getState().setWorldTransform(
      this.world.x,
      this.world.y,
      this.scale
    )
  }

  /**
   * Set PDF panel element reference for coordinate mapping
   */
  setPdfPanelElement(element: HTMLElement | null) {
    this.pdfPanelElement = element
    if (element) {
      usePdfViewportStore.getState().setPanelRect(element.getBoundingClientRect())
    }
  }

  /**
   * Handle PDF selection → create link → render
   */
  private setupSelectionHandler() {
    console.log('[WorkspaceController] ====== Setting up PDF selection handler ======')
    const unsubscribe = pdfSelectionController.subscribe((anchor) => {
      console.log('[WorkspaceController] ====== SELECTION RECEIVED! ======')
      console.log('[WorkspaceController] Selection anchor:', JSON.stringify(anchor, null, 2))
      
      // Calculate workspace position for new node with elastic positioning
      const nodePosition = this.calculateNodePosition(anchor)
      console.log('[WorkspaceController] Node position:', nodePosition)
      
      // Create link in store
      const link = useLinkStore.getState().addLink(anchor, nodePosition)
      console.log('[WorkspaceController] Link created:', link.id)
      
      // Create visual node with animation
      this.createWorkspaceNode(link)
    })
    
    this.unsubscribes.push(unsubscribe)
  }

  /**
   * Subscribe to link store and update bezier curves
   */
  private setupLinkStoreSubscription() {
    const unsubscribe = useLinkStore.subscribe(
      (state) => state.links,
      (links) => {
        // Links are updated in render loop for smooth animation
      }
    )
    
    this.unsubscribes.push(unsubscribe)
  }

  /**
   * Calculate smart node position based on anchor location
   * Implements elastic snapping behavior
   */
  private calculateNodePosition(anchor: PdfAnchor): { x: number; y: number } {
    const existingLinks = useLinkStore.getState().links
    
    // Base position - to the right in world space (nodes appear in center-right area)
    let baseX = 150
    
    // Y position based on PDF anchor position (mapped from 0-1 to world coords)
    let baseY = (anchor.rect.y + anchor.rect.h / 2 - 0.5) * 600
    baseY += anchor.pageIndex * 200 // Page offset
    
    // Apply elastic snapping - avoid overlapping with existing nodes
    const snapDistance = 100
    let finalY = baseY
    
    for (const link of existingLinks) {
      const nodeY = link.to.position.y
      if (Math.abs(finalY - nodeY) < snapDistance) {
        // Snap to grid or push away
        finalY = nodeY + (finalY > nodeY ? snapDistance : -snapDistance)
      }
    }
    
    // Add slight randomness for visual variety
    baseX += (Math.random() - 0.5) * 50
    
    console.log('[WorkspaceController] Calculated node position:', { x: baseX, y: finalY })
    
    return { x: baseX, y: finalY }
  }

  /**
   * Create a visual node in the workspace with enhanced styling
   */
  private createWorkspaceNode(link: Link) {
    const g = new Graphics()
    const pos = link.to.position
    const halfW = NODE_DIMENSIONS.width / 2
    const halfH = NODE_DIMENSIONS.height / 2
    
    // Draw shadow
    g.roundRect(-halfW + 3, -halfH + 3, NODE_DIMENSIONS.width, NODE_DIMENSIONS.height, NODE_DIMENSIONS.borderRadius)
    g.fill({ color: NODE_COLORS.shadow, alpha: 0.1 })
    
    // Draw main node background
    g.roundRect(-halfW, -halfH, NODE_DIMENSIONS.width, NODE_DIMENSIONS.height, NODE_DIMENSIONS.borderRadius)
    g.fill({ color: NODE_COLORS.background })
    g.stroke({ width: 2, color: NODE_COLORS.border })
    
    // Add connection point (left side)
    g.circle(-halfW, 0, NODE_DIMENSIONS.connectionRadius)
    g.fill({ color: NODE_COLORS.connectionPoint })
    
    // Add small indicator dot on right side for future connections
    g.circle(halfW, 0, 4)
    g.fill({ color: 0xe5e7eb })
    
    g.x = pos.x
    g.y = pos.y
    
    // Make it interactive for dragging
    g.eventMode = 'static'
    g.cursor = 'grab'
    
    this.setupNodeDragging(g, link)
    
    // Store reference
    this.nodeGraphicsMap.set(link.id, g)
    ;(g as any).linkId = link.id
    
    this.nodeContainer.addChild(g)
    
    // Animate node appearing
    this.animateNodeAppear(g)
    
    // Initial link render
    this.renderLink(link)
  }

  /**
   * Setup drag interaction for a node
   */
  private setupNodeDragging(g: Graphics, link: Link) {
    let dragging = false
    let dragOffset = { x: 0, y: 0 }
    
    g.on('pointerdown', (e) => {
      dragging = true
      g.cursor = 'grabbing'
      if (!g.parent) return
      const local = e.data.getLocalPosition(g.parent)
      dragOffset = { x: local.x - g.x, y: local.y - g.y }
      
      // Bring to front
      this.nodeContainer.setChildIndex(g, this.nodeContainer.children.length - 1)
      
      e.stopPropagation()
    })
    
    g.on('globalpointermove', (e) => {
      if (!dragging || !g.parent) return
      const local = e.data.getLocalPosition(g.parent)
      
      // Apply elastic snapping during drag
      let newX = local.x - dragOffset.x
      let newY = local.y - dragOffset.y
      
      // Snap to grid (optional, subtle)
      const gridSize = 20
      if (Math.abs(newX % gridSize) < 5) {
        newX = Math.round(newX / gridSize) * gridSize
      }
      if (Math.abs(newY % gridSize) < 5) {
        newY = Math.round(newY / gridSize) * gridSize
      }
      
      g.x = newX
      g.y = newY
      
      // Update link store
      useLinkStore.getState().updateNodePosition(link.id, { x: g.x, y: g.y })
    })
    
    g.on('pointerup', () => {
      dragging = false
      g.cursor = 'grab'
    })
    g.on('pointerupoutside', () => {
      dragging = false
      g.cursor = 'grab'
    })
  }

  /**
   * Animate node appearing
   */
  private animateNodeAppear(g: Graphics) {
    g.scale.set(0.5)
    g.alpha = 0
    
    const duration = 200 // ms
    const startTime = performance.now()
    
    const animate = () => {
      const elapsed = performance.now() - startTime
      const progress = Math.min(elapsed / duration, 1)
      
      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3)
      
      g.scale.set(0.5 + 0.5 * eased)
      g.alpha = eased
      
      if (progress < 1) {
        requestAnimationFrame(animate)
      }
    }
    
    requestAnimationFrame(animate)
  }

  /**
   * Map PDF anchor to workspace coordinates - using WORLD coordinates
   * The bezier starts from the LEFT edge of the workspace (world origin)
   * and connects to the node position
   */
  mapPdfAnchorToWorkspace(anchor: PdfAnchor): { x: number; y: number } {
    // Since the link starts from the PDF side (left), we place the start point
    // at the left edge of the visible workspace area
    // The Y position is based on the anchor's relative position
    
    // Calculate Y position based on anchor position on page
    // Map from normalized (0-1) to world space
    const baseY = (anchor.rect.y + anchor.rect.h / 2 - 0.5) * 600
    const pageOffset = anchor.pageIndex * 200 // Offset for multi-page
    
    // Start from far left of workspace (this represents the "PDF edge" in world space)
    const startX = -350 // Left edge where bezier originates
    const startY = baseY + pageOffset
    
    return { x: startX, y: startY }
  }

  /**
   * Render a single link with smooth bezier curve
   */
  private renderLink(link: Link) {
    const startPos = this.mapPdfAnchorToWorkspace(link.from)
    const node = this.nodeGraphicsMap.get(link.id)
    
    let endPos = link.to.position
    if (node) {
      endPos = { x: node.x, y: node.y }
    }
    
    // Connect to left edge of node (connection point)
    const halfW = NODE_DIMENSIONS.width / 2
    
    // Debug log first time
    if (!this._loggedLinks) this._loggedLinks = new Set()
    if (!this._loggedLinks.has(link.id)) {
      console.log('[WorkspaceController] Rendering link:', {
        id: link.id,
        startPos,
        endPos: { x: endPos.x - halfW, y: endPos.y },
      })
      this._loggedLinks.add(link.id)
    }
    
    this.linkRenderer.renderLink(link.id, {
      start: startPos,
      end: { x: endPos.x - halfW, y: endPos.y },
    })
  }
  
  private _loggedLinks?: Set<string>

  /**
   * Start render loop for smooth link updates
   */
  private startRenderLoop() {
    const render = () => {
      const links = useLinkStore.getState().links
      links.forEach((link) => {
        this.renderLink(link)
      })
      
      this.animationFrameId = requestAnimationFrame(render)
    }
    
    this.animationFrameId = requestAnimationFrame(render)
  }

  /**
   * Setup pan interaction
   */
  private setupInteraction() {
    let isDragging = false
    let last = { x: 0, y: 0 }

    this.app.canvas.addEventListener('pointerdown', (e: PointerEvent) => {
      // Only pan with left mouse button and if not clicking on a node
      if (e.button !== 0) return
      isDragging = true
      last = { x: e.clientX, y: e.clientY }
      this.app.canvas.style.cursor = 'grabbing'
    })

    window.addEventListener('pointerup', () => {
      isDragging = false
      if (this.app?.canvas) {
        this.app.canvas.style.cursor = 'default'
      }
    })

    window.addEventListener('pointermove', (e) => {
      if (!isDragging) return

      const dx = e.clientX - last.x
      const dy = e.clientY - last.y

      this.world.x += dx
      this.world.y += dy

      last = { x: e.clientX, y: e.clientY }
      
      // Sync viewport state for coordinate mapping
      this.syncViewportState()
    })
  }

  /**
   * Setup pinch zoom for touch devices
   */
  private setupPinchZoom() {
    const canvas = this.app?.canvas
    if (!canvas) return
    
    canvas.addEventListener('touchstart', (e: TouchEvent) => {
      if (e.touches.length === 2) {
        this.isPinching = true
        this.lastPinchDistance = this.getPinchDistance(e.touches)
      }
    }, { passive: true })
    
    canvas.addEventListener('touchmove', (e: TouchEvent) => {
      if (!this.isPinching || e.touches.length !== 2) return
      const touch0 = e.touches[0]
      const touch1 = e.touches[1]
      if (!touch0 || !touch1) return
      
      const currentDistance = this.getPinchDistance(e.touches)
      const delta = currentDistance / this.lastPinchDistance
      
      // Get center point of pinch
      const centerX = (touch0.clientX + touch1.clientX) / 2
      const centerY = (touch0.clientY + touch1.clientY) / 2
      const rect = canvas.getBoundingClientRect()
      
      this.zoom(delta, centerX - rect.left, centerY - rect.top)
      
      this.lastPinchDistance = currentDistance
    }, { passive: true })
    
    canvas.addEventListener('touchend', () => {
      this.isPinching = false
    }, { passive: true })
  }

  /**
   * Calculate distance between two touch points
   */
  private getPinchDistance(touches: TouchList): number {
    const touch0 = touches[0]
    const touch1 = touches[1]
    if (!touch0 || !touch1) return 0
    const dx = touch0.clientX - touch1.clientX
    const dy = touch0.clientY - touch1.clientY
    return Math.sqrt(dx * dx + dy * dy)
  }

  /**
   * Zoom with optional center point
   */
  zoom(delta: number, mouseX?: number, mouseY?: number) {
    if (!this.world) return

    const oldScale = this.scale
    this.scale = Math.min(Math.max(this.scale * delta, 0.1), 10)

    // Zoom towards cursor position if provided
    if (mouseX !== undefined && mouseY !== undefined) {
      const worldPosX = (mouseX - this.world.x) / oldScale
      const worldPosY = (mouseY - this.world.y) / oldScale

      this.world.scale.set(this.scale)

      this.world.x = mouseX - worldPosX * this.scale
      this.world.y = mouseY - worldPosY * this.scale
    } else {
      this.world.scale.set(this.scale)
    }
    
    // Sync viewport state for coordinate mapping
    this.syncViewportState()
  }

  /**
   * Get current world transform (for coordinate mapping from outside)
   */
  getWorldTransform() {
    return {
      x: this.world.x,
      y: this.world.y,
      scale: this.scale,
    }
  }

  destroy() {
    // Stop render loop
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId)
    }
    
    // Cleanup subscriptions
    this.unsubscribes.forEach((unsub) => unsub())
    this.unsubscribes = []
    
    // Cleanup graphics
    this.nodeGraphicsMap.clear()
    
    this.resizeObserver?.disconnect()
    this.linkRenderer?.destroy()
    this.app?.destroy(true, { children: true, texture: true })
  }
}
