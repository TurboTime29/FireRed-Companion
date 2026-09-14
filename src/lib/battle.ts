/** Generation III battle math (FireRed), following pret/pokefirered CalculateBaseDamage and the ball-throw code. */
import type { Item, Move, Pokemon, Stats, TypeChart, TypeName } from '../data/types'

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

export type Status = 'none' | 'brn' | 'par' | 'psn' | 'slp' | 'frz'
export type Weather = 'none' | 'sun' | 'rain' | 'sand' | 'hail'

export interface Combatant {
  pokemon: Pokemon
  level: number
  stats: Stats
  moves: Move[]
  /** ability name, e.g. "Levitate" */
  ability?: string
  item?: Item
  status?: Status
  /** stat stages -6..+6 */
  stages?: Partial<Stats>
  /** current HP as a percentage of max (for Overgrow-type abilities) */
  hpPct?: number
  ivs?: Partial<Stats>
  /** player's badges (Boulder +Atk, Thunder +Spe, Soul +Def, Volcano +SpA/SpD); undefined for opponents */
  badges?: boolean[]
  /** Flash Fire already triggered */
  flashFire?: boolean
}

export interface BattleContext {
  weather?: Weather
  crit?: boolean
  /** screens on the defender's side */
  reflect?: boolean
  lightScreen?: boolean
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
  /** damage per possible random roll (16 values, low to high), one use of the move */
  rolls?: number[]
  /** chance to KO in n uses: index 0 = 1 use … up to 4 uses; values 0..1 */
  ko?: number[]
  /** effective type after Hidden Power / Weather Ball */
  type: TypeName
}

const STAGE_NUM = [10, 10, 10, 10, 10, 10, 10, 15, 20, 25, 30, 35, 40]
const STAGE_DEN = [40, 35, 30, 25, 20, 15, 10, 10, 10, 10, 10, 10, 10]
function stageMod(stat: number, stage = 0) {
  const i = Math.max(0, Math.min(12, stage + 6))
  return Math.floor((stat * STAGE_NUM[i]) / STAGE_DEN[i])
}

const HP_TYPES: TypeName[] = ['Fighting', 'Flying', 'Poison', 'Ground', 'Rock', 'Bug', 'Ghost', 'Steel', 'Fire', 'Water', 'Grass', 'Electric', 'Psychic', 'Ice', 'Dragon', 'Dark']
/** Hidden Power type and power from IVs (Gen 3). */
export function hiddenPower(ivs: Partial<Stats>): { type: TypeName; power: number } {
  const v = (k: keyof Stats) => ivs[k] ?? 15
  const order: (keyof Stats)[] = ['hp', 'atk', 'def', 'spe', 'spa', 'spd']
  let t = 0, p = 0
  order.forEach((k, i) => { t += (v(k) & 1) << i; p += ((v(k) >> 1) & 1) << i })
  return { type: HP_TYPES[Math.floor((t * 15) / 63)], power: Math.floor((p * 40) / 63) + 30 }
}

const SOUND_MOVES = new Set(['Growl', 'Roar', 'Sing', 'Supersonic', 'Screech', 'Snore', 'Uproar', 'Metal Sound', 'Grasswhistle', 'Hyper Voice', 'Perish Song', 'Heal Bell'])

/** Ability-based immunity note, or null. */
export function abilityImmunity(target: Combatant, moveType: TypeName, move: Move, typeMult: number): string | null {
  const a = target.ability
  if (!a) return null
  if (a === 'Levitate' && moveType === 'Ground') return 'Levitate'
  if (a === 'Volt Absorb' && moveType === 'Electric') return 'Volt Absorb'
  if (a === 'Water Absorb' && moveType === 'Water') return 'Water Absorb'
  if (a === 'Flash Fire' && moveType === 'Fire') return 'Flash Fire'
  if (a === 'Wonder Guard' && typeMult <= 1) return 'Wonder Guard'
  if (a === 'Soundproof' && SOUND_MOVES.has(move.name)) return 'Soundproof'
  if (a === 'Damp' && move.effect === 'explosion') return 'Damp'
  if (a === 'Sturdy' && move.effect === 'ohko') return 'Sturdy'
  return null
}

