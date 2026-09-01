import { create } from 'zustand'
import { uid } from '../lib/format.js'
import { registerCustom } from '../lib/exercises.js'
import { DEMO, DEMO_SEEDED } from '../lib/demo.js'
import { MOBILE, nativeLoad, nativeSave } from '../lib/mobile.js'
import { auth, stateDocRef } from '../lib/firebase.js'
import { onAuthStateChanged, signOut as fbSignOut } from 'firebase/auth'
import { getDoc, setDoc } from 'firebase/firestore'

const KEY = 'gym_state_v1'
export const DEF = {
  unit: 'kg', restSec: 90, sound: true, keepAwake: true, lang: 'fr',
  theme: 'dark', accent: 'lime', body: 'male', targetW: null,
  bodyweight: [], plans: [],
  exWeights: {}, workouts: [], active: null, customEx: [], gifSize: 'full',
  // effort: which per-set effort scale is logged — 'none' | 'rir' | 'rpe'. null, not 'none', so
  // that a profile which never chose (loaded state is overlaid on DEF, on every path: local,
  // server pull, backup import) still falls back to the `showRir` boolean this replaced and
  // keeps the column it had. See effortOf.
  effort: null
}
const clone = o => JSON.parse(JSON.stringify(o))

// Legacy state (a single global `routines` array + the weekday `week`/`dayPlan`) predates the
// plan model. Fold it into one active plan, and drop the weekday schedule. Idempotent, so it
// is safe to run on every load/pull/import.
function migrate(S) {
  if (Array.isArray(S.routines)) {
    if (!Array.isArray(S.plans)) S.plans = []
    if (S.routines.length && !S.plans.length) {
      const now = Date.now()
      const started = (S.workouts || []).reduce((m, w) => Math.min(m, w.start || new Date(w.d).getTime()), now)
      S.plans.push({ id: uid(), name: 'Plan 1', status: 'active', createdAt: now, startedAt: started, endedAt: null, routines: S.routines })
    }
    delete S.routines
  }
  delete S.week; delete S.dayPlan
  if (!Array.isArray(S.plans)) S.plans = []
  // This build is French-only, kilos-only (personal use) — the pickers for both are gone.
  S.lang = 'fr'
  S.unit = 'kg'
  // Time mode retired — every non-cardio exercise is reps + weight. Convert any lingering
  // time-mode config to reps: routine configs and the in-progress session. Past séances in
  // history keep whatever they were logged with.
  const toReps = c => { if (c && c.mode === 'time') { c.mode = 'reps'; if (!(c.reps > 0)) c.reps = 10; delete c.sec } }
  S.plans.forEach(p => (p.routines || []).forEach(r => (r.ex || []).forEach(toReps)))
  if (S.active && Array.isArray(S.active.entries)) {
    S.active.entries.forEach(e => {
      toReps(e.target)
      ;(e.sets || []).forEach(s => { if (s.sec != null && s.r == null) { s.r = (e.target && e.target.reps) || 10; delete s.sec } })
    })
  }
  return S
}

function loadState() {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) return migrate(Object.assign(clone(DEF), JSON.parse(raw)))
  } catch (e) { /* ignore */ }
  return clone(DEF)
}

const hasData = st => !!((st.workouts || []).length || (st.plans || []).some(p => (p.routines || []).length) || (st.bodyweight || []).length)

