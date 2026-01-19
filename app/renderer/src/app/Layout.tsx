import PdfPanel from '../panels/PdfPanel'
import WorkspacePanel from '../panels/WorkspacePanel'
import { useLayoutStore } from '../store/layoutStore'
import { useRef } from 'react'
import { Toolbar } from '../components/Toolbar'
import { LinkOverlay } from '../components/LinkOverlay'

export default function Layout() {
  const { leftWidth, setLeftWidth } = useLayoutStore()
  const isDragging = useRef(false)

  const startDrag = () => {
    isDragging.current = true
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
  }

  const stopDrag = () => {
    isDragging.current = false
    document.body.style.cursor = ''
    document.body.style.userSelect = ''
  }

  const onMouseMove = (e: React.MouseEvent) => {
    if (!isDragging.current) return
    setLeftWidth(Math.max(200, Math.min(e.clientX, window.innerWidth - 300)))
  }

  return (
    <div className="w-full h-full flex flex-col overflow-hidden bg-gray-50">
      {/* Top toolbar */}
      <Toolbar />
      
      {/* Main content area */}
      <div
        className="flex-1 flex overflow-hidden"
        onMouseMove={onMouseMove}
        onMouseUp={stopDrag}
        onMouseLeave={stopDrag}
      >
        {/* PDF Panel */}
        <div
          className="h-full flex-shrink-0 overflow-hidden bg-white"
          style={{ width: leftWidth }}
        >
          <PdfPanel />
        </div>

        {/* Resizer */}
        <div
          className="w-1.5 cursor-col-resize bg-gray-200 hover:bg-indigo-400 flex-shrink-0 transition-colors duration-150 relative group"
          onMouseDown={startDrag}
        >
          {/* Drag handle indicator */}
          <div className="absolute inset-y-0 -left-1 -right-1 group-hover:bg-indigo-400/20" />
        </div>

        {/* Workspace Panel */}
        <div className="flex-1 h-full overflow-hidden bg-white" style={{ minWidth: 0 }}>
          <WorkspacePanel />
        </div>
      </div>
      
      {/* SVG overlay for bezier curves spanning both panels */}
      <LinkOverlay />
    </div>
  )
}
