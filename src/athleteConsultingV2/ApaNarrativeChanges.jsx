import React from 'react';

const labels = { headline: 'APA heading', opening: 'Your whole picture',
  connection: 'How it connects', main_obstacle: 'Main obstacle',
  what_we_dont_know: 'What is still unknown' };
const valueValid = (field, value) => field === 'what_we_dont_know'
  ? Array.isArray(value) && value.every(item => typeof item === 'string')
  : typeof value === 'string';
const Value = ({ value }) => Array.isArray(value)
  ? <ul>{value.map((item, index) => <li key={index}>{item}</li>)}</ul>
  : <p>{value}</p>;

// These values come only from the authenticated, verified same-athlete receipt.
// Proposed evidence is labeled as such and never counted as a saved update.
export default function ApaNarrativeChanges({ receipt, proposed = false, historical = false }) {
  const changes = (Array.isArray(receipt?.narrative_changes) ? receipt.narrative_changes : []).filter(change =>
    Object.hasOwn(labels, change?.field) && change.path === `report.${change.field}`
    && valueValid(change.field, change.before) && valueValid(change.field, change.after)
    && typeof change.value_changed === 'boolean' && typeof change.reference_changed === 'boolean'
    && (change.before_refs === null || Array.isArray(change.before_refs))
    && Array.isArray(change.after_refs));
  if (!changes.length) return null;
  return <section className="panel apa-connection" aria-label="Whole-picture changes and evidence">
    <p className="eyebrow green">{proposed ? 'PROPOSED WHOLE-PICTURE UPDATE · NOT SAVED'
      : historical ? 'EARLIER WHOLE-PICTURE UPDATE · REVIEW NEEDED' : 'SAVED WHOLE-PICTURE UPDATE'}</p>
    <p>{proposed ? 'Review the exact earlier and proposed wording before choosing whether to publish. Nothing below is saved yet.'
      : historical ? 'This receipt records an earlier publication. The reading is historical until the changed evidence is reviewed.'
        : 'These are the exact changes you reviewed and published. Your original assessment remains preserved.'}</p>
    {changes.map(change => <article key={change.field}>
      <h3>{labels[change.field]}</h3>
      {change.value_changed ? <div className="two-col">
        <div><h4>Before</h4><Value value={change.before}/></div>
        <div><h4>{proposed ? 'Proposed · not saved' : 'Published wording'}</h4><Value value={change.after}/></div>
      </div> : <><p>The wording is unchanged. Its supporting evidence {proposed ? 'is proposed for review' : 'was reviewed again'}.</p><Value value={change.after}/></>}
      <p>{change.before_refs === null ? 'Before: original baseline wording had no field-level citation. No earlier citation has been invented.'
        : `Before: ${change.before_refs.length} field-level source reference${change.before_refs.length === 1 ? '' : 's'}.`}</p>
      <p>{proposed ? 'Proposed evidence' : 'Published evidence'}: {change.after_refs.length} source reference{change.after_refs.length === 1 ? '' : 's'}, bound to the saved athlete-confirmed update{Number.isSafeInteger(change.version) ? ` for version ${change.version}` : ''}.</p>
    </article>)}
  </section>;
}
