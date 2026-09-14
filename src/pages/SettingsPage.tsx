import { useEffect, useRef, useState } from 'react'
import { getDb } from '../data/db'
import { exportProgress, useProgress, type ProgressDoc } from '../store/progress'
import { useSettings } from '../store/settings'
import { clearCloud, deletePasskey, listPasskeys, passkeySupported, registerPasskey, signIn, signInWithPasskey, signOut, syncEnabled, useSession, useSyncStatus, verifyCode, type PasskeyInfo } from '../lib/sync'
import { inferStoryProgress, parseSave, type ParsedSave } from '../lib/save/gen3'
import { PageTitle, Section, Sprite } from '../components/ui'

function PasskeyManager() {
  const [keys, setKeys] = useState<PasskeyInfo[] | null>(null)
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)
  const refresh = () => listPasskeys().then(setKeys).catch((e) => setMsg((e as Error).message))
  useEffect(() => { void refresh() }, [])
  const add = async () => {
    setBusy(true); setMsg('')
    try { await registerPasskey(); setMsg('Passkey added. Next time, tap "Sign in with passkey".'); await refresh() } catch (e) { setMsg('Could not add passkey: ' + (e as Error).message) } finally { setBusy(false) }
  }
  const remove = async (k: PasskeyInfo) => {
    if (!confirm('Remove this passkey? You can still sign in with an email code.')) return
    try { await deletePasskey(k.id); await refresh() } catch (e) { setMsg((e as Error).message) }
  }
  return (
    <div className="mt-3 rounded-xl bg-stone-50 p-2.5 text-sm dark:bg-stone-800/60">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-medium">🔐 Passkeys</span>
        <span className="text-xs text-stone-500">Face ID / Touch ID / Windows Hello sign-in, no email needed</span>
        {passkeySupported && <button className="btn-primary ml-auto text-xs" onClick={() => void add()} disabled={busy}>{busy ? 'Waiting for device…' : '+ Add passkey on this device'}</button>}
      </div>
      {!passkeySupported && <p className="mt-1 text-xs text-stone-500">This browser does not support passkeys.</p>}
      {keys && keys.length > 0 && (
        <ul className="mt-2 divide-y divide-stone-200 dark:divide-stone-700">
          {keys.map((k) => <li key={k.id} className="flex items-center gap-2 py-1 text-xs"><span className="flex-1">{k.name || 'Passkey'} · added {new Date(k.createdAt).toLocaleDateString()}{k.lastUsedAt ? ` · last used ${new Date(k.lastUsedAt).toLocaleDateString()}` : ''}</span><button className="link" onClick={() => void remove(k)}>remove</button></li>)}
        </ul>
      )}
      {keys && keys.length === 0 && passkeySupported && <p className="mt-1 rounded-lg bg-amber-100 px-2 py-1 text-xs text-amber-900 dark:bg-amber-900/40 dark:text-amber-100">No passkeys yet. Add one now so next time it is just Face ID / Touch ID / Windows Hello, with no email at all. Apple devices share passkeys through iCloud Keychain, so one added in Safari also works in the home-screen app.</p>}
      {msg && <p className="mt-1 text-xs text-stone-600 dark:text-stone-300">{msg}</p>}
    </div>
  )
}

