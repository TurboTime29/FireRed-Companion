import { getDb } from '../data/db'
import { PageTitle, TypeBadge } from '../components/ui'

export default function TypeChartPage() {
  const db = getDb()
  const T = db.typechart.types
  const cell = (m: number) => m === 0 ? 'bg-stone-800 text-white' : m === 2 ? 'bg-green-500 text-white' : m === 0.5 ? 'bg-red-500 text-white' : 'text-stone-300 dark:text-stone-700'
  return (
    <div>
      <PageTitle sub="Rows attack, columns defend. Gen 3: no Fairy; Steel resists Ghost and Dark; Dark/Ghost moves are special/physical by type.">Type chart</PageTitle>
      <div className="card overflow-x-auto p-2">
        <table className="text-[10px]">
          <thead><tr><th className="p-1 text-left text-stone-500">atk ↓ / def →</th>{T.map((t) => <th key={t} className="p-0.5"><span className="inline-block w-8 truncate rounded px-0.5 text-white" style={{ backgroundColor: `var(--color-type-${t.toLowerCase()})` }}>{t.slice(0, 3)}</span></th>)}</tr></thead>
          <tbody>
            {T.map((a) => (
              <tr key={a}>
                <td className="p-0.5"><TypeBadge type={a} small /></td>
                {T.map((d) => { const m = db.typechart.effectiveness[a][d]; return <td key={d} className={`h-6 w-9 text-center ${cell(m)}`}>{m === 1 ? '·' : m === 0.5 ? '½' : m}</td> })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="card mt-3 p-3 text-sm">
        <h2 className="mb-1 font-semibold">Physical vs Special in FireRed</h2>
        <p><b>Physical</b> (Attack vs Defense): Normal, Fighting, Flying, Poison, Ground, Rock, Bug, Ghost, Steel.</p>
        <p><b>Special</b> (Sp. Atk vs Sp. Def): Fire, Water, Grass, Electric, Psychic, Ice, Dragon, Dark.</p>
        <p className="mt-1 text-stone-500">So Gyarados's Bite and Hyper Beam are special, and Sneasel's Shadow Ball is physical. Pick moves that match your Pokémon's better attacking stat.</p>
      </div>
    </div>
  )
}
