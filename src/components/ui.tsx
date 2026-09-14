import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { getDb, spriteUrl } from '../data/db'
import type { Item, Move, Pokemon, Trainer, TypeName } from '../data/types'
import { moveCategory } from '../lib/battle'
import { useShinySpecies } from '../lib/shiny'

export function Section({ title, children, right, className = '' }: { title?: ReactNode; children: ReactNode; right?: ReactNode; className?: string }) {
  return (
    <section className={`card mb-3 p-3 ${className}`}>
      {title && (
        <div className="mb-2 flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-stone-500">{title}</h2>
          {right}
        </div>
      )}
      {children}
    </section>
  )
}

export function PageTitle({ children, sub, right }: { children: ReactNode; sub?: ReactNode; right?: ReactNode }) {
  return (
    <div className="mb-3 flex items-start justify-between gap-2">
      <div>
        <h1 className="text-xl font-bold md:text-2xl">{children}</h1>
        {sub && <div className="text-sm text-stone-500">{sub}</div>}
      </div>
      {right}
    </div>
  )
}

const typeText: Partial<Record<TypeName, string>> = { Electric: 'text-stone-900', Ice: 'text-stone-900', Ground: 'text-stone-900', Normal: 'text-stone-900', Steel: 'text-stone-900', Grass: 'text-stone-900' }

export function TypeBadge({ type, small }: { type: TypeName; small?: boolean }) {
  const t = type === '???' ? 'normal' : type.toLowerCase()
  return (
    <span className={`chip ${small ? 'px-1.5 text-[10px]' : ''} text-white ${typeText[type] ?? ''}`} style={{ backgroundColor: `var(--color-type-${t})` }}>
      {type}
    </span>
  )
}

export function Sprite({ id, size = 48, back, className = '', shiny }: { id: number; size?: number; back?: boolean; className?: string; shiny?: boolean }) {
  const owned = useShinySpecies()
  const isShiny = shiny ?? owned.has(id)
  return <img src={spriteUrl.pokemon(id, back ? 'back' : isShiny ? 'shiny' : 'front')} width={size} height={size} className={`sprite ${className}`} alt="" loading="lazy" title={isShiny ? 'shiny' : undefined} />
}

export function ItemSprite({ item, size = 24 }: { item: Item; size?: number }) {
  return <img src={spriteUrl.item(item.sprite)} width={size} height={size} className="sprite inline-block" alt="" loading="lazy" onError={(e) => ((e.target as HTMLImageElement).style.visibility = 'hidden')} />
}

export function PokemonLink({ id, level, className = '', showTypes }: { id: number; level?: number; className?: string; showTypes?: boolean }) {
  const p = getDb().pokemonById.get(id)
  if (!p) return <span>#{id}</span>
  return (
    <Link to={`/dex/${id}`} className={`inline-flex items-center gap-1 ${className}`}>
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
        <thead className="text-left text-xs uppercase text-stone-500">
          <tr><th className="py-1 pr-2">{rows.some((r) => r.label) ? 'Lv' : ''}</th><th className="py-1 pr-2">Move</th><th className="py-1 pr-2">Type</th><th className="py-1 pr-2">Cat</th><th className="py-1 pr-2 text-right">Pow</th><th className="py-1 pr-2 text-right">Acc</th><th className="py-1 pr-2 text-right">PP</th>{extra && <th />}</tr>
        </thead>
        <tbody>
          {rows.map(({ move, label }, i) => (
            <tr key={i} className="border-t border-stone-100 dark:border-stone-800">
              <td className="py-1 pr-2 text-stone-500">{label}</td>
              <td className="py-1 pr-2"><MoveLink id={move.id} /></td>
              <td className="py-1 pr-2"><TypeBadge type={move.type} small /></td>
              <td className="py-1 pr-2"><CategoryIcon move={move} /></td>
              <td className="py-1 pr-2 text-right">{move.power || '—'}</td>
              <td className="py-1 pr-2 text-right">{move.accuracy || '—'}</td>
              <td className="py-1 pr-2 text-right">{move.pp}</td>
              {extra && <td className="py-1">{extra(move)}</td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function Check({ checked, onChange, label, sub, kind }: { checked: boolean; onChange: (v: boolean) => void; label: ReactNode; sub?: ReactNode; kind?: string }) {
  return (
    <label className={`flex cursor-pointer items-start gap-2 rounded-lg px-2 py-1.5 hover:bg-stone-100 dark:hover:bg-stone-800 ${checked ? 'opacity-60' : ''}`}>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="mt-1 h-4 w-4 accent-red-700" />
      <span className="min-w-0 flex-1">
        <span className={checked ? 'line-through' : ''}>{label}</span>
        {kind && <KindChip kind={kind} />}
        {sub && <div className="text-xs text-stone-500">{sub}</div>}
      </span>
    </label>
  )
}

const kindStyle: Record<string, string> = {
  story: 'bg-stone-200 text-stone-700 dark:bg-stone-700 dark:text-stone-200', battle: 'bg-orange-100 text-orange-800 dark:bg-orange-900/50 dark:text-orange-200',
  boss: 'bg-red-600 text-white', item: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-200', hidden: 'bg-violet-100 text-violet-800 dark:bg-violet-900/50 dark:text-violet-200',
  gift: 'bg-pink-100 text-pink-800 dark:bg-pink-900/50 dark:text-pink-200', trade: 'bg-sky-100 text-sky-800 dark:bg-sky-900/50 dark:text-sky-200', tutor: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/50 dark:text-indigo-200',
  optional: 'bg-stone-100 text-stone-500 dark:bg-stone-800', missable: 'bg-yellow-300 text-yellow-900', tip: 'bg-teal-100 text-teal-800 dark:bg-teal-900/50 dark:text-teal-200', shop: 'bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-200',
}
export function KindChip({ kind }: { kind: string }) {
  return <span className={`chip ml-1.5 align-middle text-[10px] ${kindStyle[kind] ?? kindStyle.story}`}>{kind}</span>
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
      <div className="h-2 flex-1 overflow-hidden rounded bg-stone-200 dark:bg-stone-800"><div className={`h-full ${color}`} style={{ width: `${pct}%` }} /></div>
    </div>
  )
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="py-6 text-center text-sm text-stone-500">{children}</p>
}

export function pokemonName(p: Pokemon) { return p.name }
