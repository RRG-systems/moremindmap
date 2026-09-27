import React from 'react';

const labels = { headline: 'APA heading', opening: 'Your whole picture',
  connection: 'How it connects', main_obstacle: 'Main obstacle',
  what_we_dont_know: 'What is still unknown', 'confirmation.priority': 'Your chosen priority',
  'confirmation.review_date': 'Review date', 'confirmation.horizon_date': 'Look-ahead horizon' };
const confirmationFields = new Set(['confirmation.priority', 'confirmation.review_date', 'confirmation.horizon_date']);
const valueValid = (field, value) => field === 'what_we_dont_know'
  ? Array.isArray(value) && value.every(item => typeof item === 'string')
  : typeof value === 'string' && (!field.endsWith('_date') || /^\d{4}-\d{2}-\d{2}$/u.test(value));
function selectApaNarrativeChanges(receipt) {
  return (Array.isArray(receipt?.narrative_changes) ? receipt.narrative_changes : []).filter(change =>
    Object.hasOwn(labels, change?.field)
    && change.path === (confirmationFields.has(change.field) ? change.field : `report.${change.field}`)
    && valueValid(change.field, change.before) && valueValid(change.field, change.after)
    && typeof change.value_changed === 'boolean' && typeof change.reference_changed === 'boolean'
    && (change.before_refs === null || Array.isArray(change.before_refs))
    && Array.isArray(change.after_refs));
}
function apaNarrativeChangePresentation(change,{proposed=false}={}) {
  return { label:labels[change.field],afterHeading:proposed?'Proposed · not saved':'Published value',
    unchangedText:`The value is unchanged. Its supporting evidence ${proposed?'is proposed for review':'was reviewed again'}.`,
    beforeEvidence:change.before_refs===null
      ? 'Before: original baseline wording had no field-level citation. No earlier citation has been invented.'
      : `Before: ${change.before_refs.length} field-level source reference${change.before_refs.length===1?'':'s'}.`,
    afterEvidence:`${proposed?'Proposed evidence':'Published evidence'}: ${change.after_refs.length} source reference${change.after_refs.length===1?'':'s'}, bound to the ${proposed?'proposed':'saved'} athlete-confirmed update${Number.isSafeInteger(change.version)?` for version ${change.version}`:''}.` };
}
const Value = ({ value }) => Array.isArray(value)
  ? <ul>{value.map((item, index) => <li key={index}>{item}</li>)}</ul>
  : <p>{value}</p>;

// These values come only from the authenticated, verified same-athlete receipt.
// Proposed evidence is labeled as such and never counted as a saved update.
export default function ApaNarrativeChanges({ receipt, proposed = false, historical = false }) {
  const changes = selectApaNarrativeChanges(receipt);
  if (!changes.length) return null;
  return <section className="panel apa-connection" aria-label="Whole-picture changes and evidence">
    <p className="eyebrow green">{proposed ? 'PROPOSED WHOLE-PICTURE UPDATE · NOT SAVED'
      : historical ? 'EARLIER WHOLE-PICTURE UPDATE · REVIEW NEEDED' : 'SAVED WHOLE-PICTURE UPDATE'}</p>
    <p>{proposed ? 'Review the exact earlier and proposed wording before choosing whether to publish. Nothing below is saved yet.'
      : historical ? 'This receipt records an earlier publication. The reading is historical until the changed evidence is reviewed.'
        : 'These are the exact changes you reviewed and published. Your original assessment remains preserved.'}</p>
    {changes.map(change => { const copy=apaNarrativeChangePresentation(change,{proposed});return <article key={change.field}>
      <h3>{copy.label}</h3>
      {change.value_changed ? <div className="two-col">
        <div><h4>Before</h4><Value value={change.before}/></div>
        <div><h4>{copy.afterHeading}</h4><Value value={change.after}/></div>
      </div> : <><p>{copy.unchangedText}</p><Value value={change.after}/></>}
      <p>{copy.beforeEvidence}</p><p>{copy.afterEvidence}</p>
    </article>;})}
  </section>;
}
