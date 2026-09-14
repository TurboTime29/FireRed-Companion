export type TypeName =
  | 'Normal' | 'Fire' | 'Water' | 'Electric' | 'Grass' | 'Ice' | 'Fighting' | 'Poison' | 'Ground'
  | 'Flying' | 'Psychic' | 'Bug' | 'Rock' | 'Ghost' | 'Dragon' | 'Dark' | 'Steel' | '???'

export interface Stats { hp: number; atk: number; def: number; spa: number; spd: number; spe: number }

export interface Evolution {
  method: string
  to: number
  level?: number
  item?: number
  friendship?: number
  note?: string
  param?: string
}

export interface EncounterRef { map: string; method: string; rate: number; min: number; max: number }

export interface Pokemon {
  id: number
  key: string
  name: string
  slug: string
  types: TypeName[]
  stats: Stats
  abilities: { id: number; name: string; text: string }[]
  catchRate: number
  expYield: number
  femaleRatio: number | null
  growth: string
  eggGroups: string[]
  baseFriendship: number
  eggCycles: number
  category: string
  height: number
  weight: number
  dexText: string
  levelUp: [number, number][]
  tmhm: number[]
  tutor: number[]
  egg: number[]
  evolutions: Evolution[]
  evolvesFrom?: number
  heldItems: number[]
  safariFlee: number
  locations?: EncounterRef[]
  /** how it is obtained in FireRed */
  availability: 'wild' | 'gift' | 'evolution' | 'trade-evolution' | 'trade-only' | 'event'
}

export interface Move {
  id: number
  key: string
  name: string
  type: TypeName
  power: number
  accuracy: number
  pp: number
  priority: number
  effectChance: number
  effect: string
  category: 'physical' | 'special' | 'status'
  contact: boolean
  target: string
  description: string
  effectText: string
  metaCategory?: string
  min_hits?: number
  max_hits?: number
  drain?: number
  healing?: number
  crit_rate?: number
  ailment_chance?: number
  flinch_chance?: number
  stat_chance?: number
}

export interface Item {
  id: number
  key: string
  name: string
  price: number
  pocket: string
  description: string
  keyItem: boolean
  holdEffect?: string
  holdEffectParam?: number
  move?: number
  sprite: string
}

export interface TrainerMon {
  species: number
  level: number
  iv: number
  item?: number
  moves: number[]
  defaultMoves?: boolean
}

export interface Trainer {
  id: number
  key: string
  class: string
  classKey: string
  name: string
  pic: string
  double: boolean
  items: number[]
  party: TrainerMon[]
  female: boolean
  maps: string[]
  rematchOf?: number
  rematchTier?: number
  rematches?: number[]
  battleGroup?: string
  rivalStarter?: number
}

export interface EncounterSlot { species: number; rate: number; min: number; max: number }

export interface Location {
  id: string
  key: string
  section: string
  sectionName: string
  name: string
  type: string
  connections: { map: string; dir: string }[]
  warps: string[]
  items: { item: number; x: number; y: number; flag: string }[]
  hiddenItems: { item: number; x: number; y: number; qty: number; flag: string; underfoot: boolean }[]
  trainers: number[]
  shops: number[][]
  tutors: { move: number; x?: number; y?: number }[]
  encounters: Record<string, EncounterSlot[] | number>
  width: number
  height: number
  mapImage: boolean
  /** tile offset of the image's top-left within the layout (Bulbapedia crops indoor maps) */
  mapOffset: [number, number]
  /** image pixel size */
  mapSize: [number, number]
  trainerPos: Record<string, [number, number]>
  warpPos: { x: number; y: number; to: string }[]
}

export interface TypeChart { types: TypeName[]; effectiveness: Record<string, Record<string, number>> }

export interface Trade { key: string; give: number; get: number; nickname: string; item: number | null }

export interface GuideItem { name: string; display: string; where: string; hidden: boolean }
export interface GuideSection {
  id: string
  heading: string
  level: number
  prose: string[]
  items: GuideItem[]
  trainers: { cls: string; name: string; party: { dex: number; name: string; level: number }[] }[]
  catches: { dex: number; name: string; fr: boolean; lg: boolean; method: string; levels: string; rate: string }[]
  shops: { name: string; items: { name: string; price: number }[] }[]
}
export interface GuidePart { part: number; title: string; sections: GuideSection[] }

export type StepKind = 'story' | 'battle' | 'boss' | 'item' | 'hidden' | 'gift' | 'trade' | 'tutor' | 'optional' | 'missable' | 'tip' | 'shop'

export interface Step {
  id: string
  kind: StepKind
  text: string
  map?: string
  trainers?: number[]
  battleGroup?: string
  items?: number[]
  pokemon?: number[]
  flag?: string
  badge?: number
  hm?: number
  where?: string
  x?: number
  y?: number
  encounter?: Encounter
}

export interface Encounter {
  species: number
  level: number
  /** legendary = one-time roaming/static legendary; static = one-time non-legendary; gift = given by an NPC; wild = repeatable */
  kind: 'legendary' | 'static' | 'gift' | 'wild'
  legendary: boolean
  savePoint: string
  note: string
}

export interface Chapter {
  id: string
  n: number
  title: string
  subtitle: string
  maps: string[]
  guidePart: number
  steps: Step[]
}
