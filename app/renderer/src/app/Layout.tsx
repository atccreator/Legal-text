import React from 'react'
import { useRef, Component, ReactNode } from 'react'
import PdfPanel from '../panels/PdfPanel'
import { useLayoutStore } from '../store/layoutStore'
import { Toolbar } from '../components/Toolbar'
import { ToastContainer } from '../components/Toast'
import { CanvasWorkspace } from '../components/CanvasWorkspace'
import { DragGhost } from '../components/DragGhost'
import { LinkCanvas } from '../components/LinkCanvas'

// Error Boundary component
interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
}

class ErrorBoundary extends Component<{children: ReactNode}, ErrorBoundaryState> {
  constructor(props: {children: ReactNode}) {
    super(props)
    this.state = { hasError: false, error: null }
  }
  
  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error }
  }
  
  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('[ErrorBoundary] Caught error:', error, errorInfo)
  }
  
  render() {
    if (this.state.hasError) {
      return (
        <div className="p-8 bg-red-50 text-red-800 h-full">
          <h1 className="text-xl font-bold mb-2">Something went wrong</h1>
          <pre className="text-sm whitespace-pre-wrap bg-red-100 p-4 rounded">{this.state.error?.message}</pre>
          <pre className="text-xs mt-2 whitespace-pre-wrap bg-red-100 p-4 rounded overflow-auto max-h-96">{this.state.error?.stack}</pre>
        </div>
      )
    }
    return this.props.children
  }
}

// Simple workspace placeholder for debugging
function SimpleWorkspace() {
  return (
    <div className="h-full flex items-center justify-center bg-gray-50 p-8">
      <div className="text-center">
        <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-indigo-100 to-purple-100 flex items-center justify-center">
          <svg className="w-8 h-8 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
          </svg>
        </div>
        <h3 className="text-lg font-semibold text-gray-700 mb-2">Workspace</h3>
        <p className="text-sm text-gray-500">Select text in the PDF and drag here to create excerpts</p>
      </div>
    </div>
  )
}

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
    <ErrorBoundary>
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
          <CanvasWorkspace />
        </div>
      </div>
      
      {/* Cross-panel overlays - must be outside panel containers */}
      <DragGhost />
      <LinkCanvas />
      
      {/* Toast notifications */}
      <ToastContainer />
    </div>
    </ErrorBoundary>
  )
}
