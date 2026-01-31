/**
 * AnimatedLink Component - Smooth Bezier curve link with Framer Motion
 * 
 * Features:
 * - Animated bezier curves
 * - Hover effects
 * - Entry/exit animations
 * - Ghost link during drag
 */

import { memo, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

interface Point {
  x: number
  y: number
}

interface AnimatedLinkProps {
  id: string
  start: Point
  end: Point
  color?: string
  isHighlighted?: boolean
  isGhost?: boolean
  isAnimating?: boolean
}

// Calculate bezier path
function calculateBezierPath(start: Point, end: Point): string {
  const dx = end.x - start.x
  const dy = end.y - start.y
  const distance = Math.sqrt(dx * dx + dy * dy)
  
  // Adaptive control point offset based on distance
  const controlOffset = Math.min(Math.abs(dx) * 0.5, distance * 0.4, 200)
  
  // Control points for smooth S-curve
  const cp1 = { x: start.x + controlOffset, y: start.y }
  const cp2 = { x: end.x - controlOffset, y: end.y }

  return `M ${start.x} ${start.y} C ${cp1.x} ${cp1.y}, ${cp2.x} ${cp2.y}, ${end.x} ${end.y}`
}

export const AnimatedLink = memo(function AnimatedLink({
  id,
  start,
  end,
  color = '#6366f1',
  isHighlighted = false,
  isGhost = false,
  isAnimating = false,
}: AnimatedLinkProps) {
  const pathD = useMemo(() => calculateBezierPath(start, end), [start, end])
  
  const strokeWidth = isGhost ? 2 : (isHighlighted ? 3 : 2.5)
  const strokeOpacity = isGhost ? 0.7 : 0.85

  return (
    <motion.g
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
    >
      {/* Glow effect */}
      <motion.path
        d={pathD}
        fill="none"
        stroke={color}
        strokeWidth={isHighlighted ? 12 : 8}
        strokeLinecap="round"
        initial={{ opacity: 0, pathLength: 0 }}
        animate={{ 
          opacity: 0.15, 
          pathLength: 1,
          filter: 'blur(4px)',
        }}
        transition={{ 
          duration: isAnimating ? 0.5 : 0.3,
          ease: 'easeOut',
        }}
      />

      {/* Main curve */}
      <motion.path
        d={pathD}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeDasharray={isGhost ? '8 4' : undefined}
        initial={{ pathLength: 0, opacity: 0 }}
        animate={{ 
          pathLength: 1, 
          opacity: strokeOpacity,
        }}
        transition={{ 
          pathLength: { duration: isAnimating ? 0.5 : 0.2, ease: 'easeOut' },
          opacity: { duration: 0.15 },
        }}
      />

      {/* Start point */}
      <motion.circle
        cx={start.x}
        cy={start.y}
        r={isGhost ? 6 : 5}
        fill={color}
        initial={{ scale: 0 }}
        animate={{ scale: 1, opacity: 0.9 }}
        transition={{ delay: 0.1, type: 'spring', stiffness: 500 }}
      />

      {/* End point */}
      <motion.circle
        cx={end.x}
        cy={end.y}
        r={isGhost ? 8 : 5}
        fill={isGhost ? 'white' : color}
        stroke={isGhost ? color : undefined}
        strokeWidth={isGhost ? 2 : undefined}
        initial={{ scale: 0 }}
        animate={{ scale: 1, opacity: isGhost ? 1 : 0.7 }}
        transition={{ delay: 0.15, type: 'spring', stiffness: 500 }}
      />

      {/* Ghost pulse effect */}
      {isGhost && (
        <motion.circle
          cx={end.x}
          cy={end.y}
          r={20}
          fill={color}
          initial={{ opacity: 0.15, scale: 1 }}
          animate={{ 
            opacity: [0.15, 0.05, 0.15],
            scale: [1, 1.5, 1],
          }}
          transition={{
            duration: 1,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />
      )}
    </motion.g>
  )
})

export default AnimatedLink
