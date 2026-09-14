import { useState } from 'react'
import { Link } from 'react-router-dom'
import { getDb } from '../data/db'
import type { Location } from '../data/types'
import { useProgress } from '../store/progress'
import { trainerDisplayName } from '../lib/selectors'

const base = import.meta.env.BASE_URL

export interface Marker {
  x: number
  y: number
  kind: 'item' | 'hidden' | 'trainer' | 'tutor' | 'warp' | 'poi'
  label: string
  done?: boolean
  stepId?: string
  to?: string
}

const COLOR: Record<Marker['kind'], string> = { item: '#16a34a', hidden: '#7c3aed', trainer: '#ea580c', tutor: '#2563eb', warp: '#64748b', poi: '#dc2626' }

/** Bulbapedia map image with markers at the game's tile coordinates (16 px per tile). */
export function MapView({ loc, markers, height = 420 }: { loc: Location; markers: Marker[]; height?: number }) {
  const [active, setActive] = useState<number | null>(null)
  const [zoom, setZoom] = useState(false)
  if (!loc.mapImage || !loc.width) return null
  const w = loc.mapSize?.[0] || loc.width * 16, h = loc.mapSize?.[1] || loc.height * 16
  const [ox, oy] = loc.mapOffset ?? [0, 0]
  const scale = zoom ? 1 : Math.min(1, height / h, 900 / w)
  return (
    <div className="space-y-1">
      <div className="flex flex-wrap items-center gap-2 text-[11px] text-stone-500">
        {(['item', 'hidden', 'trainer', 'tutor', 'warp'] as const).filter((k) => markers.some((m) => m.kind === k)).map((k) => (
          <span key={k} className="inline-flex items-center gap-1"><span className="inline-block h-3 w-3 rounded-full" style={{ backgroundColor: COLOR[k] }} />{{ item: 'item ball', hidden: 'hidden item', trainer: 'trainer', tutor: 'move tutor', warp: 'door / exit' }[k]}</span>
        ))}
        <button className="ml-auto link" onClick={() => setZoom(!zoom)}>{zoom ? 'fit' : 'actual size'}</button>
      </div>
      <div className="overflow-auto rounded-lg ring-1 ring-stone-300 dark:ring-stone-700" style={{ maxHeight: zoom ? 700 : height + 8 }}>
        <div className="relative" style={{ width: w * scale, height: h * scale }}>
          <img src={`${base}maps/${loc.id}.png`} width={w * scale} height={h * scale} alt={loc.name} className="sprite block" style={{ width: w * scale, height: h * scale }} loading="lazy" />
          {markers.map((m, i) => {
            const cx = (m.x - ox + 0.5) * 16 * scale, cy = (m.y - oy + 0.5) * 16 * scale
            if (cx < 0 || cy < 0 || cx > w * scale || cy > h * scale) return null
            const n = markers.filter((o) => o.kind === m.kind).indexOf(m) + 1
            return (
              <button key={i} type="button" onClick={() => setActive(active === i ? null : i)} title={m.label}
                className="absolute flex -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full text-[10px] font-bold text-white ring-2 ring-white/90 shadow"
                style={{ left: cx, top: cy, width: m.kind === 'warp' ? 10 : 18, height: m.kind === 'warp' ? 10 : 18, backgroundColor: COLOR[m.kind], opacity: m.done ? 0.45 : 1, zIndex: active === i ? 3 : 2 }}>
                {m.kind !== 'warp' ? n : ''}
              </button>
            )
          })}
          {active !== null && markers[active] && (
            <div className="absolute z-10 max-w-[220px] rounded bg-stone-900/95 px-2 py-1 text-xs text-white shadow" style={{ left: Math.max(0, Math.min((markers[active].x - ox + 1) * 16 * scale + 6, w * scale - 230)), top: Math.max(0, (markers[active].y - oy + 0.5) * 16 * scale - 12) }}>
              {markers[active].to ? <Link className="underline" to={markers[active].to!}>{markers[active].label}</Link> : markers[active].label}{markers[active].done ? ' ✓' : ''}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

/** Standard marker set for a location: items, hidden items, trainers, tutors, exits. */
export function useLocationMarkers(loc: Location): Marker[] {
  const db = getDb()
  const flags = useProgress((s) => s.flags)
  const beaten = useProgress((s) => s.beaten)
  const out: Marker[] = []
  loc.items.forEach((b) => out.push({ x: b.x, y: b.y, kind: 'item', label: db.itemById.get(b.item)?.name ?? 'item', done: !!flags[b.flag], to: `/items/${b.item}` }))
  loc.hiddenItems.forEach((b) => out.push({ x: b.x, y: b.y, kind: 'hidden', label: `Hidden ${db.itemById.get(b.item)?.name ?? 'item'}${b.qty > 1 ? ` ×${b.qty}` : ''}`, done: !!flags[b.flag], to: `/items/${b.item}` }))
  for (const [tid, pos] of Object.entries(loc.trainerPos)) {
    const t = db.trainerById.get(Number(tid))
    if (t) out.push({ x: pos[0], y: pos[1], kind: 'trainer', label: `${trainerDisplayName(t)}: ${t.party.map((m) => `${db.pokemonById.get(m.species)?.name} Lv.${m.level}`).join(', ')}`, done: !!beaten[t.id], to: `/trainers/${t.id}` })
  }
  loc.tutors.forEach((t) => { if (t.x !== undefined) out.push({ x: t.x, y: t.y!, kind: 'tutor', label: `Move Tutor: ${db.moveById.get(t.move)?.name}` }) })
  const seenWarp = new Set<string>()
  loc.warpPos.forEach((wp) => { const k = `${wp.to}`; if (seenWarp.has(k)) return; seenWarp.add(k); out.push({ x: wp.x, y: wp.y, kind: 'warp', label: `To ${db.locationById.get(wp.to)?.name ?? wp.to}`, to: `/location/${wp.to}` }) })
  return out
}
