import {
  authorizePrivateLiveOperationalRunnerRequestV1,
  buildPrivateLiveOperationalRunnerV1,
  validatePrivateLiveOperationalRunnerRequestV1,
} from '../../src/lib/intelligenceFabric/coachConnect/privateRuntime/liveBindings/privateLiveOperationalRunner.js';

function headers(res) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'",
  );
}

function locked(res) {
  return res.status(404).json({ ok: false, error: 'feature_unavailable' });
}

function denied(res) {
  return res.status(403).json({ ok: false, error: 'request_denied' });
}

function body(req) {
  if (typeof req?.body === 'string') {
    if (req.body.length > 4096) return null;
    try {
      const parsed = JSON.parse(req.body);
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
        ? parsed
        : null;
    } catch {
      return null;
    }
  }
  return req?.body && typeof req.body === 'object' && !Array.isArray(req.body)
    ? req.body
    : null;
}

export function createPrivateLiveOperationalRunnerHandler({
  env = globalThis.process?.env || {},
  clock = () => Date.now(),
  buildRunner = buildPrivateLiveOperationalRunnerV1,
} = {}) {
  return async function privateLiveOperationalRunnerHandler(req, res) {
    headers(res);
    const authorized = authorizePrivateLiveOperationalRunnerRequestV1({
      req,
      env,
      nowMs: clock(),
    });
    if (!authorized.ok) return locked(res);
    const input = body(req);
    const checked = validatePrivateLiveOperationalRunnerRequestV1(input);
    if (!checked.ok) return denied(res);
    let runner;
    try {
      runner = await buildRunner({ env, clock });
    } catch {
      return locked(res);
    }
    if (!runner?.ok || typeof runner.execute !== 'function') return locked(res);
    let result;
    try {
      result = await runner.execute(checked.value);
    } catch {
      return denied(res);
    }
    if (!result?.ok) return denied(res);
    return res.status(200).json(result);
  };
}

export default createPrivateLiveOperationalRunnerHandler();
