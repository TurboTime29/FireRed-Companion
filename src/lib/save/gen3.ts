/** Pokémon FireRed (.sav) reader — Generation III save format, FRLG layout (offsets from pret/pokefirered include/global.h). */
import type { Db } from '../../data/db'
import type { OwnedMon } from '../../store/progress'
import { NATURES } from '../battle'

export interface ParsedSave {
  playerName: string
  trainerId: number
  secretId: number
  playTime: string
  money: number
  badges: boolean[]
  seen: number[]
  caught: number[]
  mons: OwnedMon[]
  keyItems: number[]
  bag: { item: number; qty: number }[]
  starter: 1 | 4 | 7 | null
  /** numeric ids of every set event flag (item balls, hidden items, gifts, beaten trainers) */
  flags: Set<number>
}

const SECTOR = 0x1000
const SECTOR_DATA = 0xf80
const SIGNATURE = 0x08012025
const NATURE_NAMES = Object.keys(NATURES)

const CHARS: Record<number, string> = { 0x00: ' ', 0xab: '!', 0xac: '?', 0xad: '.', 0xae: '-', 0xb0: '…', 0xb1: '“', 0xb2: '”', 0xb3: '‘', 0xb4: '’', 0xb5: '♂', 0xb6: '♀', 0xba: '/', 0xb8: ',', 0xb9: '×', 0xf0: ':' }
function decodeText(b: Uint8Array): string {
  let s = ''
  for (const c of b) {
    if (c === 0xff) break
    if (c >= 0xa1 && c <= 0xaa) s += String.fromCharCode(48 + c - 0xa1)
    else if (c >= 0xbb && c <= 0xd4) s += String.fromCharCode(65 + c - 0xbb)
    else if (c >= 0xd5 && c <= 0xee) s += String.fromCharCode(97 + c - 0xd5)
    else s += CHARS[c] ?? ''
  }
  return s.trim()
}

class Reader {
  b: Uint8Array
  constructor(b: Uint8Array) { this.b = b }
  u8(o: number) { return this.b[o] }
  u16(o: number) { return this.b[o] | (this.b[o + 1] << 8) }
  u32(o: number) { return (this.b[o] | (this.b[o + 1] << 8) | (this.b[o + 2] << 16) | (this.b[o + 3] << 24)) >>> 0 }
  slice(o: number, n: number) { return this.b.subarray(o, o + n) }
}

function sectorChecksum(data: Uint8Array, size: number): number {
  let sum = 0
  for (let i = 0; i < size; i += 4) sum = (sum + ((data[i] | (data[i + 1] << 8) | (data[i + 2] << 16) | (data[i + 3] << 24)) >>> 0)) >>> 0
  return ((sum >>> 16) + (sum & 0xffff)) & 0xffff
}

/** Return the 14 sectors (by id) of the most recent save slot. */
function loadSlot(file: Uint8Array): Uint8Array[] {
  const slots: { idx: number; sectors: Uint8Array[] }[] = []
  for (const base of [0, 0xe000]) {
    if (file.length < base + 14 * SECTOR) continue
    const sectors: Uint8Array[] = new Array(14)
    let idx = -1, ok = 0
    for (let i = 0; i < 14; i++) {
      const s = file.subarray(base + i * SECTOR, base + (i + 1) * SECTOR)
      const r = new Reader(s)
      if (r.u32(0xff8) !== SIGNATURE) continue
      const id = r.u16(0xff4)
      if (id > 13) continue
      sectors[id] = s
      idx = r.u32(0xffc)
      ok++
    }
    if (ok === 14) slots.push({ idx, sectors })
  }
  if (!slots.length) throw new Error('no valid save slot found (is this a 128 KB Gen 3 .sav?)')
  slots.sort((a, b) => b.idx - a.idx)
  return slots[0].sectors
}

const SUBSTRUCT_ORDER = ['GAEM', 'GAME', 'GEAM', 'GEMA', 'GMAE', 'GMEA', 'AGEM', 'AGME', 'AEGM', 'AEMG', 'AMGE', 'AMEG', 'EGAM', 'EGMA', 'EAGM', 'EAMG', 'EMGA', 'EMAG', 'MGAE', 'MGEA', 'MAGE', 'MAEG', 'MEGA', 'MEAG']

