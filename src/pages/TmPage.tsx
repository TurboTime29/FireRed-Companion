import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { getDb } from '../data/db'
import type { Item, Move } from '../data/types'
import { useParty, useProgress, type OwnedMon } from '../store/progress'
import { moveCategory } from '../lib/battle'
import { CategoryIcon, PageTitle, Progress, Seg, Sprite, TypeBadge } from '../components/ui'

type Source = { kind: 'shop' | 'corner' | 'ball' | 'hidden' | 'gift' | 'unknown'; label: string; to?: string; cost?: string }

function sourcesFor(it: Item): { sources: Source[]; renewable: boolean } {
  const db = getDb()
  const out: Source[] = []
  for (const l of db.locations) if (l.shops.some((s) => s.includes(it.id))) out.push({ kind: 'shop', label: l.name, to: `/location/${l.id}`, cost: `$${it.price}` })
  for (const g of db.extras.gameCorner) if (g.kind === 'item' && g.id === it.id) out.push({ kind: 'corner', label: 'Celadon Game Corner', to: '/location/MAP_CELADON_CITY_GAME_CORNER', cost: `${g.coins} coins` })
  for (const c of db.chapters) for (const s of c.steps) if (s.items?.includes(it.id) && s.kind !== 'item' && s.kind !== 'hidden') out.push({ kind: 'gift', label: `Ch.${c.n}: ${s.text}`, to: `/guide/${c.id}` })
  for (const l of db.locations) { if (l.items.some((b) => b.item === it.id)) out.push({ kind: 'ball', label: l.name, to: `/location/${l.id}` }); if (l.hiddenItems.some((b) => b.item === it.id)) out.push({ kind: 'hidden', label: `${l.name} (hidden)`, to: `/location/${l.id}` }) }
  return { sources: out, renewable: out.some((s) => s.kind === 'shop' || s.kind === 'corner') }
}

interface Rec { mon: OwnedMon; knows: boolean; stab: boolean; newType: boolean; upgrade: number }
function recipients(it: Item, mv: Move, party: OwnedMon[]): Rec[] {
  const db = getDb()
  return party.filter((m) => db.pokemonById.get(m.species)!.tmhm.includes(it.id)).map((m) => {
    const p = db.pokemonById.get(m.species)!
    const cur = m.moves.map((x) => db.moveById.get(x)!).filter(Boolean)
    const knows = m.moves.includes(mv.id)
    const stab = p.types.includes(mv.type)
    const newType = !cur.some((x) => x.type === mv.type && x.power > 0)
    const sameType = cur.filter((x) => x.type === mv.type && x.power > 0).map((x) => x.power)
    const upgrade = mv.power - (sameType.length ? Math.max(...sameType) : 0)
    return { mon: m, knows, stab, newType, upgrade }
  })
}

