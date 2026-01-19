import { useEffect, useRef, useState, useCallback } from 'react'
import { useLinkStore } from '../store/linkStore'
import { usePdfViewportStore } from '../store/pdfViewportStore'
import { useLayoutStore } from '../store/layoutStore'

interface Point {
  x: number
  y: number
}

interface BezierLinkProps {
  id: string
  start: Point
  end: Point
  isHighlighted?: boolean
}

function BezierLink({ id, start, end, isHighlighted = false }: BezierLinkProps) {
  // Calculate control points for smooth S-curve
  const dx = end.x - start.x
  const distance = Math.sqrt(dx * dx + Math.pow(end.y - start.y, 2))
  const controlOffset = Math.min(Math.abs(dx) * 0.5, distance * 0.4, 150)
  
  const cp1 = { x: start.x + controlOffset, y: start.y }
  const cp2 = { x: end.x - controlOffset, y: end.y }

  const pathD = `M ${start.x} ${start.y} C ${cp1.x} ${cp1.y}, ${cp2.x} ${cp2.y}, ${end.x} ${end.y}`

  return (
    <g className="link-group">
      {/* Glow effect */}
      <path
        d={pathD}
        fill="none"
        stroke={isHighlighted ? '#4f46e5' : '#6366f1'}
        strokeWidth={isHighlighted ? 8 : 6}
        strokeLinecap="round"
        opacity={0.15}
        style={{ filter: 'blur(3px)' }}
      />
      
      {/* Main curve */}
      <path
        d={pathD}
        fill="none"
        stroke={isHighlighted ? '#4f46e5' : '#6366f1'}
        strokeWidth={isHighlighted ? 3 : 2.5}
        strokeLinecap="round"
        opacity={0.85}
        className="transition-all duration-150"
      />
      
      {/* Start point indicator */}
      <circle
        cx={start.x}
        cy={start.y}
        r={5}
        fill={isHighlighted ? '#4f46e5' : '#6366f1'}
        opacity={0.9}
      />
      
      {/* End point indicator */}
      <circle
        cx={end.x}
        cy={end.y}
        r={4}
        fill={isHighlighted ? '#4f46e5' : '#6366f1'}
        opacity={0.7}
      />
    </g>
  )
}

export function LinkOverlay() {
  const svgRef = useRef<SVGSVGElement>(null)
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 })
  const [linkPositions, setLinkPositions] = useState<Map<string, { start: Point; end: Point }>>(new Map())
  
  const links = useLinkStore((s) => s.links)
  const pdfViewport = usePdfViewportStore()
  const leftWidth = useLayoutStore((s) => s.leftWidth)

  // Update SVG dimensions
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

  // Calculate link positions
  const calculateLinkPositions = useCallback(() => {
    const newPositions = new Map<string, { start: Point; end: Point }>()

    links.forEach((link) => {
      // Get PDF anchor screen position
      const screenPoint = pdfViewport.pageToScreen(
        link.from.pageIndex,
        link.from.rect.x + link.from.rect.w / 2,
        link.from.rect.y + link.from.rect.h / 2
      )

      if (screenPoint) {
        // Start point is on the PDF side (right edge of selection)
        const startX = Math.min(screenPoint.x + (link.from.rect.w * (pdfViewport.pageDimensions.get(link.from.pageIndex)?.width || 100)) / 2, leftWidth - 10)
        const startY = screenPoint.y

        // End point is on the workspace side
        // The workspace is to the right of leftWidth
        // We need to transform workspace coords to screen coords
        const workspaceOffset = leftWidth + 8 // divider width
        
        // Simple mapping: workspace origin is at center of workspace panel
        const workspaceCenterX = workspaceOffset + (dimensions.width - workspaceOffset) / 2
        const workspaceCenterY = dimensions.height / 2
        
        const endX = workspaceCenterX + link.to.position.x
        const endY = workspaceCenterY + link.to.position.y

        newPositions.set(link.id, {
          start: { x: startX, y: startY },
          end: { x: endX, y: endY },
        })
      }
    })

    setLinkPositions(newPositions)
  }, [links, pdfViewport, leftWidth, dimensions])

  // Update positions on animation frame
  useEffect(() => {
    let animationFrameId: number

    const update = () => {
      calculateLinkPositions()
      animationFrameId = requestAnimationFrame(update)
    }

    animationFrameId = requestAnimationFrame(update)
    return () => cancelAnimationFrame(animationFrameId)
  }, [calculateLinkPositions])

  if (links.length === 0) return null

  return (
    <svg
      ref={svgRef}
      className="fixed inset-0 pointer-events-none z-50"
      width={dimensions.width}
      height={dimensions.height}
      style={{ overflow: 'visible' }}
    >
      <defs>
        {/* Gradient for links */}
        <linearGradient id="linkGradient" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#6366f1" stopOpacity="0.9" />
          <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0.9" />
        </linearGradient>
        
        {/* Drop shadow filter */}
        <filter id="linkShadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="#6366f1" floodOpacity="0.3" />
        </filter>
      </defs>

      {Array.from(linkPositions.entries()).map(([id, pos]) => (
        <BezierLink
          key={id}
          id={id}
          start={pos.start}
          end={pos.end}
        />
      ))}
    </svg>
  )
}
