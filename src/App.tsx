import { Suspense, lazy, useEffect } from 'react'
import { NavLink, Route, Routes, useLocation } from 'react-router-dom'
import { useDb } from './data/db'
import { SearchBox } from './components/SearchBox'
import { useSettings } from './store/settings'
import { useSync } from './lib/sync'

const Dashboard = lazy(() => import('./pages/Dashboard'))
const Guide = lazy(() => import('./pages/Guide'))
const ChapterPage = lazy(() => import('./pages/ChapterPage'))
const LocationsPage = lazy(() => import('./pages/LocationsPage'))
const LocationPage = lazy(() => import('./pages/LocationPage'))
const Pokedex = lazy(() => import('./pages/Pokedex'))
const PokemonPage = lazy(() => import('./pages/PokemonPage'))
const MovesPage = lazy(() => import('./pages/MovesPage'))
const MovePage = lazy(() => import('./pages/MovePage'))
const ItemsPage = lazy(() => import('./pages/ItemsPage'))
const ItemPage = lazy(() => import('./pages/ItemPage'))
const TrainersPage = lazy(() => import('./pages/TrainersPage'))
const TrainerPage = lazy(() => import('./pages/TrainerPage'))
const TeamPage = lazy(() => import('./pages/TeamPage'))
const BattlePage = lazy(() => import('./pages/BattlePage'))
const TypeChartPage = lazy(() => import('./pages/TypeChartPage'))
const SettingsPage = lazy(() => import('./pages/SettingsPage'))
const MorePage = lazy(() => import('./pages/MorePage'))
const SearchPage = lazy(() => import('./pages/SearchPage'))
const TradesPage = lazy(() => import('./pages/TradesPage'))
const MissablesPage = lazy(() => import('./pages/MissablesPage'))
const TmPage = lazy(() => import('./pages/TmPage'))
const EncountersPage = lazy(() => import('./pages/EncountersPage'))

const tabs = [
  { to: '/', label: 'Home', icon: '🏠' },
  { to: '/guide', label: 'Guide', icon: '📖' },
  { to: '/dex', label: 'Dex', icon: '🔴' },
  { to: '/team', label: 'Team', icon: '👥' },
  { to: '/battle', label: 'Battle', icon: '⚔️' },
  { to: '/more', label: 'More', icon: '☰' },
]

export default function App() {
  const db = useDb()
  const theme = useSettings((s) => s.theme)
  const loc = useLocation()
  useSync()
  useEffect(() => {
    const dark = theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)
    document.documentElement.classList.toggle('dark', dark)
  }, [theme])
  useEffect(() => { window.scrollTo(0, 0) }, [loc.pathname])

  if (!db) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-3 text-stone-500">
        <img src={`${import.meta.env.BASE_URL}sprites/pokemon/4.png`} className="sprite h-16 w-16 animate-bounce" alt="" />
        <p>Loading Kanto…</p>
      </div>
    )
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-6xl flex-col md:flex-row">
      <aside className="hidden w-52 shrink-0 flex-col gap-1 border-r border-stone-200 p-3 md:flex dark:border-stone-800">
        <NavLink to="/" className="mb-3 flex items-center gap-2 px-2 text-lg font-bold text-red-700 dark:text-red-400">
          <img src={`${import.meta.env.BASE_URL}sprites/items/poke-ball.png`} className="sprite h-6 w-6" alt="" /> FireRed
        </NavLink>
        {tabs.map((t) => (
          <NavLink key={t.to} to={t.to} end={t.to === '/'} className={({ isActive }) => `rounded-lg px-3 py-2 text-sm ${isActive ? 'bg-red-700 text-white' : 'hover:bg-stone-200 dark:hover:bg-stone-800'}`}>
            <span className="mr-2">{t.icon}</span>{t.label}
          </NavLink>
        ))}
        <div className="mt-3 px-1"><SearchBox /></div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex items-center gap-2 border-b border-stone-200 bg-stone-100/90 px-3 py-2 backdrop-blur md:hidden dark:border-stone-800 dark:bg-stone-950/90">
          <NavLink to="/" className="flex items-center gap-1 font-bold text-red-700 dark:text-red-400">
            <img src={`${import.meta.env.BASE_URL}sprites/items/poke-ball.png`} className="sprite h-5 w-5" alt="" />
          </NavLink>
          <div className="flex-1"><SearchBox /></div>
        </header>
        <main className="flex-1 px-3 py-3 pb-24 md:px-6 md:pb-8">
          <Suspense fallback={<div className="p-6 text-stone-500">Loading…</div>}>
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
              <Route path="/search" element={<SearchPage />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="/more" element={<MorePage />} />
            </Routes>
          </Suspense>
        </main>
      </div>
      <nav className="pb-safe fixed inset-x-0 bottom-0 z-20 grid grid-cols-6 border-t border-stone-200 bg-white/95 backdrop-blur md:hidden dark:border-stone-800 dark:bg-stone-900/95">
        {tabs.map((t) => (
          <NavLink key={t.to} to={t.to} end={t.to === '/'} className={({ isActive }) => `flex flex-col items-center py-2 text-[11px] ${isActive ? 'text-red-700 dark:text-red-400' : 'text-stone-500'}`}>
            <span className="text-lg leading-none">{t.icon}</span>{t.label}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
