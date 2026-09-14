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
      showShiny: true,
      spoilers: true,
      setTheme: (theme) => set({ theme }),
      setShowShiny: (showShiny) => set({ showShiny }),
      setSpoilers: (spoilers) => set({ spoilers }),
    }),
    {
      name: 'firered-companion-settings',
      version: 2,
      // v2: "show shiny" changed meaning (only Pokémon you own as shiny) and defaults to on
      migrate: (state, version) => ({ ...(state as Settings), showShiny: version < 2 ? true : (state as Settings).showShiny }),
    },
  ),
)
