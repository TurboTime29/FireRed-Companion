/** Team coverage: what your party's moves hit, what hits your party, and what would fill the gaps. */
import type { Db } from '../data/db'
import type { Move, Pokemon, TypeName } from '../data/types'
import type { ItemStack, OwnedMon } from '../store/progress'
import { effectiveness, moveCategory } from './battle'

export const ALL_TYPES: TypeName[] = ['Normal', 'Fire', 'Water', 'Electric', 'Grass', 'Ice', 'Fighting', 'Poison', 'Ground', 'Flying', 'Psychic', 'Bug', 'Rock', 'Ghost', 'Dragon', 'Dark', 'Steel']

export interface AttackSource { mon: OwnedMon; pokemon: Pokemon; move: Move }

export interface Coverage {
  /** damaging moves across the party, deduplicated by type keeping the strongest */
  attacks: AttackSource[]
  /** for each defending type: best multiplier and which move gives it */
  offense: Record<TypeName, { mult: number; source?: AttackSource }>
  /** types no move hits super-effectively */
  uncovered: TypeName[]
  /** attacking type -> number of party members weak to it (>1×) */
  weakTo: Record<TypeName, number>
  /** attacking type -> number of party members that resist or are immune */
  resists: Record<TypeName, number>
  /** shared weakness: 3+ members weak to it */
  sharedWeak: TypeName[]
  /** attacking types nobody resists */
  noResist: TypeName[]
}

export function partyCoverage(db: Db, party: OwnedMon[]): Coverage {
  const chart = db.typechart
  const attacks: AttackSource[] = []
  for (const mon of party) {
    const pokemon = db.pokemonById.get(mon.species)!
    for (const mid of mon.moves) {
      const move = db.moveById.get(mid)
      if (!move || moveCategory(move) === 'status' || (!move.power && !['level damage', 'sonicboom', 'dragon rage', 'return', 'hidden power', 'low kick', 'flail'].includes(move.effect))) continue
      attacks.push({ mon, pokemon, move })
    }
  }
  const offense = {} as Coverage['offense']
  for (const t of ALL_TYPES) {
    let best: { mult: number; source?: AttackSource } = { mult: 0 }
    for (const a of attacks) {
      const m = effectiveness(chart, a.move.type, [t])
      const stab = a.pokemon.types.includes(a.move.type) ? 1.5 : 1
      const score = m * (a.move.power || 50) * stab
      const bestScore = best.source ? best.mult * (best.source.move.power || 50) * (best.source.pokemon.types.includes(best.source.move.type) ? 1.5 : 1) : -1
      if (m > best.mult || (m === best.mult && score > bestScore)) best = { mult: m, source: a }
    }
    offense[t] = best
  }
  const uncovered = ALL_TYPES.filter((t) => offense[t].mult < 2)
  const weakTo = {} as Record<TypeName, number>, resists = {} as Record<TypeName, number>
  for (const t of ALL_TYPES) {
    weakTo[t] = 0; resists[t] = 0
    for (const mon of party) {
      const p = db.pokemonById.get(mon.species)!
      let m = effectiveness(chart, t, p.types)
      const ab = p.abilities.find((a) => a.id === mon.ability)?.name
      if ((ab === 'Levitate' && t === 'Ground') || (ab === 'Volt Absorb' && t === 'Electric') || (ab === 'Water Absorb' && t === 'Water') || (ab === 'Flash Fire' && t === 'Fire')) m = 0
      if (m > 1) weakTo[t]++
      if (m < 1) resists[t]++
    }
  }
  const sharedWeak = ALL_TYPES.filter((t) => weakTo[t] >= Math.max(2, Math.ceil(party.length / 2)))
  const noResist = ALL_TYPES.filter((t) => party.length > 0 && resists[t] === 0 && weakTo[t] > 0)
  return { attacks, offense, uncovered, weakTo, resists, sharedWeak, noResist }
}

export interface Suggestion { mon: OwnedMon; pokemon: Pokemon; move: Move; via: string; owned: boolean; covers: TypeName[]; itemId?: number }

/** Moves party members could learn (TM/HM in the bag first, tutors, level-up soon) that hit currently uncovered types super-effectively. */
export function coverageSuggestions(db: Db, party: OwnedMon[], cov: Coverage, bag: ItemStack[]): Suggestion[] {
  const chart = db.typechart
  const bagIds = new Set(bag.map((b) => b.item))
  const out: Suggestion[] = []
  const seen = new Set<string>()
  for (const mon of party) {
    const p = db.pokemonById.get(mon.species)!
    const known = new Set(mon.moves)
    const candidates: { move: Move; via: string; owned: boolean; itemId?: number }[] = []
    for (const it of p.tmhm) { const item = db.itemById.get(it); const mv = item?.move ? db.moveById.get(item.move) : undefined; if (mv) candidates.push({ move: mv, via: item!.name.split(' ')[0], owned: bagIds.has(it), itemId: it }) }
    for (const mid of p.tutor) { const mv = db.moveById.get(mid); if (mv) candidates.push({ move: mv, via: 'Tutor', owned: true }) }
    for (const [lvl, mid] of p.levelUp) { if (lvl > mon.level && lvl <= mon.level + 8) { const mv = db.moveById.get(mid); if (mv) candidates.push({ move: mv, via: `Lv.${lvl}`, owned: true }) } }
    for (const c of candidates) {
      if (known.has(c.move.id) || moveCategory(c.move) === 'status' || c.move.power < 60) continue
      const covers = cov.uncovered.filter((t) => effectiveness(chart, c.move.type, [t]) >= 2)
      if (!covers.length) continue
      const key = `${mon.uid}:${c.move.id}`
      if (seen.has(key)) continue
      seen.add(key)
      out.push({ mon, pokemon: p, move: c.move, via: c.via, owned: c.owned, covers, itemId: c.itemId })
    }
  }
  const stab = (s: Suggestion) => (s.pokemon.types.includes(s.move.type) ? 1 : 0)
  return out.sort((a, b) => (b.owned ? 1 : 0) - (a.owned ? 1 : 0) || b.covers.length - a.covers.length || stab(b) - stab(a) || b.move.power - a.move.power).slice(0, 12)
}
