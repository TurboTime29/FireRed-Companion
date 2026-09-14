import { useEffect, useRef, useState } from 'react'
import { createClient, type Session, type SupabaseClient } from '@supabase/supabase-js'
import { exportProgress, useProgress, type ProgressDoc } from '../store/progress'

const rawUrl = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim()
// Accept a pasted REST/dashboard URL and reduce it to the project origin.
const url = rawUrl ? (() => { try { return new URL(rawUrl).origin } catch { return undefined } })() : undefined
const key = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)?.trim()

export const supabase: SupabaseClient | null = url && key ? createClient(url, key) : null
export const syncEnabled = !!supabase

type Status = 'disabled' | 'signed-out' | 'syncing' | 'synced' | 'error'
const listeners = new Set<(s: Status, msg?: string) => void>()
let status: Status = syncEnabled ? 'signed-out' : 'disabled'
let statusMsg = ''
function setStatus(s: Status, msg = '') { status = s; statusMsg = msg; listeners.forEach((l) => l(s, msg)) }

export function useSyncStatus() {
  const [s, setS] = useState<{ status: Status; msg: string }>({ status, msg: statusMsg })
  useEffect(() => { const l = (st: Status, m?: string) => setS({ status: st, msg: m ?? '' }); listeners.add(l); return () => { listeners.delete(l) } }, [])
  return s
}

export async function signIn(email: string) {
  if (!supabase) throw new Error('sync disabled')
  const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: window.location.origin + window.location.pathname } })
  if (error) throw error
}
export async function signOut() { await supabase?.auth.signOut() }

async function pull(userId: string): Promise<ProgressDoc | null> {
  const { data, error } = await supabase!.from('progress').select('doc').eq('user_id', userId).maybeSingle()
  if (error) throw error
  return (data?.doc as ProgressDoc) ?? null
}
async function push(userId: string, doc: ProgressDoc) {
  const { error } = await supabase!.from('progress').upsert({ user_id: userId, doc, updated_at: new Date(doc.updatedAt).toISOString() })
  if (error) throw error
}

/** Mount once: signs in from the magic link, pulls the newer copy, and pushes local changes (debounced, last-write-wins). */
export function useSync() {
  const [session, setSession] = useState<Session | null>(null)
  const lastPushed = useRef(0)
  useEffect(() => {
    if (!supabase) return
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => sub.subscription.unsubscribe()
  }, [])
  useEffect(() => {
    if (!supabase || !session) { if (syncEnabled) setStatus('signed-out'); return }
    const userId = session.user.id
    let timer: ReturnType<typeof setTimeout> | undefined
    let cancelled = false
    ;(async () => {
      try {
        setStatus('syncing')
        const remote = await pull(userId)
        const local = exportProgress(useProgress.getState())
        if (remote && remote.updatedAt > local.updatedAt) {
          useProgress.getState().replaceAll(remote)
          lastPushed.current = remote.updatedAt
        } else {
          await push(userId, local)
          lastPushed.current = local.updatedAt
        }
        if (!cancelled) setStatus('synced')
      } catch (e) {
        setStatus('error', (e as Error).message)
      }
    })()
    const unsub = useProgress.subscribe((s) => {
      if (s.updatedAt === lastPushed.current) return
      clearTimeout(timer)
      timer = setTimeout(async () => {
        try {
          setStatus('syncing')
          const doc = exportProgress(s)
          await push(userId, doc)
          lastPushed.current = doc.updatedAt
          setStatus('synced')
        } catch (e) {
          setStatus('error', (e as Error).message)
        }
      }, 2000)
    })
    return () => { cancelled = true; clearTimeout(timer); unsub() }
  }, [session])
  return session
}

export function useSession() {
  const [session, setSession] = useState<Session | null>(null)
  useEffect(() => {
    if (!supabase) return
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => sub.subscription.unsubscribe()
  }, [])
  return session
}
