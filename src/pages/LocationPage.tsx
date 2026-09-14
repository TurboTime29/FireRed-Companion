import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { getDb } from '../data/db'
import type { EncounterSlot, Location } from '../data/types'
import { MapView, useLocationMarkers } from '../components/MapView'
import { useProgress } from '../store/progress'
import { guideItemsFor, guideSectionsFor, guideWhere } from '../lib/guide'
import { trainerDisplayName } from '../lib/selectors'
import { Check, Empty, ItemLink, LocationLink, MoveLink, PageTitle, PokemonLink, Section, Sprite } from '../components/ui'

const emptyLoc: Location = { id: '', key: '', section: '', sectionName: '', name: '', type: '', connections: [], warps: [], items: [], hiddenItems: [], trainers: [], shops: [], tutors: [], encounters: {}, width: 0, height: 0, mapImage: false, mapOffset: [0, 0], mapSize: [0, 0], trainerPos: {}, warpPos: [] }

const METHOD_LABEL: Record<string, string> = { grass: 'Walking (grass / cave)', surf: 'Surfing', 'rock-smash': 'Rock Smash', 'old-rod': 'Old Rod', 'good-rod': 'Good Rod', 'super-rod': 'Super Rod' }

export default function LocationPage() {
  const db = getDb()
  const id = useParams().id!
  const l = db.locationById.get(id)
  const flags = useProgress((s) => s.flags)
  const setFlag = useProgress((s) => s.setFlag)
  const beaten = useProgress((s) => s.beaten)
  const setBeaten = useProgress((s) => s.setBeaten)
  const caught = useProgress((s) => s.caught)
  const [showGuide, setShowGuide] = useState(false)
  const markers = useLocationMarkers(l ?? emptyLoc)
  if (!l) return <Empty>Unknown location.</Empty>
  const siblings = db.locations.filter((x) => x.sectionName === l.sectionName && x.id !== l.id && !x.key.includes('Unused'))
  const encounterMethods = Object.keys(l.encounters).filter((k) => !k.endsWith('Rate'))
  const trainers = l.trainers.map((t) => db.trainerById.get(t)!).filter(Boolean)
  const guideSections = guideSectionsFor(db, l)
  const guideItems = guideItemsFor(db, l)
  const chapters = db.chapters.filter((c) => c.maps.includes(l.id))
  const leftover = guideItems.filter((gi) => !l.items.some((b) => guideWhere(db, l, db.itemById.get(b.item)!, false) === gi.where) && !l.hiddenItems.some((b) => guideWhere(db, l, db.itemById.get(b.item)!, true) === gi.where))
  return (
    <div>
      <PageTitle sub={<>{l.sectionName !== l.name && <Link className="link" to={`/location/${db.locations.find((x) => x.sectionName === l.sectionName && x.type !== 'indoor')?.id ?? l.id}`}>{l.sectionName}</Link>}{chapters.length > 0 && <> · Guide: {chapters.map((c) => <Link key={c.id} className="link mr-1" to={`/guide/${c.id}`}>Ch.{c.n}</Link>)}</>}</>}>{l.name}</PageTitle>
      {(l.connections.length > 0 || siblings.length > 0) && (
        <div className="mb-3 flex flex-wrap gap-1 text-xs">
          {l.connections.map((c) => <LocationLink key={c.map + c.dir} id={c.map} className="chip bg-stone-200 no-underline dark:bg-stone-800" />)}
          {siblings.map((s) => <LocationLink key={s.id} id={s.id} className="chip bg-stone-100 no-underline dark:bg-stone-800/60" />)}
        </div>
      )}

      {l.mapImage && (
        <Section title="Map">
          <MapView loc={l} markers={markers} height={480} />
        </Section>
      )}
      {encounterMethods.length > 0 && (
        <Section title="Wild Pokémon (FireRed)">
          {encounterMethods.map((m) => (
            <div key={m} className="mb-2">
              <div className="mb-1 text-xs font-medium text-stone-500">{METHOD_LABEL[m] ?? m}{typeof l.encounters[m + 'Rate'] === 'number' ? ` · encounter rate ${l.encounters[m + 'Rate']}` : ''}</div>
              <div className="flex flex-wrap gap-1">
                {([...(l.encounters[m] as EncounterSlot[])].sort((a, b) => b.rate - a.rate)).map((e) => (
                  <Link key={e.species} to={`/dex/${e.species}`} className={`flex items-center gap-1 rounded-lg border px-1.5 py-0.5 text-sm ${caught.includes(e.species) ? 'border-emerald-300 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950' : 'border-stone-200 dark:border-stone-700'}`}>
                    <Sprite id={e.species} size={32} /><span>{db.pokemonById.get(e.species)?.name}</span><span className="text-xs text-stone-500">Lv.{e.min}{e.max !== e.min ? `–${e.max}` : ''} · {e.rate}%</span>
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </Section>
      )}

      {trainers.length > 0 && (
        <Section title={`Trainers (${trainers.length})`}>
          {trainers.map((t) => (
            <div key={t.id} className="border-t border-stone-100 py-1.5 first:border-0 dark:border-stone-800">
              <Check checked={!!beaten[t.id]} onChange={(v) => setBeaten(t.id, v)} label={<Link to={`/trainers/${t.id}`} className="font-medium link">{trainerDisplayName(t)}</Link>} kind={t.classKey === 'LEADER' || t.classKey === 'ELITE_FOUR' || t.classKey === 'CHAMPION' || t.classKey === 'BOSS' ? 'boss' : undefined}
                sub={<span className="flex flex-wrap gap-2">{t.party.map((m, i) => <PokemonLink key={i} id={m.species} level={m.level} />)}{t.rematches?.length ? <span className="text-stone-400">· Vs Seeker rematches</span> : null}</span>} />
            </div>
          ))}
        </Section>
      )}

      {(l.items.length > 0 || l.hiddenItems.length > 0 || leftover.length > 0) && (
        <Section title="Items">
          {l.items.map((b, i) => <Check key={'b' + i} checked={!!flags[b.flag]} onChange={(v) => setFlag(b.flag, v)} label={<ItemLink id={b.item} />} sub={guideWhere(db, l, db.itemById.get(b.item)!, false) ?? `Item ball (tile ${b.x}, ${b.y})`} kind="item" />)}
          {l.hiddenItems.map((b, i) => <Check key={'h' + i} checked={!!flags[b.flag]} onChange={(v) => setFlag(b.flag, v)} label={<ItemLink id={b.item} qty={b.qty} />} sub={guideWhere(db, l, db.itemById.get(b.item)!, true) ?? `Hidden (tile ${b.x}, ${b.y}) — press A facing the spot or use the Itemfinder`} kind="hidden" />)}
          {leftover.map((gi, i) => <div key={'g' + i} className="px-2 py-1 text-sm text-stone-600 dark:text-stone-300">🎁 {gi.display}: {gi.where}{gi.hidden ? ' (hidden)' : ''}</div>)}
        </Section>
      )}

      {l.shops.length > 0 && (
        <Section title="Shop">
          {l.shops.map((s, i) => <div key={i} className="mb-1 flex flex-wrap gap-2 text-sm">{s.map((it) => <span key={it} className="inline-flex items-center gap-1 rounded bg-stone-100 px-1.5 dark:bg-stone-800"><ItemLink id={it} /><span className="text-xs text-stone-500">${db.itemById.get(it)?.price}</span></span>)}</div>)}
        </Section>
      )}
      {l.tutors.length > 0 && <Section title="Move Tutor">{l.tutors.map((t, i) => <div key={i} className="text-sm">Teaches <MoveLink id={t.move} /> once.</div>)}</Section>}

      {guideSections.length > 0 && (
        <Section title="Guide notes" right={<button className="btn-ghost text-xs" onClick={() => setShowGuide(!showGuide)}>{showGuide ? 'Hide' : 'Show'}</button>}>
          {showGuide ? (
            <div className="space-y-2 text-sm">
              {guideSections.map((s) => (
                <div key={s.id}><div className="font-medium">{s.heading}</div>{s.prose.map((p, i) => <p key={i} className="mb-1 text-stone-700 dark:text-stone-300">{p}</p>)}</div>
              ))}
              <p className="text-xs text-stone-400">Text adapted from the Bulbapedia FRLG walkthrough (CC BY-NC-SA 2.5).</p>
            </div>
          ) : <p className="text-xs text-stone-500">{guideSections.length} section{guideSections.length > 1 ? 's' : ''} of walkthrough text for this area.</p>}
        </Section>
      )}
      {!encounterMethods.length && !trainers.length && !l.items.length && !l.hiddenItems.length && !l.shops.length && !l.tutors.length && <Empty>Nothing to collect here.</Empty>}
    </div>
  )
}