function decodeMon(db: Db, raw: Uint8Array, inParty: boolean, tid: number, sid: number, hasStats: boolean): OwnedMon | null {
  const r = new Reader(raw)
  const pid = r.u32(0)
  const otid = r.u32(4)
  if (pid === 0 && otid === 0) return null
  const key = (pid ^ otid) >>> 0
  const data = new Uint8Array(48)
  for (let i = 0; i < 48; i += 4) {
    const v = (r.u32(0x20 + i) ^ key) >>> 0
    data[i] = v & 0xff; data[i + 1] = (v >>> 8) & 0xff; data[i + 2] = (v >>> 16) & 0xff; data[i + 3] = (v >>> 24) & 0xff
  }
  const order = SUBSTRUCT_ORDER[pid % 24]
  const sub = (letter: string) => { const i = order.indexOf(letter); return new Reader(data.subarray(i * 12, i * 12 + 12)) }
  const G = sub('G'), A = sub('A'), E = sub('E'), Mi = sub('M')
  const internal = G.u16(0)
  const species = db.meta.speciesMap?.[internal] ?? (internal <= 251 ? internal : 0)
  if (!species || (raw[0x13] & 0x04)) return null // 0x04 = is egg / bad egg
  const p = db.pokemonById.get(species)
  if (!p) return null
  const item = G.u16(2)
  const moves = [A.u16(0), A.u16(2), A.u16(4), A.u16(6)].filter((m) => m > 0 && db.moveById.has(m))
  const ivw = Mi.u32(4)
  const ivs = { hp: ivw & 31, atk: (ivw >>> 5) & 31, def: (ivw >>> 10) & 31, spe: (ivw >>> 15) & 31, spa: (ivw >>> 20) & 31, spd: (ivw >>> 25) & 31 }
  const abilitySlot = (ivw >>> 31) & 1
  const evs = { hp: E.u8(0), atk: E.u8(1), def: E.u8(2), spe: E.u8(3), spa: E.u8(4), spd: E.u8(5) }
  const nature = NATURE_NAMES[pid % 25]
  const level = hasStats ? r.u8(0x54) : levelFromExp(p.growth, G.u32(4))
  const nickname = decodeText(r.slice(8, 10))
  const ratio = p.femaleRatio
  const gender: OwnedMon['gender'] = ratio === null ? '-' : ratio === 100 ? 'F' : ratio === 0 ? 'M' : (pid & 0xff) < Math.min(254, Math.floor((ratio * 255) / 100)) ? 'F' : 'M'
  const shiny = ((tid ^ sid ^ (pid >>> 16) ^ (pid & 0xffff)) & 0xffff) < 8
  return {
    uid: `sav-${pid.toString(16)}-${otid.toString(16)}`,
    species, nickname: nickname.toUpperCase() === p.name.toUpperCase() ? undefined : nickname, level, moves, item: item && db.itemById.has(item) ? item : undefined,
    nature, ability: p.abilities[abilitySlot]?.id ?? p.abilities[0]?.id, gender, shiny, ivs, evs, inParty, note: 'sav',
  }
}

const EXP_TABLE_CACHE = new Map<string, number[]>()
function expTable(growth: string): number[] {
  if (EXP_TABLE_CACHE.has(growth)) return EXP_TABLE_CACHE.get(growth)!
  const t: number[] = [0, 0]
  for (let n = 2; n <= 100; n++) {
    let e = 0
    switch (growth) {
      case 'Fast': e = Math.floor((4 * n ** 3) / 5); break
      case 'Medium Fast': e = n ** 3; break
      case 'Medium Slow': e = Math.floor((6 / 5) * n ** 3 - 15 * n ** 2 + 100 * n - 140); break
      case 'Slow': e = Math.floor((5 * n ** 3) / 4); break
      case 'Erratic': e = n <= 50 ? Math.floor((n ** 3 * (100 - n)) / 50) : n <= 68 ? Math.floor((n ** 3 * (150 - n)) / 100) : n <= 98 ? Math.floor((n ** 3 * Math.floor((1911 - 10 * n) / 3)) / 500) : Math.floor((n ** 3 * (160 - n)) / 100); break
      case 'Fluctuating': e = n <= 15 ? Math.floor((n ** 3 * (Math.floor((n + 1) / 3) + 24)) / 50) : n <= 36 ? Math.floor((n ** 3 * (n + 14)) / 50) : Math.floor((n ** 3 * (Math.floor(n / 2) + 32)) / 50); break
      default: e = n ** 3
    }
    t[n] = e
  }
  EXP_TABLE_CACHE.set(growth, t)
  return t
}
function levelFromExp(growth: string, exp: number): number {
  const t = expTable(growth)
  let lvl = 1
  for (let n = 2; n <= 100; n++) if (exp >= t[n]) lvl = n
  return lvl
}

