import { useMemo } from 'react'
import { getDb } from '../data/db'
import { useProgress } from '../store/progress'
import { useSettings } from '../store/settings'

/** Species ids that should render as shiny: every Pokémon you own as shiny, plus its pre-evolutions. */
export function useShinySpecies(): Set<number> {
  const mons = useProgress((s) => s.mons)
  const enabled = useSettings((s) => s.showShiny)
  return useMemo(() => {
    const out = new Set<number>()
    if (!enabled) return out
    const db = getDb()
    for (const m of mons) {
      if (!m.shiny) continue
      let p = db.pokemonById.get(m.species)
      while (p) { out.add(p.id); p = p.evolvesFrom ? db.pokemonById.get(p.evolvesFrom) : undefined }
    }
    return out
  }, [mons, enabled])
}
