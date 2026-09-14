import { describe, expect, it } from 'vitest'
import { calcDamage, calcStats, effectiveSpeed, hiddenPower, koText, type Combatant } from './battle'
import { ballMultiplier, catchChance, safariCatch, BALLS } from './catch'
import type { Item, Move, Pokemon, TypeChart } from '../data/types'

const chart: TypeChart = {
  types: ['Normal', 'Fire', 'Water', 'Electric', 'Grass', 'Ice', 'Fighting', 'Poison', 'Ground', 'Flying', 'Psychic', 'Bug', 'Rock', 'Ghost', 'Dragon', 'Dark', 'Steel'],
  effectiveness: {
    Fire: { Grass: 2, Ice: 2, Bug: 2, Steel: 2, Fire: 0.5, Water: 0.5, Rock: 0.5, Dragon: 0.5 },
    Ground: { Fire: 2, Electric: 2, Poison: 2, Rock: 2, Steel: 2, Grass: 0.5, Bug: 0.5, Flying: 0 },
    Normal: { Rock: 0.5, Ghost: 0, Steel: 0.5 },
    Water: { Fire: 2, Rock: 2, Ground: 2, Water: 0.5, Grass: 0.5, Dragon: 0.5 },
  },
}
const mon = (id: number, name: string, types: Pokemon['types'], stats: Pokemon['stats'], extra: Partial<Pokemon> = {}): Pokemon =>
  ({ id, key: name, name, slug: name, types, stats, abilities: [], catchRate: 45, expYield: 0, femaleRatio: 50, growth: 'Medium Fast', eggGroups: [], baseFriendship: 70, eggCycles: 20,
    category: '', height: 1, weight: 10, dexText: '', levelUp: [], tmhm: [], tutor: [], egg: [], evolutions: [], heldItems: [], safariFlee: 0, availability: 'wild', ...extra }) as Pokemon
const move = (name: string, type: Move['type'], power: number, extra: Partial<Move> = {}): Move =>
  ({ id: 1, key: name, name, type, power, accuracy: 100, pp: 10, priority: 0, effectChance: 0, effect: 'hit', category: power ? 'physical' : 'status', contact: false, target: 'selected', description: '', effectText: '', ...extra }) as Move
const item = (name: string, holdEffect: string, holdEffectParam = 10): Item => ({ id: 1, key: name, name, price: 0, pocket: 'items', description: '', keyItem: false, holdEffect, holdEffectParam, sprite: '' })

const charizard = mon(6, 'Charizard', ['Fire', 'Flying'], { hp: 78, atk: 84, def: 78, spa: 109, spd: 85, spe: 100 })
const venusaur = mon(3, 'Venusaur', ['Grass', 'Poison'], { hp: 80, atk: 82, def: 83, spa: 100, spd: 100, spe: 80 })
const c = (p: Pokemon, level: number, extra: Partial<Combatant> = {}): Combatant => ({ pokemon: p, level, stats: calcStats(p.stats, level), moves: [], ...extra })

describe('full Gen 3 damage', () => {
  const fb = move('Flamethrower', 'Fire', 95, { category: 'special' })
  it('base case: Charizard Lv.50 Flamethrower vs Venusaur Lv.50 (STAB, 2x)', () => {
    const r = calcDamage(chart, c(charizard, 50), c(venusaur, 50), fb)
    // spa 114 vs spd 105: floor(floor(114*95*22/105)/50)=45 (+2)=47; STAB 70; ×2 = 140; rolls 119..140
    expect(r.max).toBe(140)
    expect(r.min).toBe(119)
    expect(r.rolls?.length).toBe(16)
  })
  it('sun boosts fire 1.5x, rain halves it', () => {
    const base = calcDamage(chart, c(charizard, 50), c(venusaur, 50), fb).max
    expect(calcDamage(chart, c(charizard, 50), c(venusaur, 50), fb, { weather: 'sun' }).max).toBeGreaterThan(base * 1.4)
    expect(calcDamage(chart, c(charizard, 50), c(venusaur, 50), fb, { weather: 'rain' }).max).toBeLessThan(base * 0.6)
  })
  it('crit doubles and ignores negative attack stages', () => {
    const r = calcDamage(chart, c(charizard, 50, { stages: { spa: -2 } }), c(venusaur, 50), fb, { crit: true })
    expect(r.max).toBe(282) // (45+2)*2 = 94, STAB 141, ×2
  })
  it('Charcoal +10%, Blaze at low HP, Thick Fat halves', () => {
    const plain = calcDamage(chart, c(charizard, 50), c(venusaur, 50), fb).max
    expect(calcDamage(chart, c(charizard, 50, { item: item('Charcoal', 'fire power') }), c(venusaur, 50), fb).max).toBeGreaterThan(plain)
    expect(calcDamage(chart, c(charizard, 50, { ability: 'Blaze', hpPct: 30 }), c(venusaur, 50), fb).max).toBeGreaterThan(plain * 1.4)
    expect(calcDamage(chart, c(charizard, 50), c(venusaur, 50, { ability: 'Thick Fat' }), fb).max).toBeLessThan(plain * 0.6)
  })
  it('Levitate makes Ground moves do nothing; Flash Fire absorbs Fire', () => {
    const eq = move('Earthquake', 'Ground', 100)
    expect(calcDamage(chart, c(venusaur, 50), c(charizard, 50, { ability: 'Levitate' }), eq).typeMult).toBe(0)
    expect(calcDamage(chart, c(charizard, 50), c(venusaur, 50, { ability: 'Flash Fire' }), fb).note).toContain('Flash Fire')
  })
  it('burn halves physical, Guts ignores it; Boulder Badge adds 10% Attack', () => {
    const sl = move('Slash', 'Normal', 70)
    const plain = calcDamage(chart, c(charizard, 50), c(venusaur, 50), sl).max
    expect(calcDamage(chart, c(charizard, 50, { status: 'brn' }), c(venusaur, 50), sl).max).toBeLessThan(plain * 0.6)
    expect(calcDamage(chart, c(charizard, 50, { status: 'brn', ability: 'Guts' }), c(venusaur, 50), sl).max).toBeGreaterThan(plain)
    expect(calcDamage(chart, c(charizard, 50, { badges: [true] }), c(venusaur, 50), sl).max).toBeGreaterThan(plain)
  })
  it('KO chances: guaranteed 2HKO for 119–140 vs 155 HP', () => {
    const r = calcDamage(chart, c(charizard, 50), c(venusaur, 50), fb)
    expect(r.ko?.[0]).toBe(0)
    expect(r.ko?.[1]).toBeCloseTo(1, 5)
    expect(koText(r)).toBe('guaranteed 2HKO')
  })
  it('Hidden Power from IVs', () => {
    expect(hiddenPower({ hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 })).toEqual({ type: 'Dark', power: 70 })
    expect(hiddenPower({ hp: 30, atk: 31, def: 30, spa: 31, spd: 31, spe: 31 }).type).toBe('Ice')
  })
  it('paralysis quarters speed; Thunder Badge +10%', () => {
    const base = c(charizard, 50)
    expect(effectiveSpeed({ ...base, status: 'par' })).toBe(Math.floor(base.stats.spe / 4))
    expect(effectiveSpeed({ ...base, badges: [false, false, true] })).toBe(Math.floor((110 * base.stats.spe) / 100))
  })
})

