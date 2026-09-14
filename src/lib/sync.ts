import { useEffect, useRef, useState } from 'react'
import { createClient, type Session, type SupabaseClient } from '@supabase/supabase-js'
import { exportProgress, isEmptyProgress, mergeProgress, useProgress, type ProgressDoc } from '../store/progress'

const rawUrl = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim()
// Accept a pasted REST/dashboard URL and reduce it to the project origin.
const url = rawUrl ? (() => { try { return new URL(rawUrl).origin } catch { return undefined } })() : undefined
const key = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)?.trim()

export const supabase: SupabaseClient | null = url && key ? createClient(url, key, { auth: { experimental: { passkey: true } } }) : null
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

/** Sends the sign-in email. With the Supabase "Magic Link" template including {{ .Token }}, the same email carries a one-time code. */
export async function signIn(email: string) {
  if (!supabase) throw new Error('sync disabled')
  const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: window.location.origin + window.location.pathname } })
  if (error) throw error
}

/** True when this browser can do WebAuthn (Face ID / Touch ID / Windows Hello / security key). */
export const passkeySupported = typeof window !== 'undefined' && 'PublicKeyCredential' in window && !!navigator.credentials

/** Face ID / Touch ID sign-in with a passkey registered earlier for this account. */
export async function signInWithPasskey() {
  if (!supabase) throw new Error('sync disabled')
  const { error } = await supabase.auth.signInWithPasskey()
  if (error) throw error
}

/** Adds a passkey for the signed-in user on this device (synced by iCloud Keychain / Google Password Manager). */
export async function registerPasskey() {
  if (!supabase) throw new Error('sync disabled')
  const { error } = await supabase.auth.registerPasskey()
  if (error) throw error
}

export interface PasskeyInfo { id: string; name?: string; createdAt: string; lastUsedAt?: string }
export async function listPasskeys(): Promise<PasskeyInfo[]> {
  if (!supabase) return []
  const { data, error } = await supabase.auth.passkey.list()
  if (error) throw error
  return (data ?? []).map((k) => ({ id: k.id, name: k.friendly_name, createdAt: k.created_at, lastUsedAt: k.last_used_at }))
}
export async function deletePasskey(passkeyId: string) {
  if (!supabase) throw new Error('sync disabled')
  const { error } = await supabase.auth.passkey.delete({ passkeyId })
  if (error) throw error
}

/**
 * Completes sign-in from what the user pastes out of the email: either a one-time code
 * (if the template shows {{ .Token }}) or the magic link itself. The default Supabase
 * link is https://<project>.supabase.co/auth/v1/verify?token=<token_hash>&type=magiclink&redirect_to=...
 * and that token_hash can be verified in-app, so an installed PWA never has to open Safari.
 */
export async function verifyCode(email: string, input: string) {
  if (!supabase) throw new Error('sync disabled')
  const raw = input.trim()
  if (/^https?:\/\//i.test(raw)) {
    const u = new URL(raw)
    const hash = new URLSearchParams(u.hash.replace(/^#/, ''))
    const tokenHash = u.searchParams.get('token')
    if (tokenHash) {
      const t = (u.searchParams.get('type') || 'magiclink') as 'magiclink' | 'email' | 'signup' | 'recovery'
      const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: t })
      if (error) throw error
      return
    }
    if (hash.get('access_token') && hash.get('refresh_token')) {
      const { error } = await supabase.auth.setSession({ access_token: hash.get('access_token')!, refresh_token: hash.get('refresh_token')! })
      if (error) throw error
      return
    }
    if (u.searchParams.get('code')) throw new Error('that is the page Safari landed on, not the link from the email. Long-press the link inside the email and choose Copy Link')
    throw new Error('no sign-in token in that link')
  }
  const { error } = await supabase.auth.verifyOtp({ email, token: raw.replace(/\s+/g, ''), type: 'email' })
  if (error) throw error
}
export async function signOut() { await supabase?.auth.signOut() }

/** Delete the cloud copy (used by "Reset everything", since an empty document is never pushed). */
export async function clearCloud() {
  if (!supabase) return
  const { data } = await supabase.auth.getSession()
  const userId = data.session?.user.id
  if (!userId) return
  const { error } = await supabase.from('progress').delete().eq('user_id', userId)
  if (error) throw error
}

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
        if (remote && isEmptyProgress(local)) {
          // fresh device: take the cloud copy as-is
          useProgress.getState().replaceAll(remote)
          lastPushed.current = remote.updatedAt
        } else if (remote) {
          // both sides have data: merge so nothing recorded on either device is lost
          const merged = mergeProgress(local, remote)
          const changedRemote = JSON.stringify(merged) !== JSON.stringify(remote)
          if (JSON.stringify(merged) !== JSON.stringify(local)) useProgress.getState().replaceAll(merged)
          if (changedRemote) await push(userId, merged)
          lastPushed.current = merged.updatedAt
        } else if (!isEmptyProgress(local)) {
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
          if (isEmptyProgress(doc)) { setStatus('synced'); return } // never push a blank document over the cloud copy
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
