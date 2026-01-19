import { create } from 'zustand'

interface LayoutState {
  leftWidth: number
  setLeftWidth: (width: number) => void
}

export const useLayoutStore = create<LayoutState>((set) => ({
  leftWidth: 400,
  setLeftWidth: (width) => set({ leftWidth: width })
}))
