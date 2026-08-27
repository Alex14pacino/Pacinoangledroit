import { useState } from 'react'
import { useStore } from '../store/useStore.js'
import { EXIDX } from '../lib/exercises.js'
import { fmtNum, fmtDate, isoOf } from '../lib/format.js'
import { t } from '../lib/i18n.js'
import { activePlan } from '../lib/history.js'
import { entryTonnage, workoutTonnage, planWorkouts } from '../lib/tonnage.js'
import LineChart from './LineChart.jsx'
import Icon from './Icon.jsx'
import { Button, Segmented, SelectRow } from './ui.jsx'

const DAY = 86400000

// The plan-scoped tonnage stats (Phase 2): everything below is filtered to one plan and one
// time window, so switching plans or windows re-reads from the raw séances — nothing is stored.
export default function PlanStats() {
  const S = useStore(s => s.S)
  // Only plans that were actually trained can have stats; a never-started draft has no séances.
  const trained = (S.plans || []).filter(p => p.startedAt)
  const ap = activePlan(S)
  const [planId, setPlanId] = useState(null)
  const [win, setWin] = useState(0)            // 0 = whole plan
  const [custom, setCustom] = useState(null)   // { from: iso, to: iso } or null
  const [showCustom, setShowCustom] = useState(false)
  const [exId, setExId] = useState(null)

  if (!trained.length) return null

  const plan = trained.find(p => p.id === planId) || ap && trained.find(p => p.id === ap.id) || trained[trained.length - 1]
  const all = planWorkouts(S, plan.id)

  // Resolve the active [from, to] window. Windows are anchored to the plan's end (or now, if
  // it is still active), so "last week" means the last week the plan was trained, not of today.
  const anchor = plan.endedAt || Date.now()
  const planStart = plan.startedAt || (all[0]?.start ?? anchor)
  let from, to
  if (custom) { from = new Date(custom.from + 'T00:00:00').getTime(); to = new Date(custom.to + 'T23:59:59').getTime() }
  else if (win === 0) { from = planStart; to = anchor }
  else { from = anchor - win * DAY; to = anchor }
  const inWin = all.filter(w => (w.start || 0) >= from && (w.start || 0) <= to)

  // Card A — tonnage per séance
  const perSession = inWin.map(w => ({ t: w.start, y: workoutTonnage(w), d: w.d }))
  const totalTon = perSession.reduce((n, p) => n + p.y, 0)

  // Card B — tonnage per exercise (of the selected exercise, over the window)
  const exIds = [...new Set(inWin.flatMap(w => w.entries.map(e => e.id)))]
    .filter(id => EXIDX[id]).sort((a, b) => (EXIDX[a].n < EXIDX[b].n ? -1 : 1))
  const curEx = exId && exIds.includes(exId) ? exId : exIds[0] || null
  const exPts = curEx ? inWin.map(w => {
    const e = w.entries.find(x => x.id === curEx)
    return e ? { t: w.start, y: entryTonnage(e), d: w.d } : null
  }).filter(Boolean) : []
  const exTotal = exPts.reduce((n, p) => n + p.y, 0)

  // Card C — cumulative tonnage across the window (the "progression" from start to end)
  let run = 0
  const cumPts = perSession.map(p => ({ t: p.t, y: (run += p.y), d: p.d }))

  const setWinPreset = v => { setWin(v); setCustom(null); setShowCustom(false) }
  const startIso = isoOf(new Date(planStart)), endIso = isoOf(new Date(anchor))
  const unit = S.unit
  const money = v => fmtNum(Math.round(v)) + ' ' + unit

  return <>
    <div className="row between" style={{ marginBottom: 10 }}>
      <h4 className="sec" style={{ margin: 0 }}>{t('Plan stats')}</h4>
    </div>

    {trained.length > 1 && <div className="sect-b" style={{ marginBottom: 12 }}>
      <SelectRow icon="clipboard" title={t('Plan')} sheetTitle={t('Plan stats')} value={plan.id} onChange={setPlanId}
        options={[...trained].reverse().map(p => ({ value: p.id, label: p.name, subtitle: p.status === 'active' ? t('Active') : t('Archived') }))} />
    </div>}

    <Segmented className="seg-range" value={custom ? '_c' : win} onChange={setWinPreset}
      options={[{ value: 7, label: t('Week') }, { value: 30, label: '30d' }, { value: 90, label: '90d' }, { value: 0, label: t('All') }]} />
    <div className="row" style={{ gap: 8, margin: '8px 0 4px' }}>
      <Button size="sm" variant={custom ? 'tinted' : 'ghost'} icon="calendar" onClick={() => setShowCustom(v => !v)}>{t('Custom range')}</Button>
      {custom && <span className="small dim">{fmtDate(custom.from, true)} – {fmtDate(custom.to, true)}</span>}
    </div>
    {showCustom && <div className="row" style={{ gap: 8, alignItems: 'center', margin: '4px 0 12px' }}>
      <input type="date" className="timef" defaultValue={custom?.from || startIso} max={endIso}
        onChange={e => setCustom(c => ({ from: e.target.value, to: (c?.to || endIso) }))} />
      <span className="dim">–</span>
      <input type="date" className="timef" defaultValue={custom?.to || endIso} max={endIso}
        onChange={e => setCustom(c => ({ from: (c?.from || startIso), to: e.target.value }))} />
    </div>}

    {!inWin.length ? <div className="card"><div className="muted small">{t('No sessions in this range.')}</div></div> : <>
      {/* A — tonnage per séance */}
      <div className="card">
        <div className="row between" style={{ alignItems: 'flex-end' }}>
          <h2 style={{ margin: 0 }}>{t('Tonnage per session')}</h2>
          <div style={{ textAlign: 'right' }}><div className="stat-v">{money(totalTon)}</div><div className="small dim">{t('total')}</div></div>
        </div>
        <div className="chart" style={{ marginTop: 8 }}><LineChart points={perSession} h={150} unit={unit} color="var(--acc)" /></div>
      </div>

      {/* B — tonnage per exercise */}
      <div className="card">
        <h2>{t('Tonnage per exercise')}</h2>
        {curEx ? <>
          <div className="sect-b" style={{ marginBottom: 10 }}>
            <SelectRow title={t('Exercise')} sheetTitle={t('Tonnage per exercise')} value={curEx} onChange={setExId}
              options={exIds.map(id => ({ value: id, label: EXIDX[id].n }))} />
          </div>
          <div className="chart"><LineChart points={exPts} h={150} unit={unit} color="var(--blue)" /></div>
          <div className="small dim" style={{ marginTop: 8 }}>{t('Total for this exercise')} · <b className="accent">{money(exTotal)}</b></div>
        </> : <div className="muted small">{t('No exercises in this range.')}</div>}
      </div>

      {/* C — cumulative tonnage across the plan window */}
      <div className="card">
        <div className="row between" style={{ alignItems: 'flex-end' }}>
          <h2 style={{ margin: 0 }}>{t('Plan progression')}</h2>
          <div style={{ textAlign: 'right' }}><div className="stat-v">{money(run)}</div><div className="small dim">{t('cumulative')}</div></div>
        </div>
        <div className="chart" style={{ marginTop: 8 }}><LineChart points={cumPts} h={150} unit={unit} color="var(--purple)" /></div>
        <div className="small dim" style={{ marginTop: 8 }}>{t('Total tonnage lifted, adding up session by session across the plan.')}</div>
      </div>
    </>}

    <div className="small dim" style={{ margin: '2px 2px 18px' }}>
      <Icon name="info" style={{ fontSize: 12 }} /> {t('Tonnage = weight × reps on completed sets; bodyweight sets count as weight 1.')}
    </div>
  </>
}
