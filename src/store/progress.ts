import { useMemo } from 'react'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Stats } from '../data/types'

export interface OwnedMon {
  uid: string
  species: number
  nickname?: string
  level: number
  moves: number[]
  item?: number
  nature?: string
  ability?: number
  gender?: 'M' | 'F' | '-'
  shiny?: boolean
  ivs?: Partial<Stats>
  evs?: Partial<Stats>
  /** true = in party, false = in a PC box */
  inParty: boolean
  note?: string
  /** PC box (1-14) and slot (1-30) from the save; party slot for party members */
  box?: number
  slot?: number
  ot?: string
  friendship?: number
}

export interface ItemStack { item: number; qty: number }

export interface ProgressDoc {
  version: 1
  playerName: string
  starter: 1 | 4 | 7 | null
  mons: OwnedMon[]
  badges: boolean[]
  seen: number[]
  caught: number[]
  /** step id -> timestamp */
  steps: Record<string, number>
  /** item/event flag -> timestamp (item balls, hidden items, gifts) */
  flags: Record<string, number>
  /** trainer id -> timestamp */
  beaten: Record<number, number>
  currentChapter: number
  money: number
  keyItems: number[]
  notes: Record<string, string>
  /** bag and PC item snapshots from the last save import */
  bag: ItemStack[]
  pcItems: ItemStack[]
  updatedAt: number
}

export const emptyProgress = (): ProgressDoc => ({
  version: 1, playerName: '', starter: null, mons: [], badges: Array(8).fill(false), seen: [], caught: [], steps: {}, flags: {}, beaten: {},
  currentChapter: 1, money: 3000, keyItems: [], notes: {}, bag: [], pcItems: [], updatedAt: 0,
})

export function isEmptyProgress(d: ProgressDoc): boolean {
  return d.mons.length === 0 && Object.keys(d.steps).length === 0 && Object.keys(d.flags).length === 0 && Object.keys(d.beaten).length === 0 && d.caught.length === 0 && !d.badges.some(Boolean)
}

/** Union of two progress documents: nothing recorded on either device is lost. Scalars come from the newer one. */
export function mergeProgress(a: ProgressDoc, b: ProgressDoc): ProgressDoc {
  const [newer, older] = a.updatedAt >= b.updatedAt ? [a, b] : [b, a]
  const minMap = (x: Record<string, number>, y: Record<string, number>) => {
    const out: Record<string, number> = { ...y }
    for (const [k, v] of Object.entries(x)) out[k] = out[k] ? Math.min(out[k], v) : v
    return out
  }
  const union = (x: number[], y: number[]) => [...new Set([...x, ...y])].sort((p, q) => p - q)
  const mons = new Map<string, OwnedMon>()
  for (const m of older.mons) mons.set(m.uid, m)
  for (const m of newer.mons) mons.set(m.uid, m)
  return {
    version: 1,
    playerName: newer.playerName || older.playerName,
    starter: newer.starter ?? older.starter,
    mons: [...mons.values()],
    badges: Array.from({ length: 8 }, (_, i) => !!(a.badges[i] || b.badges[i])),
    seen: union(a.seen, b.seen),
    caught: union(a.caught, b.caught),
    steps: minMap(a.steps, b.steps),
    flags: minMap(a.flags, b.flags),
    beaten: minMap(a.beaten as Record<string, number>, b.beaten as Record<string, number>) as Record<number, number>,
    currentChapter: Math.max(a.currentChapter, b.currentChapter),
    money: newer.money,
    keyItems: union(a.keyItems, b.keyItems),
    notes: { ...older.notes, ...newer.notes },
    bag: newer.bag?.length ? newer.bag : older.bag ?? [],
    pcItems: newer.pcItems?.length ? newer.pcItems : older.pcItems ?? [],
    updatedAt: Math.max(a.updatedAt, b.updatedAt),
  }
}

interface ProgressState extends ProgressDoc {
  setStarter: (s: 1 | 4 | 7 | null) => void
  setPlayerName: (n: string) => void
  addMon: (m: Omit<OwnedMon, 'uid'>) => string
  updateMon: (uid: string, patch: Partial<OwnedMon>) => void
  removeMon: (uid: string) => void
  setBadge: (i: number, v: boolean) => void
  toggleStep: (id: string, v?: boolean) => void
  setFlag: (flag: string, v?: boolean) => void
  setBeaten: (trainerId: number, v?: boolean) => void
  markSeen: (id: number, v?: boolean) => void
  markCaught: (id: number, v?: boolean) => void
  setChapter: (n: number) => void
  setMoney: (n: number) => void
  setKeyItem: (id: number, v: boolean) => void
  setNote: (key: string, text: string) => void
  replaceAll: (doc: ProgressDoc) => void
  reset: () => void
}

