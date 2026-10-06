const CHANNEL = 'more-athlete-academy-session-v1';

// Hints only: the server still establishes identity and permissions.
export function createSessionEvents(environment = typeof window === 'undefined' ? null : window) {
  let epoch = 0;
  let actor = null;
  let channel = null;
  const listeners = new Set();
  const emit = event => {
    for (const listener of listeners) {
      try { listener(event); } catch { /* One failed view must not prevent other views clearing. */ }
    }
  };
  const invalidate = (broadcast = false) => {
    epoch++;
    actor = null;
    emit({kind:'invalidated',epoch});
    if (broadcast) {
      try { channel?.postMessage({kind:'session-changed'}); } catch { /* Focus recheck remains available. */ }
    }
  };
  const connect = () => {
    if (channel || !environment?.BroadcastChannel) return;
    try {
      channel = new environment.BroadcastChannel(CHANNEL);
      channel.addEventListener('message', event => {
        if (event.data?.kind === 'session-changed') invalidate();
      });
    } catch { channel = null; }
  };
  return {
    epoch:()=>epoch,
    actor:()=>actor,
    subscribe(listener) {
      listeners.add(listener);
      connect();
      return () => listeners.delete(listener);
    },
    invalidate(broadcast = false) { connect(); invalidate(broadcast); },
    observe(session, expectedEpoch = epoch) {
      if (expectedEpoch !== epoch) return false;
      const a = session?.account;
      const next = a ? `${a.role || 'participant'}:${a.id || a.mm || 'account'}` : 'anonymous';
      const changed = actor !== null && actor !== next;
      actor = next;
      if (changed) {
        epoch++;
        emit({kind:'actor-changed',epoch});
      }
      return true;
    },
    close() { channel?.close(); channel = null; listeners.clear(); },
  };
}

export const clientSessionEvents = createSessionEvents();
