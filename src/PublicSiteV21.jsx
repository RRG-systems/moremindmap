import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import './publicSiteV21.css';
import { resolveProductionAthleteDestination } from './publicSiteV21Config.js';

function Icon({ name }) {
  const paths = {
    person: <path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm7 8a7 7 0 0 0-14 0" />,
    business: <path d="M4 21V7l8-4 8 4v14M8 10h2m4 0h2M8 14h2m4 0h2M9 21v-3h6v3" />,
    alive: <path d="M3 12h4l2-5 4 10 2-5h6M12 3v2m0 14v2" />,
    athlete: <><circle cx="14" cy="4" r="2" /><path d="m10 9 3-2 2 3 3 2m-8-3-2 4-4 1m8-2-3 4-3 4m6-8-1 4 4 4" /></>,
    leads: <path d="M4 19V9m6 10V5m6 14v-7m4 7H2M5 7l5-4 5 5 5-6" />,
    arrow: <path d="M5 12h14m-5-5 5 5-5 5" />,
    check: <path d="m5 12 4 4L19 6" />,
  };
  return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">{paths[name] || paths.arrow}</svg>;
}

function Ambient() {
  return <div className="ambient" aria-hidden="true"><span className="ambient-orb ambient-orb-one" /><span className="ambient-orb ambient-orb-two" /><svg viewBox="0 0 1440 520" preserveAspectRatio="none"><path d="M-80 350 C 170 170, 330 430, 570 290 S 980 120, 1210 300 S 1460 420, 1550 210" /><path d="M-80 390 C 160 225, 350 460, 585 330 S 995 170, 1220 345 S 1460 455, 1550 255" /><path d="M-80 430 C 150 275, 365 490, 600 370 S 1010 220, 1230 385 S 1470 490, 1550 300" /></svg></div>;
}

function Header() {
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);
  const athlete = resolveProductionAthleteDestination();
  const links = [['/', 'Home'], ['/step-1', 'MindMap'], ['/step-2', 'Business'], ['/step-3', 'Keep It Alive'], ['/step-4', 'Lead Recovery']];
  const nav = <>{links.map(([to, label]) => <Link key={to} to={to} onClick={() => setOpen(false)} aria-current={pathname === to ? 'page' : undefined}>{label}</Link>)}<a className="athlete-link" href={athlete || '#athlete-destination-gated'} aria-disabled={!athlete} onClick={athlete ? undefined : (event) => event.preventDefault()}><Icon name="athlete" /><span>MORE ATHLETE</span></a><a className="leadership-link" href="/leadership">MORE LEADERSHIP</a></>;
  return <header className="site-header"><Link className="brand" to="/" aria-label="MORE MindMap home"><span className="brand-mark">M</span><span><strong>MORE</strong><small>MINDMAP</small></span></Link><nav className="desktop-nav" aria-label="Primary navigation">{nav}</nav><button className="menu-button" type="button" aria-expanded={open} aria-controls="mobile-navigation" onClick={() => setOpen(!open)}><span className="sr-only">Open navigation</span><span /><span /></button><nav id="mobile-navigation" className={`mobile-nav ${open ? 'is-open' : ''}`} aria-label="Mobile navigation">{nav}</nav></header>;
}

function Footer() {
  return <footer className="site-footer"><Link className="brand brand-small" to="/"><span className="brand-mark">M</span><span><strong>MORE</strong><small>MINDMAP</small></span></Link><p>Understand more. Decide what matters. Keep moving.</p></footer>;
}

function HomeCard({ step, title, lead, copy, route, tone, icon, independent }) {
  return <Link className={`path-card tone-${tone} ${independent ? 'path-card-independent' : ''}`} to={route}><div className="card-topline"><span className="card-step">{step}{independent && <small>INDEPENDENT</small>}</span><span className="card-icon"><Icon name={icon} /></span></div><div><h3>{title}</h3><p className="card-lead">{lead}</p><p className="card-copy">{copy}</p></div><span className="card-action">Explore <Icon name="arrow" /></span></Link>;
}

