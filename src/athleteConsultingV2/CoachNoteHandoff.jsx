import React from 'react';
import { selectCoachNoteHandoff } from './coachNoteHandoff.js';

export default function CoachNoteHandoff({ bundle, state }) {
  const { pending, lastOpening, deliveredAt } = selectCoachNoteHandoff(bundle, state);
  if (!pending.length && !lastOpening.length) return null;
  const first = bundle.person.name.split(' ')[0];
  const deliveredTime = deliveredAt && !Number.isNaN(Date.parse(deliveredAt))
    ? new Date(deliveredAt).toLocaleString() : null;
  return <section className="coach-note-handoff" aria-label={`Coach Alex notes for ${first}`}>
    <span className="eyebrow">COACH CONNECT · {first.toUpperCase()}</span>
    <h2>Coach Alex’s notes</h2>
    {pending.length > 0 && <div className="coach-note-group">
      <h3>Ready for your next session</h3>
      <p>These reviewed notes will be shared with MORE when {first} next starts a session.</p>
      {pending.map((message) => <article key={message.id}><small>COACH ALEX · REVIEWED SYNTHETIC NOTE</small><p>{message.text}</p></article>)}
    </div>}
    {lastOpening.length > 0 && <div className="coach-note-group">
      <h3>Given to MORE at session opening</h3>
      {deliveredTime && <small>Delivered once · {deliveredTime}</small>}
      {lastOpening.map((message) => <article key={message.id}><small>COACH ALEX · REVIEWED SYNTHETIC NOTE</small><p>{message.text}</p></article>)}
    </div>}
    <p className="coach-note-boundary">A coach note is an unverified observation. It does not change the BOS, APA, approved learning, or the plan.</p>
  </section>;
}
