/**
 * LinkCanvas Component - SVG overlay for rendering all links
 * 
 * Features:
 * - Renders all excerpt links with animations
 * - Ghost link during drag operations
 * - Link tool drawing mode
 * - Efficient updates using coordinate service
 */

import { memo, useEffect, useState, useMemo, useCallback } from 'react'
import { AnimatePresence } from 'framer-motion'
import { AnimatedLink } from './AnimatedLink'
import { useDragController } from '../store/dragController'
import { useExcerptStore } from '../store/excerptStore'
import { usePdfViewportStore } from '../store/pdfViewportStore'
import { useWorkspaceViewportStore } from '../store/workspaceViewportStore'
import { coordinateService } from '../services/coordinates'

interface Point {
  x: number
  y: number
}

interface ComputedLink {
  id: string
  start: Point
  end: Point
  color: string
  isAnimating: boolean
}

export const LinkCanvas = memo(function LinkCanvas() {
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 })
  const [computedLinks, setComputedLinks] = useState<ComputedLink[]>([])
  
  // Get drag state for ghost link - select only primitive values
  const dragPhase = useDragController((s) => s.phase)
  const sourceAnchorX = useDragController((s) => s.sourceAnchor?.x ?? null)
  const sourceAnchorY = useDragController((s) => s.sourceAnchor?.y ?? null)
  const pointerX = useDragController((s) => s.pointerPosition?.x ?? null)
  const pointerY = useDragController((s) => s.pointerPosition?.y ?? null)
  
  // Get excerpt data - use stable Map references
  const excerptsMap = useExcerptStore((s) => s.excerpts)
  const linksMap = useExcerptStore((s) => s.links)
  
  // Get viewport state for recalculation triggers
  const pdfScrollTop = usePdfViewportStore((s) => s.scrollTop)
  const pdfScrollLeft = usePdfViewportStore((s) => s.scrollLeft)
  const pdfZoom = usePdfViewportStore((s) => s.zoom)
  const pdfPanelRect = usePdfViewportStore((s) => s.panelRect)
  
  const wsWorldX = useWorkspaceViewportStore((s) => s.worldX)
  const wsWorldY = useWorkspaceViewportStore((s) => s.worldY)
  const wsScale = useWorkspaceViewportStore((s) => s.scale)
  const wsPanelRect = useWorkspaceViewportStore((s) => s.panelRect)
  
  // Update dimensions on resize
  useEffect(() => {
    const updateDimensions = () => {
      setDimensions({
        width: window.innerWidth,
        height: window.innerHeight,
      })
    }
    
    updateDimensions()
    window.addEventListener('resize', updateDimensions)
    return () => window.removeEventListener('resize', updateDimensions)
  }, [])
  
  // Compute link endpoints when excerpts, links, or viewports change
  const calculateLinks = useCallback(() => {
    const links: ComputedLink[] = []
    
    linksMap.forEach((link) => {
      const excerpt = excerptsMap.get(link.sourceId)
      if (!excerpt) return
      
      // Calculate PDF source position (right edge of selection)
      const pdfEndpoint = coordinateService.anchorToScreen({
        type: 'pdf-region',
        documentId: excerpt.source.documentId,
        pageIndex: excerpt.source.pageIndex,
        rect: excerpt.source.rect,
      })
      
      // Calculate excerpt position (left edge of card)
      const excerptScreen = coordinateService.worldToScreen({
        x: excerpt.position.x - excerpt.size.width / 2,
        y: excerpt.position.y,
      })
      
      if (pdfEndpoint && excerptScreen) {
        links.push({
          id: link.id,
          start: pdfEndpoint,
          end: excerptScreen,
          color: link.color,
          isAnimating: link.animating,
        })
      }
    })
    
    setComputedLinks(links)
  }, [excerptsMap, linksMap])
  
  // Recalculate when viewports or data change
  useEffect(() => {
    calculateLinks()
  }, [
    calculateLinks,
    pdfScrollTop,
    pdfScrollLeft,
    pdfZoom,
    pdfPanelRect,
    wsWorldX,
    wsWorldY,
    wsScale,
    wsPanelRect,
  ])

  // Ghost link for drag operations - computed from primitives
  const ghostLink = useMemo(() => {
    if (dragPhase !== 'dragging' || sourceAnchorX === null || pointerX === null) {
      return null
    }
    
    return {
      id: 'ghost-drag',
      start: { x: sourceAnchorX, y: sourceAnchorY! },
      end: { x: pointerX, y: pointerY! },
    }
  }, [dragPhase, sourceAnchorX, sourceAnchorY, pointerX, pointerY])

  // Don't render if nothing to show
  const hasLinks = computedLinks.length > 0 || ghostLink
  if (!hasLinks) return null

  return (
    <svg
      className="fixed inset-0 pointer-events-none z-40"
      width={dimensions.width}
      height={dimensions.height}
      style={{ overflow: 'visible' }}
    >
      <defs>
        {/* Gradient definitions */}
        <linearGradient id="linkGradient" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#6366f1" stopOpacity="0.9" />
          <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0.9" />
        </linearGradient>
        
        {/* Glow filter */}
        <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      <AnimatePresence mode="popLayout">
        {/* Persistent excerpt links */}
        {computedLinks.map((link) => (
          <AnimatedLink
            key={link.id}
            id={link.id}
            start={link.start}
            end={link.end}
            color={link.color}
            isAnimating={link.isAnimating}
          />
        ))}
        
        {/* Ghost link during drag */}
        {ghostLink && (
          <AnimatedLink
            key="ghost-link"
            id="ghost-link"
            start={ghostLink.start}
            end={ghostLink.end}
            color="#8b5cf6"
            isGhost
          />
        )}
      </AnimatePresence>
    </svg>
  )
})

export default LinkCanvas
