import type { Db } from '../data/db'
import type { GuideItem, GuideSection, Item, Location } from '../data/types'

function norm(s: string) { return s.toLowerCase().replace(/[^a-z0-9]/g, '') }

/** Bulbapedia sections whose heading matches a map's section name (e.g. "Route 3", "Mt. Moon"). */
export function guideSectionsFor(db: Db, loc: Location): GuideSection[] {
  const key = norm(loc.sectionName)
  const out: GuideSection[] = []
  for (const part of db.guide) for (const s of part.sections) {
    const h = norm(s.heading)
    if (h === key || (key.length > 5 && (h.startsWith(key) || key.startsWith(h) && h.length > 5))) out.push(s)
  }
  return out
}

function itemMatches(gi: GuideItem, item: Item) {
  const n = norm(item.name), g = norm(gi.name), d = norm(gi.display)
  if (item.move) {
    const tm = item.name.split(' ')[0]
    return d.includes(norm(tm)) || norm(gi.display).includes(norm(item.name.split(' ').slice(1).join(' ')))
  }
  return g === n || d.startsWith(n) || n.startsWith(g) && g.length > 3
}

/** Human description of where an item is on a map, from the Bulbapedia item tables. */
export function guideWhere(db: Db, loc: Location, item: Item, hidden: boolean): string | undefined {
  for (const s of guideSectionsFor(db, loc)) {
    const hit = s.items.find((gi) => gi.hidden === hidden && itemMatches(gi, item))
    if (hit) return hit.where
  }
  return undefined
}

/** All guide item descriptions for a map, keyed so each is consumed once (used by the walkthrough builder + location page). */
export function guideItemsFor(db: Db, loc: Location): GuideItem[] {
  return guideSectionsFor(db, loc).flatMap((s) => s.items)
}
