/**
 * DragGhost Component - Visual preview while dragging from PDF to canvas
 * 
 * Features:
 * - Follows cursor smoothly with Framer Motion
 * - Shows preview of the selected text
 * - Visual feedback when over drop zone
 */

import { memo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { FileText, ArrowRight } from 'lucide-react'
import { useDragController } from '../store/dragController'

export const DragGhost = memo(function DragGhost() {
  const phase = useDragController((s) => s.phase)
  const source = useDragController((s) => s.source)
  const pointerPosition = useDragController((s) => s.pointerPosition)
  const ghostOpacity = useDragController((s) => s.ghostOpacity)
  const dropTarget = useDragController((s) => s.dropTarget)

  const isVisible = phase === 'dragging' && source && pointerPosition
  const isOverWorkspace = dropTarget.isValid

  if (!isVisible) return null

  return (
    <AnimatePresence>
      <motion.div
        key="drag-ghost"
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{
          opacity: ghostOpacity,
          scale: isOverWorkspace ? 1.05 : 1,
          x: pointerPosition.x,
          y: pointerPosition.y,
        }}
        exit={{ opacity: 0, scale: 0.8 }}
        transition={{
          type: 'spring',
          stiffness: 500,
          damping: 30,
          opacity: { duration: 0.15 },
        }}
        className="fixed pointer-events-none z-[9999]"
        style={{
          transform: 'translate(-50%, -50%)',
        }}
      >
        {/* Ghost card */}
        <motion.div
          className="flex items-center gap-3 px-4 py-3 rounded-xl shadow-2xl"
          style={{
            backgroundColor: isOverWorkspace ? 'white' : 'rgba(255,255,255,0.95)',
            border: isOverWorkspace ? '2px solid #6366f1' : '2px solid #e5e7eb',
            backdropFilter: 'blur(8px)',
            minWidth: 180,
          }}
          animate={{
            boxShadow: isOverWorkspace 
              ? '0 20px 40px rgba(99, 102, 241, 0.3)' 
              : '0 10px 30px rgba(0, 0, 0, 0.15)',
          }}
        >
          <motion.div
            className="w-10 h-10 rounded-lg flex items-center justify-center"
            style={{
              backgroundColor: isOverWorkspace ? '#6366f1' : '#f3f4f6',
            }}
            animate={{
              backgroundColor: isOverWorkspace ? '#6366f1' : '#f3f4f6',
            }}
          >
            <FileText 
              size={20} 
              className={isOverWorkspace ? 'text-white' : 'text-gray-500'} 
            />
          </motion.div>
          
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-800 truncate">
              {source.text?.slice(0, 30) || 'PDF Excerpt'}
              {source.text && source.text.length > 30 ? '...' : ''}
            </p>
            <p className="text-xs text-gray-500">
              Page {source.pageIndex + 1}
            </p>
          </div>

          <motion.div
            animate={{
              x: isOverWorkspace ? [0, 4, 0] : 0,
            }}
            transition={{
              repeat: isOverWorkspace ? Infinity : 0,
              duration: 0.6,
            }}
          >
            <ArrowRight 
              size={18} 
              className={isOverWorkspace ? 'text-indigo-500' : 'text-gray-400'} 
            />
          </motion.div>
        </motion.div>

        {/* Drop indicator */}
        <AnimatePresence>
          {isOverWorkspace && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 5 }}
              className="absolute left-1/2 -bottom-8 -translate-x-1/2 whitespace-nowrap"
            >
              <span className="text-xs font-medium text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full">
                Release to create excerpt
              </span>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </AnimatePresence>
  )
})

export default DragGhost
