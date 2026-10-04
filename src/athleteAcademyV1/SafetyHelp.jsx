import React from 'react';

export default function SafetyHelp() {
  return <main className="narrow" aria-labelledby="safety-help-title">
    <p className="eyebrow">MORE ATHLETE · SAFETY HELP</p>
    <h1 id="safety-help-title">Your safety comes first.</h1>
    <section className="panel" aria-labelledby="immediate-help-title">
      <h2 id="immediate-help-title">Need help now?</h2>
      <p>If you or someone else is in immediate danger, call 911 now. Tell the dispatcher your current location.
        Do not wait for sign-in, guardian approval, an email reply, or MORE.</p>
      <div className="actions"><a className="button primary" href="tel:911">Call 911</a>
        <a className="button" href="tel:988">Call 988</a></div>
      <p>For a mental health or suicide crisis, call or text 988 for crisis-professional support.
        If there is immediate danger, use 911.</p>
      <p className="small">MORE is an AI consulting tool, not an emergency service. An AI response is not a safety assessment.
        You do not need an account to use these phone numbers.</p>
    </section>
    <section aria-labelledby="more-concern-title">
      <h2 id="more-concern-title">A concern about MORE or an unsafe interaction?</h2>
      <p>Darren Kirkland is MORE ATHLETE’s safety contact. His staffed hours are Monday–Friday,
        9 a.m.–5 p.m. Pacific. MORE does not provide continuous or emergency monitoring.</p>
      <p><a className="button" href="tel:+19517416964">Call Darren: 951-741-6964</a></p>
      <p><a href="mailto:darren@moremindmap.com">darren@moremindmap.com</a></p>
      <p>This page does not submit or store a safety report. For a non-emergency concern, call Darren first
        and share only what is needed. Do not put sensitive details in voicemail or send passwords,
        sign-in codes, private reports, or images of a minor.</p>
      <p>If a guardian or coach is involved in the concern, you do not have to go through that person.
        If Darren is involved or cannot be reached, do not wait for him before seeking appropriate external help.</p>
      <p><a href="https://www.cdss.ca.gov/reporting/report-abuse/child-protective-services/report-child-abuse"
        target="_blank" rel="noopener noreferrer">California child-protection contact directory ↗</a></p>
      <p className="small">Contacting someone does not automatically change your BOS, APA, plan or participation status.
        A guardian’s participation approval does not give them access to your private conversation.</p>
    </section>
    <p><a href="#welcome">Return to MORE Athlete →</a></p>
  </main>;
}
