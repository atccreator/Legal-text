import { PdfAnchor } from '../../workspace/types'

export type SelectionListener = (anchor: PdfAnchor) => void

class PdfSelectionControllerClass {
  private listeners: Set<SelectionListener> = new Set()

  subscribe(listener: SelectionListener): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  emit(anchor: PdfAnchor) {
    console.log('[PdfSelection] Selection captured:', {
      documentId: anchor.documentId,
      pageIndex: anchor.pageIndex,
      rect: anchor.rect,
    })
    this.listeners.forEach((listener) => listener(anchor))
  }
}

// Singleton instance
export const pdfSelectionController = new PdfSelectionControllerClass()

