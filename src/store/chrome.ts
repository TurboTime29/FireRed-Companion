import { create } from 'zustand'

/** Page-level chrome shared with the app bar: the current page's title. */
interface Chrome {
  title: string
  setTitle: (t: string) => void
}

export const useChrome = create<Chrome>()((set) => ({
  title: '',
  setTitle: (title) => set((s) => (s.title === title ? s : { title })),
}))

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
  '/tms': 'TMs & HMs',
  '/types': 'Type chart',
  '/trades': 'Trades',
  '/missables': 'Missables',
  '/encounters': 'Encounters',
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
