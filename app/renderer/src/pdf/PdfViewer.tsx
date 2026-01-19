import { EmbedPDF } from "@embedpdf/core/react";
import { usePdfiumEngine } from "@embedpdf/engines/react";

import { DocumentContent } from "@embedpdf/plugin-document-manager/react";

import { Viewport } from "@embedpdf/plugin-viewport/react";
import { Scroller } from "@embedpdf/plugin-scroll/react";
import { RenderLayer } from "@embedpdf/plugin-render/react";

import { createPdfPlugins } from "./pdfPlugins";
import { useEffect, useCallback, useRef, memo, useMemo } from "react";
import { pdfSelectionController } from "./selection/PdfSelectionController";
import { usePdfViewportStore } from "../store/pdfViewportStore";
import { useSelectionStore } from "../store/selectionStore";
import { useDocumentStore } from "../store/documentStore";
import { UploadZone } from "../components/UploadZone";

// Memoized selection layer for performance
const SelectionLayer = memo(function SelectionLayer({ 
  documentId, 
  pageIndex, 
  width, 
  height 
}: { 
  documentId: string
  pageIndex: number
  width: number
  height: number 
}) {
  const layerRef = useRef<HTMLDivElement>(null)
  const isSelecting = useRef(false)
  const startPoint = useRef({ x: 0, y: 0 })
  const selectionBox = useRef<HTMLDivElement | null>(null)
  
  // Update viewport store with page dimensions
  useEffect(() => {
    usePdfViewportStore.getState().setPageDimensions(pageIndex, width, height)
  }, [pageIndex, width, height])

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return // Only left click
    
    const rect = layerRef.current?.getBoundingClientRect()
    if (!rect) return

    isSelecting.current = true
    startPoint.current = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    }

    // Create selection box with enhanced styling
    if (!selectionBox.current && layerRef.current) {
      selectionBox.current = document.createElement('div')
      selectionBox.current.style.cssText = `
        position: absolute;
        border: 2px solid #6366f1;
        background: rgba(99, 102, 241, 0.15);
        pointer-events: none;
        border-radius: 4px;
        box-shadow: 0 0 0 1px rgba(99, 102, 241, 0.3);
        transition: box-shadow 0.1s ease;
      `
      layerRef.current.appendChild(selectionBox.current)
    }
    
    // Update selection store
    useSelectionStore.getState().startSelection(
      pageIndex,
      startPoint.current.x,
      startPoint.current.y
    )
  }, [pageIndex])

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isSelecting.current || !selectionBox.current || !layerRef.current) return

    const rect = layerRef.current.getBoundingClientRect()
    const currentX = Math.max(0, Math.min(e.clientX - rect.left, width))
    const currentY = Math.max(0, Math.min(e.clientY - rect.top, height))

    const x = Math.min(startPoint.current.x, currentX)
    const y = Math.min(startPoint.current.y, currentY)
    const w = Math.abs(currentX - startPoint.current.x)
    const h = Math.abs(currentY - startPoint.current.y)

    selectionBox.current.style.left = `${x}px`
    selectionBox.current.style.top = `${y}px`
    selectionBox.current.style.width = `${w}px`
    selectionBox.current.style.height = `${h}px`
    
    // Update selection store
    useSelectionStore.getState().updateSelection(x, y, w, h)
  }, [width, height])

  const handleMouseUp = useCallback((e: React.MouseEvent) => {
    if (!isSelecting.current || !layerRef.current) return

    const rect = layerRef.current.getBoundingClientRect()
    const endX = Math.max(0, Math.min(e.clientX - rect.left, width))
    const endY = Math.max(0, Math.min(e.clientY - rect.top, height))

    const x = Math.min(startPoint.current.x, endX)
    const y = Math.min(startPoint.current.y, endY)
    const w = Math.abs(endX - startPoint.current.x)
    const h = Math.abs(endY - startPoint.current.y)

    // Only emit if selection is large enough (not just a click)
    if (w > 10 && h > 10) {
      // Normalize coordinates (0-1 range)
      const normalized = {
        x: x / width,
        y: y / height,
        w: w / width,
        h: h / height,
      }

      const anchor = {
        documentId,
        pageIndex,
        rect: normalized,
      }

      // Emit to controller
      pdfSelectionController.emit(anchor)
      
      // Update selection store
      useSelectionStore.getState().endSelection(anchor)
    } else {
      useSelectionStore.getState().cancelSelection()
    }

    // Cleanup selection box
    if (selectionBox.current) {
      selectionBox.current.remove()
      selectionBox.current = null
    }
    isSelecting.current = false
  }, [documentId, pageIndex, width, height])

  const handleMouseLeave = useCallback(() => {
    if (selectionBox.current) {
      selectionBox.current.remove()
      selectionBox.current = null
    }
    if (isSelecting.current) {
      useSelectionStore.getState().cancelSelection()
    }
    isSelecting.current = false
  }, [])

  return (
    <div
      ref={layerRef}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseLeave}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        cursor: 'crosshair',
        touchAction: 'none', // Prevent touch scroll interference
      }}
    />
  )
})

