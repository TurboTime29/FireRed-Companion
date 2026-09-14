import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { getDb } from '../data/db'
import type { TypeName } from '../data/types'
import { NATURES, PHYSICAL_TYPES } from '../lib/battle'
import { ALL_TYPES } from '../lib/coverage'
import { PageTitle, Section, Seg, Sprite, TypeBadge } from '../components/ui'

const STATUS = [
  ['Sleep', '1–4 turns in Gen 3 (a Pokémon switched out keeps its counter). Doubles catch odds. Early Bird halves it; Insomnia/Vital Spirit prevent it. Sleep Talk and Snore work while asleep.'],
  ['Freeze', 'No moves; 20% chance to thaw each turn, or instantly when hit by a Fire move or using Flame Wheel/Sacred Fire. Doubles catch odds. Only Ice moves (10%) and Tri Attack cause it; Ice types cannot be frozen.'],
  ['Burn', 'Loses 1/8 max HP per turn and halves physical damage dealt (Guts ignores the halving). Fire types cannot be burned. ×1.5 catch odds.'],
  ['Poison / Toxic', 'Poison: 1/8 max HP per turn. Toxic: 1/16, then 2/16, 3/16… resets on switch. Poison and Steel types are immune. Poison hurts while walking (1 HP per 4 steps) until 1 HP. ×1.5 catch odds.'],
  ['Paralysis', 'Speed ÷4 and a 25% chance to lose the turn. Electric types can still be paralysed in Gen 3. ×1.5 catch odds.'],
  ['Confusion', '2–5 turns; 50% chance each turn to hit yourself with a 40-power typeless physical hit. Cured by switching.'],
  ['Attraction', 'Opposite-gender only: 50% chance to skip the turn. Cured by switching. Oblivious prevents it.'],
]
const QUIRKS = [
  ['No clock', 'FireRed has no real-time clock. Nothing is time-based: berries don\'t grow, there is no day/night, and Eevee cannot become Espeon or Umbreon here (trade it to Ruby/Sapphire/Emerald/Colosseum to evolve, then trade back).'],
  ['TMs are single-use', 'Each TM disappears when taught. HMs are reusable. See the TM planner for which ones you can buy again.'],
  ['Repel trick', 'A Repel only stops wild Pokémon whose level is lower than your lead\'s. Lead with a Pokémon at exactly the level of the rare, higher-level encounter you want and lower ones vanish. Doesn\'t work on Safari Zone bait/rock logic or fishing.'],
  ['Sweet Scent', 'Instantly starts a wild encounter on the current tile (grass, cave floor, or while surfing). Great for hunting.'],
  ['Vs. Seeker', 'Rechargeable after 100 steps. Trainers on the same map who are "ready" want a rematch; each trainer has up to four stronger rematch teams. Gym leaders do not rematch in FireRed.'],
  ['Pickup', 'Gen 3 Pickup: after a battle, a Pickup Pokémon with no item has a 10% chance to pick one up. FireRed table: Potion, Antidote, Super Potion, Great Ball, Repel, Escape Rope, Full Heal, Hyper Potion, Ultra Ball, Rare Candy (1%), Nugget, King\'s Rock and more — Meowth, Aipom, Zigzagoon, Linoone, Phanpy and Teddiursa.'],
  ['Shiny odds and timing', '1 in 8192. A Pokémon\'s colours are fixed when it is generated: wild and legendary encounters when the battle starts (save in front of them and soft reset), gifts (starters, Eevee, Lapras, Hitmonlee/Hitmonchan, Magikarp) when received, fossils when revived on Cinnabar, the Togepi egg when the egg is received.'],
  ['Friendship', 'Starts at 70 (Lapras/legendaries lower, Chansey/Clefairy 140). +5/+3/+2 per level up depending on how high it already is, +1 per 256 steps, +vitamins, Soothe Bell adds 50%; fainting −1, Energy Powder/Heal Powder −5/−10. Golbat, Chansey, Pichu, Cleffa, Igglybuff, Togepi and Azurill evolve at 220+ on level-up. Return/Frustration power scales with it.'],
  ['IVs and EVs', 'IVs 0–31 per stat, fixed at generation. EVs come from defeating Pokémon (each species gives 1–3 in specific stats), max 255 per stat and 510 total; 4 EVs = 1 stat point at Lv.100. Vitamins give +10 up to 100. Macho Brace doubles EV gain; Pokérus doubles it too (rare).'],
  ['Badge boosts', 'Boulder Badge +10% Attack, Thunder +10% Speed, Soul +10% Defense, Volcano +10% Sp. Atk and Sp. Def. Applied in the Battle helper automatically.'],
  ['Critical hits', '1/16 base; Slash/Crabhammer/Karate Chop/Razor Leaf/Cross Chop/Aeroblast/Sky Attack 1/4 (with Scope Lens 1/3, Focus Energy stacks). A crit does ×2 and ignores the attacker\'s negative and the defender\'s positive stat changes, plus Reflect/Light Screen.'],
  ['Weather', 'Sun: Fire ×1.5, Water ×0.5, Solar Beam instant, Thunder 50% accuracy. Rain: Water ×1.5, Fire ×0.5, Thunder never misses, Solar Beam halved. Sandstorm/Hail: 1/16 chip damage to non-Rock/Ground/Steel (or non-Ice). 5 turns.'],
  ['Trade evolutions', 'Kadabra, Machoke, Graveler, Haunter (plain trade); Onix→Steelix with Metal Coat, Scyther→Scizor with Metal Coat, Seadra→Kingdra with Dragon Scale, Porygon with Up-Grade, Poliwhirl→Politoed and Slowpoke→Slowking with King\'s Rock, Clamperl with Deepsea Tooth/Scale. Needs a link cable or the wireless adapter with a second game.'],
  ['Day Care', 'Four Island (after the National Dex). Two compatible Pokémon may leave an egg; the man outside faces the road when there is one. Levels up 1 EXP per step but forgets moves the normal way. Everstone does not pass natures in FireRed (that is Emerald only).'],
]

