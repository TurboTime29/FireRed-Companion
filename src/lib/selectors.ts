import type { Db } from '../data/db'
import { GYM_LEADERS } from '../data/db'
import type { Chapter, Move, Pokemon, Trainer, TrainerMon } from '../data/types'
import type { OwnedMon, ProgressDoc } from '../store/progress'
import { calcDamage, calcStats, effectiveness, trainerIv, type Combatant, type DamageResult } from './battle'

/** The rival picks the starter that beats yours. */
export function rivalStarterFor(playerStarter: number | null): number | null {
  if (playerStarter === 1) return 4
  if (playerStarter === 4) return 7
  if (playerStarter === 7) return 1
  return null
}

/** Resolve a battle group (rival-*, champion-*) to the trainer matching the player's starter; falls back to all variants. */
export function trainersForGroup(db: Db, group: string, playerStarter: number | null): Trainer[] {
  const all = db.trainers.filter((t) => t.battleGroup === group)
  const rs = rivalStarterFor(playerStarter)
  if (rs) return all.filter((t) => t.rivalStarter === rs)
  return all
}

export function toCombatant(db: Db, mon: OwnedMon): Combatant {
  const p = db.pokemonById.get(mon.species)!
  return { pokemon: p, level: mon.level, stats: calcStats(p.stats, mon.level, { ivs: mon.ivs, evs: mon.evs, nature: mon.nature }), moves: mon.moves.map((m) => db.moveById.get(m)!).filter(Boolean) }
}

export function trainerMonToCombatant(db: Db, tm: TrainerMon): Combatant {
  const p = db.pokemonById.get(tm.species)!
  const iv = trainerIv(tm.iv)
  return { pokemon: p, level: tm.level, stats: calcStats(p.stats, tm.level, { ivs: { hp: iv, atk: iv, def: iv, spa: iv, spd: iv, spe: iv } }), moves: tm.moves.map((m) => db.moveById.get(m)!).filter(Boolean) }
}

export function wildCombatant(db: Db, p: Pokemon, level: number, moves?: Move[]): Combatant {
  return { pokemon: p, level, stats: calcStats(p.stats, level), moves: moves ?? defaultMoves(p, level).map((m) => db.moveById.get(m)!).filter(Boolean) }
}

export function defaultMoves(p: Pokemon, level: number): number[] {
  const out: number[] = []
  for (const [l, m] of p.levelUp) {
    if (l > level) break
    const i = out.indexOf(m)
    if (i >= 0) out.splice(i, 1)
    out.push(m)
  }
  return out.slice(-4)
}

export interface Matchup {
  attacker: Combatant
  defender: Combatant
  best: DamageResult | null
  results: DamageResult[]
  /** best incoming hit from defender against attacker */
  threat: DamageResult | null
  faster: boolean | null
  score: number
}

export function matchup(db: Db, a: Combatant, d: Combatant): Matchup {
  const results = a.moves.map((m) => calcDamage(db.typechart, a, d, m)).sort((x, y) => y.maxPct - x.maxPct)
  const best = results.find((r) => r.max > 0) ?? null
  const threats = d.moves.map((m) => calcDamage(db.typechart, d, a, m)).sort((x, y) => y.maxPct - x.maxPct)
  const threat = threats.find((r) => r.max > 0) ?? null
  const faster = a.stats.spe === d.stats.spe ? null : a.stats.spe > d.stats.spe
  const out = best ? (best.minPct + best.maxPct) / 2 : 0
  const inc = threat ? (threat.minPct + threat.maxPct) / 2 : 0
  const score = out - inc * 0.8 + (faster ? 8 : faster === null ? 0 : -8)
  return { attacker: a, defender: d, best, results, threat, faster, score }
}

export interface Readiness { trainer: Trainer; rows: { foe: Combatant; ranked: Matchup[] }[]; verdict: 'strong' | 'ok' | 'risky' | 'unknown'; note: string }

