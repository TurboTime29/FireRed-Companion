import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { getDb } from '../data/db'
import { useProgress } from '../store/progress'
import { trainerDisplayName } from '../lib/selectors'
import { Check, ItemSprite, LocationLink, MoveLink, PageTitle, Progress, Section, Seg, Sprite } from '../components/ui'
import { EncounterCard, useEncounters } from '../components/EncounterCard'

const TOWER_PRIZES = [42, 43, 44, 45, 46, 47, 179, 180, 185, 186, 187, 198, 199, 201, 218] // sPrizeList order: HP Up … Up-Grade (ids resolved by name below)
const TOWER_PRIZE_NAMES = ['HP Up', 'Protein', 'Iron', 'Carbos', 'Calcium', 'Zinc', 'Brightpowder', 'White Herb', 'Mental Herb', 'Choice Band', "King's Rock", 'Scope Lens', 'Metal Coat', 'Dragon Scale', 'Up-Grade']

const QUESTS: { id: string; title: string; text: string; chapter?: number }[] = [
  { id: 'natdex', title: 'National Dex', text: 'Own 60 Pokémon, then talk to Oak after the Hall of Fame (see his aide too). Unlocks Johto/Hoenn evolutions and the Day Care egg.', chapter: 17 },
  { id: 'ruby', title: 'Ruby (Mt. Ember)', text: 'After the League, beat the two Rocket Grunts in the Mt. Ember cave (One Island) and take the Ruby from the deepest room. Give it to Celio.', chapter: 17 },
  { id: 'password', title: 'Rocket Warehouse passwords', text: 'Two Rocket Grunts (Icefall Cave, Six Island) give the passwords "GOLDEEN need log" and "YES, NAH, CHANSEY". Enter the Five Island warehouse.', chapter: 18 },
  { id: 'sapphire', title: 'Sapphire (Dotted Hole → Rocket Warehouse)', text: 'Use Cut on the Dotted Hole door on Six Island, solve the braille puzzle (Up, Left, Right, Down, then Up in the middle), the Scientist steals the Sapphire; beat him in the Rocket Warehouse and take it to Celio. Enables trading with Ruby/Sapphire/Emerald.', chapter: 18 },
  { id: 'lostelle', title: 'Lostelle in Berry Forest', text: 'Talk to the girl\'s father on Three Island, find her in Berry Forest (Hypno battle) to unlock the way back. Needed to progress the Sevii story.', chapter: 17 },
  { id: 'togepi', title: 'Togepi egg', text: 'Water Labyrinth (Five Island): show the man a Pokémon with high friendship in the lead and he gives the Togepi egg. Save before receiving it if you want a shiny.', chapter: 18 },
  { id: 'tutors', title: 'Move tutors', text: 'Cape Brink (Two Island): Frenzy Plant / Blast Burn / Hydro Cannon for your fully evolved starter with max friendship. Other tutors below.', chapter: 20 },
  { id: 'tower', title: 'Trainer Tower', text: 'Seven Island. Single, double and knockout modes with a timer; first clear of each gives a prize from the list below (HP Up … Up-Grade), better times give better items.', chapter: 18 },
  { id: 'tanoby', title: 'Tanoby Key and Unown', text: 'Solve the Tanoby Key boulder puzzle in Sevault Canyon; Unown appear in the seven Tanoby Chambers (Ruins Valley).', chapter: 18 },
  { id: 'mewtwo', title: 'Cerulean Cave', text: 'Opens after the Sevii Ruby/Sapphire quest. Mewtwo Lv.70 at the end of B1F. Save in front of it; bring Ultra Balls, sleep and False Swipe.', chapter: 19 },
  { id: 'e4', title: 'Elite Four round 2', text: 'After Cerulean Cave/Sapphire, the League is Lv.63–75 with new teams (Lorelei\'s Jynx, Bruno\'s Steelix and Hitmontop…). Repeatable for EXP and money.', chapter: 19 },
  { id: 'events', title: 'Event tickets (not obtainable)', text: 'Deoxys (Birth Island), Lugia/Ho-Oh (Navel Rock) needed Nintendo event tickets. They are not available in a normal playthrough.', chapter: 20 },
]

