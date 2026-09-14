import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { getDb } from '../data/db'
import type { Stats } from '../data/types'
import { useProgress, type ItemStack, type OwnedMon } from '../store/progress'
import { calcStats, hiddenPower } from '../lib/battle'
import { CategoryIcon, Empty, ItemSprite, MoveLink, PageTitle, Section, Seg, Sprite, TypeBadge } from '../components/ui'

const POCKETS: [string, string][] = [['items', 'Items'], ['poke balls', 'Poké Balls'], ['tm case', 'TM case'], ['berry pouch', 'Berries'], ['key items', 'Key items']]
const STAT_LABEL: Record<keyof Stats, string> = { hp: 'HP', atk: 'Atk', def: 'Def', spa: 'SpA', spd: 'SpD', spe: 'Spe' }

function ItemGrid({ stacks }: { stacks: ItemStack[] }) {
  const db = getDb()
  if (!stacks.length) return <Empty>Nothing here.</Empty>
  return (
    <div className="grid grid-cols-2 gap-1 sm:grid-cols-3 lg:grid-cols-4">
      {stacks.map((s) => { const it = db.itemById.get(s.item); return it ? (
        <Link key={s.item} to={`/items/${s.item}`} className="flex items-center gap-2 rounded-lg px-2 py-1 text-sm transition-colors hover:bg-stone-100 dark:hover:bg-stone-800"><ItemSprite item={it} size={24} /><span className="truncate">{it.name}</span><span className="ml-auto text-xs tabular-nums text-stone-500">×{s.qty}</span></Link>
      ) : null })}
    </div>
  )
}

function MonDetail({ mon, onClose }: { mon: OwnedMon; onClose: () => void }) {
  const db = getDb()
  const p = db.pokemonById.get(mon.species)!
  const st = calcStats(p.stats, mon.level, { ivs: mon.ivs, evs: mon.evs, nature: mon.nature })
  const hp = mon.ivs ? hiddenPower(mon.ivs) : null
  const ivTotal = mon.ivs ? (Object.values(mon.ivs) as number[]).reduce((a, b) => a + b, 0) : null
  const evTotal = mon.evs ? (Object.values(mon.evs) as number[]).reduce((a, b) => a + b, 0) : null
  const keys = Object.keys(STAT_LABEL) as (keyof Stats)[]
  return (
    <div className="card fade-up p-3 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <Link to={`/dex/${p.id}`} className="hover-bounce"><Sprite id={p.id} size={64} shiny={mon.shiny ? true : undefined} /></Link>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2"><b className="text-base">{mon.nickname || p.name}</b>{mon.nickname && <span className="text-stone-500">({p.name})</span>}{mon.shiny && <span className="chip bg-amber-400 text-[10px] text-amber-950">✨ shiny</span>}<span className="text-stone-500">Lv.{mon.level}</span>{mon.gender && mon.gender !== '-' && <span>{mon.gender === 'M' ? '♂' : '♀'}</span>}{p.types.map((t) => <TypeBadge key={t} type={t} small />)}</div>
          <div className="text-xs text-stone-500">{mon.nature ?? 'nature ?'} · {p.abilities.find((a) => a.id === mon.ability)?.name ?? 'ability ?'}{mon.item && <> · holds <Link className="link" to={`/items/${mon.item}`}>{db.itemById.get(mon.item)?.name}</Link></>}{mon.ot && <> · OT {mon.ot}</>}{mon.friendship !== undefined && <> · friendship {mon.friendship}</>}{mon.box ? ` · Box ${mon.box} slot ${mon.slot}` : mon.inParty ? ' · party' : ''}</div>
        </div>
        <button className="btn-icon" onClick={onClose} aria-label="Close">✕</button>
      </div>
      <div className="mt-2 grid gap-3 sm:grid-cols-2">
        <div>
          <div className="mb-1 text-[11px] font-bold uppercase tracking-wider text-stone-500">Stats · IVs · EVs {ivTotal !== null && <span className="normal-case tracking-normal text-stone-400">(IV total {ivTotal}/186{evTotal !== null ? `, EV ${evTotal}/510` : ''})</span>}</div>
          <table className="w-full text-xs"><tbody>
            {keys.map((k) => { const iv = mon.ivs?.[k], ev = mon.evs?.[k]; return (
              <tr key={k} className="border-t border-stone-100 dark:border-stone-800"><td className="py-0.5 text-stone-500">{STAT_LABEL[k]}</td><td className="py-0.5 text-right font-medium tabular-nums">{st[k]}</td>
                <td className="py-0.5 pl-3 tabular-nums"><span className={iv === undefined ? 'text-stone-400' : iv >= 30 ? 'text-emerald-600 font-semibold' : iv >= 20 ? '' : 'text-red-500'}>{iv ?? '?'}</span><span className="text-stone-400"> IV</span></td>
                <td className="py-0.5 pl-3"><div className="flex items-center gap-1"><div className="bar h-1.5 w-16"><i className="bg-sky-500" style={{ width: `${((ev ?? 0) / 255) * 100}%` }} /></div><span className="tabular-nums text-stone-500">{ev ?? '?'}</span></div></td></tr>
            ) })}
          </tbody></table>
          {hp && <div className="mt-1 text-xs text-stone-500">Hidden Power: <TypeBadge type={hp.type} small /> {hp.power} power</div>}
        </div>
        <div>
          <div className="mb-1 text-[11px] font-bold uppercase tracking-wider text-stone-500">Moves</div>
          {mon.moves.length ? mon.moves.map((m) => { const mv = db.moveById.get(m)!; return <div key={m} className="flex items-center gap-2 py-0.5 text-xs"><MoveLink id={m} /><TypeBadge type={mv.type} small /><CategoryIcon move={mv} /><span className="text-stone-500">{mv.power || '—'}</span></div> }) : <span className="text-xs text-stone-400">none recorded</span>}
          <div className="mt-2 flex gap-2"><Link className="btn-ghost text-xs" to={`/battle?p=${p.id}&lvl=${mon.level}`}>Battle plan</Link><Link className="btn-ghost text-xs" to="/team">Edit in Team</Link></div>
        </div>
      </div>
    </div>
  )
}

