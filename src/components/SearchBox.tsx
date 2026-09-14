import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

export function SearchBox() {
  const [q, setQ] = useState('')
  const nav = useNavigate()
  return (
    <form
      onSubmit={(e) => { e.preventDefault(); if (q.trim()) { nav(`/search?q=${encodeURIComponent(q.trim())}`); setQ('') } }}
      className="flex"
    >
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search Pokémon, moves, items, places…" className="input py-1.5" aria-label="Search" />
    </form>
  )
}
