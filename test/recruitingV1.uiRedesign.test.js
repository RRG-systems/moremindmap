import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { MANAGER_DESTINATIONS } from '../src/lib/recruitingV1/workspacePresentation.js';

const appSource = readFileSync(new URL('../src/recruitingV1/RecruitingV1App.jsx', import.meta.url), 'utf8');
const adminSource = readFileSync(new URL('../src/recruitingV1/RecruitingMasterControl.jsx', import.meta.url), 'utf8');
const shellSource = readFileSync(new URL('../src/recruitingV1/RecruitingExperienceShell.jsx', import.meta.url), 'utf8');
const cssSource = readFileSync(new URL('../src/recruitingV1/recruitingV1.css', import.meta.url), 'utf8');

test('manager Layer 00 exposes the authorized two-destination map using the existing JourneyMap', () => {
  assert.deepEqual(MANAGER_DESTINATIONS.map((item) => item.title), ['Invite a Recruit', 'Consulting Tool']);
  assert.doesNotMatch(appSource, /<DirectionARail/u);
  assert.match(appSource, /<JourneyMap/u);
  assert.match(shellSource, /variant = 'manager'/u);
});

test('Admin Layer 00 consolidates manager access under Manager Accounts and has only Invite a Recruit beside it', () => {
  const cards = adminSource.slice(adminSource.indexOf('const adminCards = ['), adminSource.indexOf('function openAdminDestination'));
  assert.equal((cards.match(/id: '/gu) || []).length, 2);
  assert.match(cards, /title: 'Manager Accounts'/u);
  assert.match(cards, /title: 'Invite a Recruit'/u);
  assert.doesNotMatch(cards, /Add a Manager|Access & Usage|Recruiting Workspace/u);
  for (const action of ['ADMIN_CREATE_MANAGER', 'ADMIN_SUSPEND_MANAGER', 'ADMIN_ACTIVATE_MANAGER', 'ADMIN_REVOKE_MANAGER', 'ADMIN_RESEND_MANAGER_SETUP']) assert.match(adminSource, new RegExp(action, 'u'));
  assert.match(adminSource, /variant="admin"/u);
});

test('missing-result preparation stays inside the existing two-box destinations with truthful waiting and retry states', () => {
  assert.match(appSource, /action: 'PREPARE_CONSULTING_RESULTS'/u);
  assert.match(appSource, /Preparing this person's BOS and BA for Consulting\. Please keep this page open\. This can take around 20 minutes, and sometimes longer\. Completed results will be saved automatically\./u);
  assert.match(appSource, /const refreshed = await api\(\{ view: 'home' \}\);[\s\S]*reconcileConsultingPreparationReceipts/u);
  assert.match(appSource, /catch \{[\s\S]*setSessionStatus\('unauthorized'\);[\s\S]*return;/u);
  assert.match(appSource, /recoveredCandidate\?\.consulting_ready[\s\S]*Consulting is now available/u);
  assert.match(appSource, /Math\.min\(Math\.max\(suppliedRetryAfter, 1000\), 60_000\)/u);
  assert.match(appSource, /function ConsultingSurface[\s\S]*?<PreparationPeopleList[\s\S]*?<PeopleList/u);
  const inviteSurface = appSource.slice(appSource.indexOf('function InviteSurface'), appSource.indexOf('function InvitationAcceptance'));
  assert.match(inviteSurface, /master_control[\s\S]*?<PreparationPeopleList[\s\S]*?<PeopleList/u);
  assert.match(appSource, /BOS_INTAKE_REQUIRED/u);
  assert.match(appSource, /BA_INTAKE_REQUIRED/u);
  assert.match(appSource, /RETRYABLE_FAILURE/u);
  assert.match(appSource, /BOS_GENERATION_FAILED/u);
  assert.match(appSource, /Resume preparation/u);
  assert.match(appSource, /Saved progress is ready to resume/u);
  assert.match(appSource, /Saved progress was kept/u);
  assert.match(appSource, /Request current consent/u);
  assert.match(appSource, /completed results and invitation allowance remain unchanged/u);
  assert.match(appSource, /current-consent request on the same invitation/u);
  assert.match(appSource, /reconcileConsultingPreparationReceipts/u);
  assert.match(appSource, /Consulting is now available/u);
});

test('a failed authenticated HOME recovery transitions to verification before Retry can be offered', () => {
  const preparation = appSource.slice(appSource.indexOf('async function prepareCandidate'), appSource.indexOf("if (sessionStatus === 'loading')"));
  const recoveryStart = preparation.indexOf("const refreshed = await api({ view: 'home' })");
  const unauthorized = preparation.indexOf("setSessionStatus('unauthorized')", recoveryStart);
  const failClosedReturn = preparation.indexOf('return;', unauthorized);
  const retryReceipt = preparation.indexOf("state: 'RETRYABLE_FAILURE'", failClosedReturn);
  assert.ok(recoveryStart >= 0 && unauthorized > recoveryStart && failClosedReturn > unauthorized && retryReceipt > failClosedReturn);
});

test('Layer 02 remains keyboard dismissible and returns focus', () => {
  assert.match(shellSource, /event\.key === 'Escape'/u);
  assert.match(shellSource, /previous\?\.focus\?\.\(\)/u);
  assert.match(shellSource, /role="dialog"/u);
  assert.match(shellSource, /aria-modal="true"/u);
});

test('retired manager surfaces are not mounted or invoked from the simplified workspace', () => {
  assert.doesNotMatch(appSource, /<CandidateSurface|<OpportunitySurface|<EvidenceSurface|<IntelligenceSurface|<MeetingSurface|<ExportSurface/u);
  assert.doesNotMatch(appSource, /GENERATE_INTELLIGENCE|GENERATE_BUSINESS_GAP|ADD_MANAGER_EVIDENCE|SAVE_OPPORTUNITY/u);
  assert.match(appSource, /resolveRecruitingWorkspaceRoute/u);
});

test('the two boxes fit the existing desktop and tablet family and stack on mobile', () => {
  assert.match(cssSource, /\.campaign-map-two-box \.campaign-map-cards\s*\{[^}]*grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\); min-width:\s*0/su);
  assert.match(cssSource, /@media \(max-width: 760px\)\s*\{\s*\.campaign-map-two-box \.campaign-map-cards\s*\{\s*grid-template-columns:\s*minmax\(0, 1fr\)/su);
  assert.match(cssSource, /\.campaign-map-card\s*\{[^}]*background:\s*linear-gradient/su);
});
