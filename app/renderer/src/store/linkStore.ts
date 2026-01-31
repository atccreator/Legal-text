import { create } from 'zustand'
import { subscribeWithSelector } from 'zustand/middleware'
import { Link, PdfAnchor, WorkspaceNode } from '../workspace/types'
import { useToastStore } from './toastStore'

interface LinkState {
  links: Link[]
  addLink: (from: PdfAnchor, toPosition: { x: number; y: number }) => Link
  removeLink: (id: string) => void
  updateNodePosition: (linkId: string, position: { x: number; y: number }) => void
  getLink: (id: string) => Link | undefined
  clearLinks: () => void
}

export const useLinkStore = create<LinkState>()(
  subscribeWithSelector((set, get) => ({
    links: [],

    addLink: (from: PdfAnchor, toPosition: { x: number; y: number }) => {
      const newLink: Link = {
        id: crypto.randomUUID(),
        from,
        to: {
          id: crypto.randomUUID(),
          position: toPosition,
        },
        metadata: {
          createdAt: Date.now(),
        },
      }

      console.log('[LinkStore] New link created:', newLink.id)

      set((state) => ({
        links: [...state.links, newLink],
      }))
      
      // Show success toast
      useToastStore.getState().addToast('Link created successfully!', 'success', 2500)

      return newLink
    },

    removeLink: (id: string) => {
      set((state) => ({
        links: state.links.filter((link) => link.id !== id),
      }))
      useToastStore.getState().addToast('Link removed', 'info', 2000)
    },

    updateNodePosition: (linkId: string, position: { x: number; y: number }) => {
      set((state) => ({
        links: state.links.map((link) =>
          link.id === linkId
            ? { ...link, to: { ...link.to, position } }
            : link
        ),
      }))
    },

    getLink: (id: string) => {
      return get().links.find((link) => link.id === id)
    },

    clearLinks: () => {
      const count = get().links.length
      set({ links: [] })
      if (count > 0) {
        useToastStore.getState().addToast(`Cleared ${count} link${count !== 1 ? 's' : ''}`, 'info', 2000)
      }
    },
  }))
)
