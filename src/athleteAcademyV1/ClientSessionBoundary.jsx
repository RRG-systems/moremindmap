import React, {cloneElement, useEffect, useRef, useState} from 'react';
import {bootstrap} from './transport.js';
import {clientSessionEvents} from './sessionEvents.js';
import SafetyHelp from './SafetyHelp.jsx';

export default function ClientSessionBoundary({children, publicSafety = false}) {
  const privateTokenRef = useRef(typeof location === 'undefined' ? '' :
    new URLSearchParams(location.hash.split('?')[1] || '').get('token') || '');
  const [version, setVersion] = useState(0);
  const [checking, setChecking] = useState(false);
  const [cleared, setCleared] = useState(false);
  const [error, setError] = useState('');
  const [safety, setSafety] = useState(() => publicSafety && typeof location !== 'undefined' && location.hash.split('?')[0] === '#safety');
  const requests = useRef(0);

  useEffect(() => {
    let active = true;
    const counter = requests;
    const clear = () => {
      document.title = 'MORE / ATHLETE';
      setVersion(value => value + 1);
      setCleared(true);
      setError('');
    };
    const recheck = async () => {
      const request = ++counter.current;
      setChecking(true);
      try {
        await bootstrap();
        if (!active || request !== counter.current) return;
        setError('');
        setCleared(false);
      } catch {
        if (!active || request !== counter.current) return;
        clear();
        setError('Your sign-in could not be confirmed. Your saved work remains protected.');
      } finally {
        if (active && request === counter.current) setChecking(false);
      }
    };
    const unsubscribe = clientSessionEvents.subscribe(event => {
      if (event.kind === 'invalidated') { clear(); void recheck(); }
      if (event.kind === 'actor-changed') {
        clear();
        // This hint came from a successful, current server bootstrap.
        setCleared(false);
      }
    });
    const focus = () => { if (document.visibilityState !== 'hidden') void recheck(); };
    const hash = () => setSafety(publicSafety && location.hash.split('?')[0] === '#safety');
    window.addEventListener('focus', focus);
    document.addEventListener('visibilitychange', focus);
    window.addEventListener('hashchange', hash);
    return () => {
      active = false;
      counter.current++;
      unsubscribe();
      window.removeEventListener('focus', focus);
      document.removeEventListener('visibilitychange', focus);
      window.removeEventListener('hashchange', hash);
    };
  }, [publicSafety]);

  if (safety) return <SafetyHelp/>;
  return <>
    {!cleared && <div style={{display:checking?'none':'contents'}} aria-hidden={checking || undefined} inert={checking || undefined}>
      {cloneElement(children, {key:version, privateTokenRef})}
    </div>}
    {(checking || cleared) && <main className="narrow" role="status">
      <h1>{error || 'Checking your sign-in…'}</h1>
      <p>Your saved answers and original reports are unchanged.</p>
      {error && <a href="/athlete/workspace/index.html#login">Sign in with your own account →</a>}
      <a href="/athlete/workspace/index.html#safety">Safety help →</a>
    </main>}
  </>;
}
