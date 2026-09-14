import { useEffect, useState } from 'react'
import type { Chapter, GuidePart, Item, Location, Move, Pokemon, Trade, Trainer, TypeChart } from './types'

export interface Db {
  pokemon: Pokemon[]
  pokemonById: Map<number, Pokemon>
  moves: Move[]
  moveById: Map<number, Move>
  items: Item[]
  itemById: Map<number, Item>
  itemByKey: Map<string, Item>
  trainers: Trainer[]
  trainerById: Map<number, Trainer>
  trainerByKey: Map<string, Trainer>
  locations: Location[]
  locationById: Map<string, Location>
  typechart: TypeChart
  trades: Trade[]
  guide: GuidePart[]
  chapters: Chapter[]
  stepById: Map<string, { step: Chapter['steps'][number]; chapter: Chapter }>
  /** species id -> trainers that use it (for "who has X") */
  meta: { commit: string; counts: Record<string, number>; speciesMap?: number[]; flags?: Record<string, number>; trainerFlagsStart?: number; flagsCount?: number }
}

let cached: Db | null = null
let pending: Promise<Db> | null = null

const base = import.meta.env.BASE_URL

async function json<T>(name: string): Promise<T> {
  const r = await fetch(`${base}data/${name}.json`)
  if (!r.ok) throw new Error(`failed to load ${name}`)
  return r.json()
}

export function loadDb(): Promise<Db> {
  if (cached) return Promise.resolve(cached)
  if (pending) return pending
  pending = (async () => {
    const [pokemon, moves, items, trainers, locations, typechart, trades, guide, chapters, meta] = await Promise.all([
      json<Pokemon[]>('pokemon'), json<Move[]>('moves'), json<Item[]>('items'), json<Trainer[]>('trainers'),
      json<Location[]>('locations'), json<TypeChart>('typechart'), json<Trade[]>('trades'), json<GuidePart[]>('guide'),
      json<Chapter[]>('walkthrough'), json<Db['meta']>('meta'),
    ])
    const stepById = new Map<string, { step: Chapter['steps'][number]; chapter: Chapter }>()
    for (const c of chapters) for (const s of c.steps) stepById.set(s.id, { step: s, chapter: c })
    cached = {
      pokemon, pokemonById: new Map(pokemon.map((p) => [p.id, p])),
      moves, moveById: new Map(moves.map((m) => [m.id, m])),
      items, itemById: new Map(items.map((i) => [i.id, i])), itemByKey: new Map(items.map((i) => [i.key, i])),
      trainers, trainerById: new Map(trainers.map((t) => [t.id, t])), trainerByKey: new Map(trainers.map((t) => [t.key, t])),
      locations, locationById: new Map(locations.map((l) => [l.id, l])),
      typechart, trades, guide, chapters, stepById, meta,
    }
    return cached
  })()
  return pending
}

export function useDb(): Db | null {
  const [db, setDb] = useState<Db | null>(cached)
  useEffect(() => {
    if (!db) loadDb().then(setDb)
  }, [db])
  return db
}

export function getDb(): Db {
  if (!cached) throw new Error('db not loaded')
  return cached
}

export const spriteUrl = {
  pokemon: (id: number, variant: 'front' | 'back' | 'shiny' = 'front') =>
    `${base}sprites/pokemon/${variant === 'front' ? '' : variant + '/'}${id}.png`,
  artwork: (id: number) => `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${id}.png`,
  item: (sprite: string) => `${base}sprites/items/${sprite}.png`,
  type: (t: string) => `${base}sprites/types/${t.toLowerCase()}.png`,
  badge: (n: number) => `${base}sprites/badges/${n}.png`,
}

export const BADGES = ['Boulder', 'Cascade', 'Thunder', 'Rainbow', 'Soul', 'Marsh', 'Volcano', 'Earth']
export const GYM_LEADERS = ['TRAINER_LEADER_BROCK', 'TRAINER_LEADER_MISTY', 'TRAINER_LEADER_LT_SURGE', 'TRAINER_LEADER_ERIKA',
  'TRAINER_LEADER_KOGA', 'TRAINER_LEADER_SABRINA', 'TRAINER_LEADER_BLAINE', 'TRAINER_LEADER_GIOVANNI']
