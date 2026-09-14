import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { getDb } from '../data/db'
import { PageTitle } from '../components/ui'

export default function LocationsPage() {
  const db = getDb()
  const [q, setQ] = useState('')
  const groups = useMemo(() => {
    const order = new Map<string, number>()
    db.chapters.forEach((c, ci) => c.maps.forEach((m, mi) => { const l = db.locationById.get(m); if (l && !order.has(l.sectionName)) order.set(l.sectionName, ci * 100 + mi) }))
    const by = new Map<string, typeof db.locations>()
    for (const l of db.locations) {
      if (l.key.includes('Unused') || l.name.includes('Celadon Dept. –')) continue
      if (q && !l.name.toLowerCase().includes(q.toLowerCase())) continue
      if (!by.has(l.sectionName)) by.set(l.sectionName, [])
      by.get(l.sectionName)!.push(l)
    }
    return [...by.entries()].sort((a, b) => (order.get(a[0]) ?? 9999) - (order.get(b[0]) ?? 9999) || a[0].localeCompare(b[0]))
  }, [db, q])
  return (
    <div>
      <PageTitle sub="Every map: wild Pokémon, trainers, items, hidden items, shops">Locations</PageTitle>
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter" className="input mb-3 max-w-xs" />
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {groups.map(([sec, maps]) => {
          const main = maps.find((m) => m.type !== 'indoor' && m.type !== 'secret_base') ?? maps[0]
          const n = { enc: maps.filter((m) => Object.keys(m.encounters).length).length, tr: maps.reduce((a, m) => a + m.trainers.length, 0), it: maps.reduce((a, m) => a + m.items.length, 0), hid: maps.reduce((a, m) => a + m.hiddenItems.length, 0) }
          return (
            <div key={sec} className="card p-2">
              <Link to={`/location/${main.id}`} className="font-medium link">{sec}</Link>
              <div className="text-xs text-stone-500">{n.tr ? `${n.tr} trainers · ` : ''}{n.it ? `${n.it} items · ` : ''}{n.hid ? `${n.hid} hidden · ` : ''}{n.enc ? 'wild Pokémon' : ''}</div>
              {maps.length > 1 && <div className="mt-1 flex flex-wrap gap-1">{maps.filter((m) => m !== main).map((m) => <Link key={m.id} to={`/location/${m.id}`} className="chip bg-stone-100 text-[10px] dark:bg-stone-800">{m.name.replace(sec + ' – ', '')}</Link>)}</div>}
            </div>
          )
        })}
      </div>
    </div>
  )
}
