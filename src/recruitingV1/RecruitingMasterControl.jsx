import { useMemo, useState } from 'react';

const EMPTY_FORM = { manager_name: '', manager_email: '', enterprise_name: '', enterprise_id: '', manager_profile_id: '' };

function statusLabel(value) {
  return String(value || '').replaceAll('_', ' ').toLowerCase().replace(/^./u, (letter) => letter.toUpperCase());
}

function usageLabel(entitlement) {
  if (entitlement.mode === 'unlimited') return `${entitlement.used} this period · Unlimited`;
  return `${entitlement.used} used · ${entitlement.remaining} remaining`;
}

export default function RecruitingMasterControl({ data, request, synthetic, refresh, setError }) {
  const [syntheticSnapshot, setSyntheticSnapshot] = useState(data);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('ALL');
  const [entitlement, setEntitlement] = useState('ALL');
  const [setup, setSetup] = useState('ALL');
  const [selected, setSelected] = useState(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [notice, setNotice] = useState('');

  const snapshot = synthetic ? syntheticSnapshot : data;
  const memberships = useMemo(() => snapshot?.memberships || [], [snapshot]);
  const visible = useMemo(() => memberships.filter((membership) => {
    const haystack = `${membership.manager_name} ${membership.manager_email} ${membership.enterprise_name}`.toLowerCase();
    return (!search || haystack.includes(search.toLowerCase()))
      && (status === 'ALL' || membership.status === status)
      && (entitlement === 'ALL' || membership.entitlement.mode === entitlement)
      && (setup === 'ALL' || membership.setup_state === setup);
  }), [memberships, search, status, entitlement, setup]);

  async function openMembership(membership) {
    if (synthetic) {
      setSelected({ ...membership, audit: membership.audit?.length ? membership.audit : [
        { event_id: 'audit_synthetic_1', event_type: membership.setup_state === 'COMPLETE' ? 'MANAGER_SETUP_COMPLETED' : 'MANAGER_SETUP_SENT', occurred_at: membership.setup_completed_at || membership.setup_sent_at || '2026-08-20T17:00:00.000Z' },
        { event_id: 'audit_synthetic_2', event_type: 'MANAGER_MEMBERSHIP_CREATED', occurred_at: '2026-07-28T17:00:00.000Z' },
      ] });
      return;
    }
    try {
      const payload = await request({ view: 'master_control_membership', query: { membership_id: membership.membership_id } });
      setSelected(payload.membership);
    } catch (failure) { setError(failure.message); }
  }

  function updateSynthetic(membershipId, updater) {
    setSyntheticSnapshot((current) => {
      const membershipsNext = current.memberships.map((item) => item.membership_id === membershipId ? updater(item) : item);
      return { ...current, memberships: membershipsNext, total: membershipsNext.length };
    });
  }

  async function mutate(action, membership, body = {}) {
    try {
      if (synthetic) {
        const nextStatus = action === 'ADMIN_SUSPEND_MANAGER' ? 'SUSPENDED' : action === 'ADMIN_ACTIVATE_MANAGER' ? 'ACTIVE' : action === 'ADMIN_REVOKE_MANAGER' ? 'REVOKED' : membership.status;
        const nextSetup = action === 'ADMIN_RESEND_MANAGER_SETUP' ? 'SETUP_SENT' : membership.setup_state;
        updateSynthetic(membership.membership_id, (item) => ({ ...item, status: nextStatus, setup_state: nextSetup }));
        setSelected((current) => ({ ...current, status: nextStatus, setup_state: nextSetup }));
      } else {
        await request({ action, body: { membership_id: membership.membership_id, ...body } });
        await refresh();
        setSelected(null);
      }
      setNotice(action === 'ADMIN_RESEND_MANAGER_SETUP' ? 'A new single-use setup link was sent.' : 'Manager access updated and recorded.');
    } catch (failure) { setError(failure.message); }
  }

  async function create(event) {
    event.preventDefault();
    try {
      if (synthetic) {
        const now = new Date().toISOString();
        const membership = {
          ...form,
          membership_id: `membership_synthetic_${Date.now()}`,
          enterprise_id: form.enterprise_id || `enterprise_synthetic_${Date.now()}`,
          status: 'PENDING_SETUP', setup_state: 'SETUP_SENT', profile_bound: Boolean(form.manager_profile_id), setup_sent_at: now,
          entitlement: { mode: '5_per_month', limit: 5, used: 0, reserved: 0, consumed: 0, remaining: 5, period_start: '2026-08-01T00:00:00.000Z', period_end: '2026-09-01T00:00:00.000Z' }, audit: [],
        };
        setSyntheticSnapshot((current) => ({ ...current, memberships: [...current.memberships, membership].sort((a, b) => a.enterprise_name.localeCompare(b.enterprise_name) || a.manager_name.localeCompare(b.manager_name)), total: current.total + 1 }));
      } else {
        await request({ action: 'ADMIN_CREATE_MANAGER', body: form });
        await refresh();
      }
      setForm(EMPTY_FORM);
      setCreating(false);
      setNotice('Manager created with five invitations per month. A single-use setup link was sent.');
    } catch (failure) { setError(failure.message); }
  }

  async function correctPending(event) {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(event.currentTarget));
    await mutate('ADMIN_UPDATE_PENDING_MANAGER', selected, values);
  }

  if (!snapshot) return <section className="surface"><p className="eyebrow blue">Master Control</p><h1>Opening the authorized manager roster…</h1></section>;

  return (
    <section className="surface master-control-surface" data-surface="master-control">
      <header className="master-control-title"><div><p className="eyebrow blue">Recruiting Master Control</p><h1>Every enterprise manager you govern, visible on arrival.</h1><p className="surface-subhead">Provision access, confirm setup, and understand invitation usage without opening customer intelligence.</p></div><button className="solid-button inline" type="button" onClick={() => setCreating((value) => !value)}>＋ Add manager</button></header>
      <section className="master-summary"><article><small>Authorized accounts</small><strong>{snapshot.total}</strong><span>All shown by default</span></article><article><small>Active</small><strong>{memberships.filter((item) => item.status === 'ACTIVE').length}</strong><span>Ready to invite</span></article><article><small>Awaiting setup</small><strong>{memberships.filter((item) => item.status === 'PENDING_SETUP').length}</strong><span>Verification incomplete</span></article><article className="unlimited-summary"><small>Darren invitation access</small><strong>Unlimited</strong><span>{snapshot.admin.entitlement.used} invitations this period</span></article></section>
      {notice && <div className="master-notice" role="status">✓ {notice}</div>}
      {creating && <form className="panel master-create" onSubmit={create}><div><p className="eyebrow green">Provision standard manager</p><h2>Five invitations per month</h2></div><label>Manager name<input required value={form.manager_name} onChange={(event) => setForm({ ...form, manager_name: event.target.value })} /></label><label>Verified business email<input required type="email" value={form.manager_email} onChange={(event) => setForm({ ...form, manager_email: event.target.value })} /></label><label>Enterprise / company<input required value={form.enterprise_name} onChange={(event) => setForm({ ...form, enterprise_name: event.target.value })} /></label><label>Enterprise ID <small>optional for new accounts</small><input value={form.enterprise_id} onChange={(event) => setForm({ ...form, enterprise_id: event.target.value })} /></label><label>MORE Profile ID <small>optional until setup</small><input value={form.manager_profile_id} onChange={(event) => setForm({ ...form, manager_profile_id: event.target.value })} placeholder="MM-YYYYMMDD-XXXXXXXX" /></label><button className="solid-button" type="submit">Create and send setup →</button></form>}
      <section className="master-filters panel" aria-label="Roster filters"><label>Find a manager or company<input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search the roster" /></label><label>Status<select value={status} onChange={(event) => setStatus(event.target.value)}><option value="ALL">All statuses</option><option value="ACTIVE">Active</option><option value="PENDING_SETUP">Pending setup</option><option value="SUSPENDED">Suspended</option><option value="REVOKED">Revoked</option></select></label><label>Invitation access<select value={entitlement} onChange={(event) => setEntitlement(event.target.value)}><option value="ALL">All access levels</option><option value="5_per_month">5 per month</option><option value="unlimited">Unlimited</option></select></label><label>Setup<select value={setup} onChange={(event) => setSetup(event.target.value)}><option value="ALL">All setup states</option><option value="SETUP_SENT">Setup sent</option><option value="COMPLETE">Complete</option></select></label>{(search || status !== 'ALL' || entitlement !== 'ALL' || setup !== 'ALL') && <button type="button" onClick={() => { setSearch(''); setStatus('ALL'); setEntitlement('ALL'); setSetup('ALL'); }}>Clear filters</button>}</section>
      <div className="master-roster-heading"><div><p className="eyebrow teal">Authorized roster</p><h2>{visible.length === memberships.length ? `All ${memberships.length} accounts` : `${visible.length} of ${memberships.length} accounts`}</h2></div><span>Company · manager · access · invitation usage · setup</span></div>
      <div className="master-roster" role="list">{visible.map((membership) => <button type="button" role="listitem" className={`master-row status-${membership.status.toLowerCase()}`} key={membership.membership_id} onClick={() => openMembership(membership)}><div><small>{membership.enterprise_name}</small><strong>{membership.manager_name}</strong><span>{membership.manager_email}</span></div><b className="master-status">{statusLabel(membership.status)}</b><div><small>Invitation access</small><strong className={membership.entitlement.mode === 'unlimited' ? 'unlimited-text' : ''}>{membership.entitlement.mode === 'unlimited' ? 'Unlimited' : '5 / month'}</strong><span>{usageLabel(membership.entitlement)}</span></div><div><small>Setup</small><strong>{statusLabel(membership.setup_state)}</strong><span>{membership.profile_bound ? 'MORE Profile connected' : 'Profile connection pending'}</span></div><i>→</i></button>)}</div>
      {visible.length === 0 && <div className="panel master-empty"><h2>No accounts match these filters.</h2><button type="button" onClick={() => { setSearch(''); setStatus('ALL'); setEntitlement('ALL'); setSetup('ALL'); }}>Show everyone</button></div>}
      {selected && <div className="master-drawer-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelected(null); }}><aside className="master-drawer" aria-label={`${selected.manager_name} manager details`}><button className="drawer-close" type="button" onClick={() => setSelected(null)}>×</button><p className="eyebrow blue">Manager access</p><h2>{selected.manager_name}</h2><p>{selected.enterprise_name} · {selected.manager_email}</p><div className="drawer-facts"><span><small>Status</small><b>{statusLabel(selected.status)}</b></span><span><small>Invitation access</small><b>{selected.entitlement.mode === 'unlimited' ? 'Unlimited' : '5 per month'}</b></span><span><small>Usage</small><b>{usageLabel(selected.entitlement)}</b></span><span><small>Setup</small><b>{statusLabel(selected.setup_state)}</b></span></div>{selected.status === 'PENDING_SETUP' && <form className="drawer-correction" onSubmit={correctPending}><strong>Correct pending details</strong><input name="manager_name" defaultValue={selected.manager_name} aria-label="Manager name" /><input name="manager_email" type="email" defaultValue={selected.manager_email} aria-label="Manager email" /><input name="enterprise_name" defaultValue={selected.enterprise_name} aria-label="Enterprise name" /><button type="submit">Save corrections</button></form>}<div className="drawer-actions">{selected.status === 'PENDING_SETUP' && <button type="button" onClick={() => mutate('ADMIN_RESEND_MANAGER_SETUP', selected)}>Resend setup</button>}{selected.status === 'ACTIVE' && selected.entitlement.mode !== 'unlimited' && <button type="button" onClick={() => mutate('ADMIN_SUSPEND_MANAGER', selected)}>Suspend access</button>}{selected.status === 'SUSPENDED' && <button type="button" onClick={() => mutate('ADMIN_ACTIVATE_MANAGER', selected)}>Reactivate</button>}{!['REVOKED'].includes(selected.status) && selected.entitlement.mode !== 'unlimited' && <button className="danger" type="button" onClick={() => mutate('ADMIN_REVOKE_MANAGER', selected)}>Revoke</button>}</div><section className="drawer-audit"><p className="eyebrow violet">Access history</p>{(selected.audit || []).map((event) => <article key={event.event_id}><span>✓</span><div><strong>{statusLabel(event.event_type)}</strong><small>{new Date(event.occurred_at).toLocaleString()}</small></div></article>)}</section><footer>Master Control contains manager access and invitation-usage details only. Recruiting intelligence is intentionally unavailable here.</footer></aside></div>}
    </section>
  );
}
