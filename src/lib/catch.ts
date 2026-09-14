/** Gen 3 capture math, from pret/pokefirered Cmd_handleballthrow and the Safari Zone handlers. */
import type { Pokemon, TypeName } from '../data/types'
import type { Status } from './battle'

/** item ids of the twelve balls */
export const BALLS = { master: 1, ultra: 2, great: 3, poke: 4, safari: 5, net: 6, dive: 7, nest: 8, repeat: 9, timer: 10, luxury: 11, premier: 12 } as const
export const BALL_ORDER = [4, 3, 2, 6, 8, 9, 10, 11, 12, 1]

export interface CatchInput {
  pokemon: Pokemon
  level: number
  maxHp: number
  curHp: number
  status: Status
  ball: number
  /** turns elapsed (Timer Ball); the game's counter starts at 0 on turn 1 */
  turn: number
  alreadyCaught: boolean
}

/** ball multiplier in tenths (10 = ×1) */
export function ballMultiplier(ball: number, p: { types: TypeName[]; level: number; turn: number; alreadyCaught: boolean }): number {
  switch (ball) {
    case BALLS.ultra: return 20
    case BALLS.great: return 15
    case BALLS.safari: return 15
    case BALLS.net: return p.types.includes('Water') || p.types.includes('Bug') ? 30 : 10
    case BALLS.dive: return 10 // never underwater in FireRed
    case BALLS.nest: return p.level < 40 ? Math.max(10, 40 - p.level) : 10
    case BALLS.repeat: return p.alreadyCaught ? 30 : 10
    case BALLS.timer: return Math.min(40, p.turn + 10)
    default: return 10
  }
}

function isqrt(n: number) { return Math.floor(Math.sqrt(n)) }

export interface CatchResult {
  /** per-throw capture probability 0..1 */
  chance: number
  /** modified catch value, 0..255+ (255+ = guaranteed) */
  odds: number
  expectedThrows: number
}

export function catchChance(inp: CatchInput): CatchResult {
  if (inp.ball === BALLS.master) return { chance: 1, odds: 999, expectedThrows: 1 }
  const bm = ballMultiplier(inp.ball, { types: inp.pokemon.types, level: inp.level, turn: inp.turn, alreadyCaught: inp.alreadyCaught })
  const M = Math.max(1, inp.maxHp), H = Math.max(1, Math.min(inp.curHp, M))
  let odds = Math.floor((Math.floor((inp.pokemon.catchRate * bm) / 10) * (M * 3 - H * 2)) / (3 * M))
  if (inp.status === 'slp' || inp.status === 'frz') odds *= 2
  if (inp.status === 'psn' || inp.status === 'brn' || inp.status === 'par') odds = Math.floor((odds * 15) / 10)
  return fromOdds(odds)
}

function fromOdds(odds: number): CatchResult {
  if (odds > 254) return { chance: 1, odds, expectedThrows: 1 }
  if (odds <= 0) return { chance: 0, odds: 0, expectedThrows: Infinity }
  const y = Math.floor(1048560 / isqrt(isqrt(Math.floor(16711680 / odds))))
  const chance = Math.pow(y / 65536, 4)
  return { chance, odds, expectedThrows: chance > 0 ? 1 / chance : Infinity }
}

/** P(caught within n throws) */
export function withinThrows(chance: number, n: number) { return 1 - Math.pow(1 - chance, n) }

export interface SafariState { rocks: number; baits: number }

/** Safari Zone: catch factor starts at catchRate*100/1275; a rock doubles it (max 20), bait halves it (min 3). Balls are ×1.5 and HP is full. */
export function safariCatch(p: Pokemon, state: 'watching' | 'angry' | 'eating', factorOverride?: number): CatchResult & { factor: number; fleePct: number } {
  let factor = factorOverride ?? Math.floor((p.catchRate * 100) / 1275)
  if (factorOverride === undefined) {
    if (state === 'angry') factor = Math.min(20, factor * 2)
    if (state === 'eating') factor = Math.max(3, factor >> 1)
  }
  const catchRate = Math.floor((factor * 1275) / 100)
  const odds = Math.floor((Math.floor((catchRate * 15) / 10) * (3 - 2)) / 3) // full HP: (3M-2M)/(3M) = 1/3
  const r = fromOdds(odds)
  let escape = Math.floor((p.safariFlee * 100) / 1275); if (escape <= 1) escape = 2
  let flee = state === 'angry' ? Math.min(20, escape * 2) : state === 'eating' ? Math.max(1, Math.floor(escape / 4)) : escape
  flee = Math.min(100, flee * 5)
  return { ...r, factor, fleePct: flee }
}
