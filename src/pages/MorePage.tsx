import { Link } from 'react-router-dom'
import { getDb } from '../data/db'
import { PageTitle } from '../components/ui'

export default function MorePage() {
  const db = getDb()
  const items = [
    ['/locations', '🗺', 'Locations', 'Wild Pokémon, trainers, items and hidden items per map'],
    ['/trainers', '⚔', 'Trainers', 'Gym leaders, rival, Elite Four, every route trainer'],
    ['/moves', '📜', 'Moves', 'All 354 moves with Gen 3 categories'],
    ['/items', '🎒', 'Items', 'Descriptions and where to find them'],
    ['/tms', '💿', 'TMs & HMs', 'Every machine and its location'],
    ['/types', '🧭', 'Type chart', 'Gen 3 effectiveness and physical/special split'],
    ['/trades', '🔁', 'In-game trades', 'NPC trades and where they are'],
    ['/missables', '⚠', 'Missables', 'One-time choices and gifts'],
    ['/settings', '⚙', 'Settings & sync', 'Cloud sync, save import, export, theme'],
  ]
  return (
    <div>
      <PageTitle>More</PageTitle>
      <div className="grid gap-2 sm:grid-cols-2">
        {items.map(([to, icon, title, sub]) => <Link key={to} to={to} className="card flex items-center gap-3 p-3 hover:bg-stone-50 dark:hover:bg-stone-800"><span className="text-2xl">{icon}</span><div><div className="font-medium">{title}</div><div className="text-xs text-stone-500">{sub}</div></div></Link>)}
      </div>
      <p className="mt-6 text-xs text-stone-400">Data: pret/pokefirered decompilation ({db.meta.commit.slice(0, 7)}), PokeAPI sprites and text, Bulbapedia walkthrough (CC BY-NC-SA 2.5). Pokémon is © Nintendo / Creatures / GAME FREAK; this is a fan-made, non-commercial tool.</p>
    </div>
  )
}
