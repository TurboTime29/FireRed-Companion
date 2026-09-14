import { useState } from 'react'
import { koText, type Combatant } from '../lib/battle'
import type { Matchup } from '../lib/selectors'
import { EffChip, MoveLink, PokemonLink, Sprite, TypeBadge } from './ui'

function pct(a: number, b: number) { return `${Math.round(a)}–${Math.round(b)}%` }

export function MatchupTable({ rows }: { rows: { foe: Combatant; ranked: Matchup[] }[] }) {
  const [open, setOpen] = useState<number | null>(null)
  return (
    <div className="space-y-2">
      {rows.map((row, i) => {
        const best = row.ranked[0]
        return (
          <div key={i} className="rounded-lg border border-stone-200 p-2 text-sm dark:border-stone-700">
            <div className="flex flex-wrap items-center gap-2">
              <PokemonLink id={row.foe.pokemon.id} level={row.foe.level} />
              {row.foe.pokemon.types.map((t) => <TypeBadge key={t} type={t} small />)}
              <span className="text-xs text-stone-500">HP {row.foe.stats.hp} · Spe {row.foe.stats.spe}</span>
              <button className="ml-auto text-xs link" onClick={() => setOpen(open === i ? null : i)}>{open === i ? 'less' : 'all options'}</button>
            </div>
            {best && (
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <span className="text-stone-500">Best:</span>
                <Sprite id={best.attacker.pokemon.id} size={28} /><b>{best.attacker.pokemon.name}</b>
                {best.best ? <>with <MoveLink id={best.best.move.id} /> <EffChip mult={best.best.typeMult} /> <b className={best.best.maxPct >= 100 ? 'text-emerald-600' : best.best.maxPct >= 50 ? 'text-lime-600' : 'text-amber-600'}>{pct(best.best.minPct, best.best.maxPct)}</b> of its HP{koText(best.best) && <span className="chip bg-stone-200 text-[10px] dark:bg-stone-700">{koText(best.best)}</span>}{best.best.note && <span className="text-xs text-stone-400">({best.best.note})</span>}</> : <span className="text-red-600">has no damaging move that lands</span>}
                {best.faster !== null && <span className={`text-xs ${best.faster ? 'text-emerald-600' : 'text-red-600'}`}>{best.faster ? 'outspeeds' : 'slower'}</span>}
                {best.threat && best.threat.max > 0 && <span className="text-xs text-stone-500">· takes {pct(best.threat.minPct, best.threat.maxPct)} from {best.threat.move.name}{best.threat.typeMult > 1 && <EffChip mult={best.threat.typeMult} />}</span>}
              </div>
            )}
            {open === i && (
              <table className="mt-2 w-full text-xs">
                <tbody>
                  {row.ranked.map((m) => (
                    <tr key={m.attacker.pokemon.id + '-' + m.attacker.level} className="border-t border-stone-100 dark:border-stone-800">
                      <td className="py-1"><Sprite id={m.attacker.pokemon.id} size={24} /> {m.attacker.pokemon.name} <span className="text-stone-400">Lv.{m.attacker.level}</span></td>
                      <td className="py-1">{m.best ? <>{m.best.move.name} <EffChip mult={m.best.typeMult} /> {pct(m.best.minPct, m.best.maxPct)} <span className="text-stone-400">{koText(m.best)}</span></> : '—'}</td>
                      <td className="py-1 text-stone-500">{m.threat ? `takes ${pct(m.threat.minPct, m.threat.maxPct)} (${m.threat.move.name}${koText(m.threat) ? ', ' + koText(m.threat) : ''})` : 'takes nothing'}</td>
                      <td className="py-1 text-right">{m.faster === null ? 'speed tie' : m.faster ? 'faster' : 'slower'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )
      })}
    </div>
  )
}
