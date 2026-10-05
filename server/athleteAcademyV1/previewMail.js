import { requireValue } from './repository.js';

// Reserved fictional identities stay the account identities. Only the hosted
// Preview transport destination changes; tokens and normal verification do not.
export function academyPreviewMail({ env, transport }) {
  if (env.ATHLETE_ACADEMY_SYNTHETIC_PREVIEW !== '1') return transport;
  const recipient = String(env.ATHLETE_ACADEMY_SYNTHETIC_MAIL_TO || '').trim().toLowerCase();
  if (env.VERCEL_ENV !== 'preview' || !transport
    || !/^more:athlete-academy:\{test-[a-zA-Z0-9-]+\}$/.test(env.ATHLETE_ACADEMY_NAMESPACE || '')
    || recipient.length > 254 || !/^[^\s@,<>]+@[^\s@,<>]+\.[^\s@,<>]+$/.test(recipient)
    || recipient.endsWith('.invalid')) return null;
  return message => {
    requireValue(typeof message?.email === 'string'
      && /^[^\s@,<>]+@test\.invalid$/.test(message.email)
      && ['verify_email', 'reset_password', 'guardian_invite'].includes(message.kind),
    'SYNTHETIC_MAIL_SCOPE_REQUIRED', 503);
    return transport({ ...message, email: recipient,
      subject: `[SYNTHETIC ${message.email}] ${message.subject}` });
  };
}
