import { create } from 'zustand'
import { subscribeWithSelector } from 'zustand/middleware'
import { Link, PdfAnchor, WorkspaceNode } from '../workspace/types'

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
      }

      console.log('[LinkStore] New link created:', newLink.id)

      set((state) => ({
        links: [...state.links, newLink],
      }))

      return newLink
    },

    removeLink: (id: string) => {
      set((state) => ({
        links: state.links.filter((link) => link.id !== id),
      }))
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
      set({ links: [] })
    },
  }))
)
