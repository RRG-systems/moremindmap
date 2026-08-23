import assert from 'node:assert/strict';
import test from 'node:test';
import { selectRecruitingCandidate } from '../src/lib/recruitingV1/candidateSelection.js';

const retryCandidate = {
  candidate_id: 'candidate_retry',
  ba_readiness: 'BA_NOT_STARTED',
};

const readyCandidate = {
  candidate_id: 'candidate_ready',
  ba_readiness: 'BA_INTELLIGENCE_READY',
};

test('an explicit candidate selection wins regardless of list order', () => {
  assert.equal(
    selectRecruitingCandidate([retryCandidate, readyCandidate], 'candidate_retry'),
    retryCandidate,
  );
});

test('a ready candidate is the safe default when no candidate was selected', () => {
  assert.equal(
    selectRecruitingCandidate([retryCandidate, readyCandidate]),
    readyCandidate,
  );
});

test('an unknown selection falls back to a ready candidate without crossing the supplied list', () => {
  assert.equal(
    selectRecruitingCandidate([retryCandidate, readyCandidate], 'candidate_other'),
    readyCandidate,
  );
});

test('an empty candidate list fails closed', () => {
  assert.equal(selectRecruitingCandidate([], 'candidate_other'), null);
});
