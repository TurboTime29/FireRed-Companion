import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { getDb } from '../data/db'
import type { Step } from '../data/types'
import { useParty, useProgress } from '../store/progress'
import { chapterProgress, readiness, trainersForGroup } from '../lib/selectors'
import { Check, Empty, ItemLink, LocationLink, PageTitle, PokemonLink, Progress, Section, Seg, Sprite, VerdictChip } from '../components/ui'
import { EncounterCard } from '../components/EncounterCard'
import { LocationBlock } from '../components/LocationBlock'

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
  const chapterN = useProgress((s) => s.currentChapter)
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
  const isCurrent = chapterN === c.n
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
      <div className="mb-3 flex items-center justify-between gap-2 text-sm">
        <Link className="btn-ghost text-xs" to="/guide">📖 All chapters</Link>
        <div className="flex gap-1">
          {prev && <Link className="btn-ghost text-xs" to={`/guide/${prev.id}`} title={prev.title}>‹ Ch.{prev.n}</Link>}
          {next && <Link className="btn-ghost text-xs" to={`/guide/${next.id}`} title={next.title}>Ch.{next.n} ›</Link>}
        </div>
      </div>
      <PageTitle hero sub={c.subtitle} right={<button className={`btn ${isCurrent ? 'bg-dex-100 text-dex-700 dark:bg-dex-900/60 dark:text-red-300' : 'btn-ghost'} text-xs`} onClick={() => setChapter(c.n)}>{isCurrent ? '● Current chapter' : 'Set as current'}</button>}>Chapter {c.n}: {c.title}</PageTitle>
      <div className="mb-3 flex items-center gap-2 text-xs text-stone-500">
        <Progress pct={p.pct} color={p.done >= p.total ? 'bg-emerald-500' : 'bg-dex-500'} />
        <span className="shrink-0 tabular-nums">{p.done}/{p.total} done</span>
      </div>
      <div className="mb-3 flex flex-wrap gap-1 text-xs">{c.maps.map((m) => <LocationLink key={m} id={m} className="chip-btn no-underline hover:no-underline" />)}</div>

      {c.steps.some((s) => s.encounter && s.encounter.kind !== 'wild') && (
        <Section title="💾 Save before these" right={<Link className="text-xs link" to="/encounters">all encounters →</Link>}>
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
                  <Link to={`/battle?t=${t.id}`} className="font-semibold link">{t.class} {t.name}</Link>
                  <span className="hover-bounce flex gap-0.5">{t.party.map((m, i) => <Sprite key={i} id={m.species} size={28} />)}</span>
                  <VerdictChip verdict={r.verdict} />
                  <span className="text-xs text-stone-500">{r.note}</span>
                </div>
              )
            })
          })}
        </Section>
      )}

      <Section title="Steps" right={<Seg value={filter} onChange={(v) => setFilter(v)} options={[{ value: 'all', label: 'All' }, { value: 'todo', label: 'To do' }, { value: 'story', label: 'Story' }]} />}>
        <div key={filter} className="fade-up">
          {visible.map((s) => {
            const header = s.map && s.map !== lastMap ? s.map : null
            if (s.map) lastMap = s.map
            return (
              <div key={s.id}>
                {header && db.locationById.get(header) && <LocationBlock loc={db.locationById.get(header)!} />}
                <Check checked={!!steps[s.id]} onChange={(v) => done(s, v)} label={<StepText s={s} />} kind={s.kind === 'story' ? undefined : s.kind} sub={s.encounter && s.encounter.kind !== 'wild' ? <span className="font-medium text-dex-600 dark:text-red-400">💾 {s.encounter.savePoint}</span> : s.where} />
              </div>
            )
          })}
          {visible.length === 0 && <Empty>All done here!</Empty>}
        </div>
      </Section>

      {guide && (
        <Section title="Area notes" right={<button className="btn-ghost text-xs" onClick={() => setShowNotes(!showNotes)}>{showNotes ? 'Hide' : 'Show'}</button>}>
          {showNotes ? (
            <div className="fade-up space-y-3 text-sm">
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
      <div className="flex flex-wrap items-center justify-between gap-2">
        {prev ? <Link className="btn-ghost" to={`/guide/${prev.id}`}>‹ Ch.{prev.n} {prev.title}</Link> : <span />}
        {next && (p.done >= p.total ? <Link to={`/guide/${next.id}`} className="btn-primary">Continue to Chapter {next.n}: {next.title} ›</Link> : <Link className="btn-ghost" to={`/guide/${next.id}`}>Ch.{next.n} {next.title} ›</Link>)}
      </div>
    </div>
  )
}
