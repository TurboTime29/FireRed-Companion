import { Link } from 'react-router-dom'
import { getDb } from '../data/db'
import { useProgress } from '../store/progress'
import { chapterProgress, currentChapter } from '../lib/selectors'
import { PageTitle } from '../components/ui'

export default function Guide() {
  const db = getDb()
  const steps = useProgress((s) => s.steps)
  const prog = useProgress()
  const cur = currentChapter(db, prog)
  return (
    <div>
      <PageTitle sub={<>Story order, one chapter per area. <Link className="link" to="/missables">Missables checklist →</Link></>}>Walkthrough</PageTitle>
      <div className="space-y-2">
        {db.chapters.map((c) => {
          const p = chapterProgress(c, steps)
          const bosses = c.steps.filter((s) => s.kind === 'boss')
          return (
            <Link key={c.id} to={`/guide/${c.id}`} className={`card block p-3 ${c.id === cur.id ? 'ring-2 ring-red-500' : ''}`}>
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-xs text-stone-500">Chapter {c.n}{c.n > 17 && ' · post-game'}</div>
                  <div className="font-semibold">{c.title}</div>
                  <div className="truncate text-xs text-stone-500">{c.subtitle}</div>
                </div>
                <div className="shrink-0 text-right text-xs text-stone-500">{p.done}/{p.total}{bosses.length > 0 && <div className="mt-1 flex justify-end gap-0.5">{bosses.slice(0, 3).map((b) => <span key={b.id} className={`h-2 w-2 rounded-full ${steps[b.id] ? 'bg-emerald-500' : 'bg-red-400'}`} />)}</div>}</div>
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded bg-stone-200 dark:bg-stone-800"><div className="h-full bg-red-600" style={{ width: `${p.pct}%` }} /></div>
            </Link>
          )
        })}
      </div>
      <p className="mt-4 text-xs text-stone-400">Steps are original; area notes and item positions adapted from Bulbapedia's FRLG walkthrough (CC BY-NC-SA 2.5). Game data from the pret/pokefirered decompilation.</p>
    </div>
  )
}