function HomePage() {
  return <main><section className="hero shell"><div className="hero-copy"><h1>Start with the map.</h1><p className="hero-primary">Understand yourself. Understand your business. See what could happen next. Then decide what matters most.</p><p className="hero-secondary">MORE builds an understanding of you and your business—then helps you use it to think, decide, and move forward as things change.</p><a className="button button-primary" href="#paths">Explore the four ways <Icon name="arrow" /></a></div><div className="map-orbit" aria-hidden="true"><span className="orbit orbit-one" /><span className="orbit orbit-two" /><span className="orbit-center">M</span><span className="orbit-node node-person"><Icon name="person" /></span><span className="orbit-node node-business"><Icon name="business" /></span><span className="orbit-node node-alive"><Icon name="alive" /></span></div></section><section id="paths" className="paths shell"><div className="section-heading"><p className="eyebrow">ONE MINDMAP. FOUR WAYS TO USE IT.</p><h2>Four ways to put your MindMap to work.</h2><p>One deeper understanding of you and your business—put to work wherever it matters.</p></div><div className="four-step-grid" aria-label="Four ways to use MORE MindMap"><HomeCard step="STEP 1" title="Build Your MindMap" lead="It starts by understanding you." copy="Understand how you think, decide, communicate, lead, and operate." route="/step-1" tone="mint" icon="person" /><HomeCard step="STEP 2" title="Assess Your Business" lead="Then it understands your business." copy="See where your business is now, explore five possible futures, and find the move worth testing." route="/step-2" tone="blue" icon="business" /><HomeCard step="STEP 3" title="Keep Your Map Alive" lead="Your AI self-coaching relationship starts here." copy="Think with MORE as things change. It remembers what matters, researches when needed, challenges your thinking, and helps you decide what comes next." route="/step-3" tone="violet" icon="alive" /><HomeCard step="STEP 4" title="Recover Your Leads" lead="Make your CRM disappear." copy="MORE finds the people and opportunities already hiding in your database—and shows you where to start." route="/step-4" tone="amber" icon="leads" independent /></div></section><section className="convergence shell"><p className="eyebrow">ONE DEEPER UNDERSTANDING</p><h2>MORE gets more useful as your life and business change.</h2><div className="convergence-steps"><span>Understand yourself.</span><span>See your business clearly.</span><span>Think through what comes next.</span></div></section></main>;
}

function StepShell({ step, title, headline, support, tone, children }) {
  return <main className={`step-main tone-${tone}`}><section className="step-hero shell"><Link className="back-link" to="/">← Back to the four ways</Link><div className="step-kicker">{step}</div><h1>{title}</h1><p className="step-headline">{headline}</p><p className="step-support">{support}</p></section>{children}</main>;
}

function ValueList({ items }) {
  return <ul className="value-list">{items.map((item) => <li key={item}><Icon name="check" /><span>{item}</span></li>)}</ul>;
}

function Message({ state }) {
  if (!state?.message) return <p className="form-message" aria-live="polite" />;
  return <p className="form-message" data-tone={state.tone || 'error'} aria-live="polite">{state.message}</p>;
}

async function postJson(path, body, idempotencyKey = '') {
  const response = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {}) }, credentials: 'same-origin', body: JSON.stringify(body) });
  const payload = await response.json().catch(() => null);
  if (!response.ok || payload?.ok !== true) throw new Error(payload?.error || 'request_unavailable');
  return payload;
}