function effectivePower(move: Move, attacker: Combatant, target: Combatant, result: DamageResult): number | null {
  if (move.power > 0) return move.power
  switch (move.effect) {
    case 'return': return 102
    case 'frustration': return 1
    case 'low kick': { const w = target.pokemon.weight; return w >= 200 ? 120 : w >= 100 ? 100 : w >= 50 ? 80 : w >= 25 ? 60 : w >= 10 ? 40 : 20 }
    case 'hidden power': { if (attacker.ivs) { const hp = hiddenPower(attacker.ivs); result.type = hp.type; return hp.power } result.note = 'IVs unknown: shown as 49 power Normal'; return 49 }
    case 'flail': { const pct = attacker.hpPct ?? 100; result.note = 'stronger at low HP'; return pct <= 4 ? 200 : pct <= 10 ? 150 : pct <= 20 ? 100 : pct <= 35 ? 80 : pct <= 68 ? 40 : 20 }
    case 'magnitude': result.note = 'random 10–150'; return 71
    case 'eruption': { const pct = attacker.hpPct ?? 100; return Math.max(1, Math.floor((150 * pct) / 100)) }
    case 'present': result.note = 'random 40/80/120 or heals'; return 40
    case 'rollout': result.note = 'first hit; doubles each turn'; return 30
    case 'fury cutter': result.note = 'first hit; doubles each use'; return 10
    case 'triple kick': result.note = '3 rising hits if all land'; return 10
    case 'weather ball': return 50
    default: return null
  }
}

const FIXED: Record<string, (a: Combatant, t: Combatant) => [number, number, string?]> = {
  'level damage': (a) => [a.level, a.level],
  sonicboom: () => [20, 20],
  'dragon rage': () => [40, 40],
  ohko: (_, t) => [t.stats.hp, t.stats.hp, 'OHKO, 30% accuracy, fails on higher level'],
  'super fang': (_, t) => [Math.floor(t.stats.hp / 2), Math.floor(t.stats.hp / 2), 'halves current HP'],
  psywave: (a) => [1, Math.floor(a.level * 1.5)],
}

