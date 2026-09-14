import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { getDb } from '../data/db'
import type { Pokemon } from '../data/types'
import { useProgress } from '../store/progress'
import { calcStats, type Status } from '../lib/battle'
import { BALLS, BALL_ORDER, catchChance, safariCatch, withinThrows } from '../lib/catch'
import { Empty, ItemSprite, PageTitle, Section, Seg, Sprite, TypeBadge } from '../components/ui'

const STATUS: { v: Status; label: string; hint: string }[] = [
  { v: 'none', label: 'Healthy', hint: '' }, { v: 'slp', label: 'Asleep', hint: '×2' }, { v: 'frz', label: 'Frozen', hint: '×2' },
  { v: 'par', label: 'Paralysed', hint: '×1.5' }, { v: 'psn', label: 'Poisoned', hint: '×1.5' }, { v: 'brn', label: 'Burned', hint: '×1.5' },
]

const SAFARI_MAPS = new Set(['MAP_SAFARI_ZONE_CENTER', 'MAP_SAFARI_ZONE_EAST', 'MAP_SAFARI_ZONE_NORTH', 'MAP_SAFARI_ZONE_WEST'])

function pct(x: number) { return x >= 0.995 ? '100%' : x < 0.001 ? '<0.1%' : `${(x * 100).toFixed(x < 0.1 ? 1 : 0)}%` }

