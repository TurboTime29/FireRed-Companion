import { describe, expect, it } from 'vitest'
import { calcDamage, calcStats, effectiveness, moveCategory, trainerIv, type Combatant } from './battle'
import type { Move, Pokemon, TypeChart } from '../data/types'

const chart: TypeChart = {
  types: ['Normal', 'Fire', 'Water', 'Electric', 'Grass', 'Ice', 'Fighting', 'Poison', 'Ground', 'Flying', 'Psychic', 'Bug', 'Rock', 'Ghost', 'Dragon', 'Dark', 'Steel'],
  effectiveness: {
    Water: { Fire: 2, Rock: 2, Ground: 2, Water: 0.5, Grass: 0.5, Dragon: 0.5 },
    Normal: { Rock: 0.5, Ghost: 0, Steel: 0.5 },
    Dark: { Psychic: 2, Ghost: 2, Steel: 0.5, Dark: 0.5, Fighting: 0.5 },
    Electric: { Ground: 0 },
  },
}

const mon = (name: string, types: Pokemon['types'], stats: Pokemon['stats']): Pokemon =>
  ({ id: 1, key: name, name, slug: name, types, stats, abilities: [], catchRate: 45, expYield: 0, femaleRatio: 50, growth: 'Medium Fast', eggGroups: [], baseFriendship: 70, eggCycles: 20,
    category: '', height: 1, weight: 10, dexText: '', levelUp: [], tmhm: [], tutor: [], egg: [], evolutions: [], heldItems: [], safariFlee: 0 }) as Pokemon
const move = (name: string, type: Move['type'], power: number, extra: Partial<Move> = {}): Move =>
  ({ id: 1, key: name, name, type, power, accuracy: 100, pp: 10, priority: 0, effectChance: 0, effect: 'hit', category: power ? (type === 'Normal' ? 'physical' : 'special') : 'status', contact: false, target: 'selected', description: '', effectText: '', ...extra }) as Move

describe('Gen 3 stats', () => {
  it('matches the well-known Lv.50 Garchomp-style formula (Charizard Lv.36, IV 15, no EV)', () => {
    const s = calcStats({ hp: 78, atk: 84, def: 78, spa: 109, spd: 85, spe: 100 }, 36)
    expect(s.hp).toBe(107) // floor((2*78+15)*36/100)+36+10
    expect(s.atk).toBe(70) // floor((2*84+15)*36/100)+5
  })
  it('applies natures', () => {
    const s = calcStats({ hp: 50, atk: 100, def: 50, spa: 50, spd: 50, spe: 50 }, 100, { nature: 'Adamant', ivs: { atk: 31 }, evs: { atk: 252 } })
    expect(s.atk).toBe(Math.floor((Math.floor(((200 + 31 + 63) * 100) / 100) + 5) * 1.1))
  })
  it('converts trainer IV byte', () => {
    expect(trainerIv(0)).toBe(0); expect(trainerIv(255)).toBe(31); expect(trainerIv(50)).toBe(6)
  })
})

describe('Gen 3 physical/special split by type', () => {
  it('Bite is special, Shadow Ball is physical', () => {
    expect(moveCategory(move('Bite', 'Dark', 60))).toBe('special')
    expect(moveCategory(move('Shadow Ball', 'Ghost', 80))).toBe('physical')
    expect(moveCategory(move('Growl', 'Normal', 0))).toBe('status')
  })
  it('Steel resists Dark and Electric does nothing to Ground', () => {
    expect(effectiveness(chart, 'Dark', ['Steel'])).toBe(0.5)
    expect(effectiveness(chart, 'Electric', ['Ground', 'Rock'])).toBe(0)
    expect(effectiveness(chart, 'Water', ['Rock', 'Ground'])).toBe(4)
  })
})

describe('damage', () => {
  const squirtle: Combatant = { pokemon: mon('Squirtle', ['Water'], { hp: 44, atk: 48, def: 65, spa: 50, spd: 64, spe: 43 }), level: 14, stats: calcStats({ hp: 44, atk: 48, def: 65, spa: 50, spd: 64, spe: 43 }, 14), moves: [] }
  const onix: Combatant = { pokemon: mon('Onix', ['Rock', 'Ground'], { hp: 35, atk: 45, def: 160, spa: 30, spd: 45, spe: 70 }), level: 14, stats: calcStats({ hp: 35, atk: 45, def: 160, spa: 30, spd: 45, spe: 70 }, 14), moves: [] }
  it('Water Gun from Squirtle on Onix: STAB, 4x, special vs Sp. Def', () => {
    const r = calcDamage(chart, squirtle, onix, move('Water Gun', 'Water', 40))
    // spa = floor((2*50+15)*14/100)+5 = 21, spd = floor((2*45+15)*14/100)+5 = 19
    // base = floor(floor(7*40*21/19)/50)+2 = floor(309/50)+2 = 8 ; *1.5 STAB = 12 ; *4 = 48
    expect(r.max).toBe(48)
    expect(r.min).toBe(Math.floor(48 * 0.85))
    expect(r.typeMult).toBe(4)
    expect(r.stab).toBe(true)
    expect(r.category).toBe('special')
    expect(r.maxPct).toBeGreaterThan(100)
  })
  it('Tackle from Squirtle on Onix is physical and resisted', () => {
    const r = calcDamage(chart, squirtle, onix, move('Tackle', 'Normal', 35))
    expect(r.category).toBe('physical')
    expect(r.typeMult).toBe(0.5)
    expect(r.max).toBeLessThan(10)
  })
  it('immune moves deal nothing', () => {
    const r = calcDamage(chart, squirtle, onix, move('Thunder Shock', 'Electric', 40))
    expect(r.max).toBe(0)
  })
  it('status moves deal nothing', () => {
    expect(calcDamage(chart, squirtle, onix, move('Growl', 'Normal', 0)).max).toBe(0)
  })
})
