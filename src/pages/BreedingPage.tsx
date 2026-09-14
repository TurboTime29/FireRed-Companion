import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { getDb } from '../data/db'
import type { Pokemon } from '../data/types'
import { useProgress } from '../store/progress'
import { Empty, MoveLink, PageTitle, Section, Sprite, TypeBadge } from '../components/ui'

const INCENSE: Record<number, { baby: number; item: string }> = { 183: { baby: 298, item: 'Sea Incense' }, 202: { baby: 360, item: 'Lax Incense' } }
const DITTO = 132

/** base form of an evolution line */
function baseOf(p: Pokemon): Pokemon {
  const db = getDb()
  let r = p
  while (r.evolvesFrom) r = db.pokemonById.get(r.evolvesFrom)!
  return r
}

/** What hatches when the mother (or non-Ditto parent) is `p`: the base form, unless the base is an incense baby. */
function hatchesFrom(p: Pokemon): { species: Pokemon; incense?: string } {
  const db = getDb()
  const base = baseOf(p)
  for (const [parentId, v] of Object.entries(INCENSE)) if (v.baby === base.id) { const parent = db.pokemonById.get(Number(parentId))!; return { species: baseOf(parent).id === parent.id ? parent : db.pokemonById.get(Number(parentId))!, incense: v.item } }
  return { species: base }
}

function compatible(a: Pokemon, b: Pokemon, ga: string | undefined, gb: string | undefined): { ok: boolean; why: string } {
  if (a.eggGroups.includes('no-eggs') || b.eggGroups.includes('no-eggs') || a.eggGroups.includes('Undiscovered') || b.eggGroups.includes('Undiscovered')) return { ok: false, why: 'Undiscovered egg group: cannot breed' }
  if (a.id === DITTO && b.id === DITTO) return { ok: false, why: 'Two Ditto cannot breed' }
  if (a.id === DITTO || b.id === DITTO) return { ok: true, why: 'Ditto breeds with anything that can breed' }
  if (!a.eggGroups.some((g) => b.eggGroups.includes(g))) return { ok: false, why: 'No shared egg group' }
  if (ga && gb && ga !== '-' && gb !== '-' && ga === gb) return { ok: false, why: 'Same gender' }
  if ((ga === '-' && b.id !== DITTO) || (gb === '-' && a.id !== DITTO)) return { ok: false, why: 'Genderless Pokémon only breed with Ditto' }
  return { ok: true, why: 'Shared egg group, opposite genders' }
}

