import { describe, expect, it } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { inferStoryProgress, parseSave } from './gen3'
import type { Db } from '../../data/db'

const root = resolve(__dirname, '../../..')
const load = (n: string) => JSON.parse(readFileSync(resolve(root, 'public/data', n + '.json'), 'utf-8'))
const fixture = resolve(root, 'scripts/fixtures/test.sav')

function makeDb(): Db {
  const pokemon = load('pokemon'), moves = load('moves'), items = load('items'), meta = load('meta')
  return {
    pokemon, pokemonById: new Map(pokemon.map((p: { id: number }) => [p.id, p])), moves, moveById: new Map(moves.map((m: { id: number }) => [m.id, m])),
    items, itemById: new Map(items.map((i: { id: number }) => [i.id, i])), itemByKey: new Map(), trainers: [], trainerById: new Map(), trainerByKey: new Map(),
    locations: [], locationById: new Map(), typechart: { types: [], effectiveness: {} }, trades: [], guide: [], chapters: [], stepById: new Map(), meta,
  } as unknown as Db
}

describe.skipIf(!existsSync(fixture))('FireRed .sav import', () => {
  const db = makeDb()
  const expected = JSON.parse(readFileSync(resolve(root, 'scripts/fixtures/test.expected.json'), 'utf-8'))
  const save = parseSave(new Uint8Array(readFileSync(fixture)), db)
  it('reads trainer card', () => {
    expect(save.playerName).toBe(expected.playerName)
    expect(save.trainerId).toBe(expected.trainerId)
    expect(save.money).toBe(expected.money)
    expect(save.playTime).toBe('12h 34m')
  })
  it('reads badges and dex', () => {
    expect(save.badges).toEqual(expected.badges)
    expect(save.seen).toEqual(expected.seen)
    expect(save.caught).toEqual(expected.caught)
  })
  it('decodes the party', () => {
    const party = save.mons.filter((m) => m.inParty)
    expect(party).toHaveLength(2)
    expect(party[0].species).toBe(5)
    expect(party[0].level).toBe(20)
    expect(party[0].nickname).toBe('FLAME')
    expect(party[0].moves).toEqual([52, 10, 45, 232])
    expect(party[0].item).toBe(139)
    expect(party[0].ivs).toEqual({ hp: 15, atk: 20, def: 25, spe: 30, spa: 5, spd: 10 })
    expect(party[1].species).toBe(16)
    expect(party[1].level).toBe(9)
  })
  it('decodes boxes and derives level from experience', () => {
    const boxed = save.mons.filter((m) => !m.inParty)
    expect(boxed).toHaveLength(1)
    expect(boxed[0].species).toBe(19)
    expect(boxed[0].level).toBe(4)
  })
  it('reads bag and key items', () => {
    expect(save.bag).toContainEqual({ item: 13, qty: 5 })
    expect(save.keyItems).toContain(339)
  })
  it('guesses the starter', () => {
    expect(save.starter).toBe(4)
  })
  it('reads event flags and infers story progress', () => {
    const meta = db.meta as { flags: Record<string, number> }
    expect(save.flags.has(meta.flags.FLAG_HIDE_VIRIDIAN_FOREST_POKE_BALL)).toBe(true)
    expect(save.flags.has(meta.flags.FLAG_GOT_HM01)).toBe(true)
    const locations = load('locations'), trainers = load('trainers'), chapters = load('walkthrough'), items = load('items')
    const full = { ...db, locations, trainers, chapters, itemById: new Map(items.map((i: { id: number }) => [i.id, i])) } as unknown as Db
    const story = inferStoryProgress(save, full)
    expect(story.flags).toContain('FLAG_HIDE_VIRIDIAN_FOREST_POKE_BALL')
    expect(story.flags).toContain('FLAG_HIDDEN_ITEM_VIRIDIAN_FOREST_POTION')
    const brock = trainers.find((t: { key: string }) => t.key === 'TRAINER_LEADER_BROCK')
    expect(story.beaten).toContain(brock.id)
    const brockStep = chapters.flatMap((c: { steps: { id: string; trainers?: number[] }[] }) => c.steps).find((s: { trainers?: number[] }) => s.trainers?.includes(brock.id))
    expect(story.steps).toContain(brockStep.id)
    const hm01Step = chapters.flatMap((c: { steps: { id: string; items?: number[]; kind: string }[] }) => c.steps).find((s: { items?: number[]; kind: string }) => s.kind === 'gift' && s.items?.includes(339))
    expect(story.steps).toContain(hm01Step.id)
    expect(story.currentChapter).toBe(5)
  })
})
