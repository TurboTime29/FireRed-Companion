import { describe, expect, it } from 'vitest'
import { emptyProgress, isEmptyProgress, mergeProgress, type ProgressDoc } from './progress'

const full = (): ProgressDoc => ({
  ...emptyProgress(), playerName: 'Aakash', starter: 4, badges: [true, true, false, false, false, false, false, false], seen: [4, 5], caught: [5],
  mons: [{ uid: 'a', species: 6, level: 40, moves: [], inParty: true, shiny: true }], steps: { 'c01-001': 100 }, flags: { FLAG_X: 100 }, beaten: { 414: 100 },
  currentChapter: 10, money: 500, keyItems: [339], updatedAt: 1000,
})

describe('progress merge', () => {
  it('detects a fresh document', () => {
    expect(isEmptyProgress(emptyProgress())).toBe(true)
    expect(isEmptyProgress(full())).toBe(false)
    expect(emptyProgress().updatedAt).toBe(0)
  })
  it('a blank newer document never wipes a full older one', () => {
    const blank = { ...emptyProgress(), updatedAt: 5000 }
    const m = mergeProgress(blank, full())
    expect(m.mons).toHaveLength(1)
    expect(m.steps['c01-001']).toBe(100)
    expect(m.badges.filter(Boolean)).toHaveLength(2)
    expect(m.caught).toEqual([5])
    expect(m.currentChapter).toBe(10)
    expect(m.starter).toBe(4)
  })
  it('unions progress from two devices', () => {
    const a = full()
    const b = { ...full(), steps: { 'c02-001': 200 }, caught: [16], mons: [{ uid: 'b', species: 131, level: 34, moves: [], inParty: true }], updatedAt: 2000, money: 900 }
    const m = mergeProgress(a, b)
    expect(Object.keys(m.steps).sort()).toEqual(['c01-001', 'c02-001'])
    expect(m.caught).toEqual([5, 16])
    expect(m.mons.map((x) => x.uid).sort()).toEqual(['a', 'b'])
    expect(m.money).toBe(900)
    expect(m.updatedAt).toBe(2000)
  })
})
