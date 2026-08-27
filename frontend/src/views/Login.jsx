import { useState } from 'react'
import { useStore } from '../store/useStore.js'
import { useUI } from '../store/useUI.js'
import { t } from '../lib/i18n.js'
import { DEMO, REPO } from '../lib/demo.js'
import { auth, googleProvider } from '../lib/firebase.js'
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, signInWithPopup, updateProfile } from 'firebase/auth'
import Icon from '../components/Icon.jsx'
import { Button } from '../components/ui.jsx'

function authError(e) {
  const c = e?.code || ''
  if (c.includes('invalid-credential') || c.includes('wrong-password') || c.includes('user-not-found')) return t('Wrong email or password.')
  if (c.includes('email-already-in-use')) return t('That email already has an account.')
  if (c.includes('weak-password')) return t('Password too short (min 6 characters).')
  if (c.includes('invalid-email')) return t('Invalid email address.')
  return e?.message || t('Sign-in failed')
}

const head = <>
  <div style={{ fontSize: 54, display: 'flex', justifyContent: 'center', color: 'var(--acc)' }}><Icon name="dumbbell" /></div>
  <h1 style={{ fontSize: 34, fontWeight: 700, letterSpacing: '-.028em', margin: '10px 0 4px' }}>PacinAngle</h1>
</>
const wrap = { display: 'flex', flexDirection: 'column', justifyContent: 'center', minHeight: '78vh', textAlign: 'center' }

export default function Login() {
  const setGuest = useStore(s => s.setGuest)
  const [mode, setMode] = useState('in')   // 'in' = sign in · 'up' = create account
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [pw, setPw] = useState('')
  const [busy, setBusy] = useState(false)
  const toast = useUI.getState().toast

  const submit = async () => {
    const em = email.trim()
    if (!em || !pw) { toast(t('Enter your email and password')); return }
    setBusy(true)
    try {
      if (mode === 'up') {
        const cred = await createUserWithEmailAndPassword(auth, em, pw)
        if (name.trim()) await updateProfile(cred.user, { displayName: name.trim() })
      } else {
        await signInWithEmailAndPassword(auth, em, pw)
      }
      // onAuthStateChanged (in boot) takes over: sets the user and pulls their data.
    } catch (e) { toast(authError(e)) }
    setBusy(false)
  }
  const google = async () => {
    setBusy(true)
    try { await signInWithPopup(auth, googleProvider) }
    catch (e) { if (!(e?.code || '').includes('popup-closed') && !(e?.code || '').includes('cancelled')) toast(authError(e)) }
    setBusy(false)
  }

  // Demo build: no backend to sign in against — the only way in is the local guest profile.
  if (DEMO) return (
    <div className="narrow" style={wrap}>
      {head}
      <div className="muted" style={{ marginBottom: 30 }}>{t('Live demo — everything stays in this browser.')}</div>
      <Button variant="primary" icon="sparkles" onClick={() => setGuest(true)}>{t('Start the demo')}</Button>
      <div className="dim small" style={{ marginTop: 22, lineHeight: 1.6 }}>
        <a href={REPO} target="_blank" rel="noopener">{t('Self-host it in a minute →')}</a>
      </div>
    </div>
  )

  return (
    <div className="narrow" style={wrap}>
      {head}
      <div className="muted" style={{ marginBottom: 24 }}>{t('Your workouts. Your weights. Your profile.')}</div>
      {mode === 'up' && <>
        <input className="input" placeholder={t('Your name')} value={name} maxLength={40} onChange={e => setName(e.target.value)} />
        <div style={{ height: 10 }} />
      </>}
      <input className="input" type="email" placeholder={t('Email')} value={email} autoComplete="email"
        onChange={e => setEmail(e.target.value)} />
      <div style={{ height: 10 }} />
      <input className="input" type="password" placeholder={t('Password')} value={pw}
        autoComplete={mode === 'up' ? 'new-password' : 'current-password'}
        onChange={e => setPw(e.target.value)} onKeyDown={e => e.key === 'Enter' && submit()} />
      <div style={{ height: 12 }} />
      <Button variant="primary" disabled={busy} onClick={submit}>{mode === 'up' ? t('Create account') : t('Sign in')}</Button>
      <div style={{ height: 10 }} />
      <Button disabled={busy} icon="person" onClick={google}>{t('Continue with Google')}</Button>
      <div style={{ height: 16 }} />
      <button onClick={() => setMode(m => (m === 'in' ? 'up' : 'in'))}
        style={{ background: 'none', border: 0, color: 'var(--acc)', cursor: 'pointer', fontSize: 14 }}>
        {mode === 'in' ? t('No account? Create one') : t('Already have an account? Sign in')}
      </button>
      <div style={{ height: 16 }} />
      <Button variant="ghost" className="dim" onClick={() => setGuest(true)}>{t('Continue without account')}</Button>
    </div>
  )
}
