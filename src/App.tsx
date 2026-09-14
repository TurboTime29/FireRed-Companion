import { Suspense, lazy, useEffect, useRef, useState, type ComponentType } from 'react'
import { Link, NavLink, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { useDb } from './data/db'
import { SearchBox } from './components/SearchBox'
import { useSettings } from './store/settings'
import { useSync, useSyncStatus } from './lib/sync'
import { ROOT_LABEL, TAB_ROOTS, parentOf, useChrome } from './store/chrome'
import { ErrorBoundary, isStaleChunkError, reloadOnceForStaleChunk, rememberError } from './components/ErrorBoundary'
import { CommandPalette } from './components/CommandPalette'

/** lazy() that survives a deploy happening while the app is open: a missing chunk reloads the app once instead of crashing. */
function L<T extends { default: ComponentType }>(f: () => Promise<T>) {
  return lazy(() => f().catch((e: unknown) => {
    rememberError(e, 'chunk')
    if (isStaleChunkError(e) && reloadOnceForStaleChunk()) return new Promise<T>(() => {})
    throw e
  }))
}

const Dashboard = L(() => import('./pages/Dashboard'))
const Guide = L(() => import('./pages/Guide'))
const ChapterPage = L(() => import('./pages/ChapterPage'))
const LocationsPage = L(() => import('./pages/LocationsPage'))
const LocationPage = L(() => import('./pages/LocationPage'))
const Pokedex = L(() => import('./pages/Pokedex'))
const PokemonPage = L(() => import('./pages/PokemonPage'))
const MovesPage = L(() => import('./pages/MovesPage'))
const MovePage = L(() => import('./pages/MovePage'))
const ItemsPage = L(() => import('./pages/ItemsPage'))
const ItemPage = L(() => import('./pages/ItemPage'))
const TrainersPage = L(() => import('./pages/TrainersPage'))
const TrainerPage = L(() => import('./pages/TrainerPage'))
const TeamPage = L(() => import('./pages/TeamPage'))
const BattlePage = L(() => import('./pages/BattlePage'))
const TypeChartPage = L(() => import('./pages/TypeChartPage'))
const SettingsPage = L(() => import('./pages/SettingsPage'))
const MorePage = L(() => import('./pages/MorePage'))
const SearchPage = L(() => import('./pages/SearchPage'))
const TradesPage = L(() => import('./pages/TradesPage'))
const MissablesPage = L(() => import('./pages/MissablesPage'))
const TmPage = L(() => import('./pages/TmPage'))
const EncountersPage = L(() => import('./pages/EncountersPage'))
const CatchPage = L(() => import('./pages/CatchPage'))
const HeldItemsPage = L(() => import('./pages/HeldItemsPage'))
const FarmingPage = L(() => import('./pages/FarmingPage'))
const MechanicsPage = L(() => import('./pages/MechanicsPage'))
const BagPage = L(() => import('./pages/BagPage'))
const BreedingPage = L(() => import('./pages/BreedingPage'))
const PostgamePage = L(() => import('./pages/PostgamePage'))
const ComparePage = L(() => import('./pages/ComparePage'))

const tabs = [
  { to: '/', label: 'Home', icon: '🏠' },
  { to: '/guide', label: 'Guide', icon: '📖' },
  { to: '/dex', label: 'Dex', icon: '🔴' },
  { to: '/team', label: 'Team', icon: '👥' },
  { to: '/battle', label: 'Battle', icon: '⚔️' },
  { to: '/more', label: 'More', icon: '☰' },
]

const base = import.meta.env.BASE_URL

function historyIndex() {
  return (window.history.state as { idx?: number } | null)?.idx ?? 0
}

/** Back control: browser history when there is some, otherwise the route's natural parent. */
export function useBack() {
  const nav = useNavigate()
  const loc = useLocation()
  const canGoBack = historyIndex() > 0
  const parent = parentOf(loc.pathname)
  const go = () => { if (canGoBack) nav(-1); else if (parent) nav(parent.to) }
  return { canGoBack, parent, go }
}

function PokeballSpinner({ size = 56 }: { size?: number }) {
  return (
    <div className="pokeball-spin rounded-full" style={{ width: size, height: size, background: 'linear-gradient(180deg, #e3350d 0 46%, #1c1917 46% 54%, #fff 54% 100%)', boxShadow: '0 0 0 3px #1c1917 inset, 0 6px 16px -4px rgba(0,0,0,.4)', position: 'relative' }}>
      <div className="absolute left-1/2 top-1/2 h-[30%] w-[30%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-white" style={{ boxShadow: '0 0 0 3px #1c1917, 0 0 0 5px #fff' }} />
    </div>
  )
}

function Lens() {
  const sync = useSyncStatus()
  return (
    <div className="flex items-center gap-1.5">
      <div className={`lens ${sync.status === 'syncing' ? 'lens-live' : ''}`} title={sync.status === 'synced' ? 'Cloud sync on' : sync.status === 'syncing' ? 'Syncing…' : sync.status === 'error' ? 'Sync error' : 'Not signed in'} />
      <div className="lights flex gap-1 pt-[2px]">
        <span className="text-red-400" style={{ background: '#f87171' }} />
        <span className="text-yellow-300" style={{ background: sync.status === 'syncing' ? '#fde047' : '#a16207' }} />
        <span className="text-green-400" style={{ background: sync.status === 'synced' ? '#4ade80' : '#166534' }} />
      </div>
    </div>
  )
}

function AppBar() {
  const loc = useLocation()
  const { canGoBack, parent, go } = useBack()
  const title = useChrome((s) => s.title)
  const pins = useChrome((s) => s.pins)
  const togglePin = useChrome((s) => s.togglePin)
  const [showSearch, setShowSearch] = useState(false)
  const seg = '/' + loc.pathname.split('/')[1]
  const here = loc.pathname + loc.search
  const pinned = pins.some((p) => p.to === here)
  const isRoot = TAB_ROOTS.includes(loc.pathname) || loc.pathname === '/'
  const isHome = loc.pathname === '/'
  const fallback = ROOT_LABEL[loc.pathname] ?? ROOT_LABEL[seg] ?? ''
  useEffect(() => { setShowSearch(false) }, [loc.pathname])
  return (
    <header className="pt-safe sticky top-0 z-30 bg-gradient-to-b from-dex-600 to-dex-700 text-white shadow-md dark:from-dex-700 dark:to-dex-900">
      <div className="mx-auto flex h-13 max-w-6xl items-center gap-1 px-2 md:px-4">
        {isHome ? (
          <div className="flex items-center gap-2 pl-1"><Lens /></div>
        ) : (
          <button type="button" onClick={go} className="btn-icon shrink-0 text-white hover:bg-white/15 dark:text-white dark:hover:bg-white/15" aria-label={canGoBack ? 'Back' : `Up to ${parent?.label}`} title={canGoBack ? 'Back (Esc)' : `Up to ${parent?.label}`}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M15 5l-7 7 7 7" /></svg>
          </button>
        )}
        <div className="min-w-0 flex-1 leading-tight">
          {!isHome && !isRoot && parent && (
            <div className="flex items-center gap-1 text-[11px] text-white/75">
              <Link to={parent.to} className="hover:underline">{parent.label}</Link>
              {canGoBack && <span className="text-white/50">· back to previous</span>}
            </div>
          )}
          <div className="truncate font-display text-[15px] font-bold tracking-tight md:text-base">{isHome ? 'FireRed Companion' : title || fallback}</div>
        </div>
        {!isHome && <button type="button" onClick={() => togglePin(here, title || fallback)} className="btn-icon text-white hover:bg-white/15 dark:text-white dark:hover:bg-white/15" aria-label={pinned ? 'Unpin page' : 'Pin page'} title={pinned ? 'Unpin from quick search' : 'Pin to quick search (Ctrl/⌘ K)'}>{pinned ? '★' : '☆'}</button>}
        <div className="hidden w-64 md:block"><SearchBox light /></div>
        <button type="button" onClick={() => setShowSearch(!showSearch)} className="btn-icon text-white hover:bg-white/15 md:hidden dark:text-white dark:hover:bg-white/15" aria-label="Search">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></svg>
        </button>
        {!isHome && <div className="hidden pl-1 md:block"><Lens /></div>}
      </div>
      {showSearch && <div className="fade-up mx-auto max-w-6xl px-2 pb-2 md:hidden"><SearchBox light autoFocus onDone={() => setShowSearch(false)} /></div>}
    </header>
  )
}

function Sidebar() {
  return (
    <aside className="sticky top-13 hidden h-[calc(100vh-3.25rem)] w-56 shrink-0 flex-col gap-1 p-3 md:flex">
      <NavLink to="/" className="card-hover mb-3 flex items-center gap-3 rounded-2xl bg-gradient-to-br from-dex-500 to-dex-800 p-3 text-white shadow-lg">
        <img src={`${base}sprites/items/poke-ball.png`} className="sprite h-8 w-8 drop-shadow" alt="" />
        <div className="leading-tight"><div className="font-display text-base font-bold">FireRed</div><div className="text-[11px] text-white/80">Companion</div></div>
      </NavLink>
      {tabs.map((t) => (
        <NavLink key={t.to} to={t.to} end={t.to === '/'} className={({ isActive }) => `flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-colors ${isActive ? 'bg-dex-500 text-white shadow' : 'text-stone-700 hover:bg-stone-200/70 dark:text-stone-200 dark:hover:bg-stone-800'}`}>
          {({ isActive }) => <><span className={`text-lg leading-none ${isActive ? 'nav-active-icon' : ''}`}>{t.icon}</span>{t.label}</>}
        </NavLink>
      ))}
      <div className="mt-auto px-1 text-[11px] text-stone-400">Esc or ← goes back · fan-made, non-commercial</div>
    </aside>
  )
}

function BottomNav() {
  return (
    <nav className="pb-safe fixed inset-x-0 bottom-0 z-30 border-t border-stone-200/70 bg-white/90 backdrop-blur-md md:hidden dark:border-stone-800 dark:bg-stone-900/90">
      <div className="grid grid-cols-6">
        {tabs.map((t) => (
          <NavLink key={t.to} to={t.to} end={t.to === '/'} className={({ isActive }) => `relative flex flex-col items-center gap-0.5 py-1.5 text-[10px] font-medium transition-colors ${isActive ? 'text-dex-600 dark:text-red-400' : 'text-stone-500'}`}>
            {({ isActive }) => (
              <>
                <span className={`flex h-7 w-11 items-center justify-center rounded-full text-lg leading-none transition-colors ${isActive ? 'bg-dex-100 dark:bg-dex-900/60' : ''}`}><span className={isActive ? 'nav-active-icon' : ''}>{t.icon}</span></span>
                {t.label}
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  )
}

/** Keyboard (Esc) and left-edge swipe both go back. */
function useBackGestures() {
  const nav = useNavigate()
  const start = useRef<{ x: number; y: number } | null>(null)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName
      if (e.key === 'Escape' && !['INPUT', 'TEXTAREA', 'SELECT'].includes(tag) && historyIndex() > 0) nav(-1)
    }
    const onStart = (e: TouchEvent) => { const t = e.touches[0]; start.current = t.clientX < 28 ? { x: t.clientX, y: t.clientY } : null }
    const onEnd = (e: TouchEvent) => {
      if (!start.current) return
      const t = e.changedTouches[0]
      if (t.clientX - start.current.x > 90 && Math.abs(t.clientY - start.current.y) < 70 && historyIndex() > 0) nav(-1)
      start.current = null
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener('touchstart', onStart, { passive: true })
    window.addEventListener('touchend', onEnd, { passive: true })
    return () => { window.removeEventListener('keydown', onKey); window.removeEventListener('touchstart', onStart); window.removeEventListener('touchend', onEnd) }
  }, [nav])
}

export default function App() {
  const db = useDb()
  const theme = useSettings((s) => s.theme)
  const loc = useLocation()
  const title = useChrome((s) => s.title)
  const pushRecent = useChrome((s) => s.pushRecent)
  const fontSize = useSettings((s) => s.fontSize)
  useSync()
  useBackGestures()
  useEffect(() => {
    const dark = theme === 'dark' || theme === 'oled' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)
    document.documentElement.classList.toggle('dark', dark)
    document.documentElement.classList.toggle('oled', theme === 'oled')
  }, [theme])
  useEffect(() => { document.documentElement.style.fontSize = fontSize === 'large' ? '17.5px' : '' }, [fontSize])
  useEffect(() => { window.scrollTo(0, 0) }, [loc.pathname])
  useEffect(() => { document.title = title ? `${title} · FireRed Companion` : 'FireRed Companion'; if (title) pushRecent(loc.pathname + loc.search, title) }, [title, loc.pathname, loc.search, pushRecent])

  if (!db) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4 text-stone-500">
        <PokeballSpinner />
        <p className="font-display text-sm">Loading Kanto…</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen">
      <AppBar />
      <div className="mx-auto flex max-w-6xl md:items-start">
        <Sidebar />
        <main className="min-w-0 flex-1 px-3 py-3 pb-24 md:px-6 md:py-5 md:pb-10">
          <Suspense fallback={<div className="flex justify-center p-10"><PokeballSpinner size={40} /></div>}>
            <div key={loc.pathname} className="page-enter">
              <ErrorBoundary>
              <Routes>
                <Route path="/" element={<Dashboard />} />
                <Route path="/guide" element={<Guide />} />
                <Route path="/guide/:id" element={<ChapterPage />} />
                <Route path="/locations" element={<LocationsPage />} />
                <Route path="/location/:id" element={<LocationPage />} />
                <Route path="/dex" element={<Pokedex />} />
                <Route path="/dex/:id" element={<PokemonPage />} />
                <Route path="/moves" element={<MovesPage />} />
                <Route path="/moves/:id" element={<MovePage />} />
                <Route path="/items" element={<ItemsPage />} />
                <Route path="/items/:id" element={<ItemPage />} />
                <Route path="/tms" element={<TmPage />} />
                <Route path="/trainers" element={<TrainersPage />} />
                <Route path="/trainers/:id" element={<TrainerPage />} />
                <Route path="/team" element={<TeamPage />} />
                <Route path="/battle" element={<BattlePage />} />
                <Route path="/types" element={<TypeChartPage />} />
                <Route path="/trades" element={<TradesPage />} />
                <Route path="/missables" element={<MissablesPage />} />
                <Route path="/encounters" element={<EncountersPage />} />
                <Route path="/catch" element={<CatchPage />} />
                <Route path="/held-items" element={<HeldItemsPage />} />
                <Route path="/farming" element={<FarmingPage />} />
                <Route path="/mechanics" element={<MechanicsPage />} />
                <Route path="/bag" element={<BagPage />} />
                <Route path="/breeding" element={<BreedingPage />} />
                <Route path="/postgame" element={<PostgamePage />} />
                <Route path="/compare" element={<ComparePage />} />
                <Route path="/search" element={<SearchPage />} />
                <Route path="/settings" element={<SettingsPage />} />
                <Route path="/more" element={<MorePage />} />
              </Routes>
              </ErrorBoundary>
            </div>
          </Suspense>
        </main>
      </div>
      <BottomNav />
      <CommandPalette />
    </div>
  )
}