export function readiness(db: Db, party: OwnedMon[], trainer: Trainer): Readiness {
  const team = party.map((m) => toCombatant(db, m))
  const rows = trainer.party.map((tm) => {
    const foe = trainerMonToCombatant(db, tm)
    const ranked = team.map((c) => matchup(db, c, foe)).sort((a, b) => b.score - a.score)
    return { foe, ranked }
  })
  if (!team.length) return { trainer, rows, verdict: 'unknown', note: 'Add your party in Team to see a verdict.' }
  const bests = rows.map((r) => r.ranked[0])
  const weak = bests.filter((m) => !m.best || m.best.maxPct < 34).length
  const outLeveled = trainer.party.some((tm) => tm.level > Math.max(...party.map((m) => m.level)) + 4)
  let verdict: Readiness['verdict'] = 'strong'
  let note = 'Your team has a strong answer for every Pokémon.'
  if (weak > 0 || outLeveled) { verdict = 'ok'; note = `${weak ? `${weak} of their Pokémon lack a strong counter.` : ''}${outLeveled ? ' They out-level your best Pokémon.' : ''}`.trim() }
  if (weak >= Math.ceil(rows.length / 2) || bests.some((m) => m.threat && m.threat.minPct >= 100)) { verdict = 'risky'; note = 'Level up or catch a counter first. ' + note }
  return { trainer, rows, verdict, note }
}

export function nextGymLeader(db: Db, badges: boolean[]): Trainer | null {
  const i = badges.findIndex((b) => !b)
  if (i < 0) return null
  return db.trainerByKey.get(GYM_LEADERS[i]) ?? null
}

export function chapterProgress(c: Chapter, steps: Record<string, number>) {
  const total = c.steps.filter((s) => s.kind !== 'tip').length
  const done = c.steps.filter((s) => s.kind !== 'tip' && steps[s.id]).length
  return { total, done, pct: total ? Math.round((done / total) * 100) : 0 }
}

export function currentChapter(db: Db, p: ProgressDoc): Chapter {
  const explicit = db.chapters.find((c) => c.n === p.currentChapter)
  const firstIncomplete = db.chapters.find((c) => chapterProgress(c, p.steps).done < chapterProgress(c, p.steps).total)
  if (explicit && firstIncomplete && explicit.n < firstIncomplete.n) return firstIncomplete
  return explicit ?? firstIncomplete ?? db.chapters[db.chapters.length - 1]
}

export function nextStep(c: Chapter, steps: Record<string, number>) {
  return c.steps.find((s) => !steps[s.id] && s.kind !== 'tip' && s.kind !== 'optional') ?? c.steps.find((s) => !steps[s.id]) ?? null
}

/** Alerts for a party member: upcoming evolution, next moves, trade-only warning. */
export function monAlerts(db: Db, mon: OwnedMon): string[] {
  const p = db.pokemonById.get(mon.species)
  if (!p) return []
  const out: string[] = []
  for (const e of p.evolutions) {
    const to = db.pokemonById.get(e.to)?.name ?? '?'
    if (e.method === 'level' && e.level) out.push(e.level <= mon.level ? `Ready to evolve into ${to} (level up once more)` : `Evolves into ${to} at Lv.${e.level} (${e.level - mon.level} more)`)
    else if (e.method === 'item' && e.item) out.push(`Evolves into ${to} with ${db.itemById.get(e.item)?.name}`)
    else if (e.method === 'trade') out.push(`Evolves into ${to} only by trading`)
    else if (e.method === 'trade_item' && e.item) out.push(`Evolves into ${to} by trading while holding ${db.itemById.get(e.item)?.name}`)
    else if (e.method === 'friendship') out.push(`Evolves into ${to} by friendship (level up when it likes you)`)
  }
  const upcoming = p.levelUp.filter(([l, m]) => l > mon.level && !mon.moves.includes(m)).slice(0, 2)
  for (const [l, m] of upcoming) out.push(`Learns ${db.moveById.get(m)?.name} at Lv.${l}`)
  return out
}

export function typeMatchupSummary(db: Db, types: Pokemon['types']) {
  const weak: string[] = [], resist: string[] = [], immune: string[] = []
  for (const t of db.typechart.types) {
    const m = effectiveness(db.typechart, t, types)
    if (m === 0) immune.push(t); else if (m > 1) weak.push(`${t}${m >= 4 ? ' (4×)' : ''}`); else if (m < 1) resist.push(`${t}${m <= 0.25 ? ' (¼×)' : ''}`)
  }
  return { weak, resist, immune }
}

/** Which of the trainer's team members you have already fought (for rival/champion groups with several variants). */
export function trainerDisplayName(t: Trainer) {
  return t.classKey.startsWith('RIVAL') || t.classKey === 'CHAMPION' ? `Rival ${t.name}` : `${t.class} ${t.name}`
}