export default function MechanicsPage() {
  const db = getDb()
  const [tab, setTab] = useState<'basics' | 'types' | 'status' | 'abilities' | 'natures'>('basics')
  const [q, setQ] = useState('')
  const abilities = useMemo(() => db.extras.abilities.filter((a) => !q || a.name.toLowerCase().includes(q.toLowerCase()) || a.text.toLowerCase().includes(q.toLowerCase())), [db, q])
  const chart = db.typechart
  return (
    <div>
      <PageTitle hero sub="How Generation III actually works: the rules FireRed uses that later games changed.">Mechanics</PageTitle>
      <Seg className="mb-3" value={tab} onChange={(v) => setTab(v)} options={[{ value: 'basics', label: 'Gen 3 quirks' }, { value: 'types', label: 'Physical / special' }, { value: 'status', label: 'Status' }, { value: 'abilities', label: 'Abilities' }, { value: 'natures', label: 'Natures' }]} />
      {tab === 'basics' && (
        <div className="fade-up space-y-2">
          {QUIRKS.map(([h, t]) => <Section key={h} title={h}><p className="text-sm text-stone-700 dark:text-stone-200">{t}</p></Section>)}
        </div>
      )}
      {tab === 'types' && (
        <div className="fade-up">
          <Section title="Category is decided by the move's type, not the move">
            <p className="mb-2 text-sm">Before Gen 4 every move of a type shares its category. Bite is special, Shadow Ball is physical, Hidden Power uses Attack or Sp. Atk depending on its type.</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div><div className="mb-1 text-[11px] font-bold uppercase tracking-wider text-orange-600">Physical (uses Attack vs Defense)</div><div className="flex flex-wrap gap-1">{ALL_TYPES.filter((t) => PHYSICAL_TYPES.has(t)).map((t) => <TypeBadge key={t} type={t} />)}</div></div>
              <div><div className="mb-1 text-[11px] font-bold uppercase tracking-wider text-sky-600">Special (uses Sp. Atk vs Sp. Def)</div><div className="flex flex-wrap gap-1">{ALL_TYPES.filter((t) => !PHYSICAL_TYPES.has(t)).map((t) => <TypeBadge key={t} type={t} />)}</div></div>
            </div>
          </Section>
          <Section title="Type chart differences from modern games">
            <ul className="list-disc space-y-1 pl-5 text-sm">
              <li>No Fairy type. Clefairy, Jigglypuff, Togepi and friends are pure Normal; Mr. Mime is pure Psychic; Gardevoir is pure Psychic.</li>
              <li>Steel resists Ghost and Dark (removed in Gen 6).</li>
              <li>Ghost and Dark moves are physical/special by type: Shadow Ball and Bite/Crunch categories are the reverse of modern games.</li>
              <li>Full chart: <Link className="link" to="/types">type chart</Link>.</li>
            </ul>
            <div className="mt-2 text-xs text-stone-500">Immunities in this chart: {ALL_TYPES.flatMap((a) => ALL_TYPES.filter((d) => chart.effectiveness[a]?.[d] === 0).map((d) => `${a}→${d}`)).join(', ')}.</div>
          </Section>
        </div>
      )}
      {tab === 'status' && (
        <div className="fade-up">
          {STATUS.map(([h, t]) => <Section key={h} title={h}><p className="text-sm text-stone-700 dark:text-stone-200">{t}</p></Section>)}
          <Section title="Cures"><p className="text-sm">Antidote (poison), Paralyze Heal, Awakening (sleep), Burn Heal, Ice Heal, Full Heal (any). Berries: Cheri (par), Chesto (slp), Pecha (psn), Rawst (brn), Aspear (frz), Lum (any). A Pokémon Center cures everything. Natural Cure heals on switch-out; Shed Skin has a 30% chance each turn.</p></Section>
        </div>
      )}
      {tab === 'abilities' && (
        <div className="fade-up">
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search abilities" className="input mb-3" />
          <div className="card divide-y divide-stone-100 dark:divide-stone-800">
            {abilities.map((a) => (
              <div key={a.id} className="px-3 py-2 text-sm">
                <div className="flex flex-wrap items-baseline gap-2"><b>{a.name}</b><span className="text-stone-600 dark:text-stone-300">{a.text}</span></div>
                <div className="mt-1 flex flex-wrap gap-0.5">{a.pokemon.slice(0, 14).map((id) => <Link key={id} to={`/dex/${id}`} className="hover-bounce" title={db.pokemonById.get(id)?.name}><Sprite id={id} size={26} /></Link>)}{a.pokemon.length > 14 && <span className="self-center text-xs text-stone-400">+{a.pokemon.length - 14}</span>}</div>
              </div>
            ))}
          </div>
          <p className="mt-2 text-xs text-stone-500">Battle-relevant ones are already applied in the Battle helper: Levitate, Volt/Water Absorb, Flash Fire, Wonder Guard, Soundproof, Thick Fat, Huge/Pure Power, Hustle, Guts, Marvel Scale, Overgrow/Blaze/Torrent/Swarm, Chlorophyll, Swift Swim, Cloud Nine.</p>
        </div>
      )}
      {tab === 'natures' && (
        <div className="fade-up">
          <Section title="Natures: +10% to one stat, −10% to another">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-[11px] uppercase tracking-wide text-stone-500"><tr><th className="py-1">Nature</th><th className="py-1">Raises</th><th className="py-1">Lowers</th></tr></thead>
                <tbody>{Object.entries(NATURES).map(([n, v]) => <tr key={n} className="border-t border-stone-100 dark:border-stone-800"><td className="py-1 font-medium">{n}</td><td className="py-1 text-emerald-600">{label(v.up)}</td><td className="py-1 text-red-600">{label(v.down)}</td></tr>)}</tbody>
              </table>
            </div>
            <p className="mt-2 text-xs text-stone-500">Nature is fixed at generation (PID % 25) and cannot be changed. Synchronize does not affect wild natures in Gen 3 (that starts in Emerald). Five natures are neutral: Hardy, Docile, Serious, Bashful, Quirky.</p>
          </Section>
        </div>
      )}
    </div>
  )
}

function label(k?: string) { return k ? ({ atk: 'Attack', def: 'Defense', spa: 'Sp. Atk', spd: 'Sp. Def', spe: 'Speed' } as Record<string, string>)[k] : '—' }

export type _T = TypeName
