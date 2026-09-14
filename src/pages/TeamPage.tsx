import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { getDb } from '../data/db'
import type { Pokemon } from '../data/types'
import { useProgress, type OwnedMon } from '../store/progress'
import { NATURES, calcStats } from '../lib/battle'
import { defaultMoves, monAlerts } from '../lib/selectors'
import { ItemSprite, MoveLink, PageTitle, Section, Sprite, TypeBadge, CategoryIcon, Empty } from '../components/ui'

function PokemonPicker({ value, onChange }: { value: number | null; onChange: (id: number) => void }) {
  const db = getDb()
  const [q, setQ] = useState('')
  const hits = useMemo(() => q ? db.pokemon.filter((p) => p.name.toLowerCase().startsWith(q.toLowerCase()) || String(p.id) === q).slice(0, 8) : [], [db, q])
  const cur = value ? db.pokemonById.get(value) : null
  return (
    <div className="relative">
      <div className="flex items-center gap-2">{cur && <Sprite id={cur.id} size={40} />}<input value={q} onChange={(e) => setQ(e.target.value)} placeholder={cur ? cur.name : 'Type a Pokémon name'} className="input" /></div>
      {hits.length > 0 && (
        <div className="absolute z-10 mt-1 w-full rounded-lg bg-white shadow-lg ring-1 ring-stone-200 dark:bg-stone-900 dark:ring-stone-700">
          {hits.map((p) => <button key={p.id} type="button" onClick={() => { onChange(p.id); setQ('') }} className="flex w-full items-center gap-2 px-2 py-1 text-left text-sm hover:bg-stone-100 dark:hover:bg-stone-800"><Sprite id={p.id} size={32} />{p.name} <span className="text-xs text-stone-400">#{p.id}</span></button>)}
        </div>
      )}
    </div>
  )
}

function MoveSelect({ p, level, value, onChange }: { p: Pokemon; level: number; value: number | undefined; onChange: (m: number | undefined) => void }) {
  const db = getDb()
  const learnable = useMemo(() => {
    const ids = new Set<number>()
    for (const [l, m] of p.levelUp) if (l <= level) ids.add(m)
    const lv = [...ids].map((m) => ({ m, src: 'Lv' }))
    const tm = p.tmhm.map((it) => ({ m: db.itemById.get(it)!.move!, src: db.itemById.get(it)!.name.split(' ')[0] })).filter((x) => !ids.has(x.m))
    const tu = p.tutor.filter((m) => !ids.has(m)).map((m) => ({ m, src: 'Tutor' }))
    const eg = p.egg.filter((m) => !ids.has(m)).map((m) => ({ m, src: 'Egg' }))
    let pre: { m: number; src: string }[] = []
    let f = p.evolvesFrom ? db.pokemonById.get(p.evolvesFrom) : undefined
    while (f) { for (const [l, m] of f.levelUp) if (l <= level && !ids.has(m)) { pre.push({ m, src: f.name }); ids.add(m) } f = f.evolvesFrom ? db.pokemonById.get(f.evolvesFrom) : undefined }
    return [...lv, ...pre, ...tm, ...tu, ...eg]
  }, [db, p, level])
  return (
    <select value={value ?? ''} onChange={(e) => onChange(e.target.value ? Number(e.target.value) : undefined)} className="input py-1">
      <option value="">— empty —</option>
      {value && !learnable.some((x) => x.m === value) && <option value={value}>{db.moveById.get(value)?.name}</option>}
      {learnable.map((x) => { const mo = db.moveById.get(x.m)!; return <option key={x.m + x.src} value={x.m}>{mo.name} ({mo.type}{mo.power ? ` ${mo.power}` : ''}) · {x.src}</option> })}
    </select>
  )
}

function MonEditor({ mon, onSave, onCancel }: { mon: Partial<OwnedMon>; onSave: (m: Omit<OwnedMon, 'uid'>) => void; onCancel: () => void }) {
  const db = getDb()
  const [species, setSpecies] = useState<number | null>(mon.species ?? null)
  const [level, setLevel] = useState(mon.level ?? 5)
  const [nick, setNick] = useState(mon.nickname ?? '')
  const [moves, setMoves] = useState<(number | undefined)[]>([...(mon.moves ?? []), undefined, undefined, undefined, undefined].slice(0, 4))
  const [item, setItem] = useState<number | undefined>(mon.item)
  const [nature, setNature] = useState(mon.nature ?? '')
  const [ability, setAbility] = useState<number | undefined>(mon.ability)
  const [inParty, setInParty] = useState(mon.inParty ?? true)
  const p = species ? db.pokemonById.get(species) : null
  const holdables = useMemo(() => db.items.filter((i) => !i.keyItem && i.pocket !== 'tm case' && i.pocket !== 'poke balls').sort((a, b) => a.name.localeCompare(b.name)), [db])
  return (
    <div className="card space-y-2 p-3">
      <PokemonPicker value={species} onChange={(id) => { setSpecies(id); const pp = db.pokemonById.get(id)!; if (!mon.species || mon.species !== id) setMoves([...defaultMoves(pp, level), undefined, undefined, undefined, undefined].slice(0, 4)) }} />
      {p && (
        <>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <label className="text-xs">Level<input type="number" min={1} max={100} value={level} onChange={(e) => setLevel(Math.max(1, Math.min(100, Number(e.target.value) || 1)))} className="input" /></label>
            <label className="text-xs">Nickname<input value={nick} onChange={(e) => setNick(e.target.value)} className="input" placeholder={p.name} /></label>
            <label className="text-xs">Nature<select value={nature} onChange={(e) => setNature(e.target.value)} className="input"><option value="">unknown</option>{Object.keys(NATURES).map((n) => <option key={n}>{n}</option>)}</select></label>
            <label className="text-xs">Ability<select value={ability ?? ''} onChange={(e) => setAbility(e.target.value ? Number(e.target.value) : undefined)} className="input"><option value="">unknown</option>{p.abilities.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select></label>
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">{moves.map((m, i) => <MoveSelect key={i} p={p} level={level} value={m} onChange={(v) => setMoves(moves.map((x, j) => (j === i ? v : x)))} />)}</div>
          <div className="flex flex-wrap items-center gap-2">
            <label className="flex-1 text-xs">Held item<select value={item ?? ''} onChange={(e) => setItem(e.target.value ? Number(e.target.value) : undefined)} className="input"><option value="">none</option>{holdables.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}</select></label>
            <label className="flex items-center gap-1 text-sm"><input type="checkbox" checked={inParty} onChange={(e) => setInParty(e.target.checked)} className="accent-red-700" /> In party</label>
          </div>
          <div className="flex justify-end gap-2">
            <button className="btn-ghost" onClick={onCancel}>Cancel</button>
            <button className="btn-primary" onClick={() => onSave({ species: p.id, level, nickname: nick || undefined, moves: moves.filter((x): x is number => !!x), item, nature: nature || undefined, ability, inParty })}>Save</button>
          </div>
        </>
      )}
      {!p && <div className="flex justify-end"><button className="btn-ghost" onClick={onCancel}>Cancel</button></div>}
    </div>
  )
}

function MonCard({ mon, onEdit }: { mon: OwnedMon; onEdit: () => void }) {
  const db = getDb()
  const p = db.pokemonById.get(mon.species)!
  const updateMon = useProgress((s) => s.updateMon)
  const removeMon = useProgress((s) => s.removeMon)
  const st = calcStats(p.stats, mon.level, { nature: mon.nature })
  const alerts = monAlerts(db, mon)
  const evo = p.evolutions.find((e) => e.method === 'level' && e.level && e.level <= mon.level)
  return (
    <div className="card p-3">
      <div className="flex gap-3">
        <Link to={`/dex/${p.id}`}><Sprite id={p.id} size={64} /></Link>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <b>{mon.nickname || p.name}</b>{mon.nickname && <span className="text-xs text-stone-500">({p.name})</span>}
            <span className="text-sm text-stone-500">Lv.{mon.level}</span>
            {p.types.map((t) => <TypeBadge key={t} type={t} small />)}
            {mon.item && <span className="inline-flex items-center gap-1 text-xs"><ItemSprite item={db.itemById.get(mon.item)!} size={18} />{db.itemById.get(mon.item)?.name}</span>}
          </div>
          <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-sm">{mon.moves.map((m) => <span key={m} className="inline-flex items-center gap-1"><MoveLink id={m} /><CategoryIcon move={db.moveById.get(m)!} /></span>)}{!mon.moves.length && <span className="text-stone-400">no moves set</span>}</div>
          <div className="mt-1 text-xs text-stone-500">HP {st.hp} · Atk {st.atk} · Def {st.def} · SpA {st.spa} · SpD {st.spd} · Spe {st.spe}{mon.nature ? ` · ${mon.nature}` : ''}{mon.ability ? ` · ${p.abilities.find((a) => a.id === mon.ability)?.name}` : ''}</div>
          {alerts.length > 0 && <ul className="mt-1 text-xs text-amber-700 dark:text-amber-400">{alerts.map((a) => <li key={a}>• {a}</li>)}</ul>}
        </div>
      </div>
      <div className="mt-2 flex flex-wrap gap-1">
        <button className="btn-ghost text-xs" onClick={() => updateMon(mon.uid, { level: Math.min(100, mon.level + 1) })}>+1 Lv</button>
        <button className="btn-ghost text-xs" onClick={onEdit}>Edit</button>
        {evo && <button className="btn-ghost text-xs" onClick={() => updateMon(mon.uid, { species: evo.to })}>Evolve → {db.pokemonById.get(evo.to)?.name}</button>}
        <button className="btn-ghost text-xs" onClick={() => updateMon(mon.uid, { inParty: !mon.inParty })}>{mon.inParty ? 'To PC box' : 'To party'}</button>
        <button className="btn-ghost text-xs text-red-600" onClick={() => { if (confirm('Release this Pokémon from the tracker?')) removeMon(mon.uid) }}>Remove</button>
      </div>
    </div>
  )
}

export default function TeamPage() {
  const db = getDb()
  const mons = useProgress((s) => s.mons)
  const addMon = useProgress((s) => s.addMon)
  const updateMon = useProgress((s) => s.updateMon)
  const starter = useProgress((s) => s.starter)
  const setStarter = useProgress((s) => s.setStarter)
  const badges = useProgress((s) => s.badges)
  const setBadge = useProgress((s) => s.setBadge)
  const [editing, setEditing] = useState<string | 'new' | null>(null)
  const party = mons.filter((m) => m.inParty)
  const box = mons.filter((m) => !m.inParty)
  return (
    <div>
      <PageTitle sub="Keep this up to date and the guide, battle helper and dashboard adapt to your team." right={<button className="btn-primary" onClick={() => setEditing('new')}>+ Add</button>}>Your team</PageTitle>
      <Section title="Starter & badges">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex gap-1">{([1, 4, 7] as const).map((s) => <button key={s} onClick={() => setStarter(starter === s ? null : s)} className={`rounded-lg p-1 ring-2 ${starter === s ? 'ring-red-600' : 'ring-transparent hover:ring-stone-300'}`} title={db.pokemonById.get(s)?.name}><Sprite id={s} size={40} /></button>)}</div>
          <div className="flex gap-1">{badges.map((b, i) => <button key={i} onClick={() => setBadge(i, !b)} className={`rounded p-0.5 ${b ? '' : 'opacity-25 grayscale'}`} title={`Badge ${i + 1}`}><img src={`${import.meta.env.BASE_URL}sprites/badges/${i + 1}.png`} className="h-7 w-7" alt="" /></button>)}</div>
        </div>
      </Section>
      {editing === 'new' && <div className="mb-3"><MonEditor mon={{ inParty: party.length < 6 }} onSave={(m) => { addMon(m); setEditing(null) }} onCancel={() => setEditing(null)} /></div>}
      <Section title={`Party (${party.length}/6)`}>
        {party.length === 0 && <Empty>No Pokémon yet. Add your starter to begin.</Empty>}
        <div className="grid gap-2 md:grid-cols-2">{party.map((m) => editing === m.uid ? <MonEditor key={m.uid} mon={m} onSave={(x) => { updateMon(m.uid, x); setEditing(null) }} onCancel={() => setEditing(null)} /> : <MonCard key={m.uid} mon={m} onEdit={() => setEditing(m.uid)} />)}</div>
        {party.length > 6 && <p className="mt-1 text-xs text-red-600">More than 6 in party: move some to the PC.</p>}
      </Section>
      <Section title={`PC boxes (${box.length})`}>
        {box.length === 0 && <Empty>Nothing boxed.</Empty>}
        <div className="grid gap-2 md:grid-cols-2">{box.map((m) => editing === m.uid ? <MonEditor key={m.uid} mon={m} onSave={(x) => { updateMon(m.uid, x); setEditing(null) }} onCancel={() => setEditing(null)} /> : <MonCard key={m.uid} mon={m} onEdit={() => setEditing(m.uid)} />)}</div>
      </Section>
    </div>
  )
}
