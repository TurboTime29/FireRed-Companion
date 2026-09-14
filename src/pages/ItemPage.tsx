import { Link, useParams } from 'react-router-dom'
import { getDb } from '../data/db'
import { useProgress } from '../store/progress'
import { Check, Empty, ItemSprite, LocationLink, MoveLink, PageTitle, PokemonLink, Section } from '../components/ui'
import { guideWhere } from '../lib/guide'

export default function ItemPage() {
  const db = getDb()
  const id = Number(useParams().id)
  const it = db.itemById.get(id)
  const flags = useProgress((s) => s.flags)
  const setFlag = useProgress((s) => s.setFlag)
  if (!it) return <Empty>Unknown item.</Empty>
  const balls = db.locations.flatMap((l) => l.items.filter((b) => b.item === id).map((b) => ({ l, b })))
  const hidden = db.locations.flatMap((l) => l.hiddenItems.filter((b) => b.item === id).map((b) => ({ l, b })))
  const shops = db.locations.filter((l) => l.shops.some((s) => s.includes(id)))
  const steps = db.chapters.flatMap((c) => c.steps.filter((s) => s.items?.includes(id)).map((s) => ({ c, s })))
  const evolves = db.pokemon.filter((p) => p.evolutions.some((e) => e.item === id))
  const learners = it.move ? db.pokemon.filter((p) => p.tmhm.includes(id)) : []
  return (
    <div>
      <PageTitle sub={<>{it.pocket}{it.price ? ` · $${it.price} (sells for $${Math.floor(it.price / 2)})` : ' · cannot be bought'}</>}><span className="inline-flex items-center gap-2"><ItemSprite item={it} size={32} />{it.name}</span></PageTitle>
      <Section><p className="text-sm">{it.description}</p>{it.move && <p className="mt-1 text-sm">Teaches <MoveLink id={it.move} />.</p>}{it.holdEffect && <p className="mt-1 text-xs text-stone-500">Held effect: {it.holdEffect}</p>}</Section>
      <Section title="Where to get it">
        {steps.map(({ c, s }) => <div key={s.id} className="mb-1 text-sm">📖 <Link className="link" to={`/guide/${c.id}`}>Ch.{c.n}</Link>: {s.text}</div>)}
        {balls.map(({ l, b }, i) => <Check key={'b' + i} checked={!!flags[b.flag]} onChange={(v) => setFlag(b.flag, v)} label={<>Item ball at <LocationLink id={l.id} /></>} sub={guideWhere(db, l, it, false)} />)}
        {hidden.map(({ l, b }, i) => <Check key={'h' + i} checked={!!flags[b.flag]} onChange={(v) => setFlag(b.flag, v)} label={<>Hidden at <LocationLink id={l.id} />{b.qty > 1 ? ` ×${b.qty}` : ''}</>} sub={guideWhere(db, l, it, true) ?? `Hidden spot (tile ${b.x}, ${b.y}) — use the Itemfinder`} kind="hidden" />)}
        {shops.map((l) => <div key={l.id} className="text-sm">🛒 Sold at <LocationLink id={l.id} /></div>)}
        {!steps.length && !balls.length && !hidden.length && !shops.length && <Empty>No fixed location in the data (wild held item, Game Corner prize, or one-off event). Check the guide.</Empty>}
      </Section>
      {evolves.length > 0 && <Section title="Evolves"><div className="flex flex-wrap gap-2">{evolves.map((p) => <PokemonLink key={p.id} id={p.id} />)}</div></Section>}
      {learners.length > 0 && <Section title={`Compatible Pokémon (${learners.length})`}><div className="flex flex-wrap gap-2">{learners.map((p) => <PokemonLink key={p.id} id={p.id} className="rounded bg-stone-100 px-1 dark:bg-stone-800" />)}</div></Section>}
    </div>
  )
}