// Viewport scroll tracker component
function ScrollTracker({ containerRef }: { containerRef: React.RefObject<HTMLElement | null> }) {
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const handleScroll = () => {
      usePdfViewportStore.getState().setScroll(
        container.scrollTop,
        container.scrollLeft
      )
    }

    container.addEventListener('scroll', handleScroll, { passive: true })
    
    // Update panel rect on mount and resize
    const updateRect = () => {
      usePdfViewportStore.getState().setPanelRect(container.getBoundingClientRect())
    }
    updateRect()
    
    const resizeObserver = new ResizeObserver(updateRect)
    resizeObserver.observe(container)

    return () => {
      container.removeEventListener('scroll', handleScroll)
      resizeObserver.disconnect()
    }
  }, [containerRef])

  return null
}

export function PdfViewer() {
  const { engine, isLoading, error } = usePdfiumEngine();
  const viewportRef = useRef<HTMLDivElement>(null)
  
  // Get active document from store
  const activeDocument = useDocumentStore((s) => 
    s.documents.find(d => d.id === s.activeDocumentId)
  )
  
  // Create plugins with the active document URL
  const plugins = useMemo(() => {
    return createPdfPlugins(activeDocument?.url)
  }, [activeDocument?.url])

  useEffect(() => {
    console.log("PDF Engine state:", { isLoading, hasEngine: !!engine, error });
  }, [isLoading, engine, error]);

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
            <div className="text-lg font-medium mb-1">Loading PDF engine…</div>
            <div className="text-sm text-gray-400">Initializing WASM module</div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-full flex items-center justify-center text-red-600">
        <div className="text-center p-6">
          <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-red-100 flex items-center justify-center">
            <svg className="w-6 h-6 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <div className="text-lg font-medium mb-1">Failed to load PDF engine</div>
          <div className="text-sm text-red-400">{error.message}</div>
        </div>
      </div>
    );
  }

  if (!engine) {
    return (
      <div className="h-full flex items-center justify-center text-gray-600">
        <div className="text-center">
          <div className="text-lg">No PDF engine available</div>
        </div>
      </div>
    );
  }

  // Show upload zone if no document is loaded
  if (!activeDocument) {
    return (
      <div className="h-full flex items-center justify-center p-8 bg-gray-50">
        <UploadZone className="w-full max-w-md" />
      </div>
    );
  }

  return (
    <EmbedPDF key={activeDocument.id} engine={engine} plugins={plugins}>
      {({ activeDocumentId }) => {
        return activeDocumentId ? (
          <DocumentContent documentId={activeDocumentId}>
            {({ isLoaded }) =>
              isLoaded ? (
                <div ref={viewportRef} className="h-full relative">
                  <ScrollTracker containerRef={viewportRef} />
                  <Viewport
                    documentId={activeDocumentId}
                    className="h-full bg-gray-100"
                  >
                    <Scroller
                      documentId={activeDocumentId}
                      renderPage={({ width, height, pageIndex }) => (
                        <div 
                          style={{ width, height, position: 'relative' }}
                          className="shadow-lg mb-4 bg-white"
                        >
                          <RenderLayer
                            documentId={activeDocumentId}
                            pageIndex={pageIndex}
                          />
                          <SelectionLayer
                            documentId={activeDocumentId}
                            pageIndex={pageIndex}
                            width={width}
                            height={height}
                          />
                        </div>
                      )}
                    />
                  </Viewport>
                </div>
              ) : (
                <div className="h-full flex items-center justify-center text-gray-600">
                  <div className="animate-pulse">Loading document...</div>
                </div>
              )
            }
          </DocumentContent>
        ) : (
          <div className="h-full flex items-center justify-center text-gray-600">
            <div className="animate-pulse">Initializing document...</div>
          </div>
        );
      }}
    </EmbedPDF>
  );
}
