import { useMemo, useState, type CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import { getDb } from '../data/db'
import type { TypeName } from '../data/types'
import { useProgress } from '../store/progress'
import { Empty, PageTitle, Progress, Seg, Sprite, TypeBadge, typeGradient } from '../components/ui'

const TYPES: TypeName[] = ['Normal', 'Fire', 'Water', 'Electric', 'Grass', 'Ice', 'Fighting', 'Poison', 'Ground', 'Flying', 'Psychic', 'Bug', 'Rock', 'Ghost', 'Dragon', 'Dark', 'Steel']

const AVAIL_CHIP: Record<string, [string, string]> = {
  'trade-only': ['trade only', 'bg-stone-300 text-stone-700 dark:bg-stone-700 dark:text-stone-200'],
  'trade-evolution': ['trade to evolve', 'bg-sky-200 text-sky-900 dark:bg-sky-900 dark:text-sky-100'],
  gift: ['gift', 'bg-pink-200 text-pink-900 dark:bg-pink-900 dark:text-pink-100'],
  event: ['event', 'bg-stone-300 text-stone-700 dark:bg-stone-700 dark:text-stone-200'],
}

export default function Pokedex() {
  const db = getDb()
  const [q, setQ] = useState('')
  const [type, setType] = useState<TypeName | ''>('')
  const [scope, setScope] = useState<'kanto' | 'all' | 'catchable' | 'kantoall'>('kanto')
  const [only, setOnly] = useState<'all' | 'caught' | 'missing'>('all')
  const [showTypes, setShowTypes] = useState(false)
  const caught = useProgress((s) => s.caught)
  const seen = useProgress((s) => s.seen)
  const markCaught = useProgress((s) => s.markCaught)
  const list = useMemo(() => db.pokemon.filter((p) => {
    if ((scope === 'kanto' || scope === 'kantoall') && p.id > 151) return false
    if (scope === 'kanto' && (p.availability === 'trade-only' || p.availability === 'event')) return false
    if (scope === 'catchable' && p.availability !== 'wild') return false
    if (type && !p.types.includes(type)) return false
    if (only === 'caught' && !caught.includes(p.id)) return false
    if (only === 'missing' && caught.includes(p.id)) return false
    if (q && !p.name.toLowerCase().includes(q.toLowerCase()) && String(p.id) !== q) return false
    return true
  }), [db, q, type, scope, only, caught])
  const kantoCaught = caught.filter((i) => i <= 151).length
  const kantoSeen = seen.filter((i) => i <= 151).length
  const filterKey = `${q}|${type}|${scope}|${only}`
  return (
    <div>
      <PageTitle hero sub={<>National caught {caught.length}/386 {kantoCaught < 60 && <span className="text-amber-600">· {60 - kantoCaught} more Kanto catches unlock the National Dex</span>}</>}>Pokédex</PageTitle>

      <div className="card mb-3 overflow-hidden">
        <div className="grid grid-cols-2 divide-x divide-stone-100 dark:divide-stone-800">
          <div className="p-3">
            <div className="text-[11px] font-bold uppercase tracking-wider text-stone-500">Kanto caught</div>
            <div className="font-display text-2xl font-bold">{kantoCaught}<span className="text-base font-normal text-stone-400">/151</span></div>
            <Progress pct={(kantoCaught / 151) * 100} className="mt-1" color="bg-emerald-500" />
          </div>
          <div className="p-3">
            <div className="text-[11px] font-bold uppercase tracking-wider text-stone-500">Kanto seen</div>
            <div className="font-display text-2xl font-bold">{kantoSeen}<span className="text-base font-normal text-stone-400">/151</span></div>
            <Progress pct={(kantoSeen / 151) * 100} className="mt-1" color="bg-sky-500" />
          </div>
        </div>
      </div>

      <div className="mb-3 space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Name or number" className="input max-w-[200px]" />
          <Seg value={only} onChange={(v) => setOnly(v)} options={[{ value: 'all', label: 'All' }, { value: 'caught', label: '✓ Caught' }, { value: 'missing', label: 'Not caught' }]} />
          <button type="button" onClick={() => setShowTypes(!showTypes)} className={`chip-btn ${type ? 'chip-on' : ''}`}>{type ? `Type: ${type} ✕` : showTypes ? 'Hide types' : 'Filter by type'}</button>
        </div>
        {showTypes && (
          <div className="fade-up flex flex-wrap gap-1">
            {TYPES.map((t) => <TypeBadge key={t} type={t} onClick={() => setType(type === t ? '' : t)} active={type ? type === t : undefined} />)}
          </div>
        )}
        <Seg value={scope} onChange={(v) => setScope(v)} className="flex-wrap" options={[{ value: 'kanto', label: 'Obtainable in FireRed' }, { value: 'catchable', label: 'Wild only' }, { value: 'kantoall', label: 'All Kanto' }, { value: 'all', label: 'National 1–386' }]} />
      </div>

      <div className="mb-2 text-xs text-stone-500">{list.length} Pokémon</div>
      {list.length === 0 && <Empty>No Pokémon match those filters.</Empty>}
      <div key={filterKey} className="stagger grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
        {list.map((p, i) => {
          const isCaught = caught.includes(p.id), isSeen = seen.includes(p.id)
          const avail = AVAIL_CHIP[p.availability]
          return (
            <div key={p.id} style={{ '--i': i % 24 } as CSSProperties} className={`card card-hover relative overflow-hidden ${isCaught ? 'outline outline-2 -outline-offset-2 outline-emerald-400' : ''}`}>
              <Link to={`/dex/${p.id}`} className="hover-bounce flex items-center gap-2.5 p-2.5" style={{ background: typeGradient(p.types, 0.3) }}>
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-white/60 shadow-inner dark:bg-black/25"><Sprite id={p.id} size={56} /></div>
                <div className="min-w-0 flex-1">
                  <div className="text-[10px] font-bold tabular-nums tracking-wider text-stone-600 dark:text-stone-300">#{String(p.id).padStart(3, '0')}</div>
                  <div className="truncate font-display text-[15px] font-bold leading-tight">{p.name}</div>
                  <div className="mt-1 flex flex-wrap gap-1">{p.types.map((t) => <TypeBadge key={t} type={t} small />)}{avail && <span className={`chip text-[10px] ${avail[1]}`}>{avail[0]}</span>}</div>
                </div>
              </Link>
              <button onClick={() => markCaught(p.id)} title={isCaught ? 'Caught (tap to undo)' : 'Mark caught'} className={`absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full text-xs shadow transition-transform active:scale-90 ${isCaught ? 'bg-emerald-500 text-white' : isSeen ? 'bg-white/80 text-stone-500 dark:bg-stone-800/80' : 'bg-white/60 text-stone-400 dark:bg-stone-800/60'}`}>{isCaught ? '✓' : isSeen ? '👁' : '○'}</button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
