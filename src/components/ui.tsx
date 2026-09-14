import { useEffect, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { getDb, spriteUrl } from '../data/db'
import type { Item, Move, Pokemon, Trainer, TypeName } from '../data/types'
import { moveCategory } from '../lib/battle'
import { useShinySpecies } from '../lib/shiny'
import { useChrome } from '../store/chrome'
import { useSettings } from '../store/settings'

export function Section({ title, children, right, className = '' }: { title?: ReactNode; children: ReactNode; right?: ReactNode; className?: string }) {
  return (
    <section className={`card mb-3 p-3 md:p-4 ${className}`}>
      {title && (
        <div className="mb-2 flex items-center justify-between gap-2">
          <h2 className="text-[11px] font-bold uppercase tracking-[0.12em] text-stone-500">{title}</h2>
          {right}
        </div>
      )}
      {children}
    </section>
  )
}

/** Flatten a ReactNode to plain text for the app bar / document title. */
function nodeText(n: ReactNode): string {
  if (n == null || typeof n === 'boolean') return ''
  if (typeof n === 'string' || typeof n === 'number') return String(n)
  if (Array.isArray(n)) return n.map(nodeText).join('')
  if (typeof n === 'object' && 'props' in n) return nodeText((n as { props: { children?: ReactNode } }).props.children)
  return ''
}

export function PageTitle({ children, sub, right, hero }: { children: ReactNode; sub?: ReactNode; right?: ReactNode; hero?: boolean }) {
  const setTitle = useChrome((s) => s.setTitle)
  const text = nodeText(children).replace(/\s+/g, ' ').trim()
  useEffect(() => { setTitle(text); return () => setTitle('') }, [text, setTitle])
  return (
    <div className={`mb-3 flex items-start justify-between gap-2 ${hero ? 'mb-4' : ''}`}>
      <div className="min-w-0">
        <h1 className={`font-display font-bold ${hero ? 'text-2xl md:text-3xl' : 'text-xl md:text-2xl'}`}>{children}</h1>
        {sub && <div className="mt-0.5 text-sm text-stone-500">{sub}</div>}
      </div>
      {right && <div className="shrink-0">{right}</div>}
    </div>
  )
}

/** Segmented control. */
export function Seg<T extends string>({ value, onChange, options, className = '' }: { value: T; onChange: (v: T) => void; options: { value: T; label: ReactNode }[]; className?: string }) {
  return (
    <div className={`seg ${className}`} role="tablist">
      {options.map((o) => <button key={o.value} type="button" role="tab" aria-selected={value === o.value} onClick={() => onChange(o.value)}>{o.label}</button>)}
    </div>
  )
}

const typeText: Partial<Record<TypeName, string>> = { Electric: 'text-stone-900', Ice: 'text-stone-900', Ground: 'text-stone-900', Normal: 'text-stone-900', Steel: 'text-stone-900', Grass: 'text-stone-900' }

export function typeVar(type: TypeName) { return `var(--color-type-${type === '???' ? 'normal' : type.toLowerCase()})` }

/** Soft gradient background for a Pokémon's type(s). */
export function typeGradient(types: TypeName[], alpha = 0.55) {
  const a = typeVar(types[0]), b = typeVar(types[1] ?? types[0])
  return `linear-gradient(135deg, color-mix(in srgb, ${a} ${alpha * 100}%, transparent), color-mix(in srgb, ${b} ${alpha * 100}%, transparent))`
}

export function TypeBadge({ type, small, onClick, active }: { type: TypeName; small?: boolean; onClick?: () => void; active?: boolean }) {
  const cls = `chip type-badge ${small ? 'px-1.5 text-[10px]' : ''} text-white ${typeText[type] ?? ''} ${onClick ? 'cursor-pointer transition hover:scale-105 active:scale-95' : ''} ${active === false ? 'opacity-40 grayscale-[35%]' : ''} ${active ? 'ring-2 ring-stone-900 ring-offset-1 dark:ring-white' : ''}`
  const style = { backgroundColor: typeVar(type) }
  return onClick ? <button type="button" onClick={onClick} className={cls} style={style}>{type}</button> : <span className={cls} style={style}>{type}</span>
}

export function Sprite({ id, size = 48, back, className = '', shiny }: { id: number; size?: number; back?: boolean; className?: string; shiny?: boolean }) {
  const owned = useShinySpecies()
  const animated = useSettings((s) => s.animatedSprites)
  const [broken, setBroken] = useState(false)
  const isShiny = shiny ?? owned.has(id)
  const anim = animated && !back && !broken && id <= 386
  const src = anim ? `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/versions/generation-v/black-white/animated/${isShiny ? 'shiny/' : ''}${id}.gif` : spriteUrl.pokemon(id, back ? 'back' : isShiny ? 'shiny' : 'front')
  return <img src={src} width={size} height={size} className={`${anim ? 'object-contain' : 'sprite'} ${className}`} alt="" loading="lazy" title={isShiny ? 'shiny' : undefined} onError={anim ? () => setBroken(true) : undefined} style={anim ? { width: size, height: size } : undefined} />
}

export function ItemSprite({ item, size = 24 }: { item: Item; size?: number }) {
  return <img src={spriteUrl.item(item.sprite)} width={size} height={size} className="sprite inline-block" alt="" loading="lazy" onError={(e) => ((e.target as HTMLImageElement).style.visibility = 'hidden')} />
}

export function PokemonLink({ id, level, className = '', showTypes }: { id: number; level?: number; className?: string; showTypes?: boolean }) {
  const p = getDb().pokemonById.get(id)
  if (!p) return <span>#{id}</span>
  return (
    <Link to={`/dex/${id}`} className={`hover-bounce inline-flex items-center gap-1 ${className}`}>
      <Sprite id={id} size={32} />
      <span className="font-medium">{p.name}</span>
      {level !== undefined && <span className="text-stone-500">Lv.{level}</span>}
      {showTypes && p.types.map((t) => <TypeBadge key={t} type={t} small />)}
    </Link>
  )
}

export function ItemLink({ id, qty }: { id: number; qty?: number }) {
  const it = getDb().itemById.get(id)
  if (!it) return <span>item #{id}</span>
  return (
    <Link to={`/items/${id}`} className="inline-flex items-center gap-1 link">
      <ItemSprite item={it} /> {it.name}{qty && qty > 1 ? ` ×${qty}` : ''}
    </Link>
  )
}

export function MoveLink({ id }: { id: number }) {
  const m = getDb().moveById.get(id)
  if (!m) return <span>move #{id}</span>
  return <Link to={`/moves/${id}`} className="link">{m.name}</Link>
}

export function LocationLink({ id, className = '' }: { id: string; className?: string }) {
  const l = getDb().locationById.get(id)
  if (!l) return <span>{id}</span>
  return <Link to={`/location/${id}`} className={`link ${className}`}>{l.name}</Link>
}

export function TrainerLink({ t }: { t: Trainer }) {
  return <Link to={`/trainers/${t.id}`} className="link">{t.class} {t.name}</Link>
}

export function CategoryIcon({ move }: { move: Move }) {
  const c = moveCategory(move)
  const cls = c === 'physical' ? 'bg-orange-600' : c === 'special' ? 'bg-sky-600' : 'bg-stone-500'
  return <span className={`chip px-1.5 text-[10px] text-white ${cls}`} title={`${c} (decided by type in Gen 3)`}>{c === 'physical' ? 'Phys' : c === 'special' ? 'Spec' : 'Stat'}</span>
}

export function MoveTable({ rows, extra }: { rows: { move: Move; label?: ReactNode }[]; extra?: (m: Move) => ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="text-left text-[11px] uppercase tracking-wide text-stone-500">
          <tr><th className="py-1 pr-2">{rows.some((r) => r.label) ? 'Lv' : ''}</th><th className="py-1 pr-2">Move</th><th className="py-1 pr-2">Type</th><th className="py-1 pr-2">Cat</th><th className="py-1 pr-2 text-right">Pow</th><th className="py-1 pr-2 text-right">Acc</th><th className="py-1 pr-2 text-right">PP</th>{extra && <th />}</tr>
        </thead>
        <tbody>
          {rows.map(({ move, label }, i) => (
            <tr key={i} className="border-t border-stone-100 transition-colors hover:bg-stone-50 dark:border-stone-800 dark:hover:bg-stone-800/50">
              <td className="py-1.5 pr-2 tabular-nums text-stone-500">{label}</td>
              <td className="py-1.5 pr-2"><MoveLink id={move.id} /></td>
              <td className="py-1.5 pr-2"><TypeBadge type={move.type} small /></td>
              <td className="py-1.5 pr-2"><CategoryIcon move={move} /></td>
              <td className="py-1.5 pr-2 text-right tabular-nums">{move.power || '—'}</td>
              <td className="py-1.5 pr-2 text-right tabular-nums">{move.accuracy || '—'}</td>
              <td className="py-1.5 pr-2 text-right tabular-nums">{move.pp}</td>
              {extra && <td className="py-1.5">{extra(move)}</td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function Check({ checked, onChange, label, sub, kind }: { checked: boolean; onChange: (v: boolean) => void; label: ReactNode; sub?: ReactNode; kind?: string }) {
  return (
    <label className={`flex cursor-pointer items-start gap-2.5 rounded-xl px-2 py-2 transition-colors hover:bg-stone-100 dark:hover:bg-stone-800/70 ${checked ? 'opacity-55' : ''}`}>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="peer sr-only" />
      <span className="tick mt-0.5"><svg viewBox="0 0 16 16"><path d="M3 8.5l3 3 7-7" /></svg></span>
      <span className="min-w-0 flex-1">
        <span className={`transition-all ${checked ? 'line-through decoration-stone-400' : ''}`}>{label}</span>
        {kind && <KindChip kind={kind} />}
        {sub && <div className="text-xs text-stone-500">{sub}</div>}
      </span>
    </label>
  )
}

const kindStyle: Record<string, string> = {
  story: 'bg-stone-200 text-stone-700 dark:bg-stone-700 dark:text-stone-200', battle: 'bg-orange-100 text-orange-800 dark:bg-orange-900/50 dark:text-orange-200',
  boss: 'bg-dex-500 text-white', item: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-200', hidden: 'bg-violet-100 text-violet-800 dark:bg-violet-900/50 dark:text-violet-200',
  gift: 'bg-pink-100 text-pink-800 dark:bg-pink-900/50 dark:text-pink-200', trade: 'bg-sky-100 text-sky-800 dark:bg-sky-900/50 dark:text-sky-200', tutor: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/50 dark:text-indigo-200',
  optional: 'bg-stone-100 text-stone-500 dark:bg-stone-800', missable: 'bg-yellow-300 text-yellow-900', tip: 'bg-teal-100 text-teal-800 dark:bg-teal-900/50 dark:text-teal-200', shop: 'bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-200',
}
export function KindChip({ kind }: { kind: string }) {
  return <span className={`chip ml-1.5 align-middle text-[10px] ${kindStyle[kind] ?? kindStyle.story}`}>{kind}</span>
}

export function VerdictChip({ verdict }: { verdict: string }) {
  const cls = verdict === 'strong' ? 'bg-emerald-600 text-white' : verdict === 'ok' ? 'bg-amber-500 text-white' : verdict === 'risky' ? 'bg-dex-500 text-white' : 'bg-stone-300 dark:bg-stone-700'
  return <span className={`chip ${cls}`}>{verdict}</span>
}

export function EffChip({ mult }: { mult: number }) {
  const cls = mult === 0 ? 'bg-stone-800 text-white' : mult >= 4 ? 'bg-green-700 text-white' : mult > 1 ? 'bg-green-500 text-white' : mult < 0.5 ? 'bg-red-800 text-white' : mult < 1 ? 'bg-red-500 text-white' : 'bg-stone-200 text-stone-600 dark:bg-stone-700 dark:text-stone-200'
  const label = mult === 0 ? '0×' : mult === 0.25 ? '¼×' : mult === 0.5 ? '½×' : `${mult}×`
  return <span className={`chip px-1.5 text-[11px] ${cls}`}>{label}</span>
}

export function StatBar({ label, value, max = 255 }: { label: string; value: number; max?: number }) {
  const pct = Math.min(100, (value / max) * 100)
  const color = value >= 120 ? 'bg-green-600' : value >= 90 ? 'bg-lime-500' : value >= 60 ? 'bg-yellow-400' : 'bg-red-500'
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="w-14 text-stone-500">{label}</span>
      <span className="w-8 text-right tabular-nums">{value}</span>
      <div className="bar flex-1"><i className={color} style={{ width: `${pct}%` }} /></div>
    </div>
  )
}

export function Progress({ pct, className = '', color = 'bg-dex-500' }: { pct: number; className?: string; color?: string }) {
  return <div className={`bar ${className}`}><i className={color} style={{ width: `${Math.max(0, Math.min(100, pct))}%` }} /></div>
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="py-6 text-center text-sm text-stone-500">{children}</p>
}

export function pokemonName(p: Pokemon) { return p.name }
