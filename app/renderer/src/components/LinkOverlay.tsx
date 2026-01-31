import { useEffect, useRef, useState, useCallback, useMemo, memo } from 'react'
import { useLinkStore } from '../store/linkStore'
import { usePdfViewportStore } from '../store/pdfViewportStore'
import { useLayoutStore } from '../store/layoutStore'
import { useDraggingStore } from '../store/draggingStore'
import { useWorkspaceViewportStore } from '../store/workspaceViewportStore'

interface Point {
  x: number
  y: number
}

interface BezierLinkProps {
  id: string
  start: Point
  end: Point
  isHighlighted?: boolean
  isGhost?: boolean
}

// Memoized BezierLink component for performance
const BezierLink = memo(function BezierLink({ id, start, end, isHighlighted = false, isGhost = false }: BezierLinkProps) {
  // Calculate control points for smooth S-curve
  const dx = end.x - start.x
  const distance = Math.sqrt(dx * dx + Math.pow(end.y - start.y, 2))
  const controlOffset = Math.min(Math.abs(dx) * 0.5, distance * 0.4, 150)
  
  const cp1 = { x: start.x + controlOffset, y: start.y }
  const cp2 = { x: end.x - controlOffset, y: end.y }

  const pathD = `M ${start.x} ${start.y} C ${cp1.x} ${cp1.y}, ${cp2.x} ${cp2.y}, ${end.x} ${end.y}`

  const strokeColor = isGhost ? '#8b5cf6' : (isHighlighted ? '#4f46e5' : '#6366f1')
  const strokeOpacity = isGhost ? 0.7 : 0.85

  return (
    <g className="link-group">
      {/* Glow effect */}
      <path
        d={pathD}
        fill="none"
        stroke={strokeColor}
        strokeWidth={isHighlighted ? 8 : 6}
        strokeLinecap="round"
        opacity={0.15}
        style={{ filter: 'blur(3px)' }}
      />
      
      {/* Main curve */}
      <path
        d={pathD}
        fill="none"
        stroke={strokeColor}
        strokeWidth={isGhost ? 2 : (isHighlighted ? 3 : 2.5)}
        strokeLinecap="round"
        opacity={strokeOpacity}
        strokeDasharray={isGhost ? '8 4' : undefined}
        className={isGhost ? 'ghost-link-path' : 'transition-all duration-150'}
      />
      
      {/* Start point indicator */}
      <circle
        cx={start.x}
        cy={start.y}
        r={isGhost ? 6 : 5}
        fill={strokeColor}
        opacity={0.9}
      />
      
      {/* End point indicator */}
      <circle
        cx={end.x}
        cy={end.y}
        r={isGhost ? 8 : 4}
        fill={isGhost ? 'white' : strokeColor}
        stroke={isGhost ? strokeColor : undefined}
        strokeWidth={isGhost ? 2 : undefined}
        opacity={isGhost ? 1 : 0.7}
      />
      
      {/* Ghost link drop zone indicator */}
      {isGhost && (
        <circle
          cx={end.x}
          cy={end.y}
          r={20}
          fill={strokeColor}
          opacity={0.1}
        >
          <animate
            attributeName="r"
            values="15;25;15"
            dur="1s"
            repeatCount="indefinite"
          />
          <animate
            attributeName="opacity"
            values="0.15;0.05;0.15"
            dur="1s"
            repeatCount="indefinite"
          />
        </circle>
      )}
    </g>
  )
})

export function LinkOverlay() {
  const svgRef = useRef<SVGSVGElement>(null)
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 })
  const [linkPositions, setLinkPositions] = useState<Map<string, { start: Point; end: Point }>>(new Map())
  
  const links = useLinkStore((s) => s.links)
  const pdfViewport = usePdfViewportStore()
  const workspaceViewport = useWorkspaceViewportStore()
  const leftWidth = useLayoutStore((s) => s.leftWidth)
  
  // Dragging state for ghost link
  const isDragging = useDraggingStore((s) => s.isDragging)
  const sourceScreenPos = useDraggingStore((s) => s.sourceScreenPos)
  const currentPointerPos = useDraggingStore((s) => s.currentPointerPos)

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
        link.from.rect.x + link.from.rect.w,  // Right edge
        link.from.rect.y + link.from.rect.h / 2  // Vertical center
      )

      if (screenPoint) {
        const startX = screenPoint.x
        const startY = screenPoint.y

        // Use workspace viewport store for accurate position mapping
        const workspacePanelRect = workspaceViewport.panelRect
        let endX: number, endY: number
        
        if (workspacePanelRect) {
          // Transform workspace world coords to screen coords
          endX = workspacePanelRect.left + workspaceViewport.worldX + link.to.position.x * workspaceViewport.scale
          endY = workspacePanelRect.top + workspaceViewport.worldY + link.to.position.y * workspaceViewport.scale
          
          // Adjust for node connection point (left edge)
          const nodeHalfWidth = 70 // NODE_DIMENSIONS.width / 2
          endX -= nodeHalfWidth * workspaceViewport.scale
        } else {
          // Fallback calculation
          const workspaceOffset = leftWidth + 8
          const workspaceCenterX = workspaceOffset + (dimensions.width - workspaceOffset) / 2
          const workspaceCenterY = dimensions.height / 2
          
          endX = workspaceCenterX + link.to.position.x
          endY = workspaceCenterY + link.to.position.y
        }

        newPositions.set(link.id, {
          start: { x: startX, y: startY },
          end: { x: endX, y: endY },
        })
      }
    })

    setLinkPositions(newPositions)
  }, [links, pdfViewport, workspaceViewport, leftWidth, dimensions])

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

  // Don't render anything if no links and not dragging
  if (links.length === 0 && !isDragging) return null

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

      {/* Render existing links */}
      {Array.from(linkPositions.entries()).map(([id, pos]) => (
        <BezierLink
          key={id}
          id={id}
          start={pos.start}
          end={pos.end}
        />
      ))}
      
      {/* Render ghost link while dragging */}
      {isDragging && sourceScreenPos && currentPointerPos && (
        <BezierLink
          id="ghost-link"
          start={sourceScreenPos}
          end={currentPointerPos}
          isGhost={true}
        />
      )}
    </svg>
  )
}
