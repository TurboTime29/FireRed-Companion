import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { getDb } from '../data/db'
import { useParty, useProgress } from '../store/progress'
import { trainerDisplayName, trainersForGroup } from '../lib/selectors'
import { PageTitle, Section, Sprite, TypeBadge } from '../components/ui'

const EXP_SPOTS = [
  { when: 'Badges 0–1', where: 'Viridian Forest and Route 3', tip: 'Bug Catchers and Lasses give the most early EXP; Route 3 trainers do not respawn, so fight them all.', map: 'MAP_ROUTE3' },
  { when: 'Badges 2–3', where: 'Routes 9–10 and Rock Tunnel', tip: 'Long trainer gauntlets. Voltorb and Geodude are quick, safe fights for an Electric or Water lead.', map: 'MAP_ROUTE10' },
  { when: 'Badge 3 onward', where: 'Vs. Seeker rematches', tip: 'Get the Vs. Seeker in the Vermilion Poké Center. Walk 100 steps, use it, and rematch trainers on the same route. Rematches give higher-level teams each tier.', map: 'MAP_VERMILION_CITY_POKEMON_CENTER_1F' },
  { when: 'Badges 3–5', where: 'Routes 12–15 and the Cycling Road', tip: 'Dense trainers with Lv.25–35 teams. The Route 15 Oak aide gives the Exp. Share once you own 50 Pokémon.', map: 'MAP_ROUTE14' },
  { when: 'Badges 6–8', where: 'Victory Road', tip: 'Lv.40+ trainers; Cooltrainers give the best EXP before the League. Pair with Lucky Egg if you have one.', map: 'MAP_VICTORY_ROAD_1F' },
  { when: 'Post-game', where: 'Cerulean Cave and the Elite Four rematch', tip: 'Wild Lv.46–70 in the cave (Chansey gives huge EXP). The stronger Elite Four (Lv.63–75) can be fought repeatedly.', map: 'MAP_CERULEAN_CAVE_1F' },
  { when: 'Post-game', where: 'Seven Island Trainer Tower', tip: 'Timed fights against strong trainers; EXP and prizes.', map: 'MAP_SEVEN_ISLAND_TRAINER_TOWER_LOBBY' },
]
const MONEY = [
  'Amulet Coin (Oak\'s aide on Route 16, once you own 40 Pokémon): doubles prize money when the holder takes part in the battle. Put it on your lead.',
  'Vs. Seeker rematches with rich trainer classes: Gentleman, Lady, Beauty, Socialite (S.S. Anne, Routes 12–15, Celadon, Sevii) pay the most per fight.',
  'Elite Four rematch with the Amulet Coin: the biggest single payout in the game and repeatable.',
  'Pay Day (Meowth/Persian learn it) drops coins each use; small but free.',
  'Sell Nuggets, Pearls, Stardust and Star Pieces you find (hidden items on Sevii beaches, Nugget Bridge, Mt. Moon).',
]

