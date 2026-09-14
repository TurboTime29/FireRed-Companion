import { Link } from 'react-router-dom'
import { getDb } from '../data/db'
import { useProgress } from '../store/progress'
import { Check, PageTitle, Section } from '../components/ui'

export default function MissablesPage() {
  const db = getDb()
  const steps = useProgress((s) => s.steps)
  const toggleStep = useProgress((s) => s.toggleStep)
  const rows = db.chapters.flatMap((c) => c.steps.filter((s) => s.kind === 'missable' || s.kind === 'gift' || s.kind === 'trade').map((s) => ({ c, s })))
  return (
    <div>
      <PageTitle sub="One-time choices, gift Pokémon and things you can lock yourself out of.">Missables & one-offs</PageTitle>
      <Section>
        {rows.map(({ c, s }) => <Check key={s.id} checked={!!steps[s.id]} onChange={(v) => toggleStep(s.id, v)} label={<><Link className="mr-1 text-xs link" to={`/guide/${c.id}`}>Ch.{c.n}</Link>{s.text}</>} kind={s.kind} sub={s.map ? db.locationById.get(s.map)?.name : undefined} />)}
      </Section>
      <Section title="Rules of thumb">
        <ul className="list-disc space-y-1 pl-5 text-sm">
          <li>Only one fossil (Helix or Dome) and one of Hitmonlee/Hitmonchan per save.</li>
          <li>Eevee (Celadon), Lapras (Silph Co.), Magikarp (Route 4 Center), Aerodactyl (Old Amber), Togepi egg (Five Island) are single gifts.</li>
          <li>The two Snorlax, three legendary birds, Mewtwo, Hypno (Berry Forest) and the ghost Marowak are one-time encounters: save before them.</li>
          <li>Kadabra, Machoke, Graveler, Haunter, Onix (Metal Coat), Scyther (Metal Coat), Porygon (Up-Grade), Seadra (Dragon Scale), Poliwhirl/Slowpoke (King's Rock) need a trade to evolve.</li>
          <li>Gloom→Bellossom needs a Sun Stone (Hoenn trade only). The Sandshrew, Vulpix, Bellsprout, Slowpoke, Staryu, Magmar and Pinsir lines are LeafGreen-only: trade for them.</li>
          <li>Legendaries and gift Pokémon are all shiny-huntable by soft reset: see <Link className="link" to="/encounters">Legendaries & encounters</Link> for the save points.</li>
          <li>You need 60 Kanto Pokémon caught for the National Dex, and a Ruby + Sapphire from the Sevii quest to trade with Ruby/Sapphire/Emerald.</li>
        </ul>
      </Section>
    </div>
  )
}
