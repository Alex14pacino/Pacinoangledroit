import { useEffect } from 'react'
import { useUI } from '../store/useUI.js'
import { t } from '../lib/i18n.js'
import { Button } from './ui.jsx'

const clock = sec => Math.floor(sec / 60) + ':' + String(sec % 60).padStart(2, '0')

// One bar, two meanings: the rest countdown between sets, and the work countdown during a
// timed set (issue #16). They are mutually exclusive by construction — startWork() stops any
// running rest — so the bar can never have to show both, and a work set gets its own colour
// plus a "Done" that logs the time actually held.
export default function RestTimer() {
  const timer = useUI(s => s.timer)
  const work = useUI(s => s.work)
  const { addRest, stopRest, finishWorkEarly, stopWork } = useUI()
  const on = work || timer
  // The bar is fixed above the tab bar and floats over whatever is beneath it — during a
  // rest that was the next set's row. Extra bottom padding lets the page scroll clear.
  useEffect(() => {
    document.body.classList.toggle('resting', !!on)
    return () => document.body.classList.remove('resting')
  }, [!!on])
  if (!on) return null
  const pct = (on.left / on.total) * 100

  if (work) return (
    <div id="timer" className="working">
      <div className="t">{clock(work.left)}</div>
      <div className="grow">
        {work.label && <div className="lbl">{work.label}</div>}
        <div className="bar"><i style={{ width: pct + '%' }} /></div>
      </div>
      <Button size="sm" onClick={stopWork}>{t('Cancel')}</Button>
      <Button size="sm" variant="primary" icon="check" onClick={finishWorkEarly}>{t('Done')}</Button>
    </div>
  )
  // Three controls plus the clock don't fit one line on a phone — at 360px the bar is left
  // with about 30px and stops saying anything. So the rest variant stacks: clock and bar
  // read at a glance, controls get their own row. −15 and +15 sit together in number-line
  // order; Skip is pushed to the far edge, away from the button you tap to buy more time.
  // Rest is a big, centred, full-screen countdown — so unlocking the phone mid-rest shows the
  // time at a glance. Controls sit under it; Skip closes it and returns to the workout.
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 80,
      background: 'color-mix(in srgb, var(--surface) 92%, transparent)',
      backdropFilter: 'saturate(180%) blur(24px)', WebkitBackdropFilter: 'saturate(180%) blur(24px)',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      gap: 26, padding: 24, textAlign: 'center',
    }}>
      <div style={{ fontSize: 13, letterSpacing: '.16em', textTransform: 'uppercase', color: 'var(--label-2)', fontWeight: 700 }}>{t('Rest')}</div>
      <div style={{ fontSize: 'min(46vw, 32vh)', lineHeight: 0.85, fontWeight: 700, letterSpacing: '-.03em', fontVariantNumeric: 'tabular-nums', color: 'var(--acc)' }}>{clock(timer.left)}</div>
      <div style={{ width: 'min(520px, 82vw)', height: 8, background: 'var(--surface-3)', borderRadius: 99, overflow: 'hidden' }}>
        <i style={{ display: 'block', height: '100%', width: pct + '%', background: 'var(--acc)', transition: 'width 1s linear' }} />
      </div>
      <div style={{ display: 'flex', gap: 10, width: 'min(440px, 90vw)' }}>
        <Button icon="minus" onClick={() => addRest(-15)}>15s</Button>
        <Button icon="plus" onClick={() => addRest(15)}>15s</Button>
        <Button variant="primary" onClick={stopRest} style={{ marginLeft: 'auto', minWidth: 100 }}>{t('Skip')}</Button>
      </div>
    </div>
  )
}
