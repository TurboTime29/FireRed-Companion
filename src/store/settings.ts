import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface Settings {
  theme: 'system' | 'light' | 'dark' | 'oled'
  showShiny: boolean
  spoilers: boolean
  fontSize: 'normal' | 'large'
  animatedSprites: boolean
  setTheme: (t: Settings['theme']) => void
  setShowShiny: (v: boolean) => void
  setSpoilers: (v: boolean) => void
  setFontSize: (v: Settings['fontSize']) => void
  setAnimatedSprites: (v: boolean) => void
}

export const useSettings = create<Settings>()(
  persist(
    (set) => ({
      theme: 'system',
      showShiny: true,
      spoilers: true,
      fontSize: 'normal',
      animatedSprites: false,
      setTheme: (theme) => set({ theme }),
      setShowShiny: (showShiny) => set({ showShiny }),
      setSpoilers: (spoilers) => set({ spoilers }),
      setFontSize: (fontSize) => set({ fontSize }),
      setAnimatedSprites: (animatedSprites) => set({ animatedSprites }),
    }),
    {
      name: 'firered-companion-settings',
      version: 3,
      // v2: "show shiny" changed meaning (only Pokémon you own as shiny) and defaults to on; v3: font size + animated sprites
      migrate: (state, version) => ({ ...(state as Settings), showShiny: version < 2 ? true : (state as Settings).showShiny, fontSize: (state as Settings).fontSize ?? 'normal', animatedSprites: (state as Settings).animatedSprites ?? false }),
    },
  ),
)
