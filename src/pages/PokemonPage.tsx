import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useParams } from 'react-router-dom'
import { getDb, spriteUrl } from '../data/db'
import type { Pokemon } from '../data/types'
import { useProgress } from '../store/progress'
import { typeMatchupSummary } from '../lib/selectors'
import { calcStats } from '../lib/battle'
import { useShinySpecies } from '../lib/shiny'
import { EffChip, ItemLink, LocationLink, MoveTable, PageTitle, PokemonLink, Section, Seg, Sprite, StatBar, TypeBadge, Empty, typeGradient } from '../components/ui'

let cryAudio: HTMLAudioElement | null = null
function playCry(id: number) {
  const a = new Audio()
  if (!a.canPlayType('audio/ogg; codecs="vorbis"')) { alert('This browser cannot play Ogg audio (the format the cries are stored in).'); return }
  cryAudio?.pause()
  cryAudio = a
  a.src = `https://raw.githubusercontent.com/PokeAPI/cries/main/cries/pokemon/latest/${id}.ogg`
  a.volume = 0.5
  a.play().catch(() => { /* blocked or offline */ })
}

const METHOD: Record<string, string> = { grass: 'Grass', surf: 'Surfing', 'rock-smash': 'Rock Smash', 'old-rod': 'Old Rod', 'good-rod': 'Good Rod', 'super-rod': 'Super Rod', gift: 'Gift', egg: 'Egg', static: 'One-time encounter' }

function evoChain(p: Pokemon): Pokemon[][] {
  const db = getDb()
  let root = p
  while (root.evolvesFrom) root = db.pokemonById.get(root.evolvesFrom)!
  const stages: Pokemon[][] = [[root]]
  let frontier = [root]
  while (frontier.length) {
    const next = frontier.flatMap((x) => x.evolutions.map((e) => db.pokemonById.get(e.to)!).filter(Boolean))
    if (!next.length) break
    stages.push(next)
    frontier = next
  }
  return stages
}

function evoText(from: Pokemon, to: Pokemon) {
  const db = getDb()
  const e = from.evolutions.find((x) => x.to === to.id)
  if (!e) return ''
  if (e.method === 'level') return `Lv.${e.level}${e.note ? ` (${e.note})` : ''}`
  if (e.method === 'item') return `use ${db.itemById.get(e.item!)?.name}`
  if (e.method === 'trade') return 'trade'
  if (e.method === 'trade_item') return `trade holding ${db.itemById.get(e.item!)?.name}`
  if (e.method.startsWith('friendship')) return `friendship${e.method.includes('day') ? ' (day)' : e.method.includes('night') ? ' (night)' : ''}`
  return e.method.replace('_', ' ')
}

