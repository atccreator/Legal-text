import { useEffect, useRef } from 'react'
import { WorkspaceController } from '../workspace/WorkspaceController'
import { useLinkStore } from '../store/linkStore'
import { useDraggingStore } from '../store/draggingStore'

export default function WorkspacePanel() {
  const containerRef = useRef<HTMLDivElement>(null)
  const controllerRef = useRef<WorkspaceController | null>(null)
  const linksCount = useLinkStore((s) => s.links.length)
  const isDragging = useDraggingStore((s) => s.isDragging)

  useEffect(() => {
    if (!containerRef.current) return

    controllerRef.current = new WorkspaceController(containerRef.current)

    return () => {
      controllerRef.current?.destroy()
      controllerRef.current = null
    }
  }, [])

  const onWheel = (e: React.WheelEvent) => {
    if (!e.ctrlKey) return
    e.preventDefault()

    const rect = containerRef.current?.getBoundingClientRect()
    if (!rect) return

    const mouseX = e.clientX - rect.left
    const mouseY = e.clientY - rect.top

    controllerRef.current?.zoom(
      e.deltaY < 0 ? 1.1 : 0.9,
      mouseX,
      mouseY
    )
  }

  return (
    <div className="relative w-full h-full">
      {/* Canvas container */}
      <div
        ref={containerRef}
        onWheel={onWheel}
        className="w-full h-full overflow-hidden bg-white relative"
        style={{ 
          minWidth: 0, 
          minHeight: 0,
          willChange: 'width'
        }}
      />
      
      {/* Drop zone indicator when dragging */}
      {isDragging && (
        <div 
          className="absolute inset-0 pointer-events-none flex items-center justify-center"
          style={{
            background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.03) 0%, rgba(139, 92, 246, 0.06) 100%)',
            border: '3px dashed rgba(99, 102, 241, 0.4)',
            borderRadius: 12,
            margin: 16,
            animation: 'fade-in-scale 0.2s ease-out',
          }}
        >
          <div className="text-center p-6 bg-white/90 backdrop-blur-sm rounded-xl shadow-lg border border-indigo-100">
            <div className="w-16 h-16 mx-auto mb-3 rounded-full bg-gradient-to-br from-indigo-100 to-purple-100 flex items-center justify-center">
              <svg className="w-8 h-8 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v16m8-8H4" />
              </svg>
            </div>
            <p className="text-lg font-semibold text-gray-800">Drop here to create link</p>
            <p className="text-sm text-gray-500 mt-1">Release to connect PDF selection</p>
          </div>
        </div>
      )}
      
      {/* Instructions overlay - shown when workspace is empty */}
      {linksCount === 0 && !isDragging && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="text-center p-6 bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg border border-gray-100 max-w-xs">
            <div className="w-14 h-14 mx-auto mb-4 rounded-xl bg-gradient-to-br from-indigo-100 to-purple-100 flex items-center justify-center">
              <svg className="w-7 h-7 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-800 mb-2">
              Create Your First Link
            </h3>
            <p className="text-sm text-gray-500 leading-relaxed">
              Select text in the PDF by clicking and dragging. Then drag the handle to create a connection.
            </p>
            <div className="mt-4 flex items-center justify-center gap-2 text-xs text-gray-400">
              <kbd className="px-2 py-1 bg-gray-100 rounded text-gray-600">Ctrl</kbd>
              <span>+ scroll to zoom</span>
            </div>
          </div>
        </div>
      )}
      
      {/* Links count badge */}
      {linksCount > 0 && (
        <div className="absolute top-4 right-4 px-3 py-1.5 bg-indigo-600 text-white text-sm font-medium rounded-full shadow-lg">
          {linksCount} link{linksCount !== 1 ? 's' : ''}
        </div>
      )}
    </div>
  )
}
