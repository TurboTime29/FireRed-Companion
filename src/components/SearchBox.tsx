import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

export function SearchBox({ light, autoFocus, onDone }: { light?: boolean; autoFocus?: boolean; onDone?: () => void }) {
  const [q, setQ] = useState('')
  const nav = useNavigate()
  return (
    <form
      onSubmit={(e) => { e.preventDefault(); if (q.trim()) { nav(`/search?q=${encodeURIComponent(q.trim())}`); setQ(''); onDone?.() } }}
      className="relative flex"
    >
      <svg className={`pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 ${light ? 'text-white/70' : 'text-stone-400'}`} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></svg>
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        autoFocus={autoFocus}
        placeholder="Search Pokémon, moves, items, places…"
        aria-label="Search"
        className={light
          ? 'w-full rounded-full border border-white/20 bg-white/15 py-1.5 pl-8 pr-3 text-sm text-white placeholder:text-white/70 outline-none transition focus:bg-white/25'
          : 'input py-1.5 pl-8'}
      />
    </form>
  )
}
