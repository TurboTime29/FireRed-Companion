import { useState } from 'react'
import { Link } from 'react-router-dom'
import { getDb } from '../data/db'
import type { Location } from '../data/types'
import { guideSectionsFor } from '../lib/guide'
import { MapView, useLocationMarkers } from './MapView'

/** Header used in the walkthrough for each area: name, map toggle, and the area's directions text. */
export function LocationBlock({ loc, defaultOpen = true }: { loc: Location; defaultOpen?: boolean }) {
  const db = getDb()
  const [showMap, setShowMap] = useState(false)
  const [showText, setShowText] = useState(defaultOpen)
  const markers = useLocationMarkers(loc)
  const sections = guideSectionsFor(db, loc)
  // prose for this map only: use the section whose heading best matches the map's own name (floor / room), else the area's first section
  const key = loc.name.replace(loc.sectionName, '').replace(/[–-]/g, ' ').trim().toLowerCase()
  const specific = key ? sections.filter((s) => s.heading.toLowerCase().includes(key)) : []
  const prose = (specific.length ? specific : sections.slice(0, 1)).flatMap((s) => s.prose).filter((p) => p.length > 40)
  return (
    <div className="mt-4 mb-1">
      <div className="flex items-center gap-2 border-b border-stone-200 pb-1 dark:border-stone-800">
        <Link to={`/location/${loc.id}`} className="text-xs font-semibold uppercase tracking-wide text-dex-600 hover:underline dark:text-red-400">{loc.name}</Link>
        {loc.mapImage && <button className={`chip-btn text-[10px] ${showMap ? "chip-on" : ""}`} onClick={() => setShowMap(!showMap)}>🗺 map</button>}
        {prose.length > 0 && <button className={`chip-btn text-[10px] ${showText ? "chip-on" : ""}`} onClick={() => setShowText(!showText)}>{showText ? 'hide directions' : 'directions'}</button>}
      </div>
      {showMap && <div className="mt-2"><MapView loc={loc} markers={markers} height={360} /></div>}
      {showText && prose.length > 0 && (
        <div className="mt-1 space-y-1 text-[13px] leading-snug text-stone-600 dark:text-stone-300">
          {prose.map((p, i) => <p key={i}>{p}</p>)}
        </div>
      )}
    </div>
  )
}
