import React, { useState } from 'react';
import { eligibleApaMessages } from './currentApaUi.js';

// Remembering a statement and updating the APA are deliberate separate choices.
export default function MemoryContinuity({ bundle, state, disabled, onAction }) {
  const [messageId,setMessageId] = useState(''), [targetId,setTargetId] = useState(''),
    [reviewed,setReviewed] = useState(false), [error,setError] = useState('');
  if (state.flagship_enabled !== true) return null;
  const messages = eligibleApaMessages(bundle,state).filter(m => m.text.length <= 1200);
  const selected = messages.find(m => m.id === messageId);
  const targets = state.personalMemory?.items || [];
  async function save(event) {
    event.preventDefault();
    if (!selected || !reviewed || disabled) return;
    try {
      setError('');
      const result = await onAction({ action:'confirm_memory', source_message_id:selected.id,
        target_event_id:targetId || null });
      if (result && !result.lastError && !result.pendingAttempt) { setReviewed(false); setMessageId(''); setTargetId(''); }
    } catch (e) { setError(e.message); }
  }
  return <section className="plan-card" aria-label="Your reviewed conversation memory">
    <h2>Your own words, for next time.</h2>
    <p>Confirm an exact saved statement, or choose the earlier statement it corrects. This is your self-report, not independent verification. It does not publish an APA or change your agreed plan.</p>
    <details><summary>Review a statement for future conversations</summary><form onSubmit={save}>
      <label>Your saved message<select disabled={disabled} value={messageId} onChange={e=>{setMessageId(e.target.value);setReviewed(false);}}>
        <option value="">Choose your own message</option>{messages.map(m=><option key={m.id} value={m.id}>{m.text.slice(0,140)}</option>)}
      </select></label>
      {selected&&<blockquote>{selected.text}</blockquote>}
      <label>Earlier statement to correct, if needed<select disabled={disabled} value={targetId} onChange={e=>{setTargetId(e.target.value);setReviewed(false);}}>
        <option value="">A new statement, not a correction</option>{targets.map(t=><option key={t.event_id} value={t.event_id}>{t.text}</option>)}
      </select></label>
      <label className="check-label"><input type="checkbox" disabled={disabled||!selected} checked={reviewed} onChange={e=>setReviewed(e.target.checked)}/>
        <span>I reviewed these exact words and, if selected, the earlier statement being corrected.</span></label>
      <button type="submit" disabled={disabled||!selected||!reviewed}>Confirm for future conversations</button>
    </form></details>
    {!!targets.length&&<details><summary>Statements currently available for correction</summary><ul>{targets.map(t=><li key={t.event_id}>{t.text}</li>)}</ul>
      <p>These are attributed athlete statements, not independently verified facts.</p></details>}
    {(error||state.personalMemory?.omitted_count>0)&&<p role={error?'alert':'status'}>{error||'Some older statements are outside this bounded view; their saved history remains preserved.'}</p>}
  </section>;
}
