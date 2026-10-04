import { useEffect, useRef, useState } from 'react';
import { call } from './transport.js';

const statuses = { approval_missing: 'No approval recorded', approved_self_attested: 'Current self-attested approval',
  approval_not_current: 'Approval needs review', withdrawn: 'Participation paused', aged_out: 'Now an adult' };
const date = value => Number.isFinite(value) ? new Date(value).toLocaleString('en-US', { timeZone: 'America/Los_Angeles' }) : 'Not recorded';

export default function YouthApprovalRegisterPanel({ home = '#guardian-home' }) {
  const [result, setResult] = useState(null), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  async function load(offset = 0) {
    if (busy) return;
    setResult(null); setError(''); setBusy(true);
    try {
      const next = await call('youth_approval_register', { offset, limit: 25 });
      if (mounted.current) setResult(next.youthApprovalRegister);
    } catch (e) { if (mounted.current) setError(e.message); }
    finally { if (mounted.current) setBusy(false); }
  }
  return <main className="narrow">
    <p className="eyebrow">RESTRICTED STAFF · CALIFORNIA YOUTH</p>
    <h1>Guardian approval register.</h1>
    <p>This records an authenticated, email-confirmed adult’s approval, their self-attested age and claimed relationship.
      It is not independent verification of age or guardianship.</p>
    <p className="small">Only your current assignment is included. Original answers, BOS, APA and conversations are not shown.
      Historical coverage is not verified. Do not save or share copies outside this protected view.</p>
    <button className="primary" disabled={busy} onClick={() => load()}>{busy ? 'Loading…' : 'Load current approvals'}</button>
    {error && <p role="alert">{error}</p>}
    {result && <section aria-live="polite">
      <p>As of {date(result.asOf)} · {result.indexedCount} indexed registrations in your assignment.</p>
      {!result.rows.length && <p>No indexed registrations in this page.</p>}
      {result.rows.map(row => <article className="panel" key={row.mm}>
        <h2>{row.athleteName || 'Name not recorded'}</h2>
        <p>{row.mm} · Age group {row.currentAgeBand} · {statuses[row.approvalStatus] || 'Review required'}</p>
        <p>Registered: {date(row.registeredAt)} · Current policy: {row.policyCurrent ? 'Yes' : 'No'}</p>
        {row.approvals.length ? row.approvals.map(approval => <section key={approval.approvalId}>
          <h3>{approval.adultName || 'Adult name not recorded'}</h3>
          <p>{approval.adultEmail || 'Adult email not recorded'}</p>
          <p>Claimed relationship: {approval.claimedRelationship?.replaceAll('_', ' ') || 'Not recorded'} · {approval.status}</p>
          <p>Approved: {date(approval.approvedAt)} · Policy: {approval.policyVersion || 'Not recorded'}</p>
          <p className="small">Email confirmed: {approval.emailConfirmed ? 'Yes' : 'No'} · Age and relationship: self-attested, not independently verified.</p>
          {approval.withdrawnAt !== undefined && <p>Withdrawn: {date(approval.withdrawnAt)}</p>}
          {approval.replacedAt !== undefined && <p>Replaced: {date(approval.replacedAt)}</p>}
        </section>) : <p>No adult approval is recorded.</p>}
        {row.missingFields.length > 0 && <p className="small">Not recorded: {row.missingFields.join(', ')}</p>}
      </article>)}
      {result.nextOffset !== null && <button disabled={busy} onClick={() => load(result.nextOffset)}>Next page</button>}
    </section>}
    <p><a href={home}>Return to your home →</a></p>
  </main>;
}