/** Gen 3 damage: full formula with abilities, items, badges, stat stages, status, screens, weather and crits. */
export function calcDamage(chart: TypeChart, attacker: Combatant, target: Combatant, move: Move, ctx: BattleContext = {}): DamageResult {
  const category = moveCategory(move)
  const result: DamageResult = { move, min: 0, max: 0, minPct: 0, maxPct: 0, typeMult: 1, stab: false, category, type: move.type }
  if (category === 'status') return result
  if (move.effect === 'counter' || move.effect === 'mirror coat' || move.effect === 'bide') { result.note = 'returns damage taken'; return result }
  if (move.effect === 'weather ball' && ctx.weather && ctx.weather !== 'none') result.type = ({ sun: 'Fire', rain: 'Water', sand: 'Rock', hail: 'Ice' } as Record<string, TypeName>)[ctx.weather]
  const power0 = effectivePower(move, attacker, target, result)
  const type = result.type
  const physical = PHYSICAL_TYPES.has(type)
  result.typeMult = effectiveness(chart, type, target.pokemon.types)
  result.stab = attacker.pokemon.types.includes(type)
  const imm = abilityImmunity(target, type, move, result.typeMult)
  if (imm) { result.note = `no effect (${imm})`; result.typeMult = 0; return result }
  if (result.typeMult === 0) return result
  const fixed = FIXED[move.effect]
  if (fixed) {
    const [lo, hi, note] = fixed(attacker, target)
    result.min = lo; result.max = hi; if (note) result.note = note
    result.minPct = (lo / target.stats.hp) * 100; result.maxPct = (hi / target.stats.hp) * 100
    result.rolls = Array(16).fill(hi); result.ko = koChances([Array(16).fill(hi)], target.stats.hp)
    return result
  }
  if (power0 === null) { result.note = 'variable'; return result }
  let power = power0
  const badges = attacker.badges ?? [], tBadges = target.badges ?? []
  let attack = attacker.stats.atk, defense = target.stats.def, spAttack = attacker.stats.spa, spDefense = target.stats.spd
  const aAb = attacker.ability, tAb = target.ability
  const aHold = attacker.item?.holdEffect, tHold = target.item?.holdEffect
  if (aAb === 'Huge Power' || aAb === 'Pure Power') attack *= 2
  if (badges[0]) attack = Math.floor((110 * attack) / 100)
  if (tBadges[4]) defense = Math.floor((110 * defense) / 100)
  if (badges[6]) spAttack = Math.floor((110 * spAttack) / 100)
  if (tBadges[6]) spDefense = Math.floor((110 * spDefense) / 100)
  // type-boosting held item (+10%)
  if (aHold && aHold.endsWith(' power') && aHold.slice(0, -6).toLowerCase() === type.toLowerCase()) {
    const p = attacker.item?.holdEffectParam ?? 10
    if (physical) attack = Math.floor((attack * (p + 100)) / 100); else spAttack = Math.floor((spAttack * (p + 100)) / 100)
  }
  if (aHold === 'choice band') attack = Math.floor((150 * attack) / 100)
  if (aHold === 'deep sea tooth' && attacker.pokemon.id === 366) spAttack *= 2
  if (tHold === 'deep sea scale' && target.pokemon.id === 366) spDefense *= 2
  if (aHold === 'light ball' && attacker.pokemon.id === 25) spAttack *= 2
  if (tHold === 'metal powder' && target.pokemon.id === 132) defense *= 2
  if (aHold === 'thick club' && (attacker.pokemon.id === 104 || attacker.pokemon.id === 105)) attack *= 2
  if (tAb === 'Thick Fat' && (type === 'Fire' || type === 'Ice')) spAttack = Math.floor(spAttack / 2)
  if (aAb === 'Hustle') attack = Math.floor((150 * attack) / 100)
  const aStatus = attacker.status && attacker.status !== 'none'
  if (aAb === 'Guts' && aStatus) attack = Math.floor((150 * attack) / 100)
  if (tAb === 'Marvel Scale' && target.status && target.status !== 'none') defense = Math.floor((150 * defense) / 100)
  const lowHp = (attacker.hpPct ?? 100) <= 100 / 3
  if (lowHp && ((type === 'Grass' && aAb === 'Overgrow') || (type === 'Fire' && aAb === 'Blaze') || (type === 'Water' && aAb === 'Torrent') || (type === 'Bug' && aAb === 'Swarm'))) power = Math.floor((150 * power) / 100)
  if (move.effect === 'explosion') defense = Math.floor(defense / 2)
  const crit = !!ctx.crit
  const st = attacker.stages ?? {}, tst = target.stages ?? {}
  let dmg: number
  if (physical) {
    const atkStage = st.atk ?? 0, defStage = tst.def ?? 0
    const a = crit && atkStage < 0 ? attack : stageMod(attack, atkStage)
    dmg = a * power * (Math.floor((2 * attacker.level) / 5) + 2)
    const d = crit && defStage > 0 ? defense : stageMod(defense, defStage)
    dmg = Math.floor(Math.floor(dmg / Math.max(1, d)) / 50)
    if (attacker.status === 'brn' && aAb !== 'Guts') dmg = Math.floor(dmg / 2)
    if (ctx.reflect && !crit) dmg = Math.floor(dmg / 2)
    if (dmg === 0) dmg = 1
  } else {
    const atkStage = st.spa ?? 0, defStage = tst.spd ?? 0
    const a = crit && atkStage < 0 ? spAttack : stageMod(spAttack, atkStage)
    dmg = a * power * (Math.floor((2 * attacker.level) / 5) + 2)
    const d = crit && defStage > 0 ? spDefense : stageMod(spDefense, defStage)
    dmg = Math.floor(Math.floor(dmg / Math.max(1, d)) / 50)
    if (ctx.lightScreen && !crit) dmg = Math.floor(dmg / 2)
    const w = ctx.weather ?? 'none'
    const negated = aAb === 'Cloud Nine' || tAb === 'Cloud Nine'
    if (!negated) {
      if (w === 'rain') { if (type === 'Fire') dmg = Math.floor(dmg / 2); if (type === 'Water') dmg = Math.floor((15 * dmg) / 10) }
      if (w !== 'sun' && w !== 'none' && move.name === 'Solar Beam') dmg = Math.floor(dmg / 2)
      if (w === 'sun') { if (type === 'Fire') dmg = Math.floor((15 * dmg) / 10); if (type === 'Water') dmg = Math.floor(dmg / 2) }
    }
    if (attacker.flashFire && type === 'Fire') dmg = Math.floor((15 * dmg) / 10)
  }
  dmg += 2
  if (crit) dmg *= 2
  if (result.stab) dmg = Math.floor((dmg * 15) / 10)
  // type effectiveness applied per defending type, as the game does (×10 integer steps)
  for (const dt of target.pokemon.types) {
    const m = chart.effectiveness[type]?.[dt] ?? 1
    dmg = Math.floor((dmg * m * 10) / 10)
    if (m !== 0 && dmg === 0) dmg = 1
  }
  const rolls: number[] = []
  for (let r = 15; r >= 0; r--) rolls.push(Math.max(1, Math.floor((dmg * (100 - r)) / 100)))
  // multi-hit: Gen 3 2-5 hits are 3/8, 3/8, 1/8, 1/8
  const hitDist: [number, number][] = move.min_hits && move.max_hits ? (move.max_hits === move.min_hits ? [[move.min_hits, 1]] : [[2, 3 / 8], [3, 3 / 8], [4, 1 / 8], [5, 1 / 8]]) : [[1, 1]]
  const hits = [hitDist[0][0], hitDist[hitDist.length - 1][0]]
  result.min = rolls[0] * hits[0]; result.max = rolls[15] * hits[1]
  result.minPct = (result.min / target.stats.hp) * 100
  result.maxPct = (result.max / target.stats.hp) * 100
  result.rolls = rolls
  result.ko = koChances(hitDist.map(([n, w]) => ({ n, w })).length === 1 ? [repeatDist(rolls, hits[0])] : hitDist.map(([n, w]) => ({ dist: repeatDist(rolls, n), w })), target.stats.hp)
  if (hits[1] > 1) result.note = `${hits[0]}–${hits[1]} hits`
  if (crit) result.note = (result.note ? result.note + ', ' : '') + 'critical hit'
  return result
}

