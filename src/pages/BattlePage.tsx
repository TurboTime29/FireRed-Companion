import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { getDb, GYM_LEADERS } from '../data/db'
import type { Trainer } from '../data/types'
import { useParty, useProgress } from '../store/progress'
import { matchup, readiness, toCombatant, trainerDisplayName, trainersForGroup, typeMatchupSummary, wildCombatant } from '../lib/selectors'
import { MatchupTable } from '../components/MatchupTable'
import { Empty, PageTitle, PokemonLink, Section, Sprite, TypeBadge, EffChip } from '../components/ui'

const GROUP_LABEL: Record<string, string> = {
  'rival-oaks-lab': 'Rival 1 (Lab)', 'rival-route22-early': 'Rival 2 (Route 22)', 'rival-cerulean': 'Rival 3 (Cerulean)', 'rival-ss-anne': 'Rival 4 (S.S. Anne)',
  'rival-pokemon-tower': 'Rival 5 (Tower)', 'rival-silph': 'Rival 6 (Silph)', 'rival-route22-late': 'Rival 7 (Route 22)', 'champion-first': 'Champion', 'champion-rematch': 'Champion rematch',
}

export default function BattlePage() {
  const db = getDb()
  const [params, setParams] = useSearchParams()
  const party = useParty()
  const starter = useProgress((s) => s.starter)
  const badges = useProgress((s) => s.badges)
  const [q, setQ] = useState('')
  const [lvl, setLvl] = useState(Number(params.get('lvl')) || 20)
  const mode = params.get('t') ? 'trainer' : params.get('p') ? 'pokemon' : 'none'
  const trainer = params.get('t') ? db.trainerById.get(Number(params.get('t'))) : undefined
  const poke = params.get('p') ? db.pokemonById.get(Number(params.get('p'))) : undefined
  const hits = useMemo(() => {
    if (!q) return { mons: [], trainers: [] as Trainer[] }
    const s = q.toLowerCase()
    return {
      mons: db.pokemon.filter((p) => p.name.toLowerCase().startsWith(s)).slice(0, 6),
      trainers: db.trainers.filter((t) => t.rematchOf === undefined && (`${t.class} ${t.name}`.toLowerCase().includes(s) || t.maps.some((m) => db.locationById.get(m)?.name.toLowerCase().includes(s)))).slice(0, 8),
    }
  }, [db, q])
  const nextLeaderKey = GYM_LEADERS[badges.findIndex((b) => !b)]
  const quick = [
    ...(nextLeaderKey ? [db.trainerByKey.get(nextLeaderKey)!] : []),
    ...['rival-oaks-lab', 'rival-route22-early', 'rival-cerulean', 'rival-ss-anne', 'rival-pokemon-tower', 'rival-silph', 'rival-route22-late', 'champion-first'].flatMap((g) => trainersForGroup(db, g, starter).slice(0, 1)),
  ]
  const wild = poke ? wildCombatant(db, poke, lvl) : null
  const wildRows = wild ? [{ foe: wild, ranked: party.map((m) => matchup(db, toCombatant(db, m), wild)).sort((a, b) => b.score - a.score) }] : []
  const r = trainer ? readiness(db, party, trainer) : null
  return (
    <div>
      <PageTitle sub="Pick an opponent to see its weaknesses and which of your Pokémon and moves work best.">Battle helper</PageTitle>
      <div className="relative mb-3">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Opponent: Pokémon name, trainer, gym leader, or route" className="input" />
        {(hits.mons.length > 0 || hits.trainers.length > 0) && (
          <div className="absolute z-10 mt-1 w-full rounded-lg bg-white shadow-lg ring-1 ring-stone-200 dark:bg-stone-900 dark:ring-stone-700">
            {hits.mons.map((p) => <button key={p.id} onClick={() => { setParams({ p: String(p.id), lvl: String(lvl) }); setQ('') }} className="flex w-full items-center gap-2 px-2 py-1 text-left text-sm hover:bg-stone-100 dark:hover:bg-stone-800"><Sprite id={p.id} size={28} />{p.name} <span className="text-xs text-stone-400">wild / any</span></button>)}
            {hits.trainers.map((t) => <button key={t.id} onClick={() => { setParams({ t: String(t.id) }); setQ('') }} className="flex w-full items-center gap-2 px-2 py-1 text-left text-sm hover:bg-stone-100 dark:hover:bg-stone-800">⚔️ {trainerDisplayName(t)} <span className="text-xs text-stone-400">{t.maps.map((m) => db.locationById.get(m)?.name).join(', ')}</span></button>)}
          </div>
        )}
      </div>
      <div className="mb-3 flex flex-wrap gap-1">
        {quick.map((t) => <button key={t.id} onClick={() => setParams({ t: String(t.id) })} className={`chip ${trainer?.id === t.id ? 'bg-red-700 text-white' : 'bg-stone-200 dark:bg-stone-800'}`}>{t.classKey === 'LEADER' ? `Next gym: ${t.name}` : GROUP_LABEL[t.battleGroup ?? ''] ?? trainerDisplayName(t)}</button>)}
      </div>
      {!party.length && <p className="mb-3 rounded bg-amber-100 p-2 text-sm text-amber-900 dark:bg-amber-900/40 dark:text-amber-100">Your party is empty. <Link className="link" to="/team">Add your Pokémon</Link> to get recommendations.</p>}

      {mode === 'pokemon' && poke && wild && (
        <>
          <Section title="Opponent">
            <div className="flex flex-wrap items-center gap-3">
              <PokemonLink id={poke.id} showTypes />
              <label className="text-sm">Level <input type="number" min={1} max={100} value={lvl} onChange={(e) => { const v = Math.max(1, Math.min(100, Number(e.target.value) || 1)); setLvl(v); setParams({ p: String(poke.id), lvl: String(v) }) }} className="input inline w-16 py-0.5" /></label>
              <span className="text-xs text-stone-500">likely moves: {wild.moves.map((m) => m.name).join(', ')}</span>
            </div>
            <Weak types={poke.types} />
          </Section>
          <Section title="Your best options">{party.length ? <MatchupTable rows={wildRows} /> : <Empty>Add your party first.</Empty>}</Section>
        </>
      )}
      {mode === 'trainer' && trainer && r && (
        <>
          <Section title={<Link className="link" to={`/trainers/${trainer.id}`}>{trainerDisplayName(trainer)} →</Link>} right={<span className={`chip ${r.verdict === 'strong' ? 'bg-emerald-600 text-white' : r.verdict === 'ok' ? 'bg-amber-500 text-white' : r.verdict === 'risky' ? 'bg-red-600 text-white' : 'bg-stone-300'}`}>{r.verdict}</span>}>
            <p className="mb-2 text-sm">{r.note}</p>
            <div className="flex flex-wrap gap-3">{trainer.party.map((m, i) => <div key={i} className="text-center text-xs"><Sprite id={m.species} size={48} /><div>{db.pokemonById.get(m.species)?.name}</div><div className="text-stone-500">Lv.{m.level}</div><Weak types={db.pokemonById.get(m.species)!.types} compact /></div>)}</div>
          </Section>
          <Section title="Pokémon by Pokémon">{party.length ? <MatchupTable rows={r.rows} /> : <Empty>Add your party first.</Empty>}</Section>
          <Section title="Lead suggestion">{party.length ? <LeadOrder rows={r.rows} /> : null}</Section>
        </>
      )}
      {mode === 'none' && <Empty>Search for an opponent above, or tap a quick pick.</Empty>}
    </div>
  )
}

