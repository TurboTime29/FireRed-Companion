import { Link } from 'react-router-dom'
import type { CSSProperties } from 'react'
import { getDb } from '../data/db'
import { useProgress } from '../store/progress'
import { chapterProgress, currentChapter } from '../lib/selectors'
import { PageTitle, Progress } from '../components/ui'

export default function Guide() {
  const db = getDb()
  const steps = useProgress((s) => s.steps)
  const prog = useProgress()
  const cur = currentChapter(db, prog)
  const total = db.chapters.reduce((a, c) => a + c.steps.length, 0)
  const done = db.chapters.reduce((a, c) => a + c.steps.filter((s) => steps[s.id]).length, 0)
  return (
    <div>
      <PageTitle hero sub={<>Story order, one chapter per area · {done}/{total} steps done · <Link className="link" to="/missables">Missables checklist →</Link></>}>Walkthrough</PageTitle>
      <div className="stagger space-y-2">
        {db.chapters.map((c, i) => {
          const p = chapterProgress(c, steps)
          const bosses = c.steps.filter((s) => s.kind === 'boss')
          const isCur = c.id === cur.id
          const complete = p.done >= p.total
          return (
            <Link key={c.id} to={`/guide/${c.id}`} style={{ '--i': i } as CSSProperties} className={`card card-hover flex items-center gap-3 p-3 ${isCur ? 'outline outline-2 -outline-offset-2 outline-dex-500' : ''}`}>
              <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full font-display text-base font-bold ${complete ? 'bg-emerald-500 text-white' : isCur ? 'bg-dex-500 text-white shadow' : 'bg-stone-200 text-stone-600 dark:bg-stone-800 dark:text-stone-300'}`}>{complete ? '✓' : c.n}</div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 text-[11px] text-stone-500">
                  <span>Chapter {c.n}{c.n > 17 && ' · post-game'}</span>
                  {isCur && <span className="chip bg-dex-100 text-[10px] text-dex-700 dark:bg-dex-900/60 dark:text-red-300">current</span>}
                </div>
                <div className="truncate font-display font-bold">{c.title}</div>
                <div className="truncate text-xs text-stone-500">{c.subtitle}</div>
                <div className="mt-1.5 flex items-center gap-2">
                  <Progress pct={p.pct} className="!h-1.5" color={complete ? 'bg-emerald-500' : 'bg-dex-500'} />
                  <span className="shrink-0 text-[11px] tabular-nums text-stone-500">{p.done}/{p.total}</span>
                </div>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1">
                {bosses.length > 0 && <div className="flex gap-0.5">{bosses.slice(0, 3).map((b) => <span key={b.id} title={b.text} className={`h-2 w-2 rounded-full ${steps[b.id] ? 'bg-emerald-500' : 'bg-red-400'}`} />)}</div>}
                <span className="text-stone-400">›</span>
              </div>
            </Link>
          )
        })}
      </div>
      <p className="mt-4 text-xs text-stone-400">Steps are original; area notes and item positions adapted from Bulbapedia's FRLG walkthrough (CC BY-NC-SA 2.5). Game data from the pret/pokefirered decompilation.</p>
    </div>
  )
}
