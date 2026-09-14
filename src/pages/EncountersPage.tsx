import { EncounterCard, useEncounters } from '../components/EncounterCard'
import { PageTitle, Section } from '../components/ui'

export default function EncountersPage() {
  const all = useEncounters()
  const legendary = all.filter((x) => x.step.encounter!.legendary)
  const gifts = all.filter((x) => !x.step.encounter!.legendary && x.step.encounter!.kind !== 'wild')
  return (
    <div>
      <PageTitle sub="Every one-time and gift Pokémon in story order, with where to save before it.">Legendaries & one-time encounters</PageTitle>
      <Section title="Legendary & one-time (save first!)">
        <div className="space-y-2">{legendary.map((x) => <EncounterCard key={x.step.id} {...x} />)}</div>
      </Section>
      <Section title="Gift Pokémon (also shiny-huntable)">
        <div className="space-y-2">{gifts.map((x) => <EncounterCard key={x.step.id} {...x} />)}</div>
      </Section>
      <Section title="Shiny hunting in FireRed">
        <ul className="list-disc space-y-1 pl-5 text-sm">
          <li><b>Odds are 1 in 8,192</b> per encounter. There is no Shiny Charm, Masuda Method or chain in Gen 3.</li>
          <li><b>Soft reset method:</b> save directly in front of the Pokémon (or the NPC/Poké Ball for gifts), start the encounter, check the sprite and sparkle animation, then press A+B+Start+Select to reset and repeat. On mGBA use the reset shortcut and save states are fine as long as you reset before the RNG is consumed.</li>
          <li><b>Gifts, fossils and eggs</b> roll their shininess the moment you receive them, so save before the final "yes".</li>
          <li><b>Static legendaries</b> keep their species but re-roll on every encounter. Their catch rate is 3: paralysis or sleep plus Ultra Balls, or Timer Balls after 10+ turns. Don't KO it: you can retry after a black-out only if it wasn't caught, so save before each attempt.</li>
          <li><b>Shininess is set by PID vs. your Trainer ID and Secret ID</b> and stays through evolution, so a shiny Magikarp or Eevee stays shiny.</li>
          <li><b>Wild hunts:</b> stand in grass and repeatedly encounter; each encounter is a fresh roll. Repels keep lower-level Pokémon away so you meet the target level range.</li>
        </ul>
      </Section>
    </div>
  )
}
