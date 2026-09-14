import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface Settings {
  theme: 'system' | 'light' | 'dark'
  showShiny: boolean
  spoilers: boolean
  setTheme: (t: Settings['theme']) => void
  setShowShiny: (v: boolean) => void
  setSpoilers: (v: boolean) => void
}

export const useSettings = create<Settings>()(
  persist(
    (set) => ({
      theme: 'system',
      showShiny: false,
      spoilers: true,
      setTheme: (theme) => set({ theme }),
      setShowShiny: (showShiny) => set({ showShiny }),
      setSpoilers: (spoilers) => set({ spoilers }),
    }),
    { name: 'firered-companion-settings' },
  ),
)