export default function TmPage() {
  const db = getDb()
  const flags = useProgress((s) => s.flags)
  const keyItems = useProgress((s) => s.keyItems)
  const steps = useProgress((s) => s.steps)
  const setKeyItem = useProgress((s) => s.setKeyItem)
  const bag = useProgress((s) => s.bag ?? [])
  const party = useParty()
  const [filter, setFilter] = useState<'all' | 'owned' | 'unique' | 'buyable' | 'todo'>('all')
  const [open, setOpen] = useState<number | null>(null)
  const inBag = useMemo(() => new Map(bag.map((b) => [b.item, b.qty])), [bag])
  const tms = useMemo(() => db.items.filter((i) => i.move).sort((a, b) => a.id - b.id).map((it) => {
    const mv = db.moveById.get(it.move!)!
    const { sources, renewable } = sourcesFor(it)
    const isHm = it.name.startsWith('HM')
    const collected = db.locations.some((l) => l.items.some((b) => b.item === it.id && flags[b.flag]) || l.hiddenItems.some((b) => b.item === it.id && flags[b.flag])) || db.chapters.some((c) => c.steps.some((s) => s.items?.includes(it.id) && steps[s.id]))
    const owned = bag.length ? inBag.has(it.id) : keyItems.includes(it.id) || collected
    return { it, mv, sources, renewable, isHm, owned, collected, qty: inBag.get(it.id) ?? 0, recs: recipients(it, mv, party) }
  }), [db, flags, keyItems, steps, bag, inBag, party])
  const ownedCount = tms.filter((t) => t.owned && !t.isHm).length
  const visible = tms.filter((t) => filter === 'all' || (filter === 'owned' && t.owned) || (filter === 'unique' && !t.renewable && !t.isHm) || (filter === 'buyable' && t.renewable) || (filter === 'todo' && !t.owned && !t.collected))
  return (
    <div>
      <PageTitle hero sub={<>In Gen 3 a TM is used up when taught, so a one-of-a-kind TM is a permanent choice. HMs are reusable. {bag.length ? 'Ownership comes from your imported save.' : 'Import your save in Settings to see what you carry, or tick them by hand.'}</>}>TM planner</PageTitle>
      <div className="card mb-3 p-3">
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <div><span className="font-display text-2xl font-bold">{ownedCount}</span> <span className="text-stone-500">/ 50 TMs in hand</span></div>
          <div className="text-stone-500">{tms.filter((t) => !t.renewable && !t.isHm).length} are one-of-a-kind · {tms.filter((t) => t.renewable).length} can be bought again</div>
        </div>
        <Progress pct={(ownedCount / 50) * 100} className="mt-2" />
      </div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Seg value={filter} onChange={(v) => setFilter(v)} options={[{ value: 'all', label: 'All' }, { value: 'owned', label: 'In bag' }, { value: 'unique', label: '⚠ One only' }, { value: 'buyable', label: 'Buyable' }, { value: 'todo', label: 'Not yet found' }]} />
        {party.length === 0 && <span className="text-xs text-stone-500">Add your party to get recipient suggestions.</span>}
      </div>
      <div className="card divide-y divide-stone-100 dark:divide-stone-800">
        {visible.map(({ it, mv, sources, renewable, isHm, owned, qty, recs }) => {
          const good = recs.filter((r) => !r.knows && (r.stab || r.newType) && mv.power >= 60)
          return (
            <div key={it.id} className="px-3 py-2 text-sm">
              <div className="flex items-start gap-2">
                <input type="checkbox" checked={owned} onChange={(e) => setKeyItem(it.id, e.target.checked)} disabled={bag.length > 0} title={bag.length ? 'From your save' : 'Tick if you own it'} className="mt-1 h-4 w-4 accent-dex-500" />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Link to={`/items/${it.id}`} className="font-semibold link">{it.name}</Link>
                    <TypeBadge type={mv.type} small /><CategoryIcon move={mv} />
                    <span className="text-xs text-stone-500">{mv.power || '—'} pow · {mv.accuracy || '—'} acc · {mv.pp} PP</span>
                    {qty > 1 && <span className="chip bg-stone-200 text-[10px] dark:bg-stone-700">×{qty}</span>}
                    {isHm ? <span className="chip bg-sky-100 text-[10px] text-sky-800 dark:bg-sky-900/50 dark:text-sky-200">reusable</span> : renewable ? <span className="chip bg-emerald-100 text-[10px] text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-200">buyable again</span> : <span className="chip bg-amber-200 text-[10px] text-amber-900 dark:bg-amber-900/60 dark:text-amber-100">⚠ one only</span>}
                    {good.length > 0 && <span className="ml-auto flex items-center gap-0.5 text-xs text-stone-500">good for {good.slice(0, 3).map((r) => <Sprite key={r.mon.uid} id={r.mon.species} size={22} />)}</span>}
                  </div>
                  <div className="mt-0.5 text-xs text-stone-500">
                    {sources.filter((s) => s.kind === 'gift').slice(0, 1).map((s, i) => <span key={i}><Link className="link" to={s.to!}>{s.label}</Link> </span>)}
                    {sources.filter((s) => s.kind === 'ball' || s.kind === 'hidden').map((s, i) => <span key={'b' + i}>· {s.kind === 'hidden' ? 'Hidden at ' : 'Item ball at '}<Link className="link" to={s.to!}>{s.label.replace(' (hidden)', '')}</Link> </span>)}
                    {sources.filter((s) => s.kind === 'shop' || s.kind === 'corner').map((s, i) => <span key={'s' + i}>· <Link className="link" to={s.to!}>{s.label}</Link> ({s.cost}) </span>)}
                    {sources.length === 0 && 'Source not recorded'}
                  </div>
                  {recs.length > 0 && (
                    <button type="button" className="mt-1 text-xs link" onClick={() => setOpen(open === it.id ? null : it.id)}>{open === it.id ? 'hide' : `${recs.length} of your party can learn it`}</button>
                  )}
                  {open === it.id && (
                    <ul className="fade-up mt-1 space-y-0.5 text-xs">
                      {recs.map((r) => (
                        <li key={r.mon.uid} className="flex flex-wrap items-center gap-1.5"><Sprite id={r.mon.species} size={22} /><span className="font-medium">{r.mon.nickname || db.pokemonById.get(r.mon.species)!.name}</span>
                          {r.knows ? <span className="chip bg-stone-200 text-[10px] dark:bg-stone-700">already knows it</span> : <>
                            {r.stab && <span className="chip bg-emerald-100 text-[10px] text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-200">STAB</span>}
                            {r.newType && mv.power > 0 && <span className="chip bg-sky-100 text-[10px] text-sky-800 dark:bg-sky-900/50 dark:text-sky-200">new coverage</span>}
                            {!r.newType && r.upgrade > 0 && <span className="chip bg-amber-100 text-[10px] text-amber-800 dark:bg-amber-900/50 dark:text-amber-200">+{r.upgrade} power over its current {mv.type} move</span>}
                            {!r.newType && r.upgrade <= 0 && mv.power > 0 && <span className="text-stone-400">weaker than what it has</span>}
                            {moveCategory(mv) === 'status' && <span className="text-stone-400">utility</span>}
                          </>}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>
      <p className="mt-3 text-xs text-stone-500">Buyable TMs: Celadon Dept. Store 2F (TM07/TM08-style stat moves and more) and Game Corner prizes (Ice Beam, Dragon Rage, Thunderbolt, Shadow Ball, Flamethrower). Save the one-only ones for Pokémon you'll keep to the Elite Four.</p>
    </div>
  )
}
