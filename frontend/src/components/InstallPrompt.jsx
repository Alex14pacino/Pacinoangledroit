import { useEffect, useState } from 'react'
import { t } from '../lib/i18n.js'
import Icon from './Icon.jsx'
import { Button } from './ui.jsx'

const DISMISS_KEY = 'gym_install_dismissed'
const isStandalone = () =>
  window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true
const isIOS = () => /iPhone|iPad|iPod/.test(navigator.userAgent) && !window.MSStream

// A friendly "add to your home screen" banner. On Chromium (Android/desktop) it drives the
// native install prompt; on iOS Safari — which has no prompt API — it shows the manual steps.
export default function InstallPrompt() {
  const [deferred, setDeferred] = useState(null)
  const [ios, setIos] = useState(false)
  const [show, setShow] = useState(false)

  useEffect(() => {
    if (isStandalone()) return
    try { if (localStorage.getItem(DISMISS_KEY)) return } catch { /* */ }

    const onPrompt = e => { e.preventDefault(); setDeferred(e); setShow(true) }
    window.addEventListener('beforeinstallprompt', onPrompt)
    const onInstalled = () => { setShow(false); try { localStorage.setItem(DISMISS_KEY, '1') } catch { /* */ } }
    window.addEventListener('appinstalled', onInstalled)

    let tm
    if (isIOS() && /Safari/.test(navigator.userAgent) && !/CriOS|FxiOS/.test(navigator.userAgent)) {
      setIos(true)
      tm = setTimeout(() => setShow(true), 1200)   // iOS never fires an event — offer it anyway
    }
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt)
      window.removeEventListener('appinstalled', onInstalled)
      clearTimeout(tm)
    }
  }, [])

  const install = async () => {
    if (!deferred) return
    deferred.prompt()
    try { await deferred.userChoice } catch { /* */ }
    setDeferred(null); setShow(false)
  }
  const dismiss = () => { setShow(false); try { localStorage.setItem(DISMISS_KEY, '1') } catch { /* */ } }

  if (!show) return null

  return (
    <div style={{
      position: 'fixed', left: '50%', transform: 'translateX(-50%)', bottom: 'calc(74px + env(safe-area-inset-bottom, 0px))',
      width: 'min(440px, calc(100vw - 24px))', zIndex: 60,
      background: 'var(--surface-2, #1c1e24)', color: 'var(--label, #fff)',
      border: '1px solid var(--sep, #33353b)', borderRadius: 16,
      boxShadow: '0 12px 34px rgba(0,0,0,.4)', padding: 14,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <span style={{
          flex: 'none', width: 40, height: 40, borderRadius: 10, background: 'var(--acc, #a3e635)',
          color: '#0c0e12', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22,
        }}><Icon name="dumbbell" /></span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 600 }}>{t('Install openGym')}</div>
          <div className="small" style={{ opacity: .7 }}>{t('Add it to your home screen for a full-screen app.')}</div>
        </div>
        <button onClick={dismiss} aria-label={t('Dismiss')} style={{
          flex: 'none', background: 'none', border: 0, color: 'var(--label-3, #8a8d94)', fontSize: 22, cursor: 'pointer', lineHeight: 1, padding: 4,
        }}>×</button>
      </div>

      {ios ? (
        <div className="small" style={{ marginTop: 10, opacity: .85, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          {t('Tap')} <Icon name="upload" style={{ fontSize: 15 }} /> {t('in the toolbar, then')} <b>{t('Add to Home Screen')}</b>.
        </div>
      ) : (
        <div style={{ marginTop: 10 }}>
          <Button variant="primary" icon="download" onClick={install}>{t('Install')}</Button>
        </div>
      )}
    </div>
  )
}
