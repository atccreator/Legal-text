import { EmbedPDF } from "@embedpdf/core/react";
import { usePdfiumEngine } from "@embedpdf/engines/react";

import { DocumentContent } from "@embedpdf/plugin-document-manager/react";

import { Viewport } from "@embedpdf/plugin-viewport/react";
import { Scroller } from "@embedpdf/plugin-scroll/react";
import { RenderLayer } from "@embedpdf/plugin-render/react";

import { createPdfPlugins } from "./pdfPlugins";
import { useEffect, useRef, useMemo } from "react";
import { usePdfViewportStore } from "../store/pdfViewportStore";
import { useDocumentStore } from "../store/documentStore";
import { UploadZone } from "../components/UploadZone";
import { SelectionLayer } from "../components/SelectionLayer";

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
