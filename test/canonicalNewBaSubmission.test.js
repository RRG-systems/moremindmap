import assert from 'node:assert/strict';
import test from 'node:test';

import { enterCanonicalNewBaAfterIntake } from '../src/lib/businessAssessment/canonicalNewBaSubmission.js';

test('saved intake enters the ordinary canonical New BA destination, including pending generation', async () => {
  const calls = [];
  const navigations = [];
  const result = await enterCanonicalNewBaAfterIntake({
    profileId: 'mm-20260821-route001',
    resolveEntry: async (profileId) => {
      calls.push(profileId);
      return { status: 'current', pending: true, destination: `/business-twin?id=${profileId}` };
    },
    navigate: (destination) => navigations.push(destination),
  });
  assert.deepEqual(calls, ['MM-20260821-ROUTE001']);
  assert.deepEqual(navigations, ['/business-twin?id=MM-20260821-ROUTE001']);
  assert.equal(result.pending, true);
});

test('canonical submission fails closed without falling into legacy generation', async () => {
  let navigated = false;
  await assert.rejects(
    enterCanonicalNewBaAfterIntake({
      profileId: 'MM-20260821-ROUTE001',
      resolveEntry: async () => ({ status: 'unavailable', safeCode: 'new_ba_identity_mismatch' }),
      navigate: () => { navigated = true; },
    }),
    (error) => error.message === 'canonical_new_ba_submission_unavailable'
      && error.safeCode === 'new_ba_identity_mismatch',
  );
  assert.equal(navigated, false);
});
