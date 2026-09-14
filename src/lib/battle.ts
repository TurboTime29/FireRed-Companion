/** Generation III battle math (FireRed). */
import type { Move, Pokemon, Stats, TypeChart, TypeName } from '../data/types'

export const PHYSICAL_TYPES = new Set<TypeName>(['Normal', 'Fighting', 'Flying', 'Poison', 'Ground', 'Rock', 'Bug', 'Ghost', 'Steel'])

export function moveCategory(move: Move): 'physical' | 'special' | 'status' {
  if (move.category === 'status') return 'status'
  return PHYSICAL_TYPES.has(move.type) ? 'physical' : 'special'
}

export function effectiveness(chart: TypeChart, attack: TypeName, defTypes: TypeName[]): number {
  let mult = 1
  for (const d of defTypes) {
    const row = chart.effectiveness[attack]
    if (row && row[d] !== undefined) mult *= row[d]
  }
  return mult
}

export const NATURES: Record<string, { up?: keyof Stats; down?: keyof Stats }> = {
  Hardy: {}, Lonely: { up: 'atk', down: 'def' }, Brave: { up: 'atk', down: 'spe' }, Adamant: { up: 'atk', down: 'spa' }, Naughty: { up: 'atk', down: 'spd' },
  Bold: { up: 'def', down: 'atk' }, Docile: {}, Relaxed: { up: 'def', down: 'spe' }, Impish: { up: 'def', down: 'spa' }, Lax: { up: 'def', down: 'spd' },
  Timid: { up: 'spe', down: 'atk' }, Hasty: { up: 'spe', down: 'def' }, Serious: {}, Jolly: { up: 'spe', down: 'spa' }, Naive: { up: 'spe', down: 'spd' },
  Modest: { up: 'spa', down: 'atk' }, Mild: { up: 'spa', down: 'def' }, Quiet: { up: 'spa', down: 'spe' }, Bashful: {}, Rash: { up: 'spa', down: 'spd' },
  Calm: { up: 'spd', down: 'atk' }, Gentle: { up: 'spd', down: 'def' }, Sassy: { up: 'spd', down: 'spe' }, Careful: { up: 'spd', down: 'spa' }, Quirky: {},
}

export interface StatOptions { ivs?: Partial<Stats>; evs?: Partial<Stats>; nature?: string }

/** Full stats at a level (Gen 3 formula). IV default 15, EV default 0, neutral nature. */
export function calcStats(base: Stats, level: number, opt: StatOptions = {}): Stats {
  const out = {} as Stats
  const n = NATURES[opt.nature ?? 'Hardy'] ?? {}
  for (const k of Object.keys(base) as (keyof Stats)[]) {
    const iv = opt.ivs?.[k] ?? 15
    const ev = opt.evs?.[k] ?? 0
    const core = Math.floor(((2 * base[k] + iv + Math.floor(ev / 4)) * level) / 100)
    if (k === 'hp') out.hp = core + level + 10
    else {
      let v = core + 5
      if (n.up === k) v = Math.floor(v * 1.1)
      if (n.down === k) v = Math.floor(v * 0.9)
      out[k] = v
    }
  }
  return out
}

/** Trainer Pokémon IVs in Gen 3: iv * 31 / 255 for every stat. */
export function trainerIv(iv: number): number {
  return Math.floor((iv * 31) / 255)
}

export interface Combatant {
  pokemon: Pokemon
  level: number
  stats: Stats
  moves: Move[]
}

export interface DamageResult {
  move: Move
  min: number
  max: number
  minPct: number
  maxPct: number
  typeMult: number
  stab: boolean
  category: 'physical' | 'special' | 'status'
  note?: string
}