export default function BreedingPage() {
  const db = getDb()
  const mons = useProgress((s) => s.mons)
  const [q, setQ] = useState('')
  const [target, setTarget] = useState<number | null>(null)
  const hits = useMemo(() => (q ? db.pokemon.filter((p) => p.name.toLowerCase().startsWith(q.toLowerCase()) || String(p.id) === q).slice(0, 8) : []), [db, q])
  const t = target ? db.pokemonById.get(target) : null
  const base = t ? hatchesFrom(t) : null
  const eggMovesOf = base ? base.species.egg : []
  // fathers that can pass each egg move: species in a shared egg group that learn the move by level-up or TM (Gen 3 chain-breeding simplified to direct sources)
  const fathers = useMemo(() => {
    if (!base) return new Map<number, Pokemon[]>()
    const out = new Map<number, Pokemon[]>()
    for (const mv of eggMovesOf) {
      const list = db.pokemon.filter((p) => p.id !== base.species.id && p.femaleRatio !== 100 && p.femaleRatio !== null && p.eggGroups.some((g) => base.species.eggGroups.includes(g)) && (p.levelUp.some(([, m]) => m === mv) || p.tmhm.some((it) => db.itemById.get(it)?.move === mv)) && (p.availability !== 'trade-only' && p.availability !== 'event'))
      out.set(mv, list.slice(0, 8))
    }
    return out
  }, [db, base, eggMovesOf])
  const mine = useMemo(() => (base ? mons.filter((m) => { const p = db.pokemonById.get(m.species)!; return baseOf(p).id === base.species.id || p.id === DITTO || p.eggGroups.some((g) => base.species.eggGroups.includes(g)) }) : []), [db, mons, base])
  const steps = base ? base.species.eggCycles * 256 : 0
  return (
    <div>
      <PageTitle hero sub="Four Island Day Care (after the National Dex). Pick what you want to hatch: parents, egg moves, and who in your PC can do it.">Breeding</PageTitle>
      <Section title="I want to hatch…">
        <div className="relative">
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t ? `${t.name} (type to change)` : 'Pokémon name'} className="input" />
          {hits.length > 0 && <div className="absolute z-10 mt-1 w-full rounded-xl bg-white shadow-lg ring-1 ring-stone-200 dark:bg-stone-900 dark:ring-stone-700">{hits.map((p) => <button key={p.id} type="button" onClick={() => { setTarget(p.id); setQ('') }} className="flex w-full items-center gap-2 px-2 py-1 text-left text-sm hover:bg-stone-100 dark:hover:bg-stone-800"><Sprite id={p.id} size={32} />{p.name}</button>)}</div>}
        </div>
        {t && base && (
          <div className="mt-3 text-sm">
            <div className="flex flex-wrap items-center gap-3">
              <span className="hover-bounce inline-flex items-center gap-1"><Sprite id={base.species.id} size={48} /><b>{base.species.name}</b></span>
              {base.species.id !== t.id && <span className="text-stone-500">hatches, then evolve into {t.name}</span>}
              {base.species.eggGroups.map((g) => <span key={g} className="chip bg-stone-200 text-[10px] dark:bg-stone-700">egg group: {g}</span>)}
              <span className="text-xs text-stone-500">{base.species.eggCycles} cycles ≈ {steps.toLocaleString()} steps to hatch (Flame Body / Magma Armor halve it)</span>
            </div>
            {base.incense && <p className="mt-1 text-xs text-amber-700 dark:text-amber-400">Needs the mother (or the non-Ditto parent) holding <b>{base.incense}</b>, otherwise you get the evolved form's egg instead.</p>}
            {(base.species.eggGroups.includes('Undiscovered') || base.species.eggGroups.includes('no-eggs')) && <p className="mt-1 text-xs text-red-600">Undiscovered egg group: this line cannot be bred.</p>}
            <p className="mt-2 text-xs text-stone-600 dark:text-stone-300">Parents: a female {base.species.name} line member (the egg is the mother's species) plus any male from a shared egg group, or either one with a Ditto. Genderless Pokémon only breed with Ditto. Ditto is wild in Cerulean Cave and Routes 13–15.</p>
          </div>
        )}
      </Section>
      {t && base && (
        <>
          <Section title="Egg moves and who can pass them">
            {eggMovesOf.length === 0 && <Empty>No egg moves for this line.</Empty>}
            <div className="divide-y divide-stone-100 dark:divide-stone-800">
              {eggMovesOf.map((mv) => { const m = db.moveById.get(mv)!; const fs = fathers.get(mv) ?? []; return (
                <div key={mv} className="flex flex-wrap items-center gap-2 py-1.5 text-sm">
                  <MoveLink id={mv} /><TypeBadge type={m.type} small /><span className="text-xs text-stone-500">{m.power || '—'} pow</span>
                  <span className="text-xs text-stone-500">father:</span>
                  {fs.length ? fs.map((f) => <Link key={f.id} to={`/dex/${f.id}`} className="hover-bounce" title={f.name}><Sprite id={f.id} size={26} /></Link>) : <span className="text-xs text-stone-400">needs a chain-bred father</span>}
                </div>
              ) })}
            </div>
            <p className="mt-2 text-xs text-stone-500">The father must know the move when deposited. TM moves the father knows that the baby can also learn by TM are inherited too. Nature is random in FireRed (no Everstone trick); 3 IVs are inherited from the parents at random.</p>
          </Section>
          <Section title="From your PC">
            {mine.length === 0 ? <Empty>Nothing in your boxes fits. Catch a {base.species.name} line member or a Ditto.</Empty> : (
              <div className="flex flex-wrap gap-1">{mine.map((m) => { const p = db.pokemonById.get(m.species)!; const g = m.gender === 'M' ? '♂' : m.gender === 'F' ? '♀' : ''; return <span key={m.uid} className="inline-flex items-center gap-1 rounded-lg bg-stone-100 px-1.5 py-0.5 text-xs dark:bg-stone-800"><Sprite id={p.id} size={24} />{m.nickname || p.name} {g} Lv.{m.level}{p.id === DITTO ? ' (Ditto)' : ''}</span> })}</div>
            )}
            {mine.length >= 2 && (() => { const pairs: string[] = []; for (let i = 0; i < mine.length; i++) for (let j = i + 1; j < mine.length; j++) { const a = db.pokemonById.get(mine[i].species)!, b = db.pokemonById.get(mine[j].species)!; const c = compatible(a, b, mine[i].gender, mine[j].gender); const motherOk = baseOf(a).id === base.species.id || baseOf(b).id === base.species.id || a.id === DITTO || b.id === DITTO; if (c.ok && motherOk) pairs.push(`${mine[i].nickname || a.name} + ${mine[j].nickname || b.name}`) } return pairs.length ? <p className="mt-2 text-xs text-emerald-700 dark:text-emerald-400">Working pairs: {pairs.slice(0, 6).join(' · ')}</p> : <p className="mt-2 text-xs text-stone-500">No compatible pair yet (need opposite genders in a shared group, or a Ditto, with the mother in the {base.species.name} line).</p> })()}
          </Section>
        </>
      )}
      {!t && <Empty>Search for the Pokémon you want to hatch.</Empty>}
    </div>
  )
}
