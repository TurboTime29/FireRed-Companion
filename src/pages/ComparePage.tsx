import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { getDb } from '../data/db'
import type { Pokemon, Stats } from '../data/types'
import { calcStats, effectiveness } from '../lib/battle'
import { typeMatchupSummary } from '../lib/selectors'
import { EffChip, Empty, PageTitle, Section, Sprite, TypeBadge, typeGradient } from '../components/ui'

const KEYS: (keyof Stats)[] = ['hp', 'atk', 'def', 'spa', 'spd', 'spe']
const LABEL: Record<keyof Stats, string> = { hp: 'HP', atk: 'Attack', def: 'Defense', spa: 'Sp. Atk', spd: 'Sp. Def', spe: 'Speed' }

function Picker({ value, onPick, placeholder }: { value?: Pokemon; onPick: (p: Pokemon) => void; placeholder: string }) {
  const db = getDb()
  const [q, setQ] = useState('')
  const hits = useMemo(() => (q ? db.pokemon.filter((p) => p.name.toLowerCase().startsWith(q.toLowerCase()) || String(p.id) === q).slice(0, 8) : []), [db, q])
  return (
    <div className="relative">
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={value ? `${value.name} (type to change)` : placeholder} className="input" />
      {hits.length > 0 && <div className="absolute z-10 mt-1 w-full rounded-xl bg-white shadow-lg ring-1 ring-stone-200 dark:bg-stone-900 dark:ring-stone-700">{hits.map((p) => <button key={p.id} type="button" onClick={() => { onPick(p); setQ('') }} className="flex w-full items-center gap-2 px-2 py-1 text-left text-sm hover:bg-stone-100 dark:hover:bg-stone-800"><Sprite id={p.id} size={32} />{p.name}</button>)}</div>}
    </div>
  )
}

export default function ComparePage() {
  const db = getDb()
  const [params, setParams] = useSearchParams()
  const [level, setLevel] = useState(50)
  const a = db.pokemonById.get(Number(params.get('a')) || 0), b = db.pokemonById.get(Number(params.get('b')) || 0)
  const set = (k: 'a' | 'b', p: Pokemon) => { const n = new URLSearchParams(params); n.set(k, String(p.id)); setParams(n) }
  const sa = a ? calcStats(a.stats, level) : null, sb = b ? calcStats(b.stats, level) : null
  const total = (p: Pokemon) => KEYS.reduce((s, k) => s + p.stats[k], 0)
  const vs = (x: Pokemon, y: Pokemon) => x.types.map((t) => ({ t, m: effectiveness(db.typechart, t, y.types) }))
  return (
    <div>
      <PageTitle hero sub="Two Pokémon side by side: stats, matchups, how they'd fare against each other.">Compare</PageTitle>
      <div className="mb-3 grid gap-2 sm:grid-cols-2">
        <Picker value={a} onPick={(p) => set('a', p)} placeholder="First Pokémon" />
        <Picker value={b} onPick={(p) => set('b', p)} placeholder="Second Pokémon" />
      </div>
      {a && b && sa && sb ? (
        <>
          <div className="mb-3 grid grid-cols-2 gap-2">
            {[a, b].map((p) => (
              <Link key={p.id} to={`/dex/${p.id}`} className="card card-hover hover-bounce flex flex-col items-center p-3 text-center" style={{ background: typeGradient(p.types, 0.3) }}>
                <Sprite id={p.id} size={80} />
                <div className="font-display text-lg font-bold">{p.name}</div>
                <div className="flex gap-1">{p.types.map((t) => <TypeBadge key={t} type={t} small />)}</div>
                <div className="mt-1 text-xs text-stone-600 dark:text-stone-300">#{p.id} · BST {total(p)} · {p.abilities.map((x) => x.name).join(' / ')}</div>
              </Link>
            ))}
          </div>
          <Section title="Base stats" right={<label className="text-xs">at Lv.<input type="number" min={1} max={100} value={level} onChange={(e) => setLevel(Math.max(1, Math.min(100, Number(e.target.value) || 1)))} className="input ml-1 inline w-16 py-0.5" /></label>}>
            <table className="w-full text-sm">
              <tbody>
                {KEYS.map((k) => { const x = a.stats[k], y = b.stats[k]; const w = x === y ? 0 : x > y ? 1 : -1; return (
                  <tr key={k} className="border-t border-stone-100 dark:border-stone-800">
                    <td className={`py-1 text-right tabular-nums ${w > 0 ? 'font-bold text-emerald-600' : ''}`}>{x} <span className="text-xs text-stone-400">({sa[k]})</span></td>
                    <td className="w-24 py-1"><div className="flex items-center gap-1"><div className="bar h-1.5 flex-1 rotate-180"><i className={w >= 0 ? 'bg-emerald-500' : 'bg-stone-400'} style={{ width: `${(x / 255) * 100}%` }} /></div></div></td>
                    <td className="py-1 text-center text-xs text-stone-500">{LABEL[k]}</td>
                    <td className="w-24 py-1"><div className="bar h-1.5"><i className={w <= 0 ? 'bg-emerald-500' : 'bg-stone-400'} style={{ width: `${(y / 255) * 100}%` }} /></div></td>
                    <td className={`py-1 tabular-nums ${w < 0 ? 'font-bold text-emerald-600' : ''}`}>{y} <span className="text-xs text-stone-400">({sb[k]})</span></td>
                  </tr>
                ) })}
                <tr className="border-t border-stone-200 dark:border-stone-700"><td className="py-1 text-right font-semibold">{total(a)}</td><td /><td className="py-1 text-center text-xs text-stone-500">Total</td><td /><td className="py-1 font-semibold">{total(b)}</td></tr>
              </tbody>
            </table>
            <p className="mt-1 text-xs text-stone-400">Values in brackets: stats at Lv.{level}, IV 15, no EVs, neutral nature.</p>
          </Section>
          <div className="grid gap-3 md:grid-cols-2">
            <Section title={`${a.name} attacking ${b.name}`}><div className="flex flex-wrap gap-2 text-sm">{vs(a, b).map(({ t, m }) => <span key={t} className="inline-flex items-center gap-1"><TypeBadge type={t} small /><EffChip mult={m} /></span>)}</div><Sum p={b} /></Section>
            <Section title={`${b.name} attacking ${a.name}`}><div className="flex flex-wrap gap-2 text-sm">{vs(b, a).map(({ t, m }) => <span key={t} className="inline-flex items-center gap-1"><TypeBadge type={t} small /><EffChip mult={m} /></span>)}</div><Sum p={a} /></Section>
          </div>
          <div className="text-xs text-stone-500">Speed: {sa.spe === sb.spe ? 'tie' : sa.spe > sb.spe ? `${a.name} moves first` : `${b.name} moves first`} at Lv.{level}. For real damage with your own Pokémon use the <Link className="link" to={`/battle?p=${b.id}&lvl=${level}`}>Battle helper</Link>.</div>
        </>
      ) : <Empty>Pick two Pokémon.</Empty>}
    </div>
  )
}

function Sum({ p }: { p: Pokemon }) {
  const db = getDb()
  const m = typeMatchupSummary(db, p.types)
  return <div className="mt-2 text-xs text-stone-500">{p.name} is weak to {m.weak.length ? m.weak.map((t) => t.split(' ')[0]).join(', ') : 'nothing'}; resists {m.resist.length ? m.resist.map((t) => t.split(' ')[0]).join(', ') : 'nothing'}{m.immune.length ? `; immune to ${m.immune.join(', ')}` : ''}.</div>
}