/** Gen 3 damage formula, ignoring abilities/items/weather/crits. Returns min-max damage and % of target HP. */
export function calcDamage(chart: TypeChart, attacker: Combatant, target: Combatant, move: Move): DamageResult {
  const category = moveCategory(move)
  const stab = attacker.pokemon.types.includes(move.type)
  const typeMult = effectiveness(chart, move.type, target.pokemon.types)
  const result: DamageResult = { move, min: 0, max: 0, minPct: 0, maxPct: 0, typeMult, stab, category }
  if (category === 'status' || typeMult === 0) return result
  let power = move.power
  if (move.power === 0) {
    // fixed-damage moves
    const fixed: Record<string, number> = { 'level damage': attacker.level, sonicboom: 20, 'dragon rage': 40 }
    if (fixed[move.effect] !== undefined) {
      result.min = result.max = fixed[move.effect]
    } else if (move.effect === 'ohko') {
      result.min = result.max = target.stats.hp; result.note = 'OHKO, ~30% accuracy'
    } else if (move.effect === 'super fang') {
      result.min = result.max = Math.floor(target.stats.hp / 2); result.note = 'halves current HP'
    } else if (move.effect === 'psywave') {
      result.min = 1; result.max = Math.floor(attacker.level * 1.5)
    } else if (move.effect === 'return') { power = 102 } else if (move.effect === 'frustration') { power = 1 }
    else if (move.effect === 'low kick') { power = target.pokemon.weight >= 200 ? 120 : target.pokemon.weight >= 100 ? 100 : target.pokemon.weight >= 50 ? 80 : target.pokemon.weight >= 25 ? 60 : target.pokemon.weight >= 10 ? 40 : 20 }
    else if (move.effect === 'hidden power') { power = 49; result.note = 'depends on IVs (type shown as Normal)' }
    else if (move.effect === 'flail') { power = 20; result.note = 'stronger at low HP' }
    else if (move.effect === 'magnitude') { power = 71; result.note = 'random 10-150' }
    else if (move.effect === 'counter' || move.effect === 'mirror coat' || move.effect === 'bide') { result.note = 'returns damage taken'; return result }
    else { result.note = 'variable'; return result }
    if (result.max) { result.minPct = (result.min / target.stats.hp) * 100; result.maxPct = (result.max / target.stats.hp) * 100; return result }
  }
  const atk = category === 'physical' ? attacker.stats.atk : attacker.stats.spa
  const def = category === 'physical' ? target.stats.def : target.stats.spd
  let dmg = Math.floor(Math.floor((Math.floor((2 * attacker.level) / 5 + 2) * power * atk) / def) / 50) + 2
  if (stab) dmg = Math.floor(dmg * 1.5)
  dmg = Math.floor(dmg * typeMult)
  const hits = move.min_hits && move.max_hits ? [move.min_hits, move.max_hits] : [1, 1]
  result.min = Math.max(1, Math.floor(dmg * 0.85)) * hits[0]
  result.max = Math.max(1, dmg) * hits[1]
  result.minPct = (result.min / target.stats.hp) * 100
  result.maxPct = (result.max / target.stats.hp) * 100
  if (hits[1] > 1) result.note = `${hits[0]}-${hits[1]} hits`
  return result
}

/** Defensive summary: multiplier of every attacking type against a Pokémon. */
export function defensiveProfile(chart: TypeChart, types: TypeName[]): { type: TypeName; mult: number }[] {
  return chart.types.map((t) => ({ type: t, mult: effectiveness(chart, t, types) }))
}

/** Expected turns to KO with the best move (average damage). */
export function turnsToKo(res: DamageResult): number {
  const avg = (res.min + res.max) / 2
  if (avg <= 0) return Infinity
  return Math.ceil(100 / ((avg / (res.max / (res.maxPct / 100))) * 100))
}

/** Speed check: who moves first (ignores priority ties). */
export function movesFirst(a: Combatant, b: Combatant): 'a' | 'b' | 'tie' {
  if (a.stats.spe === b.stats.spe) return 'tie'
  return a.stats.spe > b.stats.spe ? 'a' : 'b'
}
