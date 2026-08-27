import { useNavigate } from 'react-router-dom'
import { useStore } from '../store/useStore.js'
import { uid } from '../lib/format.js'
import { t } from '../lib/i18n.js'
import { loadStarterPlan, planToolsSheet } from '../sheets.jsx'
import Icon from '../components/Icon.jsx'
import { Button } from '../components/ui.jsx'

// Order plans by lifecycle: the one you train from first, drafts you're preparing next,
// finished plans last (most recent first within each group).
const ORDER = { active: 0, draft: 1, archived: 2 }

export default function Plan() {
  const nav = useNavigate()
  const S = useStore(s => s.S)
  const update = useStore(s => s.update)

  const plans = [...(S.plans || [])].sort((a, b) =>
    ORDER[a.status] - ORDER[b.status] || (b.createdAt || 0) - (a.createdAt || 0))

  const newPlan = () => {
    const id = uid()
    update(s => { s.plans.push({ id, name: t('New plan'), status: 'draft', createdAt: Date.now(), startedAt: null, endedAt: null, routines: [] }) })
    nav('/plan/p/' + id)
  }

  const chip = st => st === 'active'
    ? <span className="tag acc">{t('Active')}</span>
    : st === 'archived' ? <span className="tag">{t('Archived')}</span> : <span className="tag">{t('Draft')}</span>

  return <>
    <div className="hdr">
      <div><h1>{t('Plans')}</h1><div className="sub">{t('Your training plans')}</div></div>
      <button className="iconbtn" onClick={planToolsSheet} aria-label={t('Share your plan')} title={t('Share your plan')}><Icon name="upload" /></button>
    </div>
    <div className="narrow">
      <div className="row between" style={{ marginBottom: 10 }}>
        <h4 className="sec" style={{ margin: 0 }}>{t('Plans')}</h4>
        <Button size="sm" variant="tinted" icon="plus" onClick={newPlan}>{t('New')}</Button>
      </div>
      {plans.length ? <div className="list">{plans.map(p => <div key={p.id} className="item" onClick={() => nav('/plan/p/' + p.id)}>
        <span className="lrow-i"><Icon name="clipboard" /></span>
        <div className="grow"><div className="tt">{p.name}</div><div className="ss">{t(p.routines.length === 1 ? '{0} routine' : '{0} routines', p.routines.length)}</div></div>
        {chip(p.status)}
        <Icon name="chevronRight" className="chev" /></div>)}</div> : <>
        <div className="empty"><div className="ico"><Icon name="clipboard" /></div>{t('No plans yet.')}<br />{t('Create one or load the starter plan.')}</div>
        <Button icon="sparkles" onClick={loadStarterPlan}>{t('Load starter plan (Push / Pull / Legs)')}</Button>
      </>}
    </div>
  </>
}
