import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { inferStoryProgress, parseSave } from '../src/lib/save/gen3'
import type { Db } from '../src/data/db'

const root = resolve(import.meta.dirname ?? '.', '..')
const load = (n: string) => JSON.parse(readFileSync(resolve(root, 'public/data', n + '.json'), 'utf-8'))
const pokemon = load('pokemon'), moves = load('moves'), items = load('items'), meta = load('meta'), locations = load('locations'), trainers = load('trainers'), chapters = load('walkthrough')
const db = {
  pokemon, pokemonById: new Map(pokemon.map((p: { id: number }) => [p.id, p])), moves, moveById: new Map(moves.map((m: { id: number }) => [m.id, m])),
  items, itemById: new Map(items.map((i: { id: number }) => [i.id, i])), trainers, trainerById: new Map(trainers.map((t: { id: number }) => [t.id, t])),
  locations, locationById: new Map(locations.map((l: { id: string }) => [l.id, l])), chapters, meta,
} as unknown as Db
const file = new Uint8Array(readFileSync(process.argv[2]))
console.log('file size', file.length)
const s = parseSave(file, db)
console.log(`Trainer ${s.playerName} ID ${s.trainerId} SID ${s.secretId} · ${s.playTime} · $${s.money}`)
console.log('badges', s.badges.map((b) => (b ? '●' : '○')).join(''), '| dex seen', s.seen.length, 'caught', s.caught.length, '| starter', s.starter)
const name = (id: number) => db.pokemonById.get(id)?.name
for (const m of s.mons.filter((m) => m.inParty)) console.log(`  party: ${m.nickname ?? name(m.species)} (${name(m.species)}) Lv.${m.level} ${m.nature} ${m.gender}${m.shiny ? ' ✨' : ''} moves=${m.moves.map((x) => db.moveById.get(x)?.name).join('/')} item=${m.item ? db.itemById.get(m.item)?.name : '-'} ivs=${JSON.stringify(m.ivs)}`)
const boxed = s.mons.filter((m) => !m.inParty)
console.log(`  boxed: ${boxed.length}:`, boxed.slice(0, 12).map((m) => `${name(m.species)} L${m.level}`).join(', '), boxed.length > 12 ? '…' : '')
console.log('  bag:', s.bag.slice(0, 15).map((b) => `${db.itemById.get(b.item)?.name}×${b.qty}`).join(', '), s.bag.length > 15 ? `… (${s.bag.length} stacks)` : '')
console.log('  key/TM items:', s.keyItems.map((i) => db.itemById.get(i)?.name).join(', '))
const st = inferStoryProgress(s, db)
console.log(`story: chapter ${st.currentChapter} · beaten ${st.beaten.length} trainers · ${st.flags.length} items collected · ${st.steps.length} steps`)
const bosses = trainers.filter((t: { id: number; classKey: string }) => st.beaten.includes(t.id) && ['LEADER', 'ELITE_FOUR', 'CHAMPION', 'BOSS'].includes(t.classKey) || (st.beaten.includes(t.id) && t.classKey.startsWith('RIVAL')))
console.log('  bosses beaten:', bosses.map((t: { class: string; name: string; key: string }) => t.key.replace('TRAINER_', '')).join(', '))
const f = meta.flags as Record<string, number>
console.log('  got flags:', Object.keys(f).filter((k) => k.startsWith('FLAG_GOT_') && s.flags.has(f[k])).map((k) => k.replace('FLAG_GOT_', '')).join(', '))
console.log('  natdex', s.flags.has(f.FLAG_SYS_NATIONAL_DEX), 'pokedex', s.flags.has(f.FLAG_SYS_POKEDEX_GET))
for (const c of chapters) { const done = c.steps.filter((x: { id: string }) => st.steps.includes(x.id)).length; if (done) console.log(`  ch${c.n} ${c.title}: ${done}/${c.steps.length}`) }
