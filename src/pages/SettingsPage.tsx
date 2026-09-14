import { useRef, useState } from 'react'
import { getDb } from '../data/db'
import { exportProgress, useProgress, type ProgressDoc } from '../store/progress'
import { useSettings } from '../store/settings'
import { signIn, signOut, syncEnabled, useSession, useSyncStatus } from '../lib/sync'
import { inferStoryProgress, parseSave, type ParsedSave } from '../lib/save/gen3'
import { PageTitle, Section, Sprite } from '../components/ui'

export default function SettingsPage() {
  const db = getDb()
  const prog = useProgress()
  const settings = useSettings()
  const session = useSession()
  const sync = useSyncStatus()
  const [email, setEmail] = useState('')
  const [msg, setMsg] = useState('')
  const [parsed, setParsed] = useState<ParsedSave | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const doExport = () => {
    const blob = new Blob([JSON.stringify(exportProgress(prog), null, 2)], { type: 'application/json' })
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `firered-progress-${new Date().toISOString().slice(0, 10)}.json`; a.click()
  }
  const doImport = async (f: File) => {
    try { const doc = JSON.parse(await f.text()) as ProgressDoc; if (doc.version !== 1) throw new Error('unknown format'); prog.replaceAll(doc); setMsg('Progress imported.') } catch (e) { setMsg('Import failed: ' + (e as Error).message) }
  }
  const doSave = async (f: File) => {
    try { setParsed(parseSave(new Uint8Array(await f.arrayBuffer()), db)); setMsg('') } catch (e) { setMsg('Could not read save: ' + (e as Error).message); setParsed(null) }
  }
  const story = parsed ? inferStoryProgress(parsed, db) : null
  const applySave = () => {
    if (!parsed || !story) return
    const keepBoxes = prog.mons.filter((m) => m.note === 'manual')
    const now = Date.now()
    const flags = { ...prog.flags }; for (const f of story.flags) flags[f] = flags[f] ?? now
    const beaten = { ...prog.beaten }; for (const t of story.beaten) beaten[t] = beaten[t] ?? now
    const steps = { ...prog.steps }; for (const s of story.steps) steps[s] = steps[s] ?? now
    prog.replaceAll({
      ...exportProgress(prog), playerName: parsed.playerName, badges: parsed.badges, money: parsed.money, seen: parsed.seen, caught: parsed.caught,
      mons: [...parsed.mons, ...keepBoxes], starter: parsed.starter ?? prog.starter, keyItems: parsed.keyItems, flags, beaten, steps,
      currentChapter: Math.max(prog.currentChapter, story.currentChapter), updatedAt: now,
    })
    setParsed(null); setMsg('Save applied: party, boxes, badges, Dex, items, beaten trainers and walkthrough steps updated.')
  }

  return (
    <div>
      <PageTitle>Settings</PageTitle>
      <Section title="Cloud sync">
        {!syncEnabled && <p className="text-sm text-stone-500">Sync is not configured for this build (no Supabase keys). Progress stays in this browser; use export/import to move it.</p>}
        {syncEnabled && !session && (
          <form onSubmit={async (e) => { e.preventDefault(); try { await signIn(email); setMsg('Check your email for the sign-in link.') } catch (err) { setMsg((err as Error).message) } }} className="flex gap-2">
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" className="input" />
            <button className="btn-primary">Send link</button>
          </form>
        )}
        {syncEnabled && session && <div className="flex items-center gap-2 text-sm"><span>Signed in as {session.user.email}</span><span className={`chip ${sync.status === 'synced' ? 'bg-emerald-600 text-white' : sync.status === 'error' ? 'bg-red-600 text-white' : 'bg-stone-300'}`}>{sync.status}</span>{sync.msg && <span className="text-xs text-red-600">{sync.msg}</span>}<button className="btn-ghost ml-auto text-xs" onClick={() => signOut()}>Sign out</button></div>}
        <p className="mt-1 text-xs text-stone-500">Progress is saved in this browser instantly and pushed to the cloud a couple of seconds after every change. Newest copy wins.</p>
      </Section>

      <Section title="Import a FireRed save (.sav)">
        <p className="mb-2 text-sm text-stone-600 dark:text-stone-300">From mGBA or BizHawk: pick the 128 KB <code>.sav</code> file. It is read in your browser only. Party, boxes, badges, Pokédex, money and key items replace what is in the tracker.</p>
        <input ref={fileRef} type="file" accept=".sav,.sa1,.srm,.bin" onChange={(e) => e.target.files?.[0] && doSave(e.target.files[0])} className="text-sm" />
        {parsed && (
          <div className="mt-3 rounded-lg bg-stone-100 p-2 text-sm dark:bg-stone-800">
            <div><b>{parsed.playerName}</b> · ID {parsed.trainerId} · ${parsed.money} · {parsed.playTime} · {parsed.badges.filter(Boolean).length} badges · Dex {parsed.caught.length} caught / {parsed.seen.length} seen</div>
            <div className="mt-1 flex flex-wrap gap-2">{parsed.mons.filter((m) => m.inParty).map((m, i) => <span key={i} className="inline-flex items-center gap-1"><Sprite id={m.species} size={28} />{m.nickname || db.pokemonById.get(m.species)?.name} Lv.{m.level}</span>)}</div>
            <div className="text-xs text-stone-500">{parsed.mons.filter((m) => !m.inParty).length} in PC boxes</div>
            {story && <div className="text-xs text-stone-500">Story: chapter {story.currentChapter} · {story.beaten.length} trainers beaten · {story.flags.length} items collected · {story.steps.length} guide steps will be ticked</div>}
            <div className="mt-2 flex gap-2"><button className="btn-primary" onClick={applySave}>Apply to tracker</button><button className="btn-ghost" onClick={() => setParsed(null)}>Cancel</button></div>
          </div>
        )}
      </Section>

      <Section title="Backup">
        <div className="flex flex-wrap gap-2">
          <button className="btn-ghost" onClick={doExport}>Export progress (JSON)</button>
          <label className="btn-ghost cursor-pointer">Import JSON<input type="file" accept=".json" className="hidden" onChange={(e) => e.target.files?.[0] && doImport(e.target.files[0])} /></label>
          <button className="btn-ghost text-red-600" onClick={() => { if (confirm('Erase all progress in this browser?')) prog.reset() }}>Reset everything</button>
        </div>
      </Section>

      <Section title="Display">
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <label>Theme <select value={settings.theme} onChange={(e) => settings.setTheme(e.target.value as never)} className="input inline w-auto py-1"><option value="system">System</option><option value="light">Light</option><option value="dark">Dark</option></select></label>
          <label className="flex items-center gap-1"><input type="checkbox" checked={settings.showShiny} onChange={(e) => settings.setShowShiny(e.target.checked)} className="accent-red-700" /> Shiny sprites</label>
          <label>Trainer name <input value={prog.playerName} onChange={(e) => prog.setPlayerName(e.target.value)} className="input inline w-32 py-1" /></label>
        </div>
      </Section>
      {msg && <p className="text-sm text-emerald-700 dark:text-emerald-400">{msg}</p>}
    </div>
  )
}
