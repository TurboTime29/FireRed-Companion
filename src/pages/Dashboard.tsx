import { Link } from 'react-router-dom'
import { getDb } from '../data/db'
import { useParty, useProgress } from '../store/progress'
import { chapterProgress, currentChapter, monAlerts, nextGymLeader, nextStep, readiness } from '../lib/selectors'
import { KindChip, PageTitle, Section, Sprite, TypeBadge } from '../components/ui'
import { EncounterCard, useEncounters } from '../components/EncounterCard'

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
  return (
    <div>
      <PageTitle sub={prog.playerName ? `Trainer ${prog.playerName}` : 'Pokémon FireRed companion'}>Dashboard</PageTitle>

      <Section title="What next" right={<Link className="text-xs link" to={`/guide/${chapter.id}`}>open chapter →</Link>}>
        <div className="text-xs text-stone-500">Chapter {chapter.n} · {chapter.title} · {cp.done}/{cp.total}</div>
        {step ? (
          <div className="mt-1 text-base">
            {step.text}<KindChip kind={step.kind} />
            {step.map && <div className="text-xs text-stone-500">📍 {db.locationById.get(step.map)?.name}</div>}
          </div>
        ) : <div className="mt-1">Chapter complete. {db.chapters.find((c) => c.n === chapter.n + 1) ? <Link className="link" to={`/guide/${db.chapters.find((c) => c.n === chapter.n + 1)!.id}`}>Start the next one →</Link> : 'You finished the guide!'}</div>}
        {areaItems.length > 0 && <div className="mt-2 text-xs text-stone-500">{areaItems.length} item{areaItems.length > 1 ? 's' : ''} still to collect in this chapter's areas{areaItems.some((x) => x.hidden) ? ` (${areaItems.filter((x) => x.hidden).length} hidden)` : ''}.</div>}
      </Section>

      <div className="grid gap-3 md:grid-cols-2">
        <Section title="Badges & Dex">
          <div className="mb-2 flex gap-1">{prog.badges.map((b, i) => <img key={i} src={`${import.meta.env.BASE_URL}sprites/badges/${i + 1}.png`} className={`h-7 w-7 ${b ? '' : 'opacity-25 grayscale'}`} alt="" />)}</div>
          <div className="text-sm">Kanto Dex: <b>{kanto}</b>/151 caught{kanto < 60 && <span className="text-stone-500"> · {60 - kanto} more for the National Dex</span>} · <Link className="link" to="/dex">Pokédex</Link></div>
          {leader && r && (
            <div className="mt-2 text-sm">
              Next gym: <Link className="link" to={`/battle?t=${leader.id}`}>{leader.name}</Link> <span className="flex-wrap">{leader.party.map((m, i) => <Sprite key={i} id={m.species} size={24} className="inline" />)}</span>
              <span className={`chip ml-1 ${r.verdict === 'strong' ? 'bg-emerald-600 text-white' : r.verdict === 'ok' ? 'bg-amber-500 text-white' : r.verdict === 'risky' ? 'bg-red-600 text-white' : 'bg-stone-300 dark:bg-stone-700'}`}>{r.verdict}</span>
              <div className="text-xs text-stone-500">{r.note}</div>
            </div>
          )}
        </Section>
        <Section title="Party" right={<Link className="text-xs link" to="/team">edit →</Link>}>
          {party.length === 0 && <p className="text-sm text-stone-500"><Link className="link" to="/team">Add your Pokémon</Link> to unlock battle advice.</p>}
          {party.map((m) => {
            const p = db.pokemonById.get(m.species)!
            const alerts = monAlerts(db, m).filter((a) => a.startsWith('Ready') || a.includes('more)') && Number(a.match(/\((\d+) more/)?.[1]) <= 3 || a.startsWith('Learns'))
            return (
              <div key={m.uid} className="flex items-center gap-2 py-0.5 text-sm">
                <Sprite id={m.species} size={32} />
                <span className="font-medium">{m.nickname || p.name}</span><span className="text-stone-500">Lv.{m.level}</span>
                {p.types.map((t) => <TypeBadge key={t} type={t} small />)}
                {alerts.length > 0 && <span className="ml-auto truncate text-xs text-amber-700 dark:text-amber-400">{alerts[0]}</span>}
              </div>
            )
          })}
        </Section>
      </div>

      {nextEncounters.length > 0 && (
        <Section title="Next one-time encounters" right={<Link className="text-xs link" to="/encounters">all →</Link>}>
          <div className="space-y-2">{nextEncounters.map((x) => <EncounterCard key={x.step.id} {...x} compact />)}</div>
        </Section>
      )}
      {missables.length > 0 && (
        <Section title="Don't miss" right={<Link className="text-xs link" to="/missables">all →</Link>}>
          {missables.map(({ c, s }) => <div key={s.id} className="text-sm">⚠ <Link className="link" to={`/guide/${c.id}`}>Ch.{c.n}</Link>: {s.text}</div>)}
        </Section>
      )}
      <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
        {[['/locations', '🗺 Locations'], ['/trainers', '⚔ Trainers'], ['/tms', '💿 TMs & HMs'], ['/types', '🧭 Type chart'], ['/moves', '📜 Moves'], ['/items', '🎒 Items'], ['/trades', '🔁 Trades'], ['/settings', '⚙ Settings & sync']].map(([to, label]) => <Link key={to} to={to} className="card p-2 text-center hover:bg-stone-50 dark:hover:bg-stone-800">{label}</Link>)}
      </div>
    </div>
  )
}
