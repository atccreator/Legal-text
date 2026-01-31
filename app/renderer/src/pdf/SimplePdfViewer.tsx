/**
 * Simple PDF Viewer using pdf.js
 * 
 * A lightweight PDF viewer for displaying documents
 */

import { useEffect, useRef, useState, useCallback } from 'react'
import * as pdfjsLib from 'pdfjs-dist'
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import { useDocumentStore } from '../store/documentStore'
import { usePdfViewportStore } from '../store/pdfViewportStore'
import { UploadZone } from '../components/UploadZone'
import { SelectionLayer } from '../components/SelectionLayer'

// Configure pdf.js worker using local bundled file
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker

interface PageInfo {
  pageIndex: number
  width: number
  height: number
}

function PdfPage({ 
  pdf, 
  pageIndex, 
  scale,
  documentId,
  onPageRendered,
}: { 
  pdf: pdfjsLib.PDFDocumentProxy
  pageIndex: number
  scale: number
  documentId: string
  onPageRendered: (info: PageInfo) => void
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 })
  const renderTaskRef = useRef<pdfjsLib.RenderTask | null>(null)

  useEffect(() => {
    let mounted = true
    
    const renderPage = async () => {
      if (!canvasRef.current) return
      
      try {
        const page = await pdf.getPage(pageIndex + 1) // pdf.js uses 1-based indexing
        
        if (!mounted) return
        
        const viewport = page.getViewport({ scale })
        const canvas = canvasRef.current
        const context = canvas.getContext('2d')
        
        if (!context) return
        
        // Set canvas dimensions
        canvas.width = viewport.width
        canvas.height = viewport.height
        
        setDimensions({ width: viewport.width, height: viewport.height })
        onPageRendered({ pageIndex, width: viewport.width, height: viewport.height })
        
        // Cancel previous render task if any
        if (renderTaskRef.current) {
          renderTaskRef.current.cancel()
        }
        
        // Render PDF page to canvas
        const renderContext = {
          canvasContext: context,
          viewport: viewport,
          canvas: canvas,
        }
        
        renderTaskRef.current = page.render(renderContext)
        await renderTaskRef.current.promise
      } catch (error: any) {
        if (error?.name !== 'RenderingCancelledException') {
          console.error('Error rendering page:', error)
        }
      }
    }
    
    renderPage()
    
    return () => {
      mounted = false
      if (renderTaskRef.current) {
        renderTaskRef.current.cancel()
      }
    }
  }, [pdf, pageIndex, scale, onPageRendered])

  return (
    <div 
      ref={containerRef}
      className="relative bg-white shadow-lg mb-4"
      style={{ width: dimensions.width, height: dimensions.height }}
    >
      <canvas ref={canvasRef} className="block" />
      <SelectionLayer
        documentId={documentId}
        pageIndex={pageIndex}
        width={dimensions.width}
        height={dimensions.height}
      />
    </div>
  )
}

export function SimplePdfViewer() {
  const containerRef = useRef<HTMLDivElement>(null)
  const [pdf, setPdf] = useState<pdfjsLib.PDFDocumentProxy | null>(null)
  const [numPages, setNumPages] = useState(0)
  const [scale, setScale] = useState(1.5)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  // Get active document from store
  const activeDocument = useDocumentStore((s) => 
    s.documents.find(d => d.id === s.activeDocumentId)
  )

  // Load PDF when document changes
  useEffect(() => {
    if (!activeDocument?.url) {
      setPdf(null)
      setNumPages(0)
      return
    }

    let mounted = true
    setIsLoading(true)
    setError(null)

    const loadPdf = async () => {
      try {
        console.log('[SimplePdfViewer] Loading PDF:', activeDocument.url)
        
        const loadingTask = pdfjsLib.getDocument(activeDocument.url)
        const pdfDoc = await loadingTask.promise
        
        if (!mounted) return
        
        console.log('[SimplePdfViewer] PDF loaded, pages:', pdfDoc.numPages)
        setPdf(pdfDoc)
        setNumPages(pdfDoc.numPages)
        setIsLoading(false)
      } catch (err: any) {
        if (!mounted) return
        console.error('[SimplePdfViewer] Error loading PDF:', err)
        setError(err.message || 'Failed to load PDF')
        setIsLoading(false)
      }
    }

    loadPdf()

    return () => {
      mounted = false
    }
  }, [activeDocument?.url])

  // Track scroll position
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const handleScroll = () => {
      usePdfViewportStore.getState().setScroll(
        container.scrollTop,
        container.scrollLeft
      )
    }

    const updateRect = () => {
      usePdfViewportStore.getState().setPanelRect(container.getBoundingClientRect())
    }
    
    container.addEventListener('scroll', handleScroll, { passive: true })
    updateRect()
    
    const resizeObserver = new ResizeObserver(updateRect)
    resizeObserver.observe(container)

    return () => {
      container.removeEventListener('scroll', handleScroll)
      resizeObserver.disconnect()
    }
  }, [])

  // Handle page rendered callback
  const handlePageRendered = useCallback((info: PageInfo) => {
    usePdfViewportStore.getState().setPageDimensions(info.pageIndex, info.width, info.height)
  }, [])

  // Show upload zone if no document
  if (!activeDocument) {
    return (
      <div className="h-full flex items-center justify-center p-8 bg-gray-50">
        <UploadZone className="w-full max-w-md" />
      </div>
    )
  }

  // Loading state
  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center text-gray-600">
        <div className="text-center">
          <div className="animate-pulse">
            <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-indigo-100 flex items-center justify-center">
              <svg className="w-6 h-6 text-indigo-500 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            </div>
            <div className="text-lg font-medium mb-1">Loading PDF...</div>
          </div>
        </div>
      </div>
    )
  }

  // Error state
  if (error) {
    return (
      <div className="h-full flex items-center justify-center text-red-600">
        <div className="text-center p-6">
          <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-red-100 flex items-center justify-center">
            <svg className="w-6 h-6 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <div className="text-lg font-medium mb-1">Failed to load PDF</div>
          <div className="text-sm text-red-400">{error}</div>
        </div>
      </div>
    )
  }

  // No PDF loaded
  if (!pdf) {
    return (
      <div className="h-full flex items-center justify-center text-gray-600">
        <div className="text-center">
          <div className="text-lg">No PDF loaded</div>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col">
      {/* Toolbar */}
      <div className="flex items-center gap-2 p-2 border-b bg-gray-50">
        <button
          onClick={() => setScale(s => Math.max(0.5, s - 0.25))}
          className="px-2 py-1 text-sm bg-white border rounded hover:bg-gray-50"
        >
          −
        </button>
        <span className="text-sm text-gray-600 min-w-[60px] text-center">
          {Math.round(scale * 100)}%
        </span>
        <button
          onClick={() => setScale(s => Math.min(3, s + 0.25))}
          className="px-2 py-1 text-sm bg-white border rounded hover:bg-gray-50"
        >
          +
        </button>
        <span className="text-sm text-gray-500 ml-2">
          {numPages} page{numPages !== 1 ? 's' : ''}
        </span>
      </div>
      
      {/* Pages container */}
      <div 
        ref={containerRef}
        className="flex-1 overflow-auto bg-gray-100 p-4"
      >
        <div className="flex flex-col items-center">
          {Array.from({ length: numPages }, (_, i) => (
            <PdfPage
              key={i}
              pdf={pdf}
              pageIndex={i}
              scale={scale}
              documentId={activeDocument.id}
              onPageRendered={handlePageRendered}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
