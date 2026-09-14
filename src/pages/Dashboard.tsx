import { Link } from 'react-router-dom'
import type { CSSProperties } from 'react'
import { getDb } from '../data/db'
import { useParty, useProgress } from '../store/progress'
import { chapterProgress, currentChapter, monAlerts, nextGymLeader, nextStep, readiness } from '../lib/selectors'
import { KindChip, PageTitle, Progress, Section, Sprite, TypeBadge, VerdictChip } from '../components/ui'
import { EncounterCard, useEncounters } from '../components/EncounterCard'

const base = import.meta.env.BASE_URL

export default function Dashboard() {
  const db = getDb()
  const prog = useProgress()
  const party = useParty()
  const chapter = currentChapter(db, prog)
  const step = nextStep(chapter, prog.steps)
  const cp = chapterProgress(chapter, prog.steps)
  const leader = nextGymLeader(db, prog.badges)
  const r = leader ? readiness(db, party, leader) : null
  const kanto = prog.caught.filter((i) => i <= 151).length
  const encounters = useEncounters()
  const nextEncounters = encounters.filter((x) => !x.done && x.step.encounter!.kind !== 'wild' && x.chapter.n >= chapter.n && !x.step.encounter!.savePoint.startsWith('Event') && !x.step.encounter!.savePoint.startsWith('Cannot')).slice(0, 2)
  const missables = db.chapters.flatMap((c) => c.steps.filter((s) => s.kind === 'missable' && !prog.steps[s.id]).map((s) => ({ c, s }))).filter(({ c }) => c.n <= chapter.n).slice(0, 4)
  const areaItems = chapter.maps.flatMap((m) => { const l = db.locationById.get(m)!; return [...l.items.map((b) => ({ l, item: b.item, flag: b.flag, hidden: false })), ...l.hiddenItems.map((b) => ({ l, item: b.item, flag: b.flag, hidden: true }))] }).filter((x) => !prog.flags[x.flag])
  const nextChapter = db.chapters.find((c) => c.n === chapter.n + 1)
  const badgeCount = prog.badges.filter(Boolean).length
  return (
    <div className="stagger">
      <div style={{ '--i': 0 } as CSSProperties}>
        <PageTitle hero sub={prog.playerName ? <>Trainer <b>{prog.playerName}</b> · {badgeCount} badge{badgeCount === 1 ? '' : 's'} · {kanto}/151 caught</> : 'Pokémon FireRed companion'}>{prog.playerName ? `Welcome back, ${prog.playerName}` : 'Dashboard'}</PageTitle>
      </div>

      {/* What next: hero card */}
      <Link to={`/guide/${chapter.id}`} style={{ '--i': 1 } as CSSProperties} className="card card-hover relative mb-3 block overflow-hidden bg-gradient-to-br from-dex-500 via-dex-600 to-dex-800 p-4 text-white">
        <img src={`${base}sprites/items/poke-ball.png`} className="sprite pointer-events-none absolute -right-5 -top-5 h-28 w-28 opacity-15" alt="" />
        <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-white/80">What next · Chapter {chapter.n}</div>
        <div className="font-display text-lg font-bold">{chapter.title}</div>
        {step ? (
          <div className="mt-2 text-base leading-snug">
            {step.text}<KindChip kind={step.kind} />
            {step.map && <div className="mt-1 text-xs text-white/80">📍 {db.locationById.get(step.map)?.name}</div>}
          </div>
        ) : <div className="mt-2">Chapter complete. {nextChapter ? <span className="underline">Start Chapter {nextChapter.n}: {nextChapter.title} →</span> : 'You finished the guide!'}</div>}
        <div className="mt-3 flex items-center gap-2 text-xs text-white/90">
          <Progress pct={cp.pct} className="!bg-white/25" color="bg-white" />
          <span className="shrink-0 tabular-nums">{cp.done}/{cp.total}</span>
        </div>
        {areaItems.length > 0 && <div className="mt-1.5 text-xs text-white/80">{areaItems.length} item{areaItems.length > 1 ? 's' : ''} still to collect in this chapter's areas{areaItems.some((x) => x.hidden) ? ` (${areaItems.filter((x) => x.hidden).length} hidden)` : ''}.</div>}
      </Link>

      <div className="grid gap-3 md:grid-cols-2">
        <Section title="Badges & Dex" className="!mb-0" >
          <div className="mb-2 flex gap-1.5">{prog.badges.map((b, i) => <img key={i} src={`${base}sprites/badges/${i + 1}.png`} className={`h-8 w-8 transition-all ${b ? 'drop-shadow' : 'opacity-25 grayscale'}`} alt="" title={`Badge ${i + 1}`} />)}</div>
          <div className="flex items-center gap-2 text-sm"><span className="font-display text-xl font-bold">{kanto}</span><span className="text-stone-500">/151 Kanto caught</span><Link className="link ml-auto text-xs" to="/dex">Pokédex →</Link></div>
          <Progress pct={(kanto / 151) * 100} className="mt-1" color="bg-emerald-500" />
          {kanto < 60 && <div className="mt-1 text-xs text-stone-500">{60 - kanto} more for the National Dex</div>}
          {leader && r && (
            <div className="mt-3 rounded-xl bg-stone-50 p-2 text-sm dark:bg-stone-800/60">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-stone-500">Next gym:</span> <Link className="link font-semibold" to={`/battle?t=${leader.id}`}>{leader.name}</Link>
                <span className="hover-bounce flex">{leader.party.map((m, i) => <Sprite key={i} id={m.species} size={28} />)}</span>
                <VerdictChip verdict={r.verdict} />
              </div>
              <div className="mt-0.5 text-xs text-stone-500">{r.note}</div>
            </div>
          )}
        </Section>
        <Section title="Party" className="!mb-0" right={<Link className="text-xs link" to="/team">edit →</Link>}>
          {party.length === 0 && <p className="text-sm text-stone-500"><Link className="link" to="/team">Add your Pokémon</Link> to unlock battle advice.</p>}
          {party.map((m) => {
            const p = db.pokemonById.get(m.species)!
            const alerts = monAlerts(db, m).filter((a) => a.startsWith('Ready') || a.includes('more)') && Number(a.match(/\((\d+) more/)?.[1]) <= 3 || a.startsWith('Learns'))
            return (
              <Link to="/team" key={m.uid} className="hover-bounce flex items-center gap-2 rounded-lg px-1 py-1 text-sm transition-colors hover:bg-stone-50 dark:hover:bg-stone-800/60">
                <Sprite id={m.species} size={36} shiny={m.shiny ? true : undefined} />
                <span className="font-medium">{m.nickname || p.name}</span><span className="text-stone-500">Lv.{m.level}</span>
                {p.types.map((t) => <TypeBadge key={t} type={t} small />)}
                {alerts.length > 0 && <span className="ml-auto truncate text-xs text-amber-700 dark:text-amber-400">{alerts[0]}</span>}
              </Link>
            )
          })}
        </Section>
      </div>

      {nextEncounters.length > 0 && (
        <Section title="Next one-time encounters" className="mt-3" right={<Link className="text-xs link" to="/encounters">all →</Link>}>
          <div className="space-y-2">{nextEncounters.map((x) => <EncounterCard key={x.step.id} {...x} compact />)}</div>
        </Section>
      )}
      {missables.length > 0 && (
        <Section title="Don't miss" className={nextEncounters.length ? '' : 'mt-3'} right={<Link className="text-xs link" to="/missables">all →</Link>}>
          {missables.map(({ c, s }) => <div key={s.id} className="py-0.5 text-sm">⚠ <Link className="link" to={`/guide/${c.id}`}>Ch.{c.n}</Link>: {s.text}</div>)}
        </Section>
      )}
      <div className={`grid grid-cols-2 gap-2 text-sm sm:grid-cols-4 ${nextEncounters.length || missables.length ? '' : 'mt-3'}`}>
        {[['/locations', '🗺', 'Locations'], ['/trainers', '⚔', 'Trainers'], ['/tms', '💿', 'TMs & HMs'], ['/types', '🧭', 'Type chart'], ['/moves', '📜', 'Moves'], ['/items', '🎒', 'Items'], ['/encounters', '⭐', 'Legendaries'], ['/settings', '⚙', 'Settings']].map(([to, icon, label], i) => (
          <Link key={to} to={to} style={{ '--i': i + 4 } as CSSProperties} className="card card-hover flex items-center gap-2 p-2.5 font-medium"><span className="text-lg">{icon}</span>{label}</Link>
        ))}
      </div>
    </div>
  )
}