describe('Gen 3 capture', () => {
  const pidgey = mon(16, 'Pidgey', ['Normal', 'Flying'], { hp: 40, atk: 45, def: 40, spa: 35, spd: 35, spe: 56 }, { catchRate: 255 })
  const mewtwo = mon(150, 'Mewtwo', ['Psychic'], { hp: 106, atk: 110, def: 90, spa: 154, spd: 90, spe: 130 }, { catchRate: 3 })
  it('ball multipliers', () => {
    expect(ballMultiplier(BALLS.ultra, { types: ['Normal'], level: 10, turn: 0, alreadyCaught: false })).toBe(20)
    expect(ballMultiplier(BALLS.net, { types: ['Water'], level: 10, turn: 0, alreadyCaught: false })).toBe(30)
    expect(ballMultiplier(BALLS.nest, { types: ['Normal'], level: 5, turn: 0, alreadyCaught: false })).toBe(35)
    expect(ballMultiplier(BALLS.timer, { types: ['Normal'], level: 5, turn: 40, alreadyCaught: false })).toBe(40)
    expect(ballMultiplier(BALLS.repeat, { types: ['Normal'], level: 5, turn: 0, alreadyCaught: true })).toBe(30)
  })
  it('full-HP Pidgey with a Poké Ball: odds 85 → about 33% per throw', () => {
    const r = catchChance({ pokemon: pidgey, level: 3, maxHp: 17, curHp: 17, status: 'none', ball: BALLS.poke, turn: 0, alreadyCaught: false })
    expect(r.odds).toBe(85)
    expect(r.chance).toBeGreaterThan(0.32); expect(r.chance).toBeLessThan(0.34)
  })
  it('Mewtwo at 1 HP asleep with an Ultra Ball: odds = floor(6*(3M-2)/(3M))*2', () => {
    const r = catchChance({ pokemon: mewtwo, level: 70, maxHp: 240, curHp: 1, status: 'slp', ball: BALLS.ultra, turn: 0, alreadyCaught: false })
    expect(r.odds).toBe(10)
    expect(r.chance).toBeGreaterThan(0.04); expect(r.chance).toBeLessThan(0.05) // y = 1048560/35 = 29958 → (29958/65536)^4
  })
  it('Master Ball always works', () => {
    expect(catchChance({ pokemon: mewtwo, level: 70, maxHp: 240, curHp: 240, status: 'none', ball: BALLS.master, turn: 0, alreadyCaught: false }).chance).toBe(1)
  })
  it('Safari: rock raises the factor (max 20), bait lowers it (min 3)', () => {
    const chansey = mon(113, 'Chansey', ['Normal'], { hp: 250, atk: 5, def: 5, spa: 35, spd: 105, spe: 50 }, { catchRate: 30, safariFlee: 125 })
    expect(safariCatch(chansey, 'watching').factor).toBe(2)
    expect(safariCatch(chansey, 'angry').factor).toBe(4)
    expect(safariCatch(chansey, 'eating').factor).toBe(3)
    expect(safariCatch(chansey, 'angry').fleePct).toBeGreaterThan(safariCatch(chansey, 'eating').fleePct)
  })
})