export default function FarmingPage() {
  const db = getDb()
  const party = useParty()
  const badges = useProgress((s) => s.badges)
  const starter = useProgress((s) => s.starter)
  const beaten = useProgress((s) => s.beaten)
  const curve = useMemo(() => {
    const bosses: { label: string; id: number; maxLvl: number; species: number[]; done: boolean; to: string }[] = []
    for (const c of db.chapters) for (const s of c.steps) {
      if (s.kind !== 'boss') continue
      const ts = s.battleGroup ? trainersForGroup(db, s.battleGroup, starter).slice(0, 1) : (s.trainers ?? []).map((t) => db.trainerById.get(t)!).filter(Boolean).slice(0, 1)
      for (const t of ts) bosses.push({ label: trainerDisplayName(t), id: t.id, maxLvl: Math.max(...t.party.map((m) => m.level)), species: t.party.map((m) => m.species), done: !!beaten[t.id], to: `/battle?t=${t.id}` })
    }
    return bosses
  }, [db, starter, beaten])
  const partyMax = party.length ? Math.max(...party.map((m) => m.level)) : 0
  const partyAvg = party.length ? Math.round(party.reduce((a, m) => a + m.level, 0) / party.length) : 0
  const next = curve.find((b) => !b.done)
  const rich = db.trainers.filter((t) => t.rematches?.length && ['GENTLEMAN', 'LADY', 'BEAUTY', 'SOCIALITE', 'COOLTRAINER'].includes(t.classKey)).slice(0, 10)
  return (
    <div>
      <PageTitle hero sub="Where your levels stand against every boss, and the fastest EXP and money in FireRed.">Levels & farming</PageTitle>
      <Section title="Level curve" right={party.length ? <span className="text-xs text-stone-500">your party: avg {partyAvg}, highest {partyMax}</span> : <Link className="text-xs link" to="/team">add your party</Link>}>
        <div className="space-y-1">
          {curve.map((b) => {
            const diff = partyMax - b.maxLvl
            const tone = b.done ? 'text-stone-400' : diff >= 0 ? 'text-emerald-600' : diff >= -3 ? 'text-amber-600' : 'text-red-600'
            return (
              <div key={b.id} className={`flex items-center gap-2 text-sm ${b.done ? 'opacity-50' : ''} ${next?.id === b.id ? 'rounded-lg bg-dex-50 px-1 dark:bg-dex-900/30' : ''}`}>
                <span className="w-8 text-right font-mono text-xs text-stone-500">Lv.{b.maxLvl}</span>
                <div className="bar h-1.5 w-24 shrink-0 sm:w-40"><i className={b.done ? 'bg-stone-400' : 'bg-dex-500'} style={{ width: `${(b.maxLvl / 75) * 100}%` }} /></div>
                <Link to={b.to} className="link truncate">{b.label}</Link>
                <span className="hidden gap-0.5 sm:flex">{b.species.slice(0, 6).map((s, i) => <Sprite key={i} id={s} size={20} />)}</span>
                {party.length > 0 && !b.done && <span className={`ml-auto text-xs font-medium ${tone}`}>{diff >= 0 ? `+${diff}` : diff} vs your best</span>}
                {b.done && <span className="ml-auto text-xs">✓</span>}
              </div>
            )
          })}
        </div>
        <p className="mt-2 text-xs text-stone-500">Rule of thumb: your best Pokémon within 3 levels of the boss's ace is comfortable; 5+ below and you need type advantage or grinding. Badge boosts (+10% to a stat per badge) are already counted in the Battle helper.</p>
      </Section>
      <Section title="Best EXP by stage">
        <div className="space-y-2">
          {EXP_SPOTS.map((s) => (
            <div key={s.where} className="rounded-xl bg-stone-50 p-2.5 text-sm dark:bg-stone-800/60">
              <div className="flex flex-wrap items-center gap-2"><span className="chip bg-stone-200 text-[10px] dark:bg-stone-700">{s.when}</span><b>{s.where}</b>{db.locationById.get(s.map) && <Link className="text-xs link" to={`/location/${s.map}`}>open map →</Link>}</div>
              <div className="mt-0.5 text-xs text-stone-600 dark:text-stone-300">{s.tip}</div>
            </div>
          ))}
        </div>
        <p className="mt-2 text-xs text-stone-500">Lucky Egg (+50% EXP) is held by wild Chansey (5%): see <Link className="link" to="/held-items">held-item farming</Link>. Exp. Share gives the holder half the EXP without battling.</p>
      </Section>
      <Section title="Money">
        <ul className="list-disc space-y-1 pl-5 text-sm">{MONEY.map((m) => <li key={m}>{m}</li>)}</ul>
        {rich.length > 0 && (
          <div className="mt-2 text-xs text-stone-500">Rich rematch trainers in the data: {rich.map((t) => <Link key={t.id} className="link mr-2" to={`/trainers/${t.id}`}>{trainerDisplayName(t)}</Link>)}</div>
        )}
        {!badges[2] && <p className="mt-2 text-xs text-amber-700 dark:text-amber-400">The Vs. Seeker becomes available in Vermilion City; rematches unlock after the trainers are first beaten.</p>}
        <div className="mt-2 flex flex-wrap gap-1">{['Normal'].map((t) => <TypeBadge key={t} type={t as never} small />)}<span className="text-xs text-stone-400">Pay Day is Normal-type; Persian gets STAB on it.</span></div>
      </Section>
    </div>
  )
}