const uid = () => Math.random().toString(36).slice(2, 10)
const touch = { updatedAt: 0 }
const now = () => (touch.updatedAt = Date.now())

function toggleList(list: number[], id: number, v?: boolean): number[] {
  const has = list.includes(id)
  const want = v ?? !has
  if (want && !has) return [...list, id]
  if (!want && has) return list.filter((x) => x !== id)
  return list
}

export const useProgress = create<ProgressState>()(
  persist(
    (set, get) => ({
      ...emptyProgress(),
      setStarter: (starter) => set({ starter, updatedAt: now() }),
      setPlayerName: (playerName) => set({ playerName, updatedAt: now() }),
      addMon: (m) => {
        const id = uid()
        set((s) => ({ mons: [...s.mons, { ...m, uid: id }], caught: toggleList(toggleList(s.caught, m.species, true), m.species, true), seen: toggleList(s.seen, m.species, true), updatedAt: now() }))
        return id
      },
      updateMon: (id, patch) => set((s) => ({ mons: s.mons.map((m) => (m.uid === id ? { ...m, ...patch } : m)), updatedAt: now() })),
      removeMon: (id) => set((s) => ({ mons: s.mons.filter((m) => m.uid !== id), updatedAt: now() })),
      setBadge: (i, v) => set((s) => { const badges = [...s.badges]; badges[i] = v; return { badges, updatedAt: now() } }),
      toggleStep: (id, v) => set((s) => {
        const steps = { ...s.steps }
        const want = v ?? !steps[id]
        if (want) steps[id] = Date.now(); else delete steps[id]
        return { steps, updatedAt: now() }
      }),
      setFlag: (flag, v) => set((s) => {
        const flags = { ...s.flags }
        const want = v ?? !flags[flag]
        if (want) flags[flag] = Date.now(); else delete flags[flag]
        return { flags, updatedAt: now() }
      }),
      setBeaten: (tid, v) => set((s) => {
        const beaten = { ...s.beaten }
        const want = v ?? !beaten[tid]
        if (want) beaten[tid] = Date.now(); else delete beaten[tid]
        return { beaten, updatedAt: now() }
      }),
      markSeen: (id, v) => set((s) => ({ seen: toggleList(s.seen, id, v), updatedAt: now() })),
      markCaught: (id, v) => set((s) => ({ caught: toggleList(s.caught, id, v), seen: v === false ? s.seen : toggleList(s.seen, id, true), updatedAt: now() })),
      setChapter: (currentChapter) => set({ currentChapter, updatedAt: now() }),
      setMoney: (money) => set({ money, updatedAt: now() }),
      setKeyItem: (id, v) => set((s) => ({ keyItems: toggleList(s.keyItems, id, v), updatedAt: now() })),
      setNote: (key, text) => set((s) => ({ notes: { ...s.notes, [key]: text }, updatedAt: now() })),
      replaceAll: (doc) => set({ ...emptyProgress(), ...doc, updatedAt: doc.updatedAt || (isEmptyProgress(doc) ? 0 : now()) }),
      reset: () => set({ ...emptyProgress() }),
      // keep get referenced for type completeness
      ...( { get } as unknown as Record<string, never>),
    }),
    {
      name: 'firered-companion-progress',
      version: 1,
      partialize: (s) => exportProgress(s),
    },
  ),
)

export function exportProgress(s: ProgressDoc): ProgressDoc {
  return {
    version: 1, playerName: s.playerName, starter: s.starter, mons: s.mons, badges: s.badges, seen: s.seen, caught: s.caught, steps: s.steps,
    flags: s.flags, beaten: s.beaten, currentChapter: s.currentChapter, money: s.money, keyItems: s.keyItems, notes: s.notes,
    bag: s.bag ?? [], pcItems: s.pcItems ?? [], updatedAt: s.updatedAt,
  }
}

export function useParty(): OwnedMon[] {
  const mons = useProgress((s) => s.mons)
  return useMemo(() => mons.filter((m) => m.inParty), [mons])
}
