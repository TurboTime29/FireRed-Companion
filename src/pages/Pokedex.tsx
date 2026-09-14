import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { getDb } from '../data/db'
import type { TypeName } from '../data/types'
import { useProgress } from '../store/progress'
import { PageTitle, Sprite, TypeBadge } from '../components/ui'

const TYPES: TypeName[] = ['Normal', 'Fire', 'Water', 'Electric', 'Grass', 'Ice', 'Fighting', 'Poison', 'Ground', 'Flying', 'Psychic', 'Bug', 'Rock', 'Ghost', 'Dragon', 'Dark', 'Steel']

export default function Pokedex() {
  const db = getDb()
  const [q, setQ] = useState('')
  const [type, setType] = useState<TypeName | ''>('')
  const [scope, setScope] = useState<'kanto' | 'all' | 'catchable'>('kanto')
  const [only, setOnly] = useState<'all' | 'caught' | 'missing'>('all')
  const caught = useProgress((s) => s.caught)
  const seen = useProgress((s) => s.seen)
  const markCaught = useProgress((s) => s.markCaught)
  const list = useMemo(() => db.pokemon.filter((p) => {
    if (scope === 'kanto' && p.id > 151) return false
    if (scope === 'catchable' && !p.locations?.length) return false
    if (type && !p.types.includes(type)) return false
    if (only === 'caught' && !caught.includes(p.id)) return false
    if (only === 'missing' && caught.includes(p.id)) return false
    if (q && !p.name.toLowerCase().includes(q.toLowerCase()) && String(p.id) !== q) return false
    return true
  }), [db, q, type, scope, only, caught])
  const kantoCaught = caught.filter((i) => i <= 151).length
  return (
    <div>
      <PageTitle sub={<>Kanto caught: <b>{kantoCaught}</b>/151 · seen {seen.filter((i) => i <= 151).length} · National caught {caught.length}/386 {kantoCaught < 60 && <span className="ml-1 text-amber-600">({60 - kantoCaught} more caught for the National Dex)</span>}</>}>Pokédex</PageTitle>
      <div className="mb-3 flex flex-wrap gap-2">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Name or number" className="input max-w-[180px]" />
        <select value={type} onChange={(e) => setType(e.target.value as TypeName | '')} className="input max-w-[140px]"><option value="">Any type</option>{TYPES.map((t) => <option key={t}>{t}</option>)}</select>
        <select value={scope} onChange={(e) => setScope(e.target.value as typeof scope)} className="input max-w-[170px]"><option value="kanto">Kanto (1–151)</option><option value="catchable">Obtainable in FireRed</option><option value="all">National (1–386)</option></select>
        <select value={only} onChange={(e) => setOnly(e.target.value as typeof only)} className="input max-w-[130px]"><option value="all">All</option><option value="caught">Caught</option><option value="missing">Not caught</option></select>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
        {list.map((p) => (
          <div key={p.id} className={`card flex items-center gap-2 p-2 ${caught.includes(p.id) ? 'ring-emerald-400' : ''}`}>
            <Link to={`/dex/${p.id}`} className="flex min-w-0 flex-1 items-center gap-2">
              <Sprite id={p.id} size={48} />
              <div className="min-w-0">
                <div className="truncate font-medium">{p.name}</div>
                <div className="text-xs text-stone-500">#{String(p.id).padStart(3, '0')}</div>
                <div className="mt-0.5 flex gap-1">{p.types.map((t) => <TypeBadge key={t} type={t} small />)}</div>
              </div>
            </Link>
            <button onClick={() => markCaught(p.id)} title="Toggle caught" className={`h-7 w-7 shrink-0 rounded-full text-sm ${caught.includes(p.id) ? 'bg-emerald-500 text-white' : seen.includes(p.id) ? 'bg-stone-300 dark:bg-stone-700' : 'bg-stone-200 text-stone-400 dark:bg-stone-800'}`}>{caught.includes(p.id) ? '✓' : seen.includes(p.id) ? '👁' : '○'}</button>
          </div>
        ))}
      </div>
    </div>
  )
}