export default function CatchPage() {
  const db = getDb()
  const [params, setParams] = useSearchParams()
  const caught = useProgress((s) => s.caught)
  const bag = useProgress((s) => s.bag ?? [])
  const [q, setQ] = useState('')
  const id = Number(params.get('p')) || 0
  const p = db.pokemonById.get(id)
  const level = Math.max(1, Math.min(100, Number(params.get('lvl')) || 30))
  const [hpPct, setHpPct] = useState(100)
  const [status, setStatus] = useState<Status>('none')
  const [turn, setTurn] = useState(1)
  const safariOnly = p ? (p.locations ?? []).length > 0 && (p.locations ?? []).every((l) => SAFARI_MAPS.has(l.map)) : false
  const [safari, setSafari] = useState<boolean | null>(null)
  const isSafari = safari ?? safariOnly
  const hits = useMemo(() => (q ? db.pokemon.filter((x) => x.name.toLowerCase().startsWith(q.toLowerCase()) || String(x.id) === q).slice(0, 8) : []), [db, q])
  const pick = (x: Pokemon, lvl?: number) => { setParams({ p: String(x.id), lvl: String(lvl ?? level) }); setQ(''); setSafari(null) }
  const stats = p ? calcStats(p.stats, level) : null
  const curHp = stats ? Math.max(1, Math.round((stats.hp * hpPct) / 100)) : 0
  const owned = new Map(bag.map((b) => [b.item, b.qty]))
  const rows = p && stats ? BALL_ORDER.map((ball) => ({ ball, item: db.itemById.get(ball)!, r: catchChance({ pokemon: p, level, maxHp: stats.hp, curHp, status, ball, turn: turn - 1, alreadyCaught: caught.includes(p.id) }) })) : []
  const bestOwned = rows.filter((r) => owned.has(r.ball) && r.ball !== BALLS.master).sort((a, b) => b.r.chance - a.r.chance)[0]
  return (
    <div>
      <PageTitle hero sub="Exact Gen 3 formula from the game code: catch rate, HP, status, ball and turn. Balls you carry (from your save) are marked.">Catch calculator</PageTitle>
      <Section title="Target">
        <div className="relative">
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={p ? `${p.name} (type to change)` : 'Pokémon name or number'} className="input" />
          {hits.length > 0 && (
            <div className="absolute z-10 mt-1 w-full rounded-xl bg-white shadow-lg ring-1 ring-stone-200 dark:bg-stone-900 dark:ring-stone-700">
              {hits.map((x) => <button key={x.id} type="button" onClick={() => pick(x)} className="flex w-full items-center gap-2 px-2 py-1 text-left text-sm hover:bg-stone-100 dark:hover:bg-stone-800"><Sprite id={x.id} size={32} />{x.name} <span className="text-xs text-stone-400">#{x.id} · rate {x.catchRate}</span></button>)}
            </div>
          )}
        </div>
        {p && stats && (
          <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
            <Link to={`/dex/${p.id}`} className="hover-bounce flex items-center gap-2"><Sprite id={p.id} size={56} /><b className="text-base">{p.name}</b></Link>
            {p.types.map((t) => <TypeBadge key={t} type={t} small />)}
            <span className="text-stone-500">catch rate {p.catchRate}{caught.includes(p.id) ? ' · already caught (Repeat Ball ×3)' : ''}</span>
            <label className="flex items-center gap-1">Lv.<input type="number" min={1} max={100} value={level} onChange={(e) => setParams({ p: String(p.id), lvl: String(Math.max(1, Math.min(100, Number(e.target.value) || 1))) })} className="input w-16 py-0.5" /></label>
            <span className="text-xs text-stone-500">max HP {stats.hp}</span>
          </div>
        )}
        {p && (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Seg value={isSafari ? 'safari' : 'battle'} onChange={(v) => setSafari(v === 'safari')} options={[{ value: 'battle', label: 'Normal battle' }, { value: 'safari', label: 'Safari Zone' }]} />
            {safariOnly && <span className="text-xs text-stone-500">Only found in the Safari Zone.</span>}
          </div>
        )}
      </Section>

      {p && stats && !isSafari && (
        <>
          <Section title="Its condition">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-sm">HP left: <b>{hpPct}%</b> <span className="text-xs text-stone-500">({curHp}/{stats.hp}{hpPct <= 2 ? ' — False Swipe leaves it at 1' : ''})</span>
                <input type="range" min={1} max={100} value={hpPct} onChange={(e) => setHpPct(Number(e.target.value))} className="mt-1 w-full accent-dex-500" />
                <div className="flex gap-1 text-xs">{[100, 50, 25, 10, 1].map((v) => <button key={v} type="button" className={`chip-btn ${hpPct === v ? 'chip-on' : ''}`} onClick={() => setHpPct(v)}>{v === 1 ? '1 HP' : `${v}%`}</button>)}</div>
              </label>
              <div className="text-sm">Status
                <div className="mt-1 flex flex-wrap gap-1">{STATUS.map((s) => <button key={s.v} type="button" className={`chip-btn ${status === s.v ? 'chip-on' : ''}`} onClick={() => setStatus(s.v)}>{s.label}{s.hint && <span className="ml-1 opacity-70">{s.hint}</span>}</button>)}</div>
                <label className="mt-2 flex items-center gap-2 text-sm">Turn <input type="number" min={1} max={99} value={turn} onChange={(e) => setTurn(Math.max(1, Number(e.target.value) || 1))} className="input w-16 py-0.5" /><span className="text-xs text-stone-500">Timer Ball grows to ×4 by turn 31</span></label>
              </div>
            </div>
          </Section>
          <Section title="Per ball" right={bestOwned ? <span className="text-xs text-stone-500">best you carry: <b>{bestOwned.item.name}</b></span> : undefined}>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-[11px] uppercase tracking-wide text-stone-500"><tr><th className="py-1">Ball</th><th className="py-1 text-right">Per throw</th><th className="py-1 text-right">Expected</th><th className="py-1 text-right">Within 5</th><th className="py-1 text-right">Within 20</th><th className="py-1 text-right">You have</th></tr></thead>
                <tbody>
                  {rows.map(({ ball, item, r }) => {
                    const have = owned.get(ball)
                    return (
                      <tr key={ball} className={`border-t border-stone-100 dark:border-stone-800 ${bestOwned?.ball === ball ? 'bg-emerald-50 dark:bg-emerald-950/40' : ''} ${!have && bag.length ? 'opacity-60' : ''}`}>
                        <td className="py-1.5"><Link to={`/items/${ball}`} className="inline-flex items-center gap-1 link"><ItemSprite item={item} />{item.name}</Link>{ball === BALLS.net && !(p.types.includes('Water') || p.types.includes('Bug')) && <span className="ml-1 text-xs text-stone-400">(not Water/Bug)</span>}{ball === BALLS.nest && level >= 30 && <span className="ml-1 text-xs text-stone-400">(weak above Lv.30)</span>}</td>
                        <td className={`py-1.5 text-right font-semibold tabular-nums ${r.chance >= 0.5 ? 'text-emerald-600' : r.chance >= 0.15 ? 'text-amber-600' : 'text-red-600'}`}>{pct(r.chance)}</td>
                        <td className="py-1.5 text-right tabular-nums">{r.expectedThrows === Infinity ? '—' : r.expectedThrows < 1.05 ? '1' : r.expectedThrows.toFixed(1)}</td>
                        <td className="py-1.5 text-right tabular-nums">{pct(withinThrows(r.chance, 5))}</td>
                        <td className="py-1.5 text-right tabular-nums">{pct(withinThrows(r.chance, 20))}</td>
                        <td className="py-1.5 text-right tabular-nums text-stone-500">{have ?? (bag.length ? '0' : '?')}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <p className="mt-2 text-xs text-stone-500">Sleep or freeze doubles the odds, other status ×1.5. Damage matters more than the ball: 1 HP roughly triples the chance versus full HP. {!bag.length && 'Import your save in Settings to see which balls you carry.'}</p>
          </Section>
        </>
      )}

      {p && isSafari && (
        <Section title="Safari Zone">
          <p className="mb-2 text-sm text-stone-600 dark:text-stone-300">You can't attack in the Safari Zone. A rock makes it angry (catch factor doubled, but it flees more); bait makes it eat (harder to catch, rarely flees). Each turn: the flee roll happens first.</p>
          <div className="grid gap-2 sm:grid-cols-3">
            {(['watching', 'angry', 'eating'] as const).map((st) => {
              const r = safariCatch(p, st)
              return (
                <div key={st} className={`rounded-xl border p-3 ${st === 'watching' ? 'border-stone-200 dark:border-stone-700' : st === 'angry' ? 'border-red-300 bg-red-50 dark:border-red-800 dark:bg-red-950/30' : 'border-emerald-300 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/30'}`}>
                  <div className="font-semibold capitalize">{st === 'watching' ? 'Watching (no bait/rock)' : st === 'angry' ? 'Angry (after a rock)' : 'Eating (after bait)'}</div>
                  <div className="mt-1 text-2xl font-bold tabular-nums">{pct(r.chance)}</div>
                  <div className="text-xs text-stone-500">catch per Safari Ball · flees <b>{r.fleePct}%</b> per turn</div>
                  <div className="mt-1 text-xs text-stone-500">within 5 balls: {pct(withinThrows(r.chance, 5))}</div>
                </div>
              )
            })}
          </div>
          <p className="mt-2 text-xs text-stone-500">Rock and bait wear off after 2–6 turns. Chansey, Tauros, Kangaskhan and Scyther are the notorious runners: throw balls immediately unless the flee rate is already low.</p>
        </Section>
      )}
      {!p && <Empty>Pick a Pokémon to calculate. Tip: the Battle helper and encounter cards link straight here.</Empty>}
    </div>
  )
}
