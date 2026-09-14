import Fuse from 'fuse.js'
import type { Db } from '../data/db'

export interface SearchHit { kind: 'pokemon' | 'move' | 'item' | 'location' | 'trainer' | 'chapter'; id: string | number; title: string; sub?: string; to: string }

let fuse: Fuse<SearchHit> | null = null

export function searchIndex(db: Db): Fuse<SearchHit> {
  if (fuse) return fuse
  const docs: SearchHit[] = []
  for (const p of db.pokemon) docs.push({ kind: 'pokemon', id: p.id, title: p.name, sub: `#${p.id} ${p.types.join('/')}`, to: `/dex/${p.id}` })
  for (const m of db.moves) docs.push({ kind: 'move', id: m.id, title: m.name, sub: `${m.type} move`, to: `/moves/${m.id}` })
  for (const i of db.items) docs.push({ kind: 'item', id: i.id, title: i.name, sub: i.pocket, to: `/items/${i.id}` })
  for (const l of db.locations) docs.push({ kind: 'location', id: l.id, title: l.name, sub: l.sectionName, to: `/location/${l.id}` })
  const seenTrainers = new Set<string>()
  for (const t of db.trainers) {
    if (t.rematchOf !== undefined) continue
    const key = `${t.class} ${t.name}`
    if (t.classKey === 'LEADER' || t.classKey === 'ELITE_FOUR' || t.classKey === 'CHAMPION' || t.classKey === 'BOSS' || t.classKey.startsWith('RIVAL')) {
      if (seenTrainers.has(key)) continue
      seenTrainers.add(key)
    }
    docs.push({ kind: 'trainer', id: t.id, title: key, sub: t.maps.map((m) => db.locationById.get(m)?.name).filter(Boolean).join(', '), to: `/trainers/${t.id}` })
  }
  for (const c of db.chapters) docs.push({ kind: 'chapter', id: c.id, title: `Chapter ${c.n}: ${c.title}`, sub: c.subtitle, to: `/guide/${c.id}` })
  fuse = new Fuse(docs, { keys: [{ name: 'title', weight: 2 }, 'sub'], threshold: 0.35, ignoreLocation: true })
  return fuse
}
