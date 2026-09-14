import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { getDb } from '../data/db'
import { ItemSprite, PageTitle } from '../components/ui'

const POCKETS = ['items', 'key items', 'poke balls', 'tm case', 'berry pouch']

export default function ItemsPage() {
  const db = getDb()
  const [q, setQ] = useState('')
  const [pocket, setPocket] = useState('')
  const list = useMemo(() => db.items.filter((i) => (!q || i.name.toLowerCase().includes(q.toLowerCase())) && (!pocket || i.pocket === pocket)).sort((a, b) => a.pocket === b.pocket ? a.name.localeCompare(b.name) : a.pocket.localeCompare(b.pocket)), [db, q, pocket])
  return (
    <div>
      <PageTitle sub={<Link to="/tms" className="link">TM & HM list with locations →</Link>}>Items</PageTitle>
      <div className="mb-3 flex flex-wrap gap-2">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Item name" className="input max-w-[200px]" />
        <select value={pocket} onChange={(e) => setPocket(e.target.value)} className="input max-w-[150px]"><option value="">Any pocket</option>{POCKETS.map((p) => <option key={p} value={p}>{p}</option>)}</select>
      </div>
      <div className="card divide-y divide-stone-100 dark:divide-stone-800">
        {list.map((i) => (
          <Link key={i.id} to={`/items/${i.id}`} className="flex items-center gap-3 px-3 py-2 hover:bg-stone-50 dark:hover:bg-stone-800">
            <ItemSprite item={i} size={28} />
            <div className="min-w-0 flex-1"><div className="font-medium">{i.name}</div><div className="truncate text-xs text-stone-500">{i.description}</div></div>
            <div className="text-xs text-stone-500">{i.price ? `$${i.price}` : ''}</div>
          </Link>
        ))}
      </div>
    </div>
  )
}