export default function SettingsPage() {
  const db = getDb()
  const prog = useProgress()
  const settings = useSettings()
  const session = useSession()
  const sync = useSyncStatus()
  const [email, setEmail] = useState(() => { try { return localStorage.getItem('firered-pending-email') ?? '' } catch { return '' } })
  const [sent, setSent] = useState(() => { try { return !!localStorage.getItem('firered-pending-email') } catch { return false } })
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const sendCode = async () => {
    setBusy(true)
    try { await signIn(email); try { localStorage.setItem('firered-pending-email', email) } catch { /* private mode */ } setSent(true); setMsg('') } catch (err) { setMsg((err as Error).message) } finally { setBusy(false) }
  }
  const passkeyLogin = async () => {
    setBusy(true); setMsg('')
    try { await signInWithPasskey(); setMsg('Signed in.') } catch (err) { setMsg('Passkey sign-in failed: ' + (err as Error).message + '. Use the email code below, then add a passkey in this section.') } finally { setBusy(false) }
  }
  const verify = async () => {
    setBusy(true)
    try { await verifyCode(email, code); try { localStorage.removeItem('firered-pending-email') } catch { /* ignore */ } setSent(false); setCode(''); setMsg('Signed in.') } catch (err) { setMsg('Not accepted: ' + (err as Error).message + '. Links and codes expire after a while and work once; send a new one if needed.') } finally { setBusy(false) }
  }
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
        {syncEnabled && !session && !sent && passkeySupported && (
          <div className="mb-3">
            <button className="btn-primary w-full py-2.5 text-base" onClick={() => void passkeyLogin()} disabled={busy}>🔐 {busy ? 'Waiting for device…' : 'Sign in with passkey'}</button>
            <p className="mt-1 text-center text-xs text-stone-500">Face ID, Touch ID or Windows Hello. First time on this account? Use the email code below, then add a passkey.</p>
          </div>
        )}
        {syncEnabled && !session && !sent && (
          <form onSubmit={(e) => { e.preventDefault(); void sendCode() }} className="flex gap-2">
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" className="input" autoComplete="email" />
            <button className="btn-primary shrink-0" disabled={busy}>{busy ? 'Sending…' : 'Send code'}</button>
          </form>
        )}
        {syncEnabled && !session && sent && (
          <form onSubmit={(e) => { e.preventDefault(); void verify() }} className="fade-up space-y-2">
            <p className="text-sm">Email sent to <b>{email}</b>.</p>
            <ul className="list-disc space-y-0.5 pl-5 text-xs text-stone-600 dark:text-stone-300">
              <li><b>Home-screen app (iPhone/Android):</b> in the email, <b>long-press the "Log In" link → Copy Link</b>, come back here and paste it. Tapping the link would open Safari instead of this app.</li>
              <li><b>Computer:</b> just click the link, or paste it here.</li>
              <li>If the email shows a numeric code, that works here too.</li>
            </ul>
            <div className="flex gap-2">
              <input value={code} onChange={(e) => setCode(e.target.value)} autoComplete="one-time-code" placeholder="Paste the link or code" className="input font-mono" autoFocus />
              <button className="btn-primary shrink-0" disabled={busy || code.trim().length < 6}>{busy ? 'Checking…' : 'Sign in'}</button>
            </div>
            <div className="flex gap-2 text-xs"><button type="button" className="link" onClick={() => void sendCode()} disabled={busy}>Resend code</button><button type="button" className="link" onClick={() => { setSent(false); setCode(''); try { localStorage.removeItem('firered-pending-email') } catch { /* ignore */ } }}>Use a different email</button></div>
          </form>
        )}
        {syncEnabled && session && <div className="flex items-center gap-2 text-sm"><span>Signed in as {session.user.email}</span><span className={`chip ${sync.status === 'synced' ? 'bg-emerald-600 text-white' : sync.status === 'error' ? 'bg-red-600 text-white' : 'bg-stone-300'}`}>{sync.status}</span>{sync.msg && <span className="text-xs text-red-600">{sync.msg}</span>}<button className="btn-ghost ml-auto text-xs" onClick={() => signOut()}>Sign out</button></div>}
        {syncEnabled && session && <PasskeyManager />}
        <p className="mt-1 text-xs text-stone-500">Progress is saved in this browser instantly and pushed to the cloud a couple of seconds after every change. Devices are merged, so anything ticked or caught on one device is kept everywhere; a new device never overwrites the cloud.</p>
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
          <button className="btn-ghost text-red-600" onClick={async () => { if (confirm(session ? 'Erase all progress in this browser AND the cloud copy?' : 'Erase all progress in this browser?')) { try { await clearCloud() } catch (e) { setMsg('Cloud reset failed: ' + (e as Error).message) } prog.reset() } }}>Reset everything</button>
        </div>
      </Section>

      <Section title="Display">
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <label>Theme <select value={settings.theme} onChange={(e) => settings.setTheme(e.target.value as never)} className="input inline w-auto py-1"><option value="system">System</option><option value="light">Light</option><option value="dark">Dark</option></select></label>
          <label className="flex items-center gap-1" title="Pokémon you own as shiny (and their pre-evolutions) use their shiny sprite"><input type="checkbox" checked={settings.showShiny} onChange={(e) => settings.setShowShiny(e.target.checked)} className="accent-red-700" /> Show my shinies as shiny</label>
          <label>Trainer name <input value={prog.playerName} onChange={(e) => prog.setPlayerName(e.target.value)} className="input inline w-32 py-1" /></label>
        </div>
      </Section>
      {msg && <p className="text-sm text-emerald-700 dark:text-emerald-400">{msg}</p>}
    </div>
  )
}
