import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { getDb } from '../data/db'
import { useProgress } from '../store/progress'
import { ItemSprite, LocationLink, PageTitle, Section, Sprite } from '../components/ui'

const STAR: Record<number, string> = {
  197: 'Lucky Egg: +50% EXP. The single best item for levelling; Chansey is rare, so bring a Thief user and patience.',
  200: 'Leftovers: heals 1/16 HP every turn. Snorlax always holds one in the wild.',
  199: 'Metal Coat: needed to evolve Onix→Steelix and Scyther→Scizor by trade; also +10% Steel moves.',
  187: "King's Rock: flinch chance; evolves Poliwhirl→Politoed and Slowpoke→Slowking by trade.",
  183: 'Quick Claw: 20% chance to move first.',
  196: 'Focus Band: 10% chance to survive a KO hit.',
  195: 'Everstone: stops evolution; useful for Pokémon that learn moves earlier unevolved.',
  202: 'Light Ball: doubles Pikachu\'s Sp. Atk.',
  224: 'Thick Club: doubles Cubone/Marowak\'s Attack.',
  225: "Stick: Farfetch'd critical-hit boost.",
  201: 'Dragon Scale: evolves Seadra→Kingdra by trade.',
  218: 'Up-Grade: evolves Porygon→Porygon2 by trade.',
  192: 'Deepseatooth: evolves Clamperl→Huntail by trade (Sevii only).',
  193: 'Deepseascale: evolves Clamperl→Gorebyss by trade (Sevii only).',
  223: 'Metal Powder: doubles Ditto\'s Defense.',
}

export default function HeldItemsPage() {
  const db = getDb()
  const flags = useProgress((s) => s.flags)
  const rows = useMemo(() => {
    const byItem = new Map<number, { holders: { id: number; where: { map: string; method: string; rate: number; min: number; max: number }[] }[] }>()
    for (const p of db.pokemon) for (const it of new Set(p.heldItems)) {
      const e = byItem.get(it) ?? { holders: [] }
      e.holders.push({ id: p.id, where: p.locations ?? [] })
      byItem.set(it, e)
    }
    return [...byItem.entries()].map(([it, e]) => ({ item: db.itemById.get(it)!, holders: e.holders, catchable: e.holders.some((h) => h.where.length > 0) }))
      .filter((r) => r.item).sort((a, b) => (STAR[b.item.id] ? 1 : 0) - (STAR[a.item.id] ? 1 : 0) || (b.catchable ? 1 : 0) - (a.catchable ? 1 : 0) || a.item.name.localeCompare(b.item.name))
  }, [db])
  const thief = db.itemById.get(db.items.find((i) => i.name.endsWith('Thief'))?.id ?? 0)
  const thiefBall = thief ? db.locations.find((l) => l.items.some((b) => b.item === thief.id) || l.hiddenItems.some((b) => b.item === thief.id)) : undefined
  const thiefGot = thief ? db.locations.some((l) => l.items.some((b) => b.item === thief.id && flags[b.flag])) : false
  const thiefLearners = thief ? db.pokemon.filter((p) => p.tmhm.includes(thief.id) && p.id <= 151 && (p.locations?.length || p.availability === 'gift')).slice(0, 12) : []
  return (
    <div>
      <PageTitle hero sub="Every item wild Pokémon can hold in FireRed, with where to find the holders. Steal them with Thief or Covet, or catch the Pokémon.">Held-item farming</PageTitle>
      <Section title="How to steal">
        <p className="text-sm">Use <b>Thief</b> ({thief ? <Link className="link" to={`/items/${thief.id}`}>{thief.name}</Link> : 'TM46'}{thiefBall ? <>, item ball in <LocationLink id={thiefBall.id} />{thiefGot ? ' ✓ collected' : ''}</> : ''}) on a wild Pokémon while your attacker holds nothing. The stolen item stays on your Pokémon after the battle. Wild held items are a 50% chance for the common item and 5% for the rare one, so expect several attempts; use a Pokémon that survives and a low-power Thief user so you can keep stealing without KOs.</p>
        {thiefLearners.length > 0 && <div className="mt-2 flex flex-wrap items-center gap-1 text-xs text-stone-500">Good Thief users you can get: {thiefLearners.map((p) => <Link key={p.id} to={`/dex/${p.id}`} className="hover-bounce inline-flex items-center"><Sprite id={p.id} size={28} /></Link>)}</div>}
        <p className="mt-2 text-xs text-stone-500">Covet does the same, but no Pokémon obtainable in FireRed learns it without breeding, so Thief is the practical option. Wild held items are rolled when the battle starts, so you can soft-reset in front of a static Pokémon (Snorlax) until it holds what you want.</p>
      </Section>
      <Section title="Items and their holders">
        <div className="divide-y divide-stone-100 dark:divide-stone-800">
          {rows.map(({ item, holders, catchable }) => (
            <div key={item.id} className={`py-2 text-sm ${catchable ? '' : 'opacity-60'}`}>
              <div className="flex flex-wrap items-center gap-2">
                <Link to={`/items/${item.id}`} className="inline-flex items-center gap-1 font-semibold link"><ItemSprite item={item} />{item.name}</Link>
                {STAR[item.id] && <span className="chip bg-amber-200 text-[10px] text-amber-900 dark:bg-amber-900/60 dark:text-amber-100">★ worth it</span>}
                {!catchable && <span className="text-xs text-stone-400">holders not catchable in FireRed</span>}
              </div>
              {STAR[item.id] && <div className="text-xs text-stone-600 dark:text-stone-300">{STAR[item.id]}</div>}
              <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs">
                {holders.map((h) => {
                  const p = db.pokemonById.get(h.id)!
                  const best = [...h.where].sort((a, b) => b.rate - a.rate).slice(0, 3)
                  return (
                    <span key={h.id} className="inline-flex flex-wrap items-center gap-1">
                      <Link to={`/dex/${p.id}`} className="hover-bounce inline-flex items-center gap-1"><Sprite id={p.id} size={26} />{p.name}</Link>
                      {best.length ? best.map((w, i) => <span key={i} className="text-stone-500"><LocationLink id={w.map} /> {w.rate}%{i < best.length - 1 ? ',' : ''}</span>) : <span className="text-stone-400">(evolve / trade only)</span>}
                    </span>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      </Section>
    </div>
  )
}