export default function BagPage() {
  const db = getDb()
  const mons = useProgress((s) => s.mons)
  const bag = useProgress((s) => s.bag ?? [])
  const pcItems = useProgress((s) => s.pcItems ?? [])
  const [tab, setTab] = useState<'boxes' | 'bag' | 'pc'>('boxes')
  const [box, setBox] = useState<number>(0)
  const [q, setQ] = useState('')
  const [sel, setSel] = useState<string | null>(null)
  const boxed = useMemo(() => mons.filter((m) => !m.inParty), [mons])
  const usedBoxes = useMemo(() => [...new Set(boxed.map((m) => m.box ?? 0))].sort((a, b) => a - b), [boxed])
  const list = useMemo(() => {
    let l = box === 0 ? mons : mons.filter((m) => (m.box ?? 0) === box && !m.inParty)
    if (q) { const s = q.toLowerCase(); l = l.filter((m) => { const p = db.pokemonById.get(m.species)!; return p.name.toLowerCase().includes(s) || (m.nickname ?? '').toLowerCase().includes(s) || p.types.some((t) => t.toLowerCase() === s) }) }
    return l
  }, [db, mons, box, q])
  const selected = sel ? mons.find((m) => m.uid === sel) : null
  const byPocket = (pk: string) => bag.filter((b) => db.itemById.get(b.item)?.pocket === pk)
  const shinies = mons.filter((m) => m.shiny).length
  return (
    <div>
      <PageTitle hero sub={<>{mons.length} Pokémon ({mons.filter((m) => m.inParty).length} in party, {boxed.length} boxed{shinies ? `, ${shinies} shiny` : ''}) · {bag.reduce((a, b) => a + b.qty, 0)} items in bag. {!bag.length && <Link className="link" to="/settings">Import your save</Link>}</>}>Bag & PC</PageTitle>
      <Seg className="mb-3" value={tab} onChange={(v) => setTab(v)} options={[{ value: 'boxes', label: `Pokémon (${mons.length})` }, { value: 'bag', label: `Bag (${bag.length})` }, { value: 'pc', label: `PC items (${pcItems.length})` }]} />
      {tab === 'boxes' && (
        <div className="fade-up">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter by name, nickname or type" className="input max-w-xs" />
            <div className="flex flex-wrap gap-1 text-xs">
              <button type="button" className={`chip-btn ${box === 0 ? 'chip-on' : ''}`} onClick={() => setBox(0)}>All</button>
              {usedBoxes.filter((b) => b > 0).map((b) => <button key={b} type="button" className={`chip-btn ${box === b ? 'chip-on' : ''}`} onClick={() => setBox(b)}>Box {b}</button>)}
            </div>
          </div>
          {selected && <div className="mb-3"><MonDetail mon={selected} onClose={() => setSel(null)} /></div>}
          {list.length === 0 && <Empty>No Pokémon{q ? ' match' : ' yet'}. {!mons.length && <Link className="link" to="/team">Add some in Team</Link>}</Empty>}
          <div className="stagger grid grid-cols-3 gap-1.5 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8">
            {list.map((m, i) => {
              const p = db.pokemonById.get(m.species)!
              return (
                <button key={m.uid} type="button" onClick={() => setSel(sel === m.uid ? null : m.uid)} style={{ '--i': i % 24 } as React.CSSProperties} className={`hover-bounce card card-hover flex flex-col items-center p-1.5 text-center ${sel === m.uid ? 'outline outline-2 -outline-offset-2 outline-dex-500' : ''} ${m.inParty ? 'bg-dex-50/60 dark:bg-dex-900/20' : ''}`}>
                  <Sprite id={p.id} size={48} shiny={m.shiny ? true : undefined} />
                  <div className="w-full truncate text-xs font-medium">{m.nickname || p.name}</div>
                  <div className="text-[10px] text-stone-500">Lv.{m.level}{m.shiny ? ' ✨' : ''}{m.inParty ? ' · party' : m.box ? ` · B${m.box}` : ''}</div>
                </button>
              )
            })}
          </div>
        </div>
      )}
      {tab === 'bag' && (
        <div className="fade-up">
          {!bag.length && <Empty>Bag contents come from a save import (Settings). Once imported, the catch calculator and TM planner use them too.</Empty>}
          {POCKETS.map(([pk, label]) => { const st = byPocket(pk); return st.length ? <Section key={pk} title={`${label} (${st.length})`}><ItemGrid stacks={st} /></Section> : null })}
        </div>
      )}
      {tab === 'pc' && <div className="fade-up"><Section title="Items stored in the PC"><ItemGrid stacks={pcItems} /></Section></div>}
    </div>
  )
}
