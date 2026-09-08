import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildRecruitingInviteContinuation } from '../src/lib/recruitingV1/continuation.js';

const appSource = readFileSync(new URL('../src/recruitingV1/RecruitingV1App.jsx', import.meta.url), 'utf8');
const continuationSource = readFileSync(new URL('../src/recruitingV1/RecruitingContinuation.jsx', import.meta.url), 'utf8');
const profileSource = readFileSync(new URL('../src/Profile.jsx', import.meta.url), 'utf8');
const cssSource = readFileSync(new URL('../src/recruitingV1/recruitingV1.css', import.meta.url), 'utf8');

function inspected(profileId = 'mm-20990101-recru001') {
  return {
    invite_session: {
      invite_session_id: 'invite_session_ux_synthetic',
      invitation_id: 'invite_ux_synthetic',
      candidate_id: 'candidate_ux_synthetic',
    },
    relationship: {
      relationship_ref: 'invite_ux_synthetic',
      candidate_id: 'candidate_ux_synthetic',
      bos_profile_id: profileId,
      ba_assessment_id: null,
      ba_readiness: 'BA_NOT_STARTED',
      purpose: 'RECRUITING_INTELLIGENCE',
    },
  };
}

test('recruit continuation contract and view keep the bound next step server-derived', () => {
  const continuation = buildRecruitingInviteContinuation(inspected());
  assert.equal(continuation.next_step.destination, '/business-assessment?recruiting=1');
  assert.doesNotMatch(continuation.next_step.destination, /(?:\?|&)id=/u);
  assert.match(continuationSource, /One invitation\. One connected journey\./u);
  assert.match(continuationSource, /continuation\.progress\.map/u);
  assert.match(continuationSource, /continuation\.notifications\.map/u);
  assert.match(continuationSource, /href=\{continuation\.next_step\.destination\}/u);
  assert.match(continuationSource, /data-testid="recruiting-continuation-next"/u);
});

test('public recruit path owns BA continuation while the manager receives readiness-only notifications', () => {
  assert.match(appSource, /location\.pathname === '\/recruiting\/continue'/u);
  assert.match(appSource, /<ManagerProgressNotifications notifications=\{state\.notifications\}/u);
  assert.match(appSource, /Readiness only · continuation stays with the recruit/u);
  assert.doesNotMatch(appSource, /<a className="text-action" href="\/business-assessment\?recruiting=1"/u);
  assert.match(profileSource, /href="\/recruiting\/continue"/u);
  assert.match(continuationSource, /return_path: '\/recruiting\/continue'/u);
  assert.match(continuationSource, /action: 'CONNECT_OWNED_PROFILE'/u);
  assert.match(appSource, /String\(notification\?\.kind \|\| 'progress'\)\.replaceAll/u);
  assert.match(appSource, /candidate\?\.progress_state \|\| candidate\?\.readiness_state/u);
  assert.match(appSource, /<ManagerProductBalances state=\{state\}/u);
  assert.match(appSource, /Refresh readiness/u);
  assert.match(appSource, /disabled=\{!canInvite\}/u);
});

test('continuation and manager progress remain responsive and accessible', () => {
  assert.match(continuationSource, /aria-label="Recruiting assessment progress"/u);
  assert.match(continuationSource, /aria-label="Progress notifications" aria-live="polite"/u);
  assert.match(cssSource, /\.recruiting-continuation__progress\s*\{[^}]*grid-template-columns:\s*repeat\(3, 1fr\)/su);
  assert.match(cssSource, /@media \(max-width: 760px\)[\s\S]*?\.recruiting-continuation__progress\s*\{\s*grid-template-columns:\s*1fr;/u);
});
