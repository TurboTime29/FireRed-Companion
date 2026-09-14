import { Link, useSearchParams } from 'react-router-dom'
import { getDb } from '../data/db'
import { searchIndex } from '../lib/search'
import { Empty, PageTitle, Sprite } from '../components/ui'

const ICON: Record<string, string> = { pokemon: '', move: '📜', item: '🎒', location: '🗺', trainer: '⚔', chapter: '📖' }

export default function SearchPage() {
  const db = getDb()
  const q = useSearchParams()[0].get('q') ?? ''
  const hits = q ? searchIndex(db).search(q).slice(0, 40) : []
  return (
    <div>
      <PageTitle sub={`${hits.length} results`}>Search: {q}</PageTitle>
      {hits.length === 0 && <Empty>Nothing found.</Empty>}
      <div className="card divide-y divide-stone-100 dark:divide-stone-800">
        {hits.map(({ item }) => (
          <Link key={item.kind + item.id} to={item.to} className="flex items-center gap-2 px-3 py-2 hover:bg-stone-50 dark:hover:bg-stone-800">
            {item.kind === 'pokemon' ? <Sprite id={Number(item.id)} size={32} /> : <span className="w-8 text-center">{ICON[item.kind]}</span>}
            <div><div className="font-medium">{item.title}</div><div className="text-xs text-stone-500">{item.kind} · {item.sub}</div></div>
          </Link>
        ))}
      </div>
    </div>
  )
}
