import { Link, useParams } from 'react-router-dom'
import { getDb } from '../data/db'
import { useParty, useProgress } from '../store/progress'
import { readiness, trainerDisplayName } from '../lib/selectors'
import { moveCategory } from '../lib/battle'
import { CategoryIcon, Empty, ItemLink, LocationLink, MoveLink, PageTitle, PokemonLink, Section, Sprite, TypeBadge } from '../components/ui'
import { MatchupTable } from '../components/MatchupTable'

export default function TrainerPage() {
  const db = getDb()
  const id = Number(useParams().id)
  const t = db.trainerById.get(id)
  const party = useParty()
  const beaten = useProgress((s) => s.beaten)
  const setBeaten = useProgress((s) => s.setBeaten)
  if (!t) return <Empty>Unknown trainer.</Empty>
  const r = readiness(db, party, t)
  const variants = t.battleGroup ? db.trainers.filter((x) => x.battleGroup === t.battleGroup && x.id !== t.id) : []
  const base = t.rematchOf !== undefined ? db.trainerById.get(t.rematchOf) : undefined
  return (
    <div>
      <PageTitle sub={<>{t.maps.map((m) => <LocationLink key={m} id={m} className="mr-2" />)}{t.double && ' · Double battle'}{t.items.length > 0 && <> · Uses {t.items.map((i) => <ItemLink key={i} id={i} />)}</>}</>}
        right={<button onClick={() => setBeaten(t.id)} className={`btn ${beaten[t.id] ? 'bg-emerald-600 text-white' : 'btn-ghost'}`}>{beaten[t.id] ? '✓ Beaten' : 'Mark beaten'}</button>}>
        {trainerDisplayName(t)}
      </PageTitle>
      {t.rivalStarter && <p className="mb-2 text-xs text-stone-500">This version appears when the rival's starter is {db.pokemonById.get(t.rivalStarter)?.name} (you chose {db.pokemonById.get(t.rivalStarter === 1 ? 7 : t.rivalStarter === 4 ? 1 : 4)?.name}). {variants.length > 0 && <>Other versions: {variants.map((v) => <Link key={v.id} className="link mr-1" to={`/trainers/${v.id}`}>{db.pokemonById.get(v.rivalStarter!)?.name}</Link>)}</>}</p>}
      {base && <p className="mb-2 text-xs text-stone-500">Vs Seeker rematch (tier {t.rematchTier}) of <Link className="link" to={`/trainers/${base.id}`}>{trainerDisplayName(base)}</Link>.</p>}

      <Section title={`Team (${t.party.length})`}>
        <div className="grid gap-2 sm:grid-cols-2">
          {t.party.map((m, i) => {
            const p = db.pokemonById.get(m.species)!
            return (
              <div key={i} className="flex gap-2 rounded-lg border border-stone-200 p-2 dark:border-stone-700">
                <Sprite id={m.species} size={56} />
                <div className="min-w-0 flex-1 text-sm">
                  <div className="flex items-center gap-2"><PokemonLink id={m.species} /> <span className="text-stone-500">Lv.{m.level}</span>{m.item && <ItemLink id={m.item} />}</div>
                  <div className="my-0.5 flex gap-1">{p.types.map((ty) => <TypeBadge key={ty} type={ty} small />)}</div>
                  <div className="flex flex-wrap gap-x-2 text-xs">{m.moves.map((mv) => { const mo = db.moveById.get(mv)!; return <span key={mv} className="inline-flex items-center gap-1"><MoveLink id={mv} /><span className="text-stone-400">{moveCategory(mo) === 'status' ? '' : `${mo.power}`}</span><CategoryIcon move={mo} /></span> })}{m.defaultMoves && <span className="text-stone-400" title="Default level-up moves">(level-up moveset)</span>}</div>
                </div>
              </div>
            )
          })}
        </div>
      </Section>

      <Section title="Your party vs this team" right={<span className={`chip ${r.verdict === 'strong' ? 'bg-emerald-600 text-white' : r.verdict === 'ok' ? 'bg-amber-500 text-white' : r.verdict === 'risky' ? 'bg-red-600 text-white' : 'bg-stone-300'}`}>{r.verdict}</span>}>
        <p className="mb-2 text-sm text-stone-600 dark:text-stone-300">{r.note} {!party.length && <Link className="link" to="/team">Set up your team →</Link>}</p>
        {party.length > 0 && <MatchupTable rows={r.rows} />}
      </Section>
      {t.rematches && t.rematches.length > 0 && <Section title="Vs Seeker rematches">{t.rematches.map((rid) => { const rt = db.trainerById.get(rid)!; return <div key={rid} className="text-sm"><Link className="link" to={`/trainers/${rid}`}>Rematch {rt.rematchTier}</Link>: {rt.party.map((m) => `${db.pokemonById.get(m.species)?.name} Lv.${m.level}`).join(', ')}</div> })}</Section>}
    </div>
  )
}