export default function PostgamePage() {
  const db = getDb()
  const notes = useProgress((s) => s.notes)
  const setNote = useProgress((s) => s.setNote)
  const beaten = useProgress((s) => s.beaten)
  const steps = useProgress((s) => s.steps)
  const [tab, setTab] = useState<'quests' | 'rematch' | 'corner' | 'tutors' | 'legends'>('quests')
  const encounters = useEncounters()
  const rematchers = useMemo(() => db.trainers.filter((t) => t.rematches?.length).map((t) => ({ t, tiers: t.rematches!.map((id) => db.trainerById.get(id)!).filter(Boolean) })), [db])
  const [where, setWhere] = useState('')
  const rows = rematchers.filter((r) => !where || r.t.maps.some((m) => db.locationById.get(m)?.name.toLowerCase().includes(where.toLowerCase())))
  const tutors = db.locations.flatMap((l) => l.tutors.map((t) => ({ l, t })))
  const done = (id: string) => notes[`pg:${id}`] === 'done'
  const doneCount = QUESTS.filter((q) => done(q.id)).length
  const prizes = TOWER_PRIZE_NAMES.map((n) => db.items.find((i) => i.name === n)).filter(Boolean)
  const gc = db.extras.gameCorner
  return (
    <div>
      <PageTitle hero sub="Everything after the Hall of Fame: Sevii quests, rematches, the Tower, the Game Corner and the tutors.">Post-game</PageTitle>
      <Seg className="mb-3" value={tab} onChange={(v) => setTab(v)} options={[{ value: 'quests', label: `Quests ${doneCount}/${QUESTS.length}` }, { value: 'rematch', label: 'Vs. Seeker' }, { value: 'corner', label: 'Game Corner' }, { value: 'tutors', label: 'Tutors' }, { value: 'legends', label: 'Legendaries' }]} />
      {tab === 'quests' && (
        <Section title="Sevii & post-game checklist" right={<span className="text-xs text-stone-500">Chapters 17–20 have the step-by-step</span>}>
          <Progress pct={(doneCount / QUESTS.length) * 100} className="mb-2" color="bg-emerald-500" />
          {QUESTS.map((q) => {
            const c = q.chapter ? db.chapters.find((x) => x.n === q.chapter) : undefined
            return <Check key={q.id} checked={done(q.id)} onChange={(v) => setNote(`pg:${q.id}`, v ? 'done' : '')} label={<span className="font-medium">{q.title}</span>} sub={<>{q.text} {c && <Link className="link" to={`/guide/${c.id}`}>Ch.{c.n} →</Link>}</>} />
          })}
          <div className="mt-2 text-xs text-stone-500">Trainer Tower prizes: <span className="inline-flex flex-wrap gap-1 align-middle">{prizes.map((it) => <Link key={it!.id} to={`/items/${it!.id}`} className="inline-flex items-center gap-0.5 link"><ItemSprite item={it!} size={18} />{it!.name}</Link>)}</span></div>
        </Section>
      )}
      {tab === 'rematch' && (
        <Section title={`Vs. Seeker rematches (${rematchers.length} trainers)`} right={<input value={where} onChange={(e) => setWhere(e.target.value)} placeholder="filter by route" className="input w-40 py-0.5 text-xs" />}>
          <p className="mb-2 text-xs text-stone-500">Each trainer has up to 3 stronger teams; the tier you get depends on your badges and how often you've beaten them. Levels shown are each tier's highest. ✓ = first fight already won.</p>
          <div className="divide-y divide-stone-100 dark:divide-stone-800">
            {rows.map(({ t, tiers }) => (
              <div key={t.id} className="flex flex-wrap items-center gap-2 py-1.5 text-sm">
                <Link to={`/trainers/${t.id}`} className={`font-medium link ${beaten[t.id] ? '' : 'opacity-70'}`}>{beaten[t.id] ? '✓ ' : ''}{trainerDisplayName(t)}</Link>
                <span className="text-xs text-stone-500">{t.maps.map((m) => db.locationById.get(m)?.name).filter(Boolean).join(', ')}</span>
                <span className="ml-auto flex items-center gap-1 text-xs">
                  <span className="chip bg-stone-200 text-[10px] dark:bg-stone-700">Lv.{Math.max(...t.party.map((m) => m.level))}</span>
                  {tiers.map((r, i) => <Link key={r.id} to={`/battle?t=${r.id}`} className="chip-btn text-[10px]" title={r.party.map((m) => `${db.pokemonById.get(m.species)?.name} Lv.${m.level}`).join(', ')}>T{i + 1}: Lv.{Math.max(...r.party.map((m) => m.level))}</Link>)}
                </span>
                <span className="hidden gap-0.5 sm:flex">{tiers[tiers.length - 1]?.party.map((m, i) => <Sprite key={i} id={m.species} size={22} />)}</span>
              </div>
            ))}
          </div>
        </Section>
      )}
      {tab === 'corner' && (
        <Section title="Celadon Game Corner prizes (FireRed)">
          <p className="mb-2 text-sm">Coins: buy 50 for $1,000 or 500 for $10,000 at the counter. Buying is far faster than playing: the slots average a loss. The prize corner is the building to the right.</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {gc.map((g, i) => (
              <div key={i} className="flex items-center gap-2 rounded-xl bg-stone-50 p-2 text-sm dark:bg-stone-800/60">
                {g.kind === 'pokemon' ? <Link to={`/dex/${g.id}`} className="hover-bounce flex items-center gap-2"><Sprite id={g.id} size={40} /><b>{db.pokemonById.get(g.id)?.name}</b></Link> : <Link to={`/items/${g.id}`} className="flex items-center gap-2 link"><ItemSprite item={db.itemById.get(g.id)!} size={28} /><b>{db.itemById.get(g.id)?.name}</b></Link>}
                <span className="ml-auto tabular-nums text-stone-600 dark:text-stone-300">{g.coins.toLocaleString()} coins <span className="text-xs text-stone-400">(≈ ${(Math.ceil(g.coins / 50) * 1000).toLocaleString()})</span></span>
              </div>
            ))}
          </div>
          <p className="mt-2 text-xs text-stone-500">Prize Pokémon are Lv.5–18 with the Game Corner as OT trainer memo; they can be shiny (rolled when received, so save before buying). Scyther and Dratini here are the only way to get them before the Safari Zone.</p>
        </Section>
      )}
      {tab === 'tutors' && (
        <Section title="Move tutors (one use each)">
          <div className="divide-y divide-stone-100 dark:divide-stone-800">
            {tutors.map(({ l, t }, i) => { const step = db.chapters.flatMap((c) => c.steps).find((s) => s.kind === 'tutor' && s.map === l.id && (s.text.includes(db.moveById.get(t.move)?.name ?? '')))
              return (
                <div key={i} className="flex flex-wrap items-center gap-2 py-1.5 text-sm">
                  <MoveLink id={t.move} /><span className="text-xs text-stone-500">{db.moveById.get(t.move)?.type} · {db.moveById.get(t.move)?.power || '—'} pow</span>
                  <LocationLink id={l.id} className="text-xs" />
                  {step && <span className={`ml-auto text-xs ${steps[step.id] ? 'text-emerald-600' : 'text-stone-400'}`}>{steps[step.id] ? '✓ used' : 'available'}</span>}
                </div>
              ) })}
          </div>
          <p className="mt-2 text-xs text-stone-500">Cape Brink's starter tutor needs a fully evolved starter with maxed friendship. Each tutor teaches once per save.</p>
        </Section>
      )}
      {tab === 'legends' && (
        <div className="space-y-2">
          {encounters.filter((e) => e.step.encounter!.legendary).map((e) => <EncounterCard key={e.step.id} {...e} />)}
          <p className="text-xs text-stone-500">Full list with gifts and one-time encounters: <Link className="link" to="/encounters">Legendaries & encounters</Link>.</p>
        </div>
      )}
    </div>
  )
}

export const _prizeIds = TOWER_PRIZES
