import { Link } from 'react-router-dom'
import type { CSSProperties } from 'react'
import { getDb } from '../data/db'
import { PageTitle } from '../components/ui'

export default function MorePage() {
  const db = getDb()
  const items = [
    ['/locations', '🗺', 'Locations', 'Maps, wild Pokémon, trainers, items and hidden items'],
    ['/trainers', '⚔', 'Trainers', 'Gym leaders, rival, Elite Four, every route trainer'],
    ['/encounters', '⭐', 'Legendaries & encounters', 'Every one-time Pokémon, where to save, shiny hunting'],
    ['/missables', '⚠', 'Missables', 'One-time choices and gifts'],
    ['/moves', '📜', 'Moves', 'All 354 moves with Gen 3 categories'],
    ['/items', '🎒', 'Items', 'Descriptions and where to find them'],
    ['/tms', '💿', 'TMs & HMs', 'Every machine and its location'],
    ['/types', '🧭', 'Type chart', 'Gen 3 effectiveness and physical/special split'],
    ['/trades', '🔁', 'In-game trades', 'NPC trades and where they are'],
    ['/settings', '⚙', 'Settings & sync', 'Cloud sync, save import, export, theme'],
  ]
  return (
    <div>
      <PageTitle hero>More</PageTitle>
      <div className="stagger grid gap-2 sm:grid-cols-2">
        {items.map(([to, icon, title, sub], i) => (
          <Link key={to} to={to} style={{ '--i': i } as CSSProperties} className="card card-hover flex items-center gap-3 p-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-stone-100 text-2xl dark:bg-stone-800">{icon}</span>
            <div className="min-w-0"><div className="font-display font-bold">{title}</div><div className="text-xs text-stone-500">{sub}</div></div>
            <span className="ml-auto text-stone-400">›</span>
          </Link>
        ))}
      </div>
      <p className="mt-6 text-xs text-stone-400">Data: pret/pokefirered decompilation ({db.meta.commit.slice(0, 7)}), PokeAPI sprites and text, Bulbapedia walkthrough and maps (CC BY-NC-SA 2.5). Pokémon is © Nintendo / Creatures / GAME FREAK; this is a fan-made, non-commercial tool.</p>
    </div>
  )
}
