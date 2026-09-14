import { Link, useParams } from 'react-router-dom'
import { getDb } from '../data/db'
import { moveCategory } from '../lib/battle'
import { CategoryIcon, Empty, ItemLink, LocationLink, PageTitle, PokemonLink, Section, TypeBadge } from '../components/ui'

export default function MovePage() {
  const db = getDb()
  const id = Number(useParams().id)
  const m = db.moveById.get(id)
  if (!m) return <Empty>Unknown move.</Empty>
  const tm = db.items.find((i) => i.move === id)
  const tutorAt = db.locations.filter((l) => l.tutors.some((t) => t.move === id))
  const byLevel = db.pokemon.filter((p) => p.levelUp.some(([, mv]) => mv === id)).map((p) => ({ p, lvl: p.levelUp.find(([, mv]) => mv === id)![0] }))
  const byTm = tm ? db.pokemon.filter((p) => p.tmhm.includes(tm.id)) : []
  const byTutor = db.pokemon.filter((p) => p.tutor.includes(id))
  const byEgg = db.pokemon.filter((p) => p.egg.includes(id))
  return (
    <div>
      <PageTitle sub={<span className="inline-flex items-center gap-2"><TypeBadge type={m.type} /><CategoryIcon move={m} /></span>}>{m.name}</PageTitle>
      <Section>
        <div className="grid grid-cols-3 gap-2 text-center text-sm">
          <div><div className="text-xs uppercase text-stone-500">Power</div><b>{m.power || '—'}</b></div>
          <div><div className="text-xs uppercase text-stone-500">Accuracy</div><b>{m.accuracy || '—'}</b></div>
          <div><div className="text-xs uppercase text-stone-500">PP</div><b>{m.pp}</b></div>
        </div>
        <p className="mt-3 text-sm">{m.description}</p>
        {m.effectText && <p className="mt-1 text-sm text-stone-500">{m.effectText}</p>}
        <div className="mt-2 text-xs text-stone-500">{moveCategory(m) === 'status' ? 'Status move' : `${moveCategory(m) === 'physical' ? 'Physical (uses Attack vs Defense)' : 'Special (uses Sp. Atk vs Sp. Def)'} because ${m.type}-type moves are ${moveCategory(m)} in Gen 3`}{m.priority ? ` · priority ${m.priority > 0 ? '+' : ''}${m.priority}` : ''}{m.contact ? ' · makes contact' : ''}{m.effectChance ? ` · ${m.effectChance}% effect chance` : ''}</div>
      </Section>
      {(tm || tutorAt.length > 0) && (
        <Section title="How to get it">
          {tm && <div className="text-sm"><ItemLink id={tm.id} /> — <Link className="link" to={`/items/${tm.id}`}>see where to find it</Link></div>}
          {tutorAt.map((l) => <div key={l.id} className="text-sm">Move Tutor at <LocationLink id={l.id} /> (one time only)</div>)}
        </Section>
      )}
      <Section title={`Learned by level up (${byLevel.length})`}>
        {byLevel.length ? <div className="flex flex-wrap gap-2">{byLevel.map(({ p, lvl }) => <PokemonLink key={p.id} id={p.id} level={lvl} className="rounded bg-stone-100 px-1 dark:bg-stone-800" />)}</div> : <Empty>None.</Empty>}
      </Section>
      {tm && <Section title={`Learned by ${tm.name.split(' ')[0]} (${byTm.length})`}><div className="flex flex-wrap gap-2">{byTm.map((p) => <PokemonLink key={p.id} id={p.id} className="rounded bg-stone-100 px-1 dark:bg-stone-800" />)}</div></Section>}
      {byTutor.length > 0 && <Section title={`Learned from tutor (${byTutor.length})`}><div className="flex flex-wrap gap-2">{byTutor.map((p) => <PokemonLink key={p.id} id={p.id} className="rounded bg-stone-100 px-1 dark:bg-stone-800" />)}</div></Section>}
      {byEgg.length > 0 && <Section title={`Egg move for (${byEgg.length})`}><div className="flex flex-wrap gap-2">{byEgg.map((p) => <PokemonLink key={p.id} id={p.id} className="rounded bg-stone-100 px-1 dark:bg-stone-800" />)}</div></Section>}
    </div>
  )
}