function bit(arr: Uint8Array, i: number) { return (arr[i >> 3] >> (i & 7)) & 1 }

export function parseSave(file: Uint8Array, db: Db): ParsedSave {
  const sectors = loadSlot(file)
  const s2 = new Reader(sectors[0])
  // sanity: checksum of sector 0
  // SaveBlock2 is 0xF24 bytes in FRLG; accept the RS/E size too and never hard-fail on it
  const ck = s2.u16(0xff6)
  if (sectorChecksum(sectors[0], 0xf24) !== ck && sectorChecksum(sectors[0], 3884) !== ck) console.warn('sector 0 checksum mismatch; continuing')
  const gameCode = s2.u32(0xac)
  if (gameCode !== 1) throw new Error(gameCode === 0 ? 'this looks like a Ruby/Sapphire save' : 'this does not look like a FireRed/LeafGreen save')
  const playerName = decodeText(s2.slice(0, 8))
  const trainerId = s2.u16(0x0a), secretId = s2.u16(0x0c)
  const playTime = `${s2.u16(0x0e)}h ${String(s2.u8(0x10)).padStart(2, '0')}m`
  const secKey = s2.u32(0xf20)
  const owned = s2.slice(0x28, 52), seenB = s2.slice(0x5c, 52)
  const seen: number[] = [], caught: number[] = []
  for (let n = 1; n <= 386; n++) { if (bit(owned, n - 1)) caught.push(n); if (bit(seenB, n - 1)) seen.push(n) }

  // SaveBlock1 = sectors 1..4 concatenated (0xF80 each)
  const sb1 = new Uint8Array(4 * SECTOR_DATA)
  for (let i = 0; i < 4; i++) sb1.set(sectors[1 + i].subarray(0, SECTOR_DATA), i * SECTOR_DATA)
  const s1 = new Reader(sb1)
  const partyCount = Math.min(6, s1.u8(0x34))
  const mons: OwnedMon[] = []
  for (let i = 0; i < partyCount; i++) { const m = decodeMon(db, sb1.subarray(0x38 + i * 100, 0x38 + (i + 1) * 100), true, trainerId, secretId, true); if (m) mons.push(m) }
  const money = (s1.u32(0x290) ^ secKey) >>> 0
  const badges: boolean[] = []
  const flagBytes = sb1.subarray(0xee0)
  for (let i = 0; i < 8; i++) badges.push(!!bit(flagBytes, 0x820 + i))
  const flags = new Set<number>()
  const flagsCount = db.meta.flagsCount ?? 0x900
  for (let f = 0; f < flagsCount; f++) if (bit(flagBytes, f)) flags.add(f)
  const bag: { item: number; qty: number }[] = []
  const keyItems: number[] = []
  const pockets: [number, number][] = [[0x310, 42], [0x3b8, 30], [0x430, 13], [0x464, 58], [0x54c, 43]]
  for (const [off, n] of pockets) for (let i = 0; i < n; i++) {
    const item = s1.u16(off + i * 4), qty = (s1.u16(off + i * 4 + 2) ^ (secKey & 0xffff)) & 0xffff
    if (item && qty && db.itemById.has(item)) { bag.push({ item, qty }); if (db.itemById.get(item)!.keyItem || db.itemById.get(item)!.move) keyItems.push(item) }
  }
  // PC storage = sectors 5..13 concatenated; boxes start at +4, 14 boxes × 30 × 80 bytes
  const pc = new Uint8Array(9 * SECTOR_DATA)
  for (let i = 0; i < 9; i++) pc.set(sectors[5 + i].subarray(0, SECTOR_DATA), i * SECTOR_DATA)
  for (let b = 0; b < 14; b++) for (let i = 0; i < 30; i++) {
    const off = 4 + (b * 30 + i) * 80
    const m = decodeMon(db, pc.subarray(off, off + 80), false, trainerId, secretId, false)
    if (m) mons.push(m)
  }
  // starter guess: first Kanto starter line owned by this trainer in the party/boxes
  const line = (s: number) => [s, s + 1, s + 2]
  let starter: ParsedSave['starter'] = null
  for (const s of [1, 4, 7] as const) if (mons.some((m) => line(s).includes(m.species))) { starter = s; break }
  return { playerName, trainerId, secretId, playTime, money, badges, seen, caught, mons, keyItems, bag, starter, flags }
}

