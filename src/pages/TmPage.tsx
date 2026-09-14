import { Link } from 'react-router-dom'
import { getDb } from '../data/db'
import { useProgress } from '../store/progress'
import { CategoryIcon, LocationLink, PageTitle, TypeBadge } from '../components/ui'

export default function TmPage() {
  const db = getDb()
  const flags = useProgress((s) => s.flags)
  const keyItems = useProgress((s) => s.keyItems)
  const setKeyItem = useProgress((s) => s.setKeyItem)
  const tms = db.items.filter((i) => i.move).sort((a, b) => a.id - b.id)
  return (
    <div>
      <PageTitle sub="Tick the ones you own. HMs are reusable; TMs are single-use in Gen 3.">TMs & HMs</PageTitle>
      <div className="card divide-y divide-stone-100 dark:divide-stone-800">
        {tms.map((it) => {
          const mv = db.moveById.get(it.move!)!
          const balls = db.locations.filter((l) => l.items.some((b) => b.item === it.id))
          const hidden = db.locations.filter((l) => l.hiddenItems.some((b) => b.item === it.id))
          const shops = db.locations.filter((l) => l.shops.some((s) => s.includes(it.id)))
          const steps = db.chapters.flatMap((c) => c.steps.filter((s) => s.items?.includes(it.id)).map((s) => ({ c, s })))
          const owned = keyItems.includes(it.id) || balls.some((l) => l.items.some((b) => b.item === it.id && flags[b.flag]))
          return (
            <div key={it.id} className="flex items-start gap-2 px-3 py-2 text-sm">
              <input type="checkbox" checked={owned} onChange={(e) => setKeyItem(it.id, e.target.checked)} className="mt-1 h-4 w-4 accent-red-700" />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1"><Link to={`/items/${it.id}`} className="font-medium link">{it.name}</Link> <TypeBadge type={mv.type} small /><CategoryIcon move={mv} /><span className="text-xs text-stone-500">{mv.power || '—'} pow · {mv.accuracy || '—'} acc</span></div>
                <div className="text-xs text-stone-500">
                  {steps.slice(0, 1).map(({ c, s }) => <span key={s.id}><Link className="link" to={`/guide/${c.id}`}>Ch.{c.n}</Link>: {s.text} </span>)}
                  {!steps.length && balls.map((l) => <span key={l.id}>Item ball: <LocationLink id={l.id} /> </span>)}
                  {!steps.length && hidden.map((l) => <span key={l.id}>Hidden: <LocationLink id={l.id} /> </span>)}
                  {shops.map((l) => <span key={l.id}>Shop: <LocationLink id={l.id} /> (${it.price}) </span>)}
                  {!steps.length && !balls.length && !hidden.length && !shops.length && 'Prize / gift — see guide'}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
