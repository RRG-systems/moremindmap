import React, { useEffect, useRef, useState } from 'react';
import { eligibleAthleteMessages, selectableApaSources, short,
  summarizeApaChanges } from './continuityModel.js';
import './athlete-continuity.css';

export function AthleteMessageActions({ message, onChoose, disabled = false }) {
  if (message?.role !== 'user' || message.speaker !== 'athlete' || message.capture) return null;
  return <div className="athlete-statement-actions"><button type="button" className="text-button"
    disabled={disabled} onClick={() => onChoose(message.id)}>Use or correct this detail →</button></div>;
}

function ContinuityModal({ title, children, onClose }) {
  const ref = useRef();
  useEffect(() => { ref.current?.showModal(); }, []);
  return <dialog ref={ref} className="athlete-continuity-dialog" onCancel={onClose}>
    <header><h2>{title}</h2><button type="button" aria-label="Close dialog" onClick={onClose}>×</button></header>
    {children}
  </dialog>;
}

export default function AthleteContinuity({ bundle, state, onAction, onNavigate,
  disabled = false, actionError = '', selectedMessageId = null, onSelectionHandled = () => {} }) {
  const [mode, setMode] = useState(null);
  const [sourceMessageId, setSourceMessageId] = useState('');
  const [targetEventId, setTargetEventId] = useState('');
  const [kind, setKind] = useState('reality');
  const [supersededSourceId, setSupersededSourceId] = useState('');
  const [reason, setReason] = useState('');
  const effectiveKind = state?.apaNeedsReview ? 'correction' : kind;
  const messages = eligibleAthleteMessages(state);
  const externalSelection = messages.some((message) => message.id === selectedMessageId)
    ? selectedMessageId : null;
  const activeMode = externalSelection ? 'fact' : mode;
  const activeSourceMessageId = externalSelection || sourceMessageId;
  const facts = state?.personalMemory?.items || [];
  const apaSources = selectableApaSources(bundle, state);
  const draft = state?.apaDraft || null;
  const currentVersion = state?.currentApa?.version || 0;
  const close = () => { setMode(null); onSelectionHandled(); };
  if (!state?.flagship_enabled) return null;

  async function confirmFact(event) {
    event.preventDefault();
    if (!activeSourceMessageId || (targetEventId && !facts.some((item) => item.event_id === targetEventId))) return;
    const result = await onAction({ action: 'confirm_fact', sourceMessageId: activeSourceMessageId,
      ...(targetEventId ? { targetEventId } : {}) });
    if (result) close();
  }

  async function prepareApa(event) {
    event.preventDefault();
    if (!sourceMessageId || !reason.trim() || (effectiveKind === 'correction' && !supersededSourceId)) return;
    const result = await onAction({ action: 'update_apa', sourceMessageId,
      reason: reason.trim(), kind: effectiveKind,
      supersedes: effectiveKind === 'correction' ? [supersededSourceId] : [],
      expectedApaVersion: currentVersion });
    if (result && !result.lastError) { close(); onNavigate('sport', { apaReading: 'preview' }); }
  }

  async function publishDraft() {
    if (!draft) return;
    const result = await onAction({ action: 'publish_apa', id: draft.id, hash: draft.hash });
    if (result?.currentApa?.artifact?.artifact_sha256
      === draft.previewRecord.artifact.artifact_sha256) { close(); onNavigate('sport', { apaReading: 'current' }); }
  }

  return <>
    <section className="athlete-continuity" aria-label="Your evolving understanding">
      <div><span className="eyebrow">YOUR UNDERSTANDING, OVER TIME</span>
        <h2>{state.apaNeedsReview ? 'Your APA needs another look.'
          : draft ? 'A proposed APA update is ready.' : 'Your story can keep evolving.'}</h2>
        <p>{state.apaNeedsReview
          ? 'A correction changed what we know. Your previous APA stays saved, but it is not current evidence for MORE until you review an update.'
          : draft ? 'The proposal has not changed your current APA or your agreed plan. Read it before deciding.'
            : 'You can confirm a detail from your conversation, or ask MORE to prepare a review of your APA. Nothing changes automatically.'}</p>
        {draft && <p className="athlete-continuity-summary">Proposed version {draft.previewRecord.version}
          {summarizeApaChanges(draft).length ? ` · ${summarizeApaChanges(draft).join(' · ')}` : ''}</p>}
      </div>
      <div className="athlete-continuity-actions">
        {draft && <><button type="button" onClick={() => onNavigate('sport', { apaReading: 'preview' })}>Read the proposed APA →</button>
          <button type="button" className="primary" disabled={disabled} onClick={() => setMode('publish')}>Decide on this version</button></>}
        <button type="button" disabled={disabled || !messages.length} onClick={() => {
          setSourceMessageId(messages[0]?.id || ''); setTargetEventId(''); setMode('fact');
        }}>Confirm a detail</button>
        <button type="button" disabled={disabled || !messages.length} onClick={() => {
          setSourceMessageId(state.apaNeedsReview ? '' : messages[0]?.id || '');
          setKind(state.apaNeedsReview ? 'correction' : 'reality');
          setSupersededSourceId(''); setReason(''); setMode('apa');
        }}>{state.apaNeedsReview ? 'Review a correction for your APA' : 'Prepare an APA update'}</button>
      </div>
    </section>

    {activeMode === 'fact' && <ContinuityModal title="Keep or correct this detail" onClose={close}>
      <form onSubmit={confirmFact}>
        {actionError && <p role="alert">{actionError}</p>}
        <p>Only your own saved words can be confirmed. MORE will remember your report with its source and date; it is not independent proof.</p>
        <label>Which message?<select required value={activeSourceMessageId} onChange={(event) => {
          setSourceMessageId(event.target.value); onSelectionHandled(); setMode('fact');
        }}>
          <option value="">Choose your message</option>{messages.map((message) =>
            <option key={message.id} value={message.id}>{short(message.text)}</option>)}</select></label>
        {facts.length > 0 && <label>Does this correct an earlier detail?<select value={targetEventId}
          onChange={(event) => setTargetEventId(event.target.value)}>
          <option value="">No — this is a new detail</option>{facts.map((item) =>
            <option key={item.event_id} value={item.event_id}>{short(item.text)}</option>)}</select></label>}
        <div className="actions"><button type="submit" className="primary" disabled={disabled || !activeSourceMessageId}>
          {targetEventId ? 'Confirm correction' : 'Confirm my report'}</button>
          <button type="button" onClick={close}>Not now</button></div>
      </form>
    </ContinuityModal>}

    {activeMode === 'apa' && <ContinuityModal title="Prepare an APA update" onClose={close}>
      <form onSubmit={prepareApa}>
        {actionError && <p role="alert">{actionError}</p>}
        <p>{state.apaNeedsReview
          ? 'The previous APA is historical. Choose the exact saved athlete message that corrects the earlier source; an unrelated new reality cannot make the old reading current. Your original APA and agreed plan stay unchanged.'
          : 'This prepares a private five-box proposal from one of your saved messages. Your original APA and agreed plan stay unchanged. You will review a proposal before anything becomes current.'}</p>
        <label>Which message describes what changed?<select required value={sourceMessageId}
          onChange={(event) => setSourceMessageId(event.target.value)}>
          <option value="">Choose your message</option>{messages.map((message) =>
            <option key={message.id} value={message.id}>{short(message.text)}</option>)}</select></label>
        <label>What kind of update?<select value={effectiveKind} disabled={state.apaNeedsReview} onChange={(event) => { setKind(event.target.value); setSupersededSourceId(''); }}>
          {!state.apaNeedsReview&&<option value="reality">Current reality</option>}<option value="correction">Correction to an earlier APA source</option>
        </select></label>
        {effectiveKind === 'correction' && <label>Which earlier athlete source is corrected?<select required
          value={supersededSourceId} onChange={(event) => setSupersededSourceId(event.target.value)}>
          <option value="">Choose the earlier source</option>{apaSources.map((source) =>
            <option key={source.id} value={source.id}>{short(source.question || source.text || source.id)}</option>)}</select></label>}
        <label>Why should the APA be reviewed?<textarea required maxLength={1000} value={reason}
          onChange={(event) => setReason(event.target.value)} placeholder="In my own words, what no longer fits?"/></label>
        <div className="actions"><button type="submit" className="primary" disabled={disabled || !sourceMessageId
          || !reason.trim() || (effectiveKind === 'correction' && !supersededSourceId)}>Prepare for my review</button>
          <button type="button" onClick={close}>Not now</button></div>
      </form>
    </ContinuityModal>}

    {activeMode === 'publish' && draft && <ContinuityModal title="Decide on this APA version" onClose={close}>
      {actionError && <p role="alert">{actionError}</p>}
      <p>You are deciding on proposed APA version {draft.previewRecord.version}. The proposal remains available in YOUR SPORT for a full five-box review.</p>
      <p className="athlete-continuity-summary">Changed areas: {summarizeApaChanges(draft).join(', ') || 'No summary available'}</p>
      <p>Your accepted plan does not change. Your original APA remains saved. This reading reflects your confirmed report, not an independently verified result.</p>
      <div className="actions"><button type="button" className="primary" disabled={disabled} onClick={publishDraft}>
        Publish this exact APA version</button>
        <button type="button" onClick={close}>Not now — keep the proposal</button></div>
    </ContinuityModal>}
  </>;
}