export interface StoryProgress {
  /** app flag names (item balls / hidden items) that the save has collected */
  flags: string[]
  /** trainer ids the save has beaten */
  beaten: number[]
  /** walkthrough step ids inferred as done */
  steps: string[]
  currentChapter: number
}

/** Map raw save flags onto the app's progress model: collected items, beaten trainers, and walkthrough steps. */
export function inferStoryProgress(save: ParsedSave, db: Db): StoryProgress {
  const names = db.meta.flags ?? {}
  const has = (name: string) => { const id = names[name]; return id !== undefined && save.flags.has(id) }
  const start = db.meta.trainerFlagsStart ?? 0x500
  const beaten = db.trainers.filter((t) => save.flags.has(start + t.id)).map((t) => t.id)
  const beatenSet = new Set(beaten)
  // Item-ball flags are reliable. Hidden-item flags are NOT: FireRed pre-sets the flags of respawning hidden
  // items (berries, pearls, shards) on maps you have never visited, so only trust them on maps with other evidence.
  const flags: string[] = []
  const visited = new Set<string>()
  for (const l of db.locations) {
    let seen = l.trainers.some((t) => beatenSet.has(t))
    for (const b of l.items) if (b.flag && has(b.flag)) { flags.push(b.flag); seen = true }
    if (seen) visited.add(l.id)
  }
  for (const l of db.locations) if (visited.has(l.id)) for (const b of l.hiddenItems) if (b.flag && has(b.flag)) flags.push(b.flag)
  const hiddenFlags = new Set(db.locations.flatMap((l) => l.hiddenItems.map((b) => b.flag)))
  const flagSet = new Set(flags)
  const gotFlagNames = Object.keys(names).filter((n) => n.startsWith('FLAG_GOT_'))
  const gotItem = (itemId: number) => {
    const key = db.itemById.get(itemId)?.key.replace('ITEM_', '')
    if (!key) return false
    return gotFlagNames.some((n) => new RegExp(`FLAG_GOT_${key}(_|$)`).test(n) && has(n))
  }
  const gotPokemon = (dex: number) => {
    const key = db.pokemonById.get(dex)?.key.replace('SPECIES_', '')
    if (!key) return false
    return gotFlagNames.some((n) => new RegExp(`FLAG_GOT_${key}(_|$)`).test(n) && has(n))
  }
  const steps: string[] = []
  let lastDoneChapter = 0
  for (const c of db.chapters) {
    const strongIdx: number[] = []
    const verified: string[] = []
    const verifiable = new Set<string>()
    c.steps.forEach((s, i) => {
      const isHidden = !!s.flag && hiddenFlags.has(s.flag)
      const canVerify = isHidden || !!s.flag || !!s.trainers?.length || !!s.battleGroup || !!s.badge
      if (canVerify) verifiable.add(s.id)
      let done = false
      if (isHidden) done = flagSet.has(s.flag!)
      else if (s.flag && has(s.flag)) done = true
      else if (s.trainers?.length && s.trainers.every((t) => beatenSet.has(t))) done = true
      else if (s.battleGroup && db.trainers.some((t) => t.battleGroup === s.battleGroup && beatenSet.has(t.id))) done = true
      else if (s.badge && save.badges[s.badge - 1]) done = true
      else if (s.kind === 'gift' && s.items?.some(gotItem)) done = true
      else if (s.kind === 'gift' && s.pokemon?.some(gotPokemon)) done = true
      if (done) { verified.push(s.id); if (!isHidden) strongIdx.push(i) }
    })
    if (strongIdx.length) lastDoneChapter = c.n
    // Verifiable steps (trainers, item balls, hidden items, badges) are ticked only on direct evidence.
    // Plain story/tip-style steps before the last verified step are assumed done.
    const upto = strongIdx.length ? Math.max(...strongIdx) : -1
    c.steps.forEach((s, i) => { if (i <= upto && s.kind !== 'tip' && !verifiable.has(s.id)) steps.push(s.id) })
    steps.push(...verified)
  }
  // in chapters before the furthest one with confirmed progress, the unverifiable story steps are complete
  const stepSet = new Set(steps)
  for (const c of db.chapters) if (c.n < lastDoneChapter) for (const s of c.steps) {
    const canVerify = !!s.flag || !!s.trainers?.length || !!s.battleGroup || !!s.badge
    if (s.kind !== 'tip' && !canVerify && !stepSet.has(s.id)) { steps.push(s.id); stepSet.add(s.id) }
  }
  return { flags, beaten, steps, currentChapter: Math.max(1, lastDoneChapter) }
}
