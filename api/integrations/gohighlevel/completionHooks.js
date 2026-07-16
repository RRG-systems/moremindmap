import { waitUntil as vercelWaitUntil } from '@vercel/functions';
import { GHL_EVENT_TYPE, syncContactToGoHighLevel } from './contactSync.js';

export function splitContactName(fullName) {
  const parts = String(fullName || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { firstName: '', lastName: '' };
  if (parts.length === 1) return { firstName: parts[0], lastName: '' };
  return { firstName: parts[0], lastName: parts.slice(1).join(' ') };
}

export function queueGoHighLevelContactSync(payload, options = {}) {
  const sync = options.sync || syncContactToGoHighLevel;
  const logger = options.logger || console;
  const registerBackgroundTask = options.waitUntil || vercelWaitUntil;
  let registered = false;
  const backgroundTask = Promise.resolve()
    .then(() => registered
      ? sync(payload, options.syncOptions)
      : { attempted: false, success: false, skipped: true, reason: 'background_primitive_unavailable', retryable: false })
    .catch(() => ({ attempted: true, success: false, reason: 'unexpected_sync_error', retryable: false }))
    .then((outcome) => {
      if (outcome?.attempted && !outcome?.success) {
        logger.warn?.('ghl_contact_sync_side_effect_failed', {
          eventType: payload.eventType,
          profileId: payload.profileId,
          assessmentType: payload.assessmentType,
          reason: outcome.reason,
          httpStatus: outcome.httpStatus || null,
          retryable: Boolean(outcome.retryable)
        });
      }
      return outcome;
    });

  try {
    registerBackgroundTask(backgroundTask);
    registered = true;
    return { scheduled: true, reason: null };
  } catch {
    logger.warn?.('ghl_contact_sync_background_registration_failed', {
      eventType: payload.eventType,
      profileId: payload.profileId,
      assessmentType: payload.assessmentType,
      reason: 'background_primitive_unavailable'
    });
    return { scheduled: false, reason: 'background_primitive_unavailable' };
  }
}

export function queueBosCompletedContactSync(contact, options) {
  return queueGoHighLevelContactSync({
    ...contact,
    eventType: GHL_EVENT_TYPE.BOS_COMPLETED,
    assessmentType: 'BOS',
    completionStatus: contact.completionStatus || 'Completed'
  }, options);
}

export function queueBaCompletedContactSync(contact, options) {
  return queueGoHighLevelContactSync({
    ...contact,
    eventType: GHL_EVENT_TYPE.BA_COMPLETED,
    assessmentType: 'BA',
    completionStatus: contact.completionStatus || 'Completed'
  }, options);
}
