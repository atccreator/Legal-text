import { create } from 'zustand'
import { subscribeWithSelector } from 'zustand/middleware'

export interface PdfDocument {
  id: string
  name: string
  url: string
  loadedAt: Date
}

interface DocumentState {
  documents: PdfDocument[]
  activeDocumentId: string | null
  isUploading: boolean
  addDocument: (file: File) => Promise<PdfDocument>
  addDocumentFromUrl: (url: string, name?: string) => PdfDocument
  removeDocument: (id: string) => void
  setActiveDocument: (id: string | null) => void
  getDocument: (id: string) => PdfDocument | undefined
}

export const useDocumentStore = create<DocumentState>()(
  subscribeWithSelector((set, get) => ({
    documents: [],
    activeDocumentId: null,
    isUploading: false,

    addDocument: async (file: File) => {
      set({ isUploading: true })
      
      try {
        // Create blob URL for the file
        const url = URL.createObjectURL(file)
        
        const doc: PdfDocument = {
          id: crypto.randomUUID(),
          name: file.name,
          url,
          loadedAt: new Date(),
        }

        set((state) => ({
          documents: [...state.documents, doc],
          activeDocumentId: doc.id,
          isUploading: false,
        }))

        return doc
      } catch (error) {
        set({ isUploading: false })
        throw error
      }
    },

    addDocumentFromUrl: (url: string, name?: string) => {
      const doc: PdfDocument = {
        id: crypto.randomUUID(),
        name: name || url.split('/').pop() || 'Document',
        url,
        loadedAt: new Date(),
      }

      set((state) => ({
        documents: [...state.documents, doc],
        activeDocumentId: doc.id,
      }))

      return doc
    },

    removeDocument: (id: string) => {
      const doc = get().documents.find(d => d.id === id)
      if (doc?.url.startsWith('blob:')) {
        URL.revokeObjectURL(doc.url)
      }
      
      set((state) => ({
        documents: state.documents.filter(d => d.id !== id),
        activeDocumentId: state.activeDocumentId === id 
          ? state.documents.find(d => d.id !== id)?.id || null
          : state.activeDocumentId,
      }))
    },

    setActiveDocument: (id: string | null) => {
      set({ activeDocumentId: id })
    },

    getDocument: (id: string) => {
      return get().documents.find(d => d.id === id)
    },
  }))
)
