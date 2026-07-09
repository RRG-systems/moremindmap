/**
 * Leadership Role Fit access gate panel.
 * Access code FATHOMDD26 unlocks Role Fit Lab (session-scoped).
 */

import { useState } from 'react';

export const ROLE_FIT_ACCESS_CODE = 'FATHOMDD26';
export const ROLE_FIT_ACCESS_SESSION_KEY = 'leadershipRoleFitAccess';
export const ROLE_FIT_CODE_SESSION_KEY = 'leadershipRoleFitCode';

export function hasRoleFitAccess() {
  try {
    return sessionStorage.getItem(ROLE_FIT_ACCESS_SESSION_KEY) === 'true';
  } catch {
    return false;
  }
}

export function grantRoleFitAccess(code = ROLE_FIT_ACCESS_CODE) {
  try {
    sessionStorage.setItem(ROLE_FIT_ACCESS_SESSION_KEY, 'true');
    sessionStorage.setItem(ROLE_FIT_CODE_SESSION_KEY, String(code).trim().toUpperCase());
  } catch {
    // sessionStorage may be unavailable in restricted contexts
  }
}

export function clearRoleFitAccess() {
  try {
    sessionStorage.removeItem(ROLE_FIT_ACCESS_SESSION_KEY);
    sessionStorage.removeItem(ROLE_FIT_CODE_SESSION_KEY);
  } catch {
    // ignore
  }
}

export function normalizeAccessCode(code) {
  return String(code || '').trim().toUpperCase();
}

export function isValidRoleFitAccessCode(code) {
  return normalizeAccessCode(code) === ROLE_FIT_ACCESS_CODE;
}

/**
 * Inline gate UI (used if user lands on route without session).
 */
export default function RoleFitAccessGate({ onUnlocked, title = 'Role Fit Lab Access' }) {
  const [code, setCode] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (event) => {
    event.preventDefault();
    if (!isValidRoleFitAccessCode(code)) {
      setError('That access code is not recognized for Role Fit Lab.');
      return;
    }
    grantRoleFitAccess(code);
    setError('');
    if (typeof onUnlocked === 'function') onUnlocked();
  };

  return (
    <div className="mx-auto w-full max-w-lg rounded-[2rem] border border-white/12 bg-white/[0.055] p-6 shadow-[0_24px_90px_rgba(0,0,0,0.45)] backdrop-blur-md md:p-8">
      <div className="rounded-[1.5rem] border border-cyan-300/20 bg-black/45 p-6 md:p-8">
        <div className="text-xs uppercase tracking-[0.24em] text-white/42">{title}</div>
        <h2 className="mt-3 text-2xl font-semibold tracking-tight text-white">
          Enter access code
        </h2>
        <p className="mt-2 text-sm leading-6 text-white/55">
          Leadership Role Fit Lab is code-gated. Use the Fathom District Director access code.
        </p>
        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <label className="block">
            <span className="text-sm font-medium text-white/72">Access code</span>
            <input
              value={code}
              onChange={(e) => {
                setCode(e.target.value);
                if (error) setError('');
              }}
              autoComplete="off"
              className="mt-3 w-full rounded-2xl border border-white/12 bg-black/50 px-5 py-4 text-base text-white outline-none transition placeholder:text-white/28 focus:border-cyan-300/60 focus:ring-4 focus:ring-cyan-300/10"
              placeholder="Enter code"
            />
          </label>
          {error && (
            <div className="rounded-2xl border border-red-400/25 bg-red-500/10 px-4 py-3 text-sm text-red-100">
              {error}
            </div>
          )}
          <button
            type="submit"
            className="w-full rounded-2xl bg-white px-6 py-4 text-sm font-semibold uppercase tracking-[0.18em] text-black transition hover:bg-cyan-100"
          >
            Unlock Role Fit Lab
          </button>
        </form>
      </div>
    </div>
  );
}