export const useStore = create((set, get) => {
  let pushTm = null
  let saveTm = null

  // Mobile build: mirror the state into a file in the app's data directory (survives WebView
  // storage eviction).
  const nativePersist = () => {
    clearTimeout(saveTm)
    saveTm = setTimeout(() => { saveTm = null; nativeSave(get().S) }, 800)
  }

  const persist = (S, push = true) => {
    S._ts = Date.now()
    registerCustom(S.customEx)
    localStorage.setItem(KEY, JSON.stringify(S))
    set({ S })
    if (MOBILE) nativePersist()
    if (push && get().user) {
      clearTimeout(pushTm)
      pushTm = setTimeout(() => get().pushState(), 1500)
    }
  }

  // A setting changed right before switching away/closing the tab must not get lost mid-debounce
  // (e.g. changing a setting then immediately backgrounding the app). On mobile the
  // same applies to the file mirror — backgrounding is often the last thing before the OS
  // kills the app.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'hidden') return
    if (MOBILE && saveTm) {
      clearTimeout(saveTm)
      saveTm = null
      nativeSave(get().S)
    }
    if (pushTm) {
      clearTimeout(pushTm)
      pushTm = null
      get().pushState()
    }
  })

  // Everything a sign-out leaves behind on this device, whichever way it was triggered.
  const clearLocalSession = () => {
    get().setUser(null)
    localStorage.removeItem('gym_guest')
    localStorage.removeItem('gym_dirty')
    localStorage.removeItem(KEY)
    persist(clone(DEF), false)
  }

  return {
    S: (() => { const s = loadState(); registerCustom(s.customEx); return s })(),
    user: (() => { try { return JSON.parse(localStorage.getItem('gym_user')) || null } catch { return null } })(),
    ready: false,

    // Mutate a draft of S via producer fn, then persist + schedule sync.
    update(mut, push = true) {
      const S = clone(get().S)
      mut(S)
      persist(S, push)
    },
    replaceState(S, push = false) { persist(migrate(clone(S)), push) },

    isGuest: () => localStorage.getItem('gym_guest') === '1',
    setGuest(v) { if (v) localStorage.setItem('gym_guest', '1'); else localStorage.removeItem('gym_guest'); set({}) },

    setUser(u) {
      if (u) { localStorage.setItem('gym_user', JSON.stringify(u)); localStorage.removeItem('gym_guest') }
      else localStorage.removeItem('gym_user')
      set({ user: u })
    },

    // Sync the whole state blob to this user's Firestore document.
    async pushState() {
      const u = get().user
      if (!u) return
      clearTimeout(pushTm)
      try { await setDoc(stateDocRef(u.id), { state: get().S, _ts: Date.now() }); localStorage.removeItem('gym_dirty') }
      catch (e) { localStorage.setItem('gym_dirty', '1') }
    },
    async pullState() {
      const u = get().user
      if (!u) return
      try {
        const snap = await getDoc(stateDocRef(u.id))
        const state = snap.exists() ? snap.data().state : null
        const S = get().S
        const dirty = localStorage.getItem('gym_dirty') === '1'
        if (state && (!hasData(S) || ((state._ts || 0) >= (S._ts || 0) && !dirty))) {
          const active = S.active
          const next = migrate(Object.assign(clone(DEF), state))
          if (active) next.active = active
          persist(next, false)
        } else if (hasData(S)) { await get().pushState() }
      } catch (e) { /* offline — keep local */ }
    },

    async signOut() {
      try { await get().pushState(); await fbSignOut(auth) } catch (e) { /* */ }
      clearLocalSession()
    },
    // Firebase has no per-device session revocation on the client, so "sign out everywhere"
    // is the same local sign-out here.
    async signOutAll() {
      await get().pushState()
      try { await fbSignOut(auth) } catch (e) { /* */ }
      clearLocalSession()
    },

    // Demo build only: drop the seeded example profile back in (Settings → "Reset demo data").
    // Dynamic import so the generator never ships in a self-hosted bundle.
    async resetDemo() {
      const { buildDemoState } = await import('../lib/demoSeed.js')
      localStorage.removeItem('gym_dirty')
      persist(migrate(Object.assign(clone(DEF), buildDemoState())), false)
    },

    // Boot: ask the server who we are, then pull.
    async boot() {
      // Mobile build: no backend either — restore from the file mirror (the durable copy;
      // localStorage may have been evicted since the last run) and go straight in.
      if (MOBILE) {
        const saved = await nativeLoad()
        const S = get().S
        if (saved && (!hasData(S) || (saved._ts || 0) >= (S._ts || 0))) {
          persist(migrate(Object.assign(clone(DEF), saved)), false)
        } else if (hasData(S)) {
          nativeSave(S)   // first run after an update from a file-less version: seed the mirror
        }
        get().setGuest(true)
        set({ ready: true })
        return
      }
      // Demo build (GitHub Pages): no backend at all — seed once, stay in guest mode.
      if (DEMO) {
        if (!localStorage.getItem(DEMO_SEEDED)) {
          localStorage.setItem(DEMO_SEEDED, '1')
          await get().resetDemo()
        }
        get().setGuest(true)
        set({ ready: true })
        return
      }
      // Firebase Auth is the source of truth for who is signed in. The listener fires once on
      // load (with the restored session or null), then on every sign-in/out.
      let first = true
      onAuthStateChanged(auth, async (fbUser) => {
        if (fbUser) {
          get().setUser({ id: fbUser.uid, name: fbUser.displayName || (fbUser.email || '').split('@')[0] || 'You' })
          await get().pullState()
        } else {
          get().setUser(null)
        }
        first = false
        set({ ready: true })
      })
      // Safety net: if Firebase is blocked or slow, still show the login screen.
      setTimeout(() => { if (first) set({ ready: true }) }, 2500)
    }
  }
})

export { hasData }
