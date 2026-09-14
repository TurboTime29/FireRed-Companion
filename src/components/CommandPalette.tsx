import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { getDb } from '../data/db'
import { searchIndex } from '../lib/search'
import { ROOT_LABEL, useChrome } from '../store/chrome'
import { Sprite } from './ui'

const ICON: Record<string, string> = { pokemon: '', move: '📜', item: '🎒', location: '🗺', trainer: '⚔', chapter: '📖' }
const QUICK: [string, string][] = [['/guide', '📖 Walkthrough'], ['/dex', '🔴 Pokédex'], ['/team', '👥 Team'], ['/battle', '⚔️ Battle helper'], ['/catch', '🎯 Catch calculator'], ['/tms', '💿 TM planner'], ['/bag', '📦 Bag & PC'], ['/farming', '📈 Levels & farming'], ['/postgame', '🏝 Post-game'], ['/encounters', '⭐ Legendaries'], ['/compare', '⚖️ Compare'], ['/mechanics', '📐 Mechanics'], ['/settings', '⚙ Settings']]

interface Row { key: string; title: string; sub?: string; to: string; sprite?: number; icon?: string }

/** Ctrl/Cmd+K quick search with recents and pins. */
export function CommandPalette() {
  const db = getDb()
  const nav = useNavigate()
  const loc = useLocation()
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const [idx, setIdx] = useState(0)
  const recents = useChrome((s) => s.recents)
  const pins = useChrome((s) => s.pins)
  const inputRef = useRef<HTMLInputElement>(null)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setOpen((o) => !o) }
      if (e.key === '/' && !open && !['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement)?.tagName)) { e.preventDefault(); setOpen(true) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])
  useEffect(() => { setOpen(false); setQ('') }, [loc.pathname])
  useEffect(() => { if (open) setTimeout(() => inputRef.current?.focus(), 30) }, [open])
  const rows = useMemo<Row[]>(() => {
    if (q.trim()) return searchIndex(db).search(q).slice(0, 12).map(({ item }) => ({ key: item.kind + item.id, title: item.title, sub: `${item.kind} · ${item.sub}`, to: item.to, sprite: item.kind === 'pokemon' ? Number(item.id) : undefined, icon: ICON[item.kind] }))
    const out: Row[] = []
    for (const p of pins) out.push({ key: 'pin' + p.to, title: p.title, sub: 'pinned', to: p.to, icon: '★' })
    for (const r of recents.filter((r) => !pins.some((p) => p.to === r.to)).slice(0, 6)) out.push({ key: 'rec' + r.to, title: r.title, sub: 'recent', to: r.to, icon: '🕘' })
    for (const [to, label] of QUICK) if (!out.some((r) => r.to === to)) out.push({ key: 'q' + to, title: label, to })
    return out.slice(0, 16)
  }, [db, q, recents, pins])
  useEffect(() => { setIdx(0) }, [q, open])
  if (!open) return null
  const go = (r: Row) => { nav(r.to); setOpen(false) }
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-3 pt-[10vh] backdrop-blur-sm" onClick={() => setOpen(false)}>
      <div className="fade-up w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-black/10 dark:bg-stone-900" onClick={(e) => e.stopPropagation()}>
        <input ref={inputRef} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Jump to a Pokémon, move, item, place, trainer or page…" className="w-full border-b border-stone-200 bg-transparent px-4 py-3 text-base outline-none dark:border-stone-700"
          onKeyDown={(e) => { if (e.key === 'ArrowDown') { e.preventDefault(); setIdx((i) => Math.min(rows.length - 1, i + 1)) } if (e.key === 'ArrowUp') { e.preventDefault(); setIdx((i) => Math.max(0, i - 1)) } if (e.key === 'Enter' && rows[idx]) go(rows[idx]); if (e.key === 'Escape') setOpen(false) }} />
        <ul className="max-h-[60vh] overflow-auto py-1">
          {rows.map((r, i) => (
            <li key={r.key}><button type="button" onMouseEnter={() => setIdx(i)} onClick={() => go(r)} className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm ${i === idx ? 'bg-dex-50 dark:bg-dex-900/40' : ''}`}>
              {r.sprite ? <Sprite id={r.sprite} size={28} /> : <span className="w-7 text-center">{r.icon ?? ''}</span>}
              <span className="min-w-0 flex-1 truncate">{r.title}</span>{r.sub && <span className="text-xs text-stone-400">{r.sub}</span>}
            </button></li>
          ))}
          {rows.length === 0 && <li className="px-3 py-3 text-sm text-stone-500">Nothing found.</li>}
        </ul>
        <div className="flex justify-between border-t border-stone-200 px-3 py-1.5 text-[11px] text-stone-400 dark:border-stone-700"><span>↑↓ move · Enter open · Esc close</span><span>Ctrl/⌘ K or / to open · {ROOT_LABEL[loc.pathname] ?? ''}</span></div>
      </div>
    </div>
  )
}
