import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { getDb } from '../data/db'
import type { Step } from '../data/types'
import { useParty, useProgress } from '../store/progress'
import { chapterProgress, readiness, trainersForGroup } from '../lib/selectors'
import { Check, Empty, ItemLink, LocationLink, PageTitle, PokemonLink, Section, Sprite } from '../components/ui'
import { EncounterCard } from '../components/EncounterCard'

function StepText({ s }: { s: Step }) {
  const db = getDb()
  return (
    <>
      {s.text}
      {s.pokemon?.map((p) => <span key={p} className="ml-1 inline-flex align-middle"><PokemonLink id={p} /></span>)}
      {s.items && s.kind !== 'item' && s.kind !== 'hidden' && s.items.map((i) => <span key={i} className="ml-1"><ItemLink id={i} /></span>)}
      {s.hm && <span className="ml-1 text-xs text-stone-500">(HM{String(s.hm).padStart(2, '0')})</span>}
      {s.badge && <img src={`${import.meta.env.BASE_URL}sprites/badges/${s.badge}.png`} className="ml-1 inline h-5 w-5 align-middle" alt="" />}
      {s.trainers && s.trainers.length > 0 && s.kind !== 'battle' && s.trainers.map((t) => { const tr = db.trainerById.get(t); return tr ? <Link key={t} to={`/trainers/${t}`} className="ml-1 text-xs link">team →</Link> : null })}
    </>
  )
}

