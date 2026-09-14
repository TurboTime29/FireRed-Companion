import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { getDb } from '../data/db'
import type { TypeName } from '../data/types'
import { useProgress, type OwnedMon } from '../store/progress'
import { ALL_TYPES, coverageSuggestions, partyCoverage } from '../lib/coverage'
import { EffChip, MoveLink, Sprite, TypeBadge } from './ui'

/** Offensive coverage of the party's moves, shared weaknesses, and moves that would fill the gaps. */
export function CoveragePanel({ party }: { party: OwnedMon[] }) {
  const db = getDb()
  const bag = useProgress((s) => s.bag ?? [])
  const cov = useMemo(() => partyCoverage(db, party), [db, party])
  const sugg = useMemo(() => coverageSuggestions(db, party, cov, bag), [db, party, cov, bag])
  if (!party.length) return <p className="text-sm text-stone-500">Add your party to see coverage.</p>
  const cell = (t: TypeName) => {
    const o = cov.offense[t]
    const cls = o.mult >= 2 ? 'bg-emerald-500 text-white' : o.mult === 1 ? 'bg-stone-200 text-stone-700 dark:bg-stone-700 dark:text-stone-200' : o.mult > 0 ? 'bg-red-500 text-white' : 'bg-stone-800 text-white'
    return (
      <div key={t} className="flex items-center gap-1.5 rounded-lg px-1.5 py-1 text-xs" title={o.source ? `${o.source.pokemon.name}: ${o.source.move.name}` : 'no damaging move'}>
        <TypeBadge type={t} small />
        <span className={`chip px-1.5 text-[10px] ${cls}`}>{o.mult >= 4 ? '4×' : o.mult >= 2 ? '2×' : o.mult === 1 ? '1×' : o.mult > 0 ? '½×' : '0'}</span>
        {o.source && o.mult >= 2 && <span className="hidden truncate text-stone-500 sm:inline">{o.source.move.name}</span>}
      </div>
    )
  }
  return (
    <div className="space-y-3 text-sm">
      <div>
        <div className="mb-1 text-[11px] font-bold uppercase tracking-wider text-stone-500">Best hit on each defending type</div>
        <div className="grid grid-cols-2 gap-x-2 sm:grid-cols-3 lg:grid-cols-4">{ALL_TYPES.map(cell)}</div>
        {cov.uncovered.length > 0 ? <p className="mt-1 text-xs text-stone-600 dark:text-stone-300">Nothing super-effective against: {cov.uncovered.map((t) => <TypeBadge key={t} type={t} small />)}</p> : <p className="mt-1 text-xs text-emerald-600">Every type is hit super-effectively by something. 💪</p>}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <div className="mb-1 text-[11px] font-bold uppercase tracking-wider text-stone-500">Shared weaknesses</div>
          {cov.sharedWeak.length === 0 && <p className="text-xs text-stone-500">No type threatens most of your team.</p>}
          {cov.sharedWeak.map((t) => (
            <div key={t} className="flex items-center gap-2 py-0.5"><TypeBadge type={t} small /><span className="text-xs">{cov.weakTo[t]} of {party.length} weak</span><EffChip mult={2} />
              <span className="flex">{party.filter((m) => { const p = db.pokemonById.get(m.species)!; return (db.typechart.effectiveness[t]?.[p.types[0]] ?? 1) * (db.typechart.effectiveness[t]?.[p.types[1] ?? p.types[0]] ?? 1) > 1 || (p.types.length === 1 && (db.typechart.effectiveness[t]?.[p.types[0]] ?? 1) > 1) }).map((m) => <Sprite key={m.uid} id={m.species} size={24} />)}</span>
            </div>
          ))}
        </div>
        <div>
          <div className="mb-1 text-[11px] font-bold uppercase tracking-wider text-stone-500">Nobody resists</div>
          {cov.noResist.length === 0 ? <p className="text-xs text-stone-500">Every attacking type is resisted by at least one member.</p> : <div className="flex flex-wrap gap-1">{cov.noResist.map((t) => <TypeBadge key={t} type={t} small />)}</div>}
        </div>
      </div>
      {sugg.length > 0 && (
        <div>
          <div className="mb-1 text-[11px] font-bold uppercase tracking-wider text-stone-500">Moves that would fill the gaps</div>
          <ul className="divide-y divide-stone-100 dark:divide-stone-800">
            {sugg.map((s) => (
              <li key={s.mon.uid + s.move.id} className="flex flex-wrap items-center gap-2 py-1 text-xs">
                <Sprite id={s.pokemon.id} size={24} /><span className="font-medium">{s.mon.nickname || s.pokemon.name}</span>
                <span>learns</span><MoveLink id={s.move.id} /><TypeBadge type={s.move.type} small /><span className="text-stone-500">{s.move.power} pow</span>
                <span className={`chip text-[10px] ${s.owned ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-200' : 'bg-stone-200 text-stone-600 dark:bg-stone-700 dark:text-stone-300'}`}>{s.via}{s.itemId && !s.owned ? ' · not in bag' : s.itemId ? ' · in bag' : ''}</span>
                <span className="text-stone-500">covers {s.covers.map((t) => <TypeBadge key={t} type={t} small />)}</span>
                {s.itemId && <Link className="link" to={`/items/${s.itemId}`}>where</Link>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