type Dist = Map<number, number>
function toDist(rolls: number[]): Dist { const d: Dist = new Map(); for (const r of rolls) d.set(r, (d.get(r) ?? 0) + 1 / rolls.length); return d }
function convolve(a: Dist, b: Dist): Dist { const out: Dist = new Map(); for (const [x, px] of a) for (const [y, py] of b) out.set(x + y, (out.get(x + y) ?? 0) + px * py); return out }
/** distribution of n hits of the same roll table, returned as a roll list of 16 quantiles for convenience */
function repeatDist(rolls: number[], n: number): Dist { let d = toDist(rolls); for (let i = 1; i < n; i++) d = convolve(d, toDist(rolls)); return d }
/** P(KO within k uses) for k = 1..4 given the per-use damage distribution(s). */
function koChances(uses: (number[] | Dist | { dist: Dist; w: number })[], hp: number): number[] {
  let per: Dist
  if (uses.length === 1) { const u = uses[0]; per = Array.isArray(u) ? toDist(u) : u instanceof Map ? u : u.dist } else {
    per = new Map()
    for (const u of uses as { dist: Dist; w: number }[]) for (const [x, p] of u.dist) per.set(x, (per.get(x) ?? 0) + p * u.w)
  }
  const out: number[] = []
  let cum = per
  for (let k = 1; k <= 4; k++) {
    let p = 0
    for (const [x, px] of cum) if (x >= hp) p += px
    out.push(Math.min(1, p))
    if (p >= 0.9999) break
    cum = convolve(cum, per)
    if (cum.size > 4000) { // trim tiny probabilities to keep it fast
      const trimmed: Dist = new Map(); for (const [x, px] of cum) if (px > 1e-6) trimmed.set(x, px); cum = trimmed
    }
  }
  return out
}

/** "OHKO", "81% to 2HKO", "guaranteed 3HKO"… */
export function koText(res: DamageResult): string {
  if (!res.ko || !res.max) return ''
  for (let i = 0; i < res.ko.length; i++) {
    const p = res.ko[i]
    if (p >= 0.9999) return `guaranteed ${i + 1}HKO`
    if (p > 0.005) return `${Math.round(p * 100)}% ${i + 1}HKO`
  }
  return res.ko.length >= 4 ? '5+ hits' : ''
}

/** Effective speed with stages, paralysis, weather abilities and the Thunder Badge. */
export function effectiveSpeed(c: Combatant, ctx: BattleContext = {}): number {
  let s = stageMod(c.stats.spe, c.stages?.spe ?? 0)
  if (c.badges?.[2]) s = Math.floor((110 * s) / 100)
  if (c.ability === 'Chlorophyll' && ctx.weather === 'sun') s *= 2
  if (c.ability === 'Swift Swim' && ctx.weather === 'rain') s *= 2
  if (c.status === 'par') s = Math.floor(s / 4)
  return s
}

/** Defensive summary: multiplier of every attacking type against a Pokémon. */
export function defensiveProfile(chart: TypeChart, types: TypeName[]): { type: TypeName; mult: number }[] {
  return chart.types.map((t) => ({ type: t, mult: effectiveness(chart, t, types) }))
}

/** Speed check: who moves first, honouring move priority when moves are given. */
export function movesFirst(a: Combatant, b: Combatant, ctx: BattleContext = {}, moveA?: Move, moveB?: Move): 'a' | 'b' | 'tie' {
  const pa = moveA?.priority ?? 0, pb = moveB?.priority ?? 0
  if (pa !== pb) return pa > pb ? 'a' : 'b'
  const sa = effectiveSpeed(a, ctx), sb = effectiveSpeed(b, ctx)
  if (sa === sb) return 'tie'
  return sa > sb ? 'a' : 'b'
}
