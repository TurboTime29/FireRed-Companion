import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface PageRef { to: string; title: string }

/** Page-level chrome shared with the app bar: the current page's title, recently visited pages and pinned pages. */
interface Chrome {
  title: string
  recents: PageRef[]
  pins: PageRef[]
  setTitle: (t: string) => void
  pushRecent: (to: string, title: string) => void
  togglePin: (to: string, title: string) => void
}

export const useChrome = create<Chrome>()(
  persist(
    (set) => ({
      title: '',
      recents: [],
      pins: [],
      setTitle: (title) => set((s) => (s.title === title ? s : { title })),
      pushRecent: (to, title) => set((s) => {
        if (to === '/' || !title) return s
        const recents = [{ to, title }, ...s.recents.filter((r) => r.to !== to)].slice(0, 12)
        return { recents }
      }),
      togglePin: (to, title) => set((s) => ({ pins: s.pins.some((p) => p.to === to) ? s.pins.filter((p) => p.to !== to) : [...s.pins, { to, title }].slice(-12) })),
    }),
    { name: 'firered-companion-chrome', version: 1, partialize: (s) => ({ recents: s.recents, pins: s.pins }) as Chrome },
  ),
)

/** Top-level tabs and the label / parent of every route family. */
export const ROOT_LABEL: Record<string, string> = {
  '/': 'Home',
  '/guide': 'Walkthrough',
  '/dex': 'Pokédex',
  '/team': 'Team',
  '/battle': 'Battle',
  '/more': 'More',
  '/locations': 'Locations',
  '/trainers': 'Trainers',
  '/moves': 'Moves',
  '/items': 'Items',
  '/tms': 'TM planner',
  '/types': 'Type chart',
  '/trades': 'Trades',
  '/missables': 'Missables',
  '/encounters': 'Encounters',
  '/catch': 'Catch calculator',
  '/held-items': 'Held-item farming',
  '/farming': 'Levels & farming',
  '/mechanics': 'Mechanics',
  '/bag': 'Bag & PC',
  '/breeding': 'Breeding',
  '/postgame': 'Post-game',
  '/compare': 'Compare',
  '/search': 'Search',
  '/settings': 'Settings',
}

export const TAB_ROOTS = ['/', '/guide', '/dex', '/team', '/battle', '/more']

/** Where "up" goes from a path when there is no history to go back to. */
export function parentOf(path: string): { to: string; label: string } | null {
  if (path === '/') return null
  const seg = '/' + path.split('/')[1]
  const detail = path.split('/').length > 2
  if (detail) {
    const map: Record<string, string> = { '/location': '/locations', '/dex': '/dex', '/guide': '/guide', '/trainers': '/trainers', '/moves': '/moves', '/items': '/items' }
    const to = map[seg] ?? '/'
    return { to, label: ROOT_LABEL[to] ?? 'Home' }
  }
  if (TAB_ROOTS.includes(seg)) return { to: '/', label: 'Home' }
  return { to: '/more', label: 'More' }
}
