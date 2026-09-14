import { getDb } from '../data/db'
import { ItemLink, PageTitle, PokemonLink, Section } from '../components/ui'

const WHERE: Record<string, string> = {
  INGAME_TRADE_MR_MIME: 'Route 2 (house east of Viridian Forest, needs Cut)', INGAME_TRADE_JYNX: 'Cerulean City (house north of the Pokémon Center)',
  INGAME_TRADE_NIDORAN: 'Route 5 Underground Path entrance', INGAME_TRADE_FARFETCHD: 'Vermilion City (house next to the Pokémon Fan Club)', INGAME_TRADE_NIDORINO: 'Route 11 gate 2F',
  INGAME_TRADE_LICKITUNG: 'Route 18 gate 2F', INGAME_TRADE_ELECTRODE: 'Cinnabar Lab (Pokémon Lab lounge)', INGAME_TRADE_TANGELA: 'Cinnabar Lab (Pokémon Lab lounge)', INGAME_TRADE_SEEL: 'Cinnabar Lab (Pokémon Lab lounge)',
}

export default function TradesPage() {
  const db = getDb()
  return (
    <div>
      <PageTitle sub="NPC trades inside FireRed. Traded Pokémon gain boosted experience.">In-game trades</PageTitle>
      <Section>
        {db.trades.map((t) => (
          <div key={t.key} className="flex flex-wrap items-center gap-2 border-t border-stone-100 py-2 text-sm first:border-0 dark:border-stone-800">
            <span>Give</span><PokemonLink id={t.give} /><span>→ get</span><PokemonLink id={t.get} /><span className="text-stone-500">“{t.nickname}”</span>
            {t.item && <span className="text-xs">holding <ItemLink id={t.item} /></span>}
            <span className="w-full text-xs text-stone-500">📍 {WHERE[t.key] ?? '?'}</span>
          </div>
        ))}
      </Section>
    </div>
  )
}