export default function ChapterPage() {
  const db = getDb()
  const id = useParams().id!
  const c = db.chapters.find((x) => x.id === id)
  const steps = useProgress((s) => s.steps)
  const toggleStep = useProgress((s) => s.toggleStep)
  const setFlag = useProgress((s) => s.setFlag)
  const setBeaten = useProgress((s) => s.setBeaten)
  const setBadge = useProgress((s) => s.setBadge)
  const setChapter = useProgress((s) => s.setChapter)
  const starter = useProgress((s) => s.starter)
  const party = useParty()
  const [filter, setFilter] = useState<'all' | 'todo' | 'story'>('all')
  const [showNotes, setShowNotes] = useState(false)
  const guide = useMemo(() => c ? db.guide.find((g) => g.part === c.guidePart) : undefined, [db, c])
  if (!c) return <Empty>Unknown chapter.</Empty>
  const p = chapterProgress(c, steps)
  const prev = db.chapters.find((x) => x.n === c.n - 1), next = db.chapters.find((x) => x.n === c.n + 1)
  const visible = c.steps.filter((s) => filter === 'all' || (filter === 'todo' && !steps[s.id]) || (filter === 'story' && ['story', 'boss', 'gift', 'missable', 'trade'].includes(s.kind)))
  const bosses = c.steps.filter((s) => s.kind === 'boss' && (s.trainers?.length || s.battleGroup))
  const done = (s: Step, v: boolean) => {
    toggleStep(s.id, v)
    if (s.flag) setFlag(s.flag, v)
    s.trainers?.forEach((t) => setBeaten(t, v))
    if (s.battleGroup) trainersForGroup(db, s.battleGroup, starter).forEach((t) => setBeaten(t.id, v))
    if (s.badge && v) setBadge(s.badge - 1, true)
  }
  let lastMap = ''
  return (
    <div>
      <div className="mb-2 flex justify-between text-sm">{prev ? <Link className="link" to={`/guide/${prev.id}`}>← Ch.{prev.n} {prev.title}</Link> : <span />}{next ? <Link className="link" to={`/guide/${next.id}`}>Ch.{next.n} {next.title} →</Link> : <span />}</div>
      <PageTitle sub={<>{c.subtitle} · {p.done}/{p.total} done</>} right={<button className="btn-ghost text-xs" onClick={() => setChapter(c.n)}>Set as current</button>}>Chapter {c.n}: {c.title}</PageTitle>
      <div className="mb-2 flex flex-wrap gap-1 text-xs">{c.maps.map((m) => <LocationLink key={m} id={m} className="chip bg-stone-200 no-underline dark:bg-stone-800" />)}</div>

      {c.steps.some((s) => s.encounter && s.encounter.kind !== 'wild') && (
        <Section title="Save before these" right={<Link className="text-xs link" to="/encounters">all encounters →</Link>}>
          <div className="space-y-2">{c.steps.filter((s) => s.encounter && s.encounter.kind !== 'wild').map((s) => <EncounterCard key={s.id} chapter={c} step={s} done={!!steps[s.id]} compact />)}</div>
        </Section>
      )}
      {bosses.length > 0 && (
        <Section title="Boss check">
          {bosses.map((b) => {
            const ts = b.battleGroup ? trainersForGroup(db, b.battleGroup, starter) : b.trainers!.map((t) => db.trainerById.get(t)!)
            return ts.slice(0, 1).map((t) => {
              const r = readiness(db, party, t)
              return (
                <div key={t.id} className="flex flex-wrap items-center gap-2 py-1 text-sm">
                  <Link to={`/battle?t=${t.id}`} className="font-medium link">{t.class} {t.name}</Link>
                  <span className="flex gap-0.5">{t.party.map((m, i) => <Sprite key={i} id={m.species} size={26} />)}</span>
                  <span className={`chip ${r.verdict === 'strong' ? 'bg-emerald-600 text-white' : r.verdict === 'ok' ? 'bg-amber-500 text-white' : r.verdict === 'risky' ? 'bg-red-600 text-white' : 'bg-stone-300 dark:bg-stone-700'}`}>{r.verdict}</span>
                  <span className="text-xs text-stone-500">{r.note}</span>
                </div>
              )
            })
          })}
        </Section>
      )}

      <Section title="Steps" right={<div className="flex gap-1 text-xs">{(['all', 'todo', 'story'] as const).map((f) => <button key={f} onClick={() => setFilter(f)} className={`rounded px-2 py-0.5 ${filter === f ? 'bg-red-700 text-white' : 'bg-stone-200 dark:bg-stone-800'}`}>{f}</button>)}</div>}>
        {visible.map((s) => {
          const header = s.map && s.map !== lastMap ? s.map : null
          if (s.map) lastMap = s.map
          return (
            <div key={s.id}>
              {header && <div className="mt-3 mb-1 border-b border-stone-200 pb-0.5 text-xs font-semibold uppercase tracking-wide text-stone-500 dark:border-stone-800"><LocationLink id={header} /></div>}
              <Check checked={!!steps[s.id]} onChange={(v) => done(s, v)} label={<StepText s={s} />} kind={s.kind === 'story' ? undefined : s.kind} sub={s.encounter && s.encounter.kind !== 'wild' ? <span className="font-medium text-red-700 dark:text-red-400">💾 {s.encounter.savePoint}</span> : s.where} />
            </div>
          )
        })}
        {visible.length === 0 && <Empty>All done here!</Empty>}
      </Section>

      {guide && (
        <Section title="Area notes" right={<button className="btn-ghost text-xs" onClick={() => setShowNotes(!showNotes)}>{showNotes ? 'Hide' : 'Show'}</button>}>
          {showNotes ? (
            <div className="space-y-3 text-sm">
              {guide.sections.filter((s) => s.prose.length).map((s) => (
                <div key={s.id}>
                  <div className={`font-semibold ${s.level === 2 ? 'text-base' : ''}`}>{s.heading}</div>
                  {s.prose.map((t, i) => <p key={i} className="mb-1 text-stone-700 dark:text-stone-300">{t}</p>)}
                </div>
              ))}
              <p className="text-xs text-stone-400">Adapted from the Bulbapedia walkthrough, part {guide.part} (CC BY-NC-SA 2.5).</p>
            </div>
          ) : <p className="text-xs text-stone-500">Full prose for this part of the game, if you want more detail than the checklist.</p>}
        </Section>
      )}
      {next && p.done >= p.total && <Link to={`/guide/${next.id}`} className="btn-primary w-full">Continue to Chapter {next.n}: {next.title} →</Link>}
    </div>
  )
}
