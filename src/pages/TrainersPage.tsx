import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { getDb, GYM_LEADERS } from '../data/db'
import { useProgress } from '../store/progress'
import { trainerDisplayName, trainersForGroup } from '../lib/selectors'
import { PageTitle, Section, Sprite } from '../components/ui'

const GROUPS = [['rival-oaks-lab', 'Rival 1 – Oak’s Lab'], ['rival-route22-early', 'Rival 2 – Route 22'], ['rival-cerulean', 'Rival 3 – Cerulean'], ['rival-ss-anne', 'Rival 4 – S.S. Anne'], ['rival-pokemon-tower', 'Rival 5 – Pokémon Tower'], ['rival-silph', 'Rival 6 – Silph Co.'], ['rival-route22-late', 'Rival 7 – Route 22 (late)'], ['champion-first', 'Champion'], ['champion-rematch', 'Champion (rematch)']]

export default function TrainersPage() {
  const db = getDb()
  const [q, setQ] = useState('')
  const starter = useProgress((s) => s.starter)
  const beaten = useProgress((s) => s.beaten)
  const leaders = GYM_LEADERS.map((k) => db.trainerByKey.get(k)!)
  const e4 = ['TRAINER_ELITE_FOUR_LORELEI', 'TRAINER_ELITE_FOUR_BRUNO', 'TRAINER_ELITE_FOUR_AGATHA', 'TRAINER_ELITE_FOUR_LANCE'].map((k) => db.trainerByKey.get(k)!)
  const e4r = ['TRAINER_ELITE_FOUR_LORELEI_2', 'TRAINER_ELITE_FOUR_BRUNO_2', 'TRAINER_ELITE_FOUR_AGATHA_2', 'TRAINER_ELITE_FOUR_LANCE_2'].map((k) => db.trainerByKey.get(k)!)
  const giovanni = ['TRAINER_BOSS_GIOVANNI', 'TRAINER_BOSS_GIOVANNI_2'].map((k) => db.trainerByKey.get(k)!)
  const results = useMemo(() => q ? db.trainers.filter((t) => t.rematchOf === undefined && (`${t.class} ${t.name}`.toLowerCase().includes(q.toLowerCase()) || t.maps.some((m) => db.locationById.get(m)?.name.toLowerCase().includes(q.toLowerCase())))).slice(0, 60) : [], [db, q])
  const Row = ({ t }: { t: typeof leaders[number] }) => (
    <Link to={`/trainers/${t.id}`} className={`flex items-center gap-2 rounded-lg px-2 py-1 hover:bg-stone-100 dark:hover:bg-stone-800 ${beaten[t.id] ? 'opacity-60' : ''}`}>
      <span className="w-44 shrink-0 text-sm font-medium">{beaten[t.id] ? '✓ ' : ''}{trainerDisplayName(t)}</span>
      <span className="flex flex-wrap gap-0.5">{t.party.map((m, i) => <Sprite key={i} id={m.species} size={28} />)}</span>
      <span className="ml-auto text-xs text-stone-500">Lv.{Math.max(...t.party.map((m) => m.level))}</span>
    </Link>
  )
  return (
    <div>
      <PageTitle sub="Gym leaders, rival, Elite Four and every route trainer">Trainers</PageTitle>
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name or location (e.g. Route 3, Misty)" className="input mb-3" />
      {q && <Section title={`Results (${results.length})`}>{results.map((t) => <Row key={t.id} t={t} />)}</Section>}
      <Section title="Gym Leaders">{leaders.map((t) => <Row key={t.id} t={t} />)}</Section>
      <Section title={<>Rival {starter ? '' : <span className="normal-case text-stone-400">(set your starter in Team to see the right team)</span>}</>}>
        {GROUPS.map(([g, label]) => { const ts = trainersForGroup(db, g, starter); return ts.map((t) => <div key={t.id} className="flex items-center gap-2"><span className="w-40 shrink-0 text-xs text-stone-500">{label}</span><div className="min-w-0 flex-1"><Row t={t} /></div></div>) })}
      </Section>
      <Section title="Team Rocket Boss">{giovanni.map((t) => <Row key={t.id} t={t} />)}</Section>
      <Section title="Elite Four">{e4.map((t) => <Row key={t.id} t={t} />)}</Section>
      <Section title="Elite Four – round 2 (after Sevii quest)">{e4r.map((t) => <Row key={t.id} t={t} />)}</Section>
    </div>
  )
}