export default function PokemonPage() {
  const db = getDb()
  const id = Number(useParams().id)
  const p = db.pokemonById.get(id)
  const [tab, setTab] = useState<'level' | 'tm' | 'tutor' | 'egg'>('level')
  const [lvl, setLvl] = useState(50)
  const [previewShiny, setPreviewShiny] = useState(false)
  const caught = useProgress((s) => s.caught.includes(id))
  const seen = useProgress((s) => s.seen.includes(id))
  const markCaught = useProgress((s) => s.markCaught)
  const markSeen = useProgress((s) => s.markSeen)
  const mons = useProgress((s) => s.mons)
  const shinySet = useShinySpecies()
  if (!p) return <Empty>Unknown Pokémon.</Empty>
  const owned = mons.filter((m) => m.species === id)
  const shinyOwned = owned.filter((m) => m.shiny)
  const isShiny = shinySet.has(id)
  const m = typeMatchupSummary(db, p.types)
  const stages = evoChain(p)
  const total = Object.values(p.stats).reduce((a, b) => a + b, 0)
  const at50 = calcStats(p.stats, lvl)
  const trainersWith = db.trainers.filter((t) => t.party.some((x) => x.species === id) && t.rematchOf === undefined).slice(0, 12)
  const inFireRed = (p.locations?.length ?? 0) > 0
  const prev = db.pokemonById.get(id - 1), next = db.pokemonById.get(id + 1)
  const showShinyHero = isShiny || previewShiny
  return (
    <div>
      <div className="hidden"><PageTitle>{`#${String(id).padStart(3, '0')} ${p.name}`}</PageTitle></div>

      {/* hero */}
      <div key={id} className="card fade-up relative mb-3 overflow-hidden">
        <div className="absolute inset-0" style={{ background: typeGradient(p.types, 0.45) }} />
        <div className="pointer-events-none absolute -right-8 -top-10 select-none font-display text-[140px] font-black leading-none text-white/25 dark:text-white/10">{String(id).padStart(3, '0')}</div>
        <div className="relative flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
          <div className="flex items-center justify-center gap-3 sm:w-56 sm:flex-col">
            <div className="relative flex h-44 w-44 items-center justify-center rounded-full bg-white/50 shadow-inner dark:bg-black/25">
              {showShinyHero ? <Sprite id={id} size={160} className="float h-40 w-40" shiny /> : <img src={spriteUrl.artwork(id)} alt={p.name} className="float h-40 w-40 object-contain drop-shadow-lg" loading="lazy" />}
              {showShinyHero && <span className="absolute right-2 top-2 rounded-full bg-amber-400 px-1.5 py-0.5 text-[10px] font-bold text-amber-950 shadow">✨ shiny</span>}
            </div>
            <div className="flex gap-2 sm:flex-row">
              <button type="button" onClick={() => setPreviewShiny(false)} className={`flex flex-col items-center rounded-xl bg-white/50 p-1 text-[10px] text-stone-600 ring-2 transition dark:bg-black/25 dark:text-stone-300 ${!showShinyHero ? 'ring-stone-800 dark:ring-white' : 'ring-transparent hover:ring-stone-400'}`} title="Normal colours"><Sprite id={id} size={48} shiny={false} />normal</button>
              <button type="button" onClick={() => setPreviewShiny(true)} className={`flex flex-col items-center rounded-xl bg-white/50 p-1 text-[10px] text-stone-600 ring-2 transition dark:bg-black/25 dark:text-stone-300 ${showShinyHero ? 'ring-amber-400' : 'ring-transparent hover:ring-amber-300'}`} title="Preview the shiny colours"><Sprite id={id} size={48} shiny />✨ shiny</button>
            </div>
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="text-xs font-bold tabular-nums tracking-widest text-stone-700 dark:text-stone-200">#{String(id).padStart(3, '0')} · {p.category} Pokémon</div>
                <h1 className="font-display text-3xl font-black leading-tight md:text-4xl">{p.name}</h1>
                <div className="mt-1.5 flex gap-1">{p.types.map((t) => <TypeBadge key={t} type={t} />)}</div>
              </div>
              <div className="flex shrink-0 flex-col gap-1">
                <button onClick={() => markCaught(id)} className={`btn ${caught ? 'bg-emerald-600 text-white shadow' : 'bg-white/70 text-stone-800 hover:bg-white dark:bg-black/30 dark:text-white'}`}>{caught ? '✓ Caught' : 'Mark caught'}</button>
                <button onClick={() => markSeen(id)} className={`btn ${seen ? 'bg-stone-700 text-white' : 'bg-white/70 text-stone-800 hover:bg-white dark:bg-black/30 dark:text-white'}`}>{seen ? '👁 Seen' : 'Mark seen'}</button>
                <div className="flex gap-1">
                  <button onClick={() => playCry(id)} className="btn flex-1 bg-white/70 text-stone-800 hover:bg-white dark:bg-black/30 dark:text-white" title="Play its cry">🔊 Cry</button>
                  <Link to={`/compare?a=${id}`} className="btn flex-1 bg-white/70 text-stone-800 hover:bg-white dark:bg-black/30 dark:text-white" title="Compare with another Pokémon">⚖️</Link>
                </div>
              </div>
            </div>
            {shinyOwned.length > 0 && (
              <div className="mt-2 rounded-xl border border-amber-400 bg-amber-50/90 px-2.5 py-1.5 text-sm text-amber-900 dark:border-amber-600 dark:bg-amber-950/60 dark:text-amber-100">
                ✨ You own a <b>shiny {p.name}</b>{shinyOwned.map((x) => ` · ${x.nickname ? `${x.nickname} ` : ''}Lv.${x.level} (${x.inParty ? 'party' : 'PC'})`).join('')}
              </div>
            )}
            {shinyOwned.length === 0 && isShiny && <div className="mt-2 text-xs text-amber-800 dark:text-amber-300">✨ Shown shiny because you own its shiny evolution.</div>}
            {owned.length > 0 && shinyOwned.length === 0 && <div className="mt-2 text-xs text-stone-700 dark:text-stone-300">You own: {owned.map((x) => `${x.nickname ? `${x.nickname} ` : ''}Lv.${x.level} (${x.inParty ? 'party' : 'PC'})`).join(', ')}</div>}
            <p className="mt-2 text-sm leading-relaxed text-stone-800 dark:text-stone-200">{p.dexText}</p>
            <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-stone-700 dark:text-stone-300">
              <span>{p.height} m</span><span>{p.weight} kg</span><span>Catch rate {p.catchRate}</span><span>Exp {p.expYield}</span><span>{p.growth} growth</span><span>{p.femaleRatio === null ? 'genderless' : `${100 - p.femaleRatio}% ♂ / ${p.femaleRatio}% ♀`}</span><span>Eggs: {p.eggGroups.join(', ')}</span>
            </div>
            <div className="mt-2 text-sm"><b>Abilit{p.abilities.length > 1 ? 'ies' : 'y'}:</b> {p.abilities.map((a) => <span key={a.id} className="mr-2" title={a.text}>{a.name} <span className="text-stone-600 dark:text-stone-400">({a.text})</span></span>)}</div>
            {p.heldItems.length > 0 && <div className="mt-1 text-sm">Wild held: {p.heldItems.map((i) => <ItemLink key={i} id={i} />)}</div>}
            {p.availability === 'trade-only' && <div className="mt-2 rounded-lg bg-amber-100 px-2 py-1 text-xs text-amber-900 dark:bg-amber-900/50 dark:text-amber-100">Not obtainable in FireRed. It only comes from a trade with another game{p.id <= 151 ? ' (LeafGreen has it)' : ''}.</div>}
            {p.availability === 'event' && <div className="mt-2 rounded-lg bg-amber-100 px-2 py-1 text-xs text-amber-900 dark:bg-amber-900/50 dark:text-amber-100">Event-only Pokémon: not obtainable in normal play.</div>}
            {p.availability === 'evolution' && !inFireRed && <div className="mt-2 text-xs text-stone-700 dark:text-stone-300">Not in the wild: evolve {db.pokemonById.get(p.evolvesFrom!)?.name}.</div>}
            {p.availability === 'trade-evolution' && <div className="mt-2 rounded-lg bg-sky-100 px-2 py-1 text-xs text-sky-900 dark:bg-sky-900/50 dark:text-sky-100">Only by trading {db.pokemonById.get(p.evolvesFrom!)?.name} to another game and back (link cable or wireless adapter).</div>}
          </div>
        </div>
        <div className="relative flex justify-between border-t border-white/40 bg-white/40 px-2 py-1.5 text-sm dark:border-white/10 dark:bg-black/20">
          {prev ? <Link className="hover-bounce flex items-center gap-1 rounded-lg px-2 py-1 hover:bg-white/60 dark:hover:bg-black/30" to={`/dex/${prev.id}`}>‹ <Sprite id={prev.id} size={28} /> <span className="text-xs text-stone-600 dark:text-stone-300">#{prev.id}</span> {prev.name}</Link> : <span />}
          {next ? <Link className="hover-bounce flex items-center gap-1 rounded-lg px-2 py-1 hover:bg-white/60 dark:hover:bg-black/30" to={`/dex/${next.id}`}>{next.name} <span className="text-xs text-stone-600 dark:text-stone-300">#{next.id}</span> <Sprite id={next.id} size={28} /> ›</Link> : <span />}
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <Section title={<>Base stats <span className="normal-case tracking-normal text-stone-400">(total {total})</span></>} right={<label className="text-xs">at Lv.<input type="number" min={1} max={100} value={lvl} onChange={(e) => setLvl(Number(e.target.value) || 1)} className="input ml-1 inline w-16 py-0.5" /></label>}>
          <div key={id} className="space-y-1">
            <StatBar label="HP" value={p.stats.hp} /><StatBar label="Attack" value={p.stats.atk} /><StatBar label="Defense" value={p.stats.def} /><StatBar label="Sp. Atk" value={p.stats.spa} /><StatBar label="Sp. Def" value={p.stats.spd} /><StatBar label="Speed" value={p.stats.spe} />
          </div>
          <div className="mt-2 text-xs text-stone-500">At Lv.{lvl} (IV 15, no EVs, neutral): HP {at50.hp} · Atk {at50.atk} · Def {at50.def} · SpA {at50.spa} · SpD {at50.spd} · Spe {at50.spe}</div>
        </Section>
        <Section title="Type matchups (defending)">
          <div className="space-y-1 text-sm">
            <div><span className="text-stone-500">Weak to:</span> {m.weak.length ? m.weak.map((t) => <span key={t} className="mr-1 inline-flex items-center gap-1"><TypeBadge type={t.split(' ')[0] as Pokemon['types'][number]} small />{t.includes('4') && <EffChip mult={4} />}</span>) : '—'}</div>
            <div><span className="text-stone-500">Resists:</span> {m.resist.length ? m.resist.map((t) => <span key={t} className="mr-1 inline-flex items-center gap-1"><TypeBadge type={t.split(' ')[0] as Pokemon['types'][number]} small />{t.includes('¼') && <EffChip mult={0.25} />}</span>) : '—'}</div>
            <div><span className="text-stone-500">Immune to:</span> {m.immune.length ? m.immune.map((t) => <TypeBadge key={t} type={t as Pokemon['types'][number]} small />) : '—'}</div>
          </div>
          <div className="mt-3">
            <div className="mb-1 text-[11px] font-bold uppercase tracking-wider text-stone-500">Evolution line</div>
            <div className="flex flex-wrap items-center gap-2 text-sm">
              {stages.map((st, i) => (
                <div key={i} className="flex items-center gap-2">
                  {i > 0 && <span className="text-stone-400">→</span>}
                  <div className="flex flex-col gap-1">
                    {st.map((x) => {
                      const from = stages[i - 1]?.find((f) => f.evolutions.some((e) => e.to === x.id))
                      const e = from?.evolutions.find((ev) => ev.to === x.id)
                      return (
                        <div key={x.id} className={`flex items-center gap-1 rounded-lg px-1 py-0.5 ${x.id === id ? 'bg-dex-50 ring-1 ring-dex-500/40 dark:bg-dex-900/40' : ''}`}>
                          <PokemonLink id={x.id} />
                          {from && <span className="text-xs text-stone-500">({evoText(from, x)})</span>}
                          {e?.note && <span className="text-xs text-amber-700 dark:text-amber-400" title={e.note}>⚠</span>}
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
            {p.evolutions.filter((e) => e.note).map((e) => <div key={e.to} className="mt-1 text-xs text-amber-700 dark:text-amber-400">⚠ {db.pokemonById.get(e.to)?.name}: {e.note}</div>)}
          </div>
        </Section>
      </div>

      <Section title="Where to find in FireRed" right={<Link className="text-xs link" to={`/catch?p=${p.id}&lvl=${p.locations?.[0]?.max ?? 30}`}>🎯 catch odds →</Link>}>
        {p.locations?.length ? (
          <table className="w-full text-sm">
            <tbody>
              {[...p.locations].sort((a, b) => b.rate - a.rate).map((l, i) => (
                <tr key={i} className="border-t border-stone-100 dark:border-stone-800">
                  <td className="py-1.5 pr-2"><LocationLink id={l.map} /></td>
                  <td className="py-1.5 pr-2 text-stone-500">{METHOD[l.method] ?? l.method}</td>
                  <td className="py-1.5 pr-2 text-right tabular-nums">Lv.{l.min}{l.max !== l.min ? `–${l.max}` : ''}</td>
                  <td className="py-1.5 text-right tabular-nums">{l.rate}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : <Empty>Not available in the wild. {p.evolvesFrom ? <>Evolve <PokemonLink id={p.evolvesFrom} />.</> : 'Trade from another game or evolve.'}</Empty>}
        {db.trades.filter((t) => t.get === id).map((t) => <div key={t.key} className="mt-1 text-sm">🔁 In-game trade: give <PokemonLink id={t.give} /> → get <b>{t.nickname}</b> ({p.name}). See <Link className="link" to="/trades">trades</Link>.</div>)}
      </Section>

      <Section title="Moves" right={<Seg value={tab} onChange={(v) => setTab(v)} options={[{ value: 'level', label: 'Level up' }, { value: 'tm', label: 'TM/HM' }, { value: 'tutor', label: 'Tutor' }, { value: 'egg', label: 'Egg' }]} />}>
        <div key={tab} className="fade-up">
          {tab === 'level' && <MoveTable rows={p.levelUp.map(([l, mv]) => ({ move: db.moveById.get(mv)!, label: l === 1 ? '—' : l }))} />}
          {tab === 'tm' && <MoveTable rows={p.tmhm.map((it) => ({ move: db.moveById.get(db.itemById.get(it)!.move!)!, label: db.itemById.get(it)!.name.split(' ')[0] }))} extra={(mv) => { const it = p.tmhm.find((i) => db.itemById.get(i)?.move === mv.id); return it ? <Link to={`/items/${it}`} className="link text-xs">where</Link> : null }} />}
          {tab === 'tutor' && (p.tutor.length ? <MoveTable rows={p.tutor.map((mv) => ({ move: db.moveById.get(mv)! }))} extra={(mv) => { const loc = db.locations.find((l) => l.tutors.some((t) => t.move === mv.id)); return loc ? <LocationLink id={loc.id} className="text-xs" /> : null }} /> : <Empty>No tutor moves.</Empty>)}
          {tab === 'egg' && (p.egg.length ? <MoveTable rows={p.egg.map((mv) => ({ move: db.moveById.get(mv)! }))} /> : <Empty>No egg moves{p.evolvesFrom ? ' (see the base form)' : ''}.</Empty>)}
        </div>
      </Section>

      {trainersWith.length > 0 && (
        <Section title="Used by trainers">
          <div className="flex flex-wrap gap-1 text-sm">{trainersWith.map((t) => <Link key={t.id} to={`/trainers/${t.id}`} className="chip-btn">{t.class} {t.name} (Lv.{t.party.find((x) => x.species === id)?.level})</Link>)}</div>
        </Section>
      )}
    </div>
  )
}
