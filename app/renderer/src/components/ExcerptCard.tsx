/**
 * ExcerptCard Component - Visual representation of an excerpt on the canvas
 * 
 * Features:
 * - Smooth Framer Motion animations
 * - Drag to reposition
 * - Resize handles
 * - Connection points for links
 */

import { memo, useCallback, useState, useRef } from 'react'
import { motion, useMotionValue, useTransform, PanInfo } from 'framer-motion'
import { GripVertical, Link2, Trash2, FileText, X } from 'lucide-react'
import { useExcerptStore, type Excerpt } from '../store/excerptStore'
import { useToolStore } from '../store/toolStore'

interface ExcerptCardProps {
  excerpt: Excerpt
  scale: number
  worldOffset: { x: number; y: number }
  panelRect: DOMRect | null
}

export const ExcerptCard = memo(function ExcerptCard({
  excerpt,
  scale,
  worldOffset,
  panelRect,
}: ExcerptCardProps) {
  const [isHovered, setIsHovered] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const cardRef = useRef<HTMLDivElement>(null)
  
  // Calculate screen position from world position
  const screenX = panelRect ? panelRect.left + worldOffset.x + excerpt.position.x * scale : 0
  const screenY = panelRect ? panelRect.top + worldOffset.y + excerpt.position.y * scale : 0
  
  // Scaled size
  const width = excerpt.size.width * scale
  const height = excerpt.size.height * scale

  // Handle drag - use getState() to avoid function dependencies
  const handleDrag = useCallback((event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    if (!panelRect) return
    
    // Convert screen delta to world delta
    const worldDeltaX = info.delta.x / scale
    const worldDeltaY = info.delta.y / scale
    
    const newX = excerpt.position.x + worldDeltaX
    const newY = excerpt.position.y + worldDeltaY
    
    useExcerptStore.getState().updateExcerptPosition(excerpt.id, { x: newX, y: newY })
  }, [excerpt.id, excerpt.position.x, excerpt.position.y, scale, panelRect])

  const handleDragStart = useCallback(() => {
    setIsDragging(true)
    useExcerptStore.getState().selectExcerpt(excerpt.id)
  }, [excerpt.id])

  const handleDragEnd = useCallback(() => {
    setIsDragging(false)
  }, [])

  const handleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    useExcerptStore.getState().selectExcerpt(excerpt.id, e.shiftKey)
  }, [excerpt.id])

  const handleDelete = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    useExcerptStore.getState().deleteExcerpt(excerpt.id)
  }, [excerpt.id])

  const handleStartLink = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    const rect = cardRef.current?.getBoundingClientRect()
    if (rect) {
      // Start link from left center of card
      useToolStore.getState().startLinkFromExcerpt(excerpt.id, {
        x: rect.left,
        y: rect.top + rect.height / 2,
      })
    }
  }, [excerpt.id])

  const handleMouseEnter = useCallback(() => {
    setIsHovered(true)
    useExcerptStore.getState().setHoveredExcerpt(excerpt.id)
  }, [excerpt.id])

  const handleMouseLeave = useCallback(() => {
    setIsHovered(false)
    useExcerptStore.getState().setHoveredExcerpt(null)
  }, [])

  // Don't render if outside panel
  if (!panelRect) return null

  const borderColor = excerpt.selected ? excerpt.color : (isHovered ? excerpt.color : '#e5e7eb')
  const shadowColor = excerpt.color + '30'

  return (
    <motion.div
      ref={cardRef}
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ 
        scale: 1, 
        opacity: 1,
        x: screenX - width / 2,
        y: screenY - height / 2,
      }}
      exit={{ scale: 0.8, opacity: 0 }}
      transition={{ 
        type: 'spring', 
        stiffness: 400, 
        damping: 25,
        opacity: { duration: 0.15 },
      }}
      drag
      dragMomentum={false}
      onDrag={handleDrag}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onClick={handleClick}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className="absolute select-none"
      style={{
        width,
        height,
        cursor: isDragging ? 'grabbing' : 'grab',
        zIndex: excerpt.selected ? 100 : (isHovered ? 50 : 10),
      }}
    >
      {/* Main card */}
      <motion.div
        className="w-full h-full rounded-xl overflow-hidden"
        style={{
          backgroundColor: 'white',
          border: `2px solid ${borderColor}`,
          boxShadow: excerpt.selected 
            ? `0 8px 25px ${shadowColor}, 0 0 0 3px ${excerpt.color}20`
            : isHovered 
              ? `0 4px 15px ${shadowColor}`
              : '0 2px 8px rgba(0,0,0,0.08)',
        }}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        transition={{ type: 'spring', stiffness: 400, damping: 25 }}
      >
        {/* Header */}
        <div 
          className="flex items-center gap-2 px-3 py-2 border-b"
          style={{ 
            backgroundColor: excerpt.color + '10',
            borderBottomColor: excerpt.color + '20',
          }}
        >
          <FileText size={14} style={{ color: excerpt.color }} />
          <span 
            className="text-xs font-medium truncate flex-1"
            style={{ color: excerpt.color }}
          >
            Page {excerpt.source.pageIndex + 1}
          </span>
          
          {/* Actions */}
          {isHovered && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex items-center gap-1"
            >
              <button
                onClick={handleStartLink}
                className="p-1 rounded hover:bg-white/50 transition-colors"
                title="Create link"
              >
                <Link2 size={12} style={{ color: excerpt.color }} />
              </button>
              <button
                onClick={handleDelete}
                className="p-1 rounded hover:bg-red-100 transition-colors"
                title="Delete"
              >
                <Trash2 size={12} className="text-red-500" />
              </button>
            </motion.div>
          )}
        </div>

        {/* Content */}
        <div className="p-3 h-[calc(100%-36px)] overflow-hidden">
          <p className="text-xs text-gray-600 line-clamp-3 leading-relaxed">
            {excerpt.source.text || 'PDF excerpt'}
          </p>
        </div>
      </motion.div>

      {/* Connection point (left) */}
      <motion.div
        className="absolute -left-2 top-1/2 -translate-y-1/2 w-4 h-4 rounded-full"
        style={{
          backgroundColor: excerpt.color,
          border: '2px solid white',
          boxShadow: `0 2px 6px ${excerpt.color}50`,
        }}
        initial={{ scale: 0 }}
        animate={{ scale: isHovered || excerpt.selected ? 1 : 0.6 }}
        transition={{ type: 'spring', stiffness: 500, damping: 25 }}
      />
    </motion.div>
  )
})

export default ExcerptCard
