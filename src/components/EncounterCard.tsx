import { Link } from 'react-router-dom'
import { getDb } from '../data/db'
import type { Chapter, Step } from '../data/types'
import { useProgress } from '../store/progress'
import { Sprite, TypeBadge } from './ui'

/** Every step that carries an encounter, in story order, with done state. */
export function useEncounters() {
  const db = getDb()
  const steps = useProgress((s) => s.steps)
  const out: { chapter: Chapter; step: Step; done: boolean }[] = []
  for (const c of db.chapters) for (const s of c.steps) if (s.encounter) out.push({ chapter: c, step: s, done: !!steps[s.id] })
  return out
}

export function EncounterCard({ chapter, step, done, compact }: { chapter: Chapter; step: Step; done: boolean; compact?: boolean }) {
  const db = getDb()
  const e = step.encounter!
  const p = db.pokemonById.get(e.species)!
  const toggleStep = useProgress((s) => s.toggleStep)
  const setFlag = useProgress((s) => s.setFlag)
  const huntable = e.kind !== 'wild' && !e.savePoint.startsWith('Cannot') && !e.savePoint.startsWith('Event')
  const tone = done ? 'border-stone-300 bg-stone-50 opacity-70 dark:border-stone-700 dark:bg-stone-900' : e.legendary ? 'border-amber-400 bg-amber-50 dark:border-amber-600 dark:bg-amber-950/40' : 'border-sky-300 bg-sky-50 dark:border-sky-700 dark:bg-sky-950/40'
  return (
    <div className={`flex gap-3 rounded-xl border-2 p-3 ${tone}`}>
      <Link to={`/dex/${p.id}`} className="shrink-0"><Sprite id={p.id} size={compact ? 48 : 64} /></Link>
      <div className="min-w-0 flex-1 text-sm">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-base font-bold">{e.legendary ? '⭐ ' : ''}{p.name} <span className="font-normal text-stone-500">Lv.{e.level}</span></span>
          {p.types.map((t) => <TypeBadge key={t} type={t} small />)}
          <span className={`chip text-[10px] ${e.kind === 'legendary' ? 'bg-amber-500 text-white' : e.kind === 'gift' ? 'bg-pink-500 text-white' : e.kind === 'static' ? 'bg-violet-500 text-white' : 'bg-stone-400 text-white'}`}>{e.kind === 'legendary' ? 'legendary · one-time' : e.kind === 'static' ? 'one-time' : e.kind}</span>
          {done && <span className="chip bg-emerald-600 text-[10px] text-white">done</span>}
        </div>
        <div className="mt-1 text-xs text-stone-500">Ch.{chapter.n} · {step.map ? <Link className="link" to={`/location/${step.map}`}>{db.locationById.get(step.map)?.name}</Link> : chapter.title} · catch rate {p.catchRate}</div>
        <div className={`mt-1 ${huntable && !done ? 'font-medium text-red-700 dark:text-red-400' : 'text-stone-600 dark:text-stone-300'}`}>💾 {e.savePoint}</div>
        {!compact && <div className="mt-0.5 text-xs text-stone-600 dark:text-stone-300">{e.note}</div>}
        {!compact && (
          <div className="mt-2 flex flex-wrap gap-2">
            <Link to={`/battle?p=${p.id}&lvl=${e.level}`} className="btn-ghost text-xs">Battle plan</Link>
            <Link to={`/catch?p=${p.id}&lvl=${e.level}`} className="btn-ghost text-xs">🎯 Catch odds</Link>
            <button className="btn-ghost text-xs" onClick={() => { toggleStep(step.id, !done); if (step.flag) setFlag(step.flag, !done) }}>{done ? 'Mark not done' : 'Mark done'}</button>
          </div>
        )}
      </div>
    </div>
  )
}
