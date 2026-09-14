import { useMemo, useState } from 'react'
import { getDb } from '../data/db'
import type { TypeName } from '../data/types'
import { moveCategory } from '../lib/battle'
import { MoveTable, PageTitle } from '../components/ui'

export default function MovesPage() {
  const db = getDb()
  const [q, setQ] = useState('')
  const [type, setType] = useState('')
  const [cat, setCat] = useState('')
  const [sort, setSort] = useState<'name' | 'power' | 'type'>('name')
  const rows = useMemo(() => db.moves.filter((m) => (!q || m.name.toLowerCase().includes(q.toLowerCase())) && (!type || m.type === type) && (!cat || moveCategory(m) === cat))
    .sort((a, b) => sort === 'name' ? a.name.localeCompare(b.name) : sort === 'power' ? b.power - a.power : a.type.localeCompare(b.type) || b.power - a.power)
    .map((move) => ({ move })), [db, q, type, cat, sort])
  return (
    <div>
      <PageTitle sub="Physical/Special is decided by the move's type in Gen 3">Moves</PageTitle>
      <div className="mb-3 flex flex-wrap gap-2">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Move name" className="input max-w-[180px]" />
        <select value={type} onChange={(e) => setType(e.target.value)} className="input max-w-[130px]"><option value="">Any type</option>{db.typechart.types.map((t: TypeName) => <option key={t}>{t}</option>)}</select>
        <select value={cat} onChange={(e) => setCat(e.target.value)} className="input max-w-[130px]"><option value="">Any category</option><option value="physical">Physical</option><option value="special">Special</option><option value="status">Status</option></select>
        <select value={sort} onChange={(e) => setSort(e.target.value as typeof sort)} className="input max-w-[130px]"><option value="name">Sort: name</option><option value="power">Sort: power</option><option value="type">Sort: type</option></select>
      </div>
      <div className="card p-2"><MoveTable rows={rows} /></div>
    </div>
  )
}