function idempotencyKey(scope) {
  const random = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`;
  return `${scope}:${random}`;
}

function stableAttemptKey(attemptRef, scope, fingerprint) {
  if (attemptRef.current.fingerprint !== fingerprint) {
    attemptRef.current = { fingerprint, key: idempotencyKey(scope) };
  }
  return attemptRef.current.key;
}

function customerMessage(code) {
  const messages = {
    not_found: 'This action is not enabled in the current review configuration.',
    ownership_verification_required: 'If this Profile can be verified, use the private link sent to the email connected to it.',
    ownership_verification_failed: 'That verification link is invalid or has expired. Request a new link to continue.',
    ownership_verified: 'Ownership verified. Enter your MORE Profile ID again to continue.',
    missing: 'We could not find a completed result for that verified Profile.',
    completed_bos_required: 'Build or retrieve your MindMap first.',
    profile_ownership_required: 'Verify that this MindMap belongs to you before continuing.',
    purchase_already_granted: 'This purchase is already complete. Use your existing payment return or retrieve your result.',
    subscription_checkout_gated: 'Subscription checkout is not open yet. No payment was started.',
    request_unavailable: 'This action is not available right now. Nothing was changed.',
  };
  return messages[code] || 'We could not verify that request. Nothing was changed.';
}

function useProfileOwnershipLink(setState) {
  useLayoutEffect(() => {
    const prefix = '#more-profile-owner=';
    if (!window.location.hash.startsWith(prefix)) return;
    let token = '';
    try { token = decodeURIComponent(window.location.hash.slice(prefix.length)); }
    catch { token = ''; }
    window.history.replaceState({}, document.title, `${window.location.pathname}${window.location.search}`);
    if (!token) {
      setState({ phase: 'idle', message: customerMessage('ownership_verification_failed') });
      return;
    }
    postJson('/api/public-v1/profile-ownership', { action: 'verify', token })
      .then(() => setState({ phase: 'idle', message: customerMessage('ownership_verified'), tone: 'success' }))
      .catch((error) => setState({ phase: 'idle', message: customerMessage(error.message) }));
  }, [setState]);
}

async function requestProfileOwnership(profileId, returnPath) {
  return postJson('/api/public-v1/profile-ownership', {
    action: 'request',
    profile_id: profileId,
    return_path: returnPath,
  });
}

function Step1Page() {
  const navigate = useNavigate();
  const [state, setState] = useState({});
  const [busy, setBusy] = useState(false);
  const checkoutKey = useMemo(() => idempotencyKey('bos-checkout'), []);
  const complimentaryAttempt = useRef({ fingerprint: '', key: '' });
  useProfileOwnershipLink(setState);
  async function checkout() {
    setBusy(true); setState({});
    try {
      const payload = await postJson('/api/public-v1/purchase-intent', { product_key: 'behavior_operating_system' }, checkoutKey);
      window.location.assign(payload.checkout_url);
    } catch (error) { setState({ message: customerMessage(error.message) }); setBusy(false); }
  }
  async function retrieve(event) {
    event.preventDefault(); setBusy(true); setState({});
    const value = new FormData(event.currentTarget).get('profileId');
    try {
      if (/^mm-/iu.test(String(value).trim())) {
        const payload = await postJson('/api/public-v1/access', { action: 'lookup', value, product_key: 'behavior_operating_system' });
        if (payload.state === 'ownership_verification_required') {
          await requestProfileOwnership(value, '/step-1');
          setState({ message: customerMessage(payload.state) });
        } else if (payload.state === 'ready' && payload.destination) {
          navigate(`${payload.destination}?id=${encodeURIComponent(payload.profile_id)}`);
        } else {
          setState({ message: customerMessage(payload.state) });
        }
      } else {
        const capability = String(value || '').trim();
        const redemptionKey = stableAttemptKey(complimentaryAttempt, 'bos-comp', capability);
        const redeemed = await postJson('/api/public-v1/access', { action: 'redeem', product_key: 'behavior_operating_system', capability, idempotency_key: redemptionKey });
        const token = await postJson('/api/public-v1/access', { action: 'create_start_token', grant_id: redeemed.grant.grant_id });
        const started = await postJson('/api/public-v1/product-start', { start_token: token.start_token });
        sessionStorage.setItem('more.public.start_token.v1', token.start_token);
        navigate(started.destination);
      }
    } catch (error) { setState({ message: customerMessage(error.message) }); }
    finally { setBusy(false); }
  }
  return <StepShell step="STEP 1" title="BUILD YOUR MINDMAP" headline="See how you think, decide, communicate, lead, and operate." support="Your MindMap builds a deep picture of how you work as a whole person—not a personality type or a generic score." tone="mint"><section className="product-grid shell"><article className="surface-card value-card"><p className="eyebrow">WHAT YOU GET</p><ValueList items={['Your Personality DNA', 'How you operate', 'How people experience you', 'Your strengths and vulnerabilities', 'How you respond under pressure', 'Your Five Futures + One Move']} /></article><article className="surface-card purchase-card"><p className="eyebrow">BUILD YOUR MINDMAP</p><div className="price"><span>$149</span><small>one time</small></div><p>Answer a focused set of real-life questions. MORE turns your answers into a MindMap you can keep using.</p><button className="button button-primary button-wide" type="button" onClick={checkout} disabled={busy}>Build My MindMap <Icon name="arrow" /></button><Message state={state} /></article></section><section className="existing-card shell"><div><p className="eyebrow">ALREADY HAVE A MINDMAP?</p><h2>RETRIEVE YOUR PROFILE</h2><p>Your MindMap is connected to your MORE Profile ID.</p></div><form className="inline-form" onSubmit={retrieve}><label htmlFor="step1-profile">Enter your MORE Profile ID (starts with MM)</label><div className="field-action"><input id="step1-profile" name="profileId" autoComplete="off" inputMode="text" placeholder="MM-YYYYMMDD-XXXXXXXX" required /><button className="button button-secondary" type="submit" disabled={busy}>Open My MindMap</button></div><Message state={state} /></form></section><section className="next-step shell"><div><span>WHEN YOU'RE READY</span><strong>Your MindMap becomes the foundation for understanding your business.</strong></div><Link to="/step-2">Continue to Step 2 <Icon name="arrow" /></Link></section></StepShell>;
}

function Step2Page() {
  const navigate = useNavigate();
  const [state, setState] = useState({ phase: 'idle' });
  const [busy, setBusy] = useState(false);
  const checkoutAttempt = useRef({ fingerprint: '', key: '' });
  useProfileOwnershipLink(setState);
  async function begin(event) {
    event.preventDefault(); setBusy(true);
    const profileId = String(new FormData(event.currentTarget).get('profileId') || '').trim();
    if (!/^mm-\d{8}-[a-z0-9]{8}$/iu.test(profileId)) { setState({ message: 'Enter a valid MORE Profile ID.' }); setBusy(false); return; }
    try {
      const payload = await postJson('/api/public-v1/access', { action: 'lookup', value: profileId, product_key: 'behavior_operating_system' });
      if (payload.state === 'ownership_verification_required') {
        await requestProfileOwnership(profileId, '/step-2');
        setState({ phase: 'idle', message: customerMessage(payload.state) });
      } else if (payload.state === 'ready') {
        setState({ phase: 'vertical', profileId: payload.profile_id });
      } else {
        setState({ phase: 'idle', message: customerMessage('completed_bos_required') });
      }
    } catch (error) { setState({ phase: 'idle', message: customerMessage(error.message) }); }
    finally { setBusy(false); }
  }
  async function confirmVertical(event) {
    event.preventDefault(); setBusy(true);
    const vertical = new FormData(event.currentTarget).get('vertical');
    const verticalSelection = { vertical_id: vertical, confirmation: 'CUSTOMER_CONFIRMED' };
    try {
      const checkoutFingerprint = JSON.stringify({ profile_id: state.profileId, vertical_selection: verticalSelection });
      const checkoutKey = stableAttemptKey(checkoutAttempt, 'ba-checkout', checkoutFingerprint);
      const payload = await postJson('/api/public-v1/purchase-intent', { product_key: 'business_assessment', profile_id: state.profileId, vertical_selection: verticalSelection }, checkoutKey);
      window.location.assign(payload.checkout_url);
    } catch (error) { setState((current) => ({ ...current, message: customerMessage(error.message) })); setBusy(false); }
  }
  async function retrieve(event) {
    event.preventDefault(); setBusy(true);
    const value = new FormData(event.currentTarget).get('profileId');
    try {
      const payload = await postJson('/api/public-v1/access', { action: 'lookup', value, product_key: 'business_assessment' });
      if (payload.state === 'ownership_verification_required') {
        await requestProfileOwnership(value, '/step-2');
        setState({ phase: 'idle', message: customerMessage(payload.state) });
      } else if (payload.state === 'ready' && payload.destination) {
        navigate(`${payload.destination}?id=${encodeURIComponent(payload.profile_id)}`);
      } else {
        setState({ phase: 'idle', message: customerMessage(payload.state) });
      }
    } catch (error) { setState({ phase: 'idle', message: customerMessage(error.message) }); }
    finally { setBusy(false); }
  }
  return <StepShell step="STEP 2" title="ASSESS YOUR BUSINESS" headline="See where your business is now—and where it could go." support="Your Business Assessment builds a living Business Twin so you can see your Five Futures—and the One Move that matters most right now." tone="blue"><section className="product-grid shell"><article className="surface-card value-card"><p className="eyebrow">YOUR BUSINESS TWIN</p><ValueList items={['Where You Are', 'Five Possible Futures', 'Your One Move', 'Your Plan', 'Evidence']} /></article><article className="surface-card purchase-card"><p className="eyebrow">ASSESS YOUR BUSINESS</p><div className="price"><span>$49</span><small>one time</small></div><p>Your Business Assessment builds on the MindMap you completed in Step 1.</p><form onSubmit={begin}><label htmlFor="step2-profile">Enter your MORE Profile ID (starts with MM)</label><input id="step2-profile" name="profileId" autoComplete="off" placeholder="MM-YYYYMMDD-XXXXXXXX" required /><button className="button button-primary button-wide" type="submit">Assess My Business <Icon name="arrow" /></button><Message state={state} /></form></article></section><section className="existing-card shell"><div><p className="eyebrow">ALREADY ASSESSED YOUR BUSINESS?</p><h2>RETRIEVE YOUR BUSINESS ASSESSMENT</h2><p>Use your MORE Profile ID to open your existing Business Assessment and Business Twin.</p></div><form className="inline-form" onSubmit={retrieve}><label htmlFor="step2-retrieval-profile">Enter your MORE Profile ID (starts with MM)</label><div className="field-action"><input id="step2-retrieval-profile" name="profileId" autoComplete="off" inputMode="text" placeholder="MM-YYYYMMDD-XXXXXXXX" required /><button className="button button-secondary" type="submit" disabled={busy}>Open My Business Twin</button></div><Message state={state} /></form></section>{state.phase === 'vertical' && <section className="result-slot shell"><article className="ready-card vertical-confirmation-card"><div className="ready-icon"><Icon name="business" /></div><div><p className="eyebrow">CONFIRM YOUR BUSINESS</p><h2>Which business are we assessing?</h2><p>Choose the supported vertical that matches this business. MORE will not infer it for you.</p><form className="vertical-confirmation-form" onSubmit={confirmVertical}><label htmlFor="step2-vertical">Business vertical</label><select id="step2-vertical" name="vertical" required><option value="">Choose your business vertical</option><option value="real_estate">Real Estate</option></select><p className="field-note">Additional verticals will appear only after they are separately activated.</p><Message state={state} /><button className="button button-primary" type="submit" disabled={busy}>Confirm and Continue</button></form></div></article></section>}<section className="next-step shell"><div><span>WHEN YOUR BUSINESS TWIN IS READY</span><strong>Keep the understanding useful as reality changes.</strong></div><Link to="/step-3">Continue to Step 3 <Icon name="arrow" /></Link></section></StepShell>;
}

function Step3Page() {
  const [message, setMessage] = useState('');
  function submit(event) { event.preventDefault(); setMessage('Subscription checkout is not open in this candidate. No payment was started. Home Base must first prove the authenticated subscriber destination and membership binding.'); }
  return <StepShell step="STEP 3" title="KEEP YOUR MAP ALIVE" headline="Your AI self-coach for the decisions that come next." support="Your business keeps changing. MORE stays with you as it does—remembering what matters, researching when needed, challenging your thinking, and helping you decide what comes next." tone="violet"><section className="surface-card capabilities-card shell"><p className="eyebrow">YOUR CONTINUING AI SELF-COACH</p><ValueList items={['Remembers what matters', 'Researches when you need current answers', 'Asks better questions', 'Learns from what you try and what happens', 'Creates interactive tools when conversation isn’t enough', 'Helps you think through what comes next']} /></section><section className="step3-decision-grid shell"><article className="surface-card purchase-card subscription-panel"><p className="eyebrow">KEEP YOUR MAP ALIVE</p><div className="price"><span>$38.95</span><small>/ month</small></div><p>Your Subscription builds on both your MindMap and your Business Twin.</p><form onSubmit={submit}><label htmlFor="step3-profile">Enter your MORE Profile ID (starts with MM)</label><input id="step3-profile" name="profileId" autoComplete="off" placeholder="MM-YYYYMMDD-XXXXXXXX" required /><button className="button button-primary button-wide" type="submit">Keep My Map Alive <Icon name="arrow" /></button><Message state={{ message }} /></form></article></section></StepShell>;
}

function Step4Page() {
  const [state, setState] = useState('idle');
  const [message, setMessage] = useState('');
  const key = useMemo(() => idempotencyKey('step4-inquiry'), []);
  async function submit(event) {
    event.preventDefault(); setState('processing'); setMessage('');
    const body = Object.fromEntries(new FormData(event.currentTarget));
    try { await postJson('/api/public-v1/inquiry', body, key); setState('complete'); }
    catch (error) { setState('failed'); setMessage(customerMessage(error.message)); }
  }
  return <StepShell step="STEP 4 · INDEPENDENT APPLICATION" title="MAKE YOUR CRM DISAPPEAR." headline="Recover the relationships and revenue already sitting in your database." support="Your CRM should not be another job. MORE helps you see who matters now, what may be missing, and where the next conversation is worth having." tone="amber"><section className="product-grid shell"><article className="surface-card value-card"><p className="eyebrow">YOUR DATABASE SHOULD WORK FOR YOU.</p><h2>Stop managing contacts. Start seeing relationships.</h2><ValueList items={['Find the people most worth revisiting', 'See where relationships or opportunities may be going quiet', 'Know who deserves a call, note, text, or follow-up', 'Focus your time where a human touch matters most']} /></article><article className="surface-card contact-card">{state === 'complete' ? <div className="signal-confirmation" role="status"><span className="signal-rings"><i /><i /><b><Icon name="check" /></b></span><p className="eyebrow">MESSAGE RECEIVED</p><h2>We got it.</h2><p>Someone from MORE will be in touch.</p></div> : state === 'processing' ? <div className="signal-confirmation" role="status"><span className="signal-rings is-processing"><i /><i /><b><Icon name="arrow" /></b></span><p className="eyebrow">SENDING</p><h2>One moment.</h2><p>We’re confirming that your message was accepted.</p></div> : <><p className="eyebrow">START A CONVERSATION</p><h2>Let’s find what your CRM may be hiding.</h2><form onSubmit={submit}><label htmlFor="contact-name">Name</label><input id="contact-name" name="name" autoComplete="name" required /><label htmlFor="contact-phone">Phone</label><input id="contact-phone" name="phone" autoComplete="tel" inputMode="tel" required /><label htmlFor="contact-email">Email</label><input id="contact-email" name="email" autoComplete="email" inputMode="email" type="email" required /><input className="sr-only" name="website" tabIndex="-1" autoComplete="off" aria-hidden="true" /><button className="button button-primary button-wide" type="submit">LET’S TALK <Icon name="arrow" /></button><Message state={{ message }} /></form></>}</article></section></StepShell>;
}

export function PublicSiteV21({ page = 'home' }) {
  const pages = { home: <HomePage />, step1: <Step1Page />, step2: <Step2Page />, step3: <Step3Page />, step4: <Step4Page /> };
  return <div className="public-site-v21"><Ambient /><Header />{pages[page] || pages.home}<Footer /></div>;
}

export default PublicSiteV21;
