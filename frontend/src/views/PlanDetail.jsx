import { useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useStore } from '../store/useStore.js'
import { uid, exCount } from '../lib/format.js'
import { t } from '../lib/i18n.js'
import { confirmSheet } from '../sheets.jsx'
import Icon from '../components/Icon.jsx'
import { Button } from '../components/ui.jsx'
import { glyphOf, DEFAULT_GLYPH } from '../lib/glyphs.js'

// One plan: its lifecycle toggle (draft/archived → Start · active → End) and the ordered
// list of entraînements that make up its rotation.
export default function PlanDetail() {
  const nav = useNavigate()
  const { planId } = useParams()
  const S = useStore(s => s.S)
  const update = useStore(s => s.update)
  const p = S.plans.find(x => x.id === planId)
  useEffect(() => { if (!p) nav('/plan') }, [!!p])
  if (!p) return null

  const withPlan = fn => update(s => { const pl = s.plans.find(x => x.id === planId); if (pl) fn(pl, s) })

  const start = () => withPlan((pl, s) => {
    s.plans.forEach(x => { if (x.status === 'active' && x.id !== planId) { x.status = 'archived'; x.endedAt = Date.now() } })
    pl.status = 'active'; pl.startedAt = pl.startedAt || Date.now(); pl.endedAt = null
  })
  const end = () => withPlan(pl => { pl.status = 'archived'; pl.endedAt = Date.now() })

  const addRoutine = () => {
    const rid = uid()
    withPlan(pl => pl.routines.push({ id: rid, name: t('New routine'), emoji: DEFAULT_GLYPH, ex: [] }))
    nav('/plan/r/' + rid)
  }
  const move = (i, dir) => withPlan(pl => {
    const j = i + dir
    if (j < 0 || j >= pl.routines.length) return
    const [r] = pl.routines.splice(i, 1)
    pl.routines.splice(j, 0, r)
  })
  const del = () => confirmSheet({
    title: t('Delete plan?'), message: t('“{0}” and its workouts are removed. Sessions you already logged stay in your history.', p.name),
    confirmText: t('Delete'), danger: true,
    onConfirm: () => { update(s => { s.plans = s.plans.filter(x => x.id !== planId) }); nav('/plan') }
  })

  const statusLabel = p.status === 'active' ? t('Active') : p.status === 'archived' ? t('Archived') : t('Draft')

  return <div className="narrow">
    <div className="hdr">
      <button className="iconbtn" onClick={() => nav('/plan')} aria-label={t('Plans')}><Icon name="chevronLeft" /></button>
      <div style={{ flex: 1, margin: '0 12px' }}>
        <input className="input" defaultValue={p.name} style={{ fontWeight: 600, fontSize: 20, letterSpacing: '-.021em' }}
          onChange={e => withPlan(pl => { pl.name = e.target.value.trim() || t('Plan') })} />
      </div>
      <span className={'tag' + (p.status === 'active' ? ' acc' : '')}>{statusLabel}</span>
    </div>

    {p.status === 'active'
      ? <Button variant="danger" icon="flag" onClick={end}>{t('End plan')}</Button>
      : <Button variant="primary" icon="play" onClick={start}>{t('Start plan')}</Button>}

    <div className="row between" style={{ marginTop: 22, marginBottom: 10 }}>
      <h4 className="sec" style={{ margin: 0 }}>{t('Routines')}</h4>
      <Button size="sm" variant="tinted" icon="plus" onClick={addRoutine}>{t('New')}</Button>
    </div>
    {p.routines.length ? <>
      <div className="muted small" style={{ marginBottom: 10 }}>{t('Workouts run in this order and loop back to the top.')}</div>
      <div className="list">{p.routines.map((r, i) => <div key={r.id} className="item" onClick={() => nav('/plan/r/' + r.id)}>
        <span className="lrow-i" style={{ opacity: .8, fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>{i + 1}</span>
        <div className="grow"><div className="tt">{r.name}</div><div className="ss">{exCount(r.ex.length)}</div></div>
        <div className="row" style={{ gap: 2 }} onClick={e => e.stopPropagation()}>
          <button className="iconbtn" disabled={i === 0} onClick={() => move(i, -1)} aria-label={t('Move up')}><Icon name="chevronUp" /></button>
          <button className="iconbtn" disabled={i === p.routines.length - 1} onClick={() => move(i, 1)} aria-label={t('Move down')}><Icon name="chevronDown" /></button>
        </div>
        <Icon name="chevronRight" className="chev" /></div>)}</div>
    </> : <div className="empty"><div className="ico"><Icon name="clipboard" /></div>{t('No routines yet.')}</div>}

    <div style={{ height: 18 }} />
    <Button variant="danger" icon="trash" onClick={del}>{t('Delete plan')}</Button>
  </div>
}