function Weak({ types, compact }: { types: import('../data/types').TypeName[]; compact?: boolean }) {
  const db = getDb()
  const s = typeMatchupSummary(db, types)
  if (compact) return <div className="mt-1 flex flex-wrap justify-center gap-0.5">{s.weak.map((w) => <span key={w} className="inline-flex items-center"><TypeBadge type={w.split(' ')[0] as never} small />{w.includes('4') && <EffChip mult={4} />}</span>)}</div>
  return (
    <div className="mt-2 space-y-1 text-sm">
      <div><span className="text-stone-500">Weak to:</span> {s.weak.map((w) => <span key={w} className="mr-1 inline-flex items-center gap-0.5"><TypeBadge type={w.split(' ')[0] as never} small />{w.includes('4') && <EffChip mult={4} />}</span>)}</div>
      <div><span className="text-stone-500">Resists:</span> {s.resist.length ? s.resist.map((w) => <TypeBadge key={w} type={w.split(' ')[0] as never} small />) : '—'} {s.immune.length > 0 && <><span className="text-stone-500">Immune:</span> {s.immune.map((w) => <TypeBadge key={w} type={w as never} small />)}</>}</div>
    </div>
  )
}

function LeadOrder({ rows }: { rows: ReturnType<typeof readiness>['rows'] }) {
  const db = getDb()
  const order = rows.map((r) => r.ranked[0]).filter(Boolean)
  return (
    <ol className="list-decimal space-y-1 pl-5 text-sm">
      {order.map((m, i) => <li key={i}>Against <b>{rows[i].foe.pokemon.name}</b>: lead with <b>{m.attacker.pokemon.name}</b>{m.best ? <> using {m.best.move.name} ({Math.round(m.best.minPct)}–{Math.round(m.best.maxPct)}%)</> : ''}{m.threat && m.threat.maxPct >= 60 && <span className="text-red-600"> — careful, {m.threat.move.name} hits back for up to {Math.round(m.threat.maxPct)}%</span>}</li>)}
      {rows.length > 0 && <li className="text-stone-500">Heal up and bring {db.itemById.get(13) ? 'Potions' : ''} and status cures.</li>}
    </ol>
  )
}
