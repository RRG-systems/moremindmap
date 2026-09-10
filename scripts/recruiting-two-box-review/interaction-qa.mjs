import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { chromium } from '/Users/rrg/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';

const base = process.argv[2] || 'http://127.0.0.1:5270';
if (base !== 'http://127.0.0.1:5270') throw new Error('ISOLATED_INTERACTION_QA_PORT_5270_REQUIRED');
const output = resolve(process.argv[3] || 'docs/recruiting-two-box-consulting-v1/interaction-browser');
await mkdir(output, { recursive: true });
const report = { started_at: new Date().toISOString(), base, synthetic_only: true, success_api_interception: false, provider_calls: false, steps: [], actions: [], transcripts: [], unexpected_requests: [], errors: [] };
const resumePath = process.argv.find((item) => item.startsWith('--resume-from='))?.slice('--resume-from='.length);
let priorReport;
if (resumePath) {
  const priorBytes = await readFile(resolve(resumePath));
  priorReport = JSON.parse(priorBytes);
  assert.equal(priorReport.base, base);
  assert.equal(priorReport.steps.at(-1)?.step, 'duplicate-no-quota-debit');
  assert.match(priorReport.errors.join(' '), /Delivery failed/);
  report.prior_run = { path: resolve(resumePath), sha256: createHash('sha256').update(priorBytes).digest('hex'), valid_steps_preserved: priorReport.steps.length, failure: 'Harness case-sensitive assertion saw CSS-uppercase DELIVERY FAILED; no Product defect.' };
}
const browser = await chromium.launch({ headless: true, executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
report.browser = browser.version();
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
await context.route('**/*', (route) => {
  const url = new URL(route.request().url());
  if (url.origin !== base && !['data:', 'blob:'].includes(url.protocol)) { report.unexpected_requests.push(url.origin + url.pathname); return route.abort(); }
  return route.continue();
});
const page = await context.newPage();
page.on('pageerror', (error) => report.errors.push(error.message));
let lastSession;
let firstSessionId;
let accepted;
let invitationsBefore;
let deliveryFailureProof;
function isAction(response, action) {
  if (response.request().method() !== 'POST' || !response.url().startsWith(`${base}/api/recruiting/`)) return false;
  try { return response.request().postDataJSON()?.action === action; } catch { return false; }
}
async function operation(action, click, { expectedOk = true } = {}) {
  const pending = page.waitForResponse((response) => isAction(response, action), { timeout: 60000 });
  await click();
  const response = await pending;
  const payload = await response.json();
  report.actions.push({ action, status: response.status(), ok: payload.ok, code: payload.code || null, session_id: payload.session?.session_id || null, revision: payload.session?.revision ?? null });
  assert.equal(payload.ok === true, expectedOk, `${action}: ${payload.code || response.status()}`);
  if (payload.session) lastSession = payload.session;
  return payload;
}
async function screenshot(step, detail = {}) {
  await page.screenshot({ path: resolve(output, `${String(report.steps.length + 1).padStart(2, '0')}-${step}.png`), fullPage: true });
  const geometry = await page.evaluate(() => ({ width: innerWidth, document: document.documentElement.scrollWidth, body: document.body.scrollWidth }));
  assert.ok(geometry.document <= geometry.width, `${step}: horizontal overflow`);
  report.steps.push({ step, url: page.url(), geometry, ...detail, passed: true });
}
async function changeRoom(room) {
  if (await page.locator('.recruiting-gu-v1').getAttribute('data-room') === room.replaceAll(' ', '_')) return;
  await operation('CHANGE_ROOM', () => page.getByRole('button', { name: room, exact: true }).click());
  await page.locator(`[data-room="${room.replaceAll(' ', '_')}"]`).waitFor();
}
async function typeInConversation(message, { visual = false, sendButton = false } = {}) {
  const compiled = visual ? page.waitForResponse((response) => isAction(response, 'COMPILE_GU'), { timeout: 60000 }) : null;
  const result = await operation('CHAT', async () => {
    await page.locator('.gu-chat textarea').fill(message);
    if (sendButton) await page.locator('.gu-chat .gu-send').click();
    else await page.locator('.gu-chat textarea').press('Enter');
  });
  if (compiled) {
    const response = await compiled;
    const payload = await response.json();
    assert.equal(payload.ok, true, payload.code);
    lastSession = payload.session;
    report.actions.push({ action: 'COMPILE_GU', status: response.status(), ok: payload.ok, session_id: payload.session.session_id, revision: payload.session.revision });
    await page.locator('.gu-projection').waitFor();
  }
  await page.locator('.gu-thinking').waitFor({ state: 'detached' });
  report.transcripts.push({ session_id: lastSession.session_id, room: lastSession.current_room, input: message, conversation: lastSession.conversation });
  return result;
}
async function snapshot() { return (await context.request.get(`${base}/__review/status`)).json(); }
async function humanInvitationFailure(expectedMessage) {
  const alert = page.getByRole('alert');
  await alert.waitFor();
  const message = await alert.innerText();
  assert.match(message, expectedMessage, 'Invitation failure must explain the current human action.');
  assert.doesNotMatch(message, /RECRUITING_[A-Z_]+/u, 'Raw invitation error codes must not reach the person.');
  assert.equal(await page.locator('.master-notice').count(), 0, 'A failed request must not retain a prior success notice.');
  return { message, raw_error_code_visible: false, stale_success_notice_visible: false };
}

try {
  const initial = await snapshot();
  report.initial_snapshot = initial;
  assert.equal(initial.synthetic_only, true);
  assert.equal(initial.credentials_loaded, false);
  if (priorReport) {
    firstSessionId = priorReport.steps.find((item) => item.step === 'coach-and-generated-environment').session_id;
    accepted = priorReport.steps.find((item) => item.step === 'accepted-exact-plan').accepted_plan_snapshot;
    assert.deepEqual(initial.sessions.find((item) => item.session_id === firstSessionId).accepted_plan_snapshot, accepted);
    assert.equal(initial.delivery_records.filter((item) => item.kind === 'RECRUIT_INVITATION' && item.recipient === 'delivery-retry@example.test' && item.state === 'FAILED').length, 1);
    invitationsBefore = initial.counts.invitations - 1;
    await page.goto(`${base}/__review/login?role=manager`);
    await page.getByRole('button', { name: /Consulting Tool.*See ready people/s }).waitFor({ timeout: 60000 });
    await page.getByRole('button', { name: /Invite a Recruit.*Invite and see progress/s }).click();
    await page.getByLabel('Recruit name', { exact: true }).waitFor();
  } else {
  assert.equal(initial.sessions.filter((item) => item.accepted_plan_snapshot).length, 0, 'Do not replace any prior accepted-plan proof.');
  assert.equal(initial.delivery_records.filter((item) => item.kind === 'CONSULTING_AGREED_PLAN').length, 0);
  await page.goto(`${base}/__review/login?role=manager`);
  await page.getByRole('button', { name: /Consulting Tool.*See ready people/s }).waitFor({ timeout: 60000 });
  assert.equal(await page.locator('.campaign-map-card').count(), 2);
  await page.getByRole('button', { name: /Consulting Tool.*See ready people/s }).click();
  await operation('OPEN_CANDIDATE', () => page.getByRole('button', { name: /Jordan Lee/ }).click());
  firstSessionId = lastSession.session_id;
  await page.locator('.gu-selected-person').getByText('Jordan Lee', { exact: true }).waitFor();
  await changeRoom('YOU');
  await typeInConversation('What should we understand together before deciding what Jordan should try next?', { visual: true });
  await screenshot('coach-and-generated-environment', { session_id: firstSessionId });
  await changeRoom('PLAN');
  await typeInConversation('I will hold a weekly review for four weeks. Jordan will bring what was tried and what happened.');
  await page.getByRole('button', { name: 'ADJUST', exact: true }).waitFor();
  const firstProposal = structuredClone(lastSession.proposals.find((item) => item.proposal_id === lastSession.current_proposal_id));
  await screenshot('proposed-plan', { session_id: firstSessionId, proposal: firstProposal });
  await operation('PLAN_DECISION', () => page.getByRole('button', { name: 'ADJUST', exact: true }).click());
  assert.equal(lastSession.session_id, firstSessionId);
  assert.equal(lastSession.proposals.find((item) => item.proposal_id === lastSession.current_proposal_id).status, 'ADJUSTMENT_REQUESTED');
  await page.getByRole('heading', { name: 'What should change?' }).waitFor();
  await screenshot('adjust-preserves-draft');
  await typeInConversation('Change the review to thirty minutes, starting next Tuesday, for four weeks.');
  await page.getByRole('button', { name: 'YES', exact: true }).waitFor();
  const revised = structuredClone(lastSession.proposals.find((item) => item.proposal_id === lastSession.current_proposal_id));
  assert.ok(revised.version > firstProposal.version);
  assert.match(JSON.stringify(revised.proposal), /thirty-minute/);
  assert.match(JSON.stringify(revised.proposal), /Tuesday/);
  assert.equal(lastSession.session_id, firstSessionId);
  await screenshot('revised-plan', { proposal: revised });
  await operation('PLAN_DECISION', () => page.getByRole('button', { name: 'YES', exact: true }).click());
  accepted = structuredClone(lastSession.accepted_plan_snapshot);
  assert.deepEqual(accepted.plan, revised.proposal);
  assert.equal(lastSession.status, 'COMPLETED');
  await page.getByRole('heading', { name: /Congratulations/ }).waitFor();
  await screenshot('accepted-exact-plan', { accepted_plan_snapshot: accepted });
  const reopened = page.waitForResponse((response) => isAction(response, 'OPEN_CANDIDATE'));
  await page.reload();
  const recovered = await (await reopened).json();
  assert.equal(recovered.session.session_id, firstSessionId);
  assert.deepEqual(recovered.session.accepted_plan_snapshot, accepted);
  lastSession = recovered.session;
  await page.getByRole('heading', { name: /Congratulations/ }).waitFor();
  await screenshot('accepted-plan-refresh');
  const beforeNew = await snapshot();
  const originalDelivery = beforeNew.delivery_records.filter((item) => item.kind === 'CONSULTING_AGREED_PLAN');
  assert.equal(originalDelivery.length, 2, 'One exact accepted-plan delivery per role.');
  for (const item of originalDelivery) assert.deepEqual(item.accepted_plan_snapshot.plan, accepted.plan);
  const renewed = await operation('START_ANOTHER_CONSULTATION', () => page.getByRole('button', { name: 'Start another consultation', exact: true }).click());
  assert.notEqual(renewed.session.session_id, firstSessionId);
  assert.equal(renewed.session.predecessor_session_id, firstSessionId);
  assert.equal(renewed.session.subject_binding.name, 'Jordan Lee');
  assert.equal(renewed.session.status, 'OPEN');
  assert.equal(renewed.session.accepted_plan_snapshot, null);
  assert.deepEqual(renewed.previous_accepted_plans.find((item) => item.session_id === firstSessionId).accepted_plan_snapshot, accepted);
  await page.getByRole('button', { name: /Previous agreed plans/ }).click();
  await page.getByRole('dialog', { name: 'Previous agreed plans' }).waitFor();
  assert.match(await page.getByRole('dialog', { name: 'Previous agreed plans' }).innerText(), /thirty-minute/);
  await screenshot('previous-plan-preserved');
  await page.getByRole('button', { name: 'Close plan history' }).click();
  await page.getByRole('button', { name: /Back to My Recruits/ }).click();
  const other = await operation('OPEN_CANDIDATE', () => page.getByRole('button', { name: /Avery Brooks/ }).click());
  assert.equal(other.session.subject_binding.name, 'Avery Brooks');
  assert.notEqual(other.session.subject_binding.profile_id, renewed.session.subject_binding.profile_id);
  assert.equal(other.session.accepted_plan_snapshot, null);
  assert.equal(other.previous_accepted_plans.length, 0);
  await page.locator('.gu-selected-person').getByText('Avery Brooks', { exact: true }).waitFor();
  assert.doesNotMatch(await page.locator('.gu-selected-person').innerText(), /Jordan|Previous agreed plans/);
  await screenshot('second-person-no-plan-leakage');
  for (const viewport of [{ name: 'desktop', width: 1440, height: 1000 }, { name: 'ipad-landscape', width: 1024, height: 768 }, { name: 'ipad-portrait', width: 768, height: 1024 }, { name: 'mobile', width: 390, height: 844 }]) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await changeRoom('YOUR BUSINESS');
    await page.locator('.gu-chat textarea').click({ trial: true, timeout: 5000 });
    for (const suggestion of await page.locator('.gu-suggestions button').all()) await suggestion.click({ trial: true, timeout: 5000 });
    await page.locator('.gu-chat textarea').fill(`Synthetic ${viewport.name} control accessibility proof.`);
    await page.locator('.gu-chat .gu-send').click({ trial: true, timeout: 5000 });
    await typeInConversation(`Synthetic ${viewport.name} control accessibility proof. What should we both learn next?`, { visual: true, sendButton: true });
    await screenshot(`conversation-controls-${viewport.name}`, { actual_send_click: true, suggestions_hit_tested: true });
  }
  await page.setViewportSize({ width: 1440, height: 1000 });

  await page.goto(`${base}/recruiting/invite`);
  await page.getByLabel('Recruit name', { exact: true }).waitFor();
  assert.match(await page.locator('[aria-label="Combined BOS and BA invitation allowance"]').innerText(), /1 of 5 remaining/);
  invitationsBefore = (await snapshot()).counts.invitations;
  await page.getByLabel('Recruit name', { exact: true }).fill('Jordan Lee');
  await page.getByLabel('Recruit email', { exact: true }).fill('jordan@example.test');
  const duplicate = await operation('CREATE_INVITATION', () => page.getByRole('button', { name: 'Send private invitation →', exact: true }).click());
  assert.equal(duplicate.duplicate_active, true);
  await page.getByRole('status').filter({ hasText: 'already invited' }).waitFor();
  assert.equal((await snapshot()).counts.invitations, invitationsBefore);
  assert.match(await page.locator('[aria-label="Combined BOS and BA invitation allowance"]').innerText(), /1 of 5 remaining/);
  await screenshot('duplicate-no-quota-debit');
  await page.getByLabel('Recruit name', { exact: true }).fill('Delivery Retry Person');
  await page.getByLabel('Recruit email', { exact: true }).fill('delivery-retry@example.test');
  await operation('CREATE_INVITATION', () => page.getByRole('button', { name: 'Send private invitation →', exact: true }).click(), { expectedOk: false });
  deliveryFailureProof = await humanInvitationFailure(/could not be delivered.*Resend invitation/is);
  }
  const retryCard = page.locator('article.candidate-card').filter({ has: page.getByRole('heading', { name: 'Delivery Retry Person', exact: true }) });
  await retryCard.getByRole('button', { name: 'Resend invitation →', exact: true }).waitFor();
  assert.match(await retryCard.innerText(), /Delivery failed/i);
  assert.match(await page.locator('[aria-label="Combined BOS and BA invitation allowance"]').innerText(), /1 of 5 remaining/);
  const progressTitles = (await page.locator('.manager-progress-notifications article strong').allInnerTexts()).map((title) => title.trim());
  assert.ok(progressTitles.length > 0, 'Current Progress must render the fixture progress.');
  assert.equal(new Set(progressTitles).size, progressTitles.length, 'Current Progress must not duplicate a rendered candidate title.');
  await screenshot('failed-delivery-visible-and-slot-returned', { current_progress_titles: progressTitles, current_progress_titles_unique: true, ...(deliveryFailureProof ? { failure_presentation: deliveryFailureProof } : {}) });
  const retry = await operation('RESEND_INVITATION', () => retryCard.getByRole('button', { name: 'Resend invitation →', exact: true }).click());
  assert.equal(retry.invitation.resend_count, 1);
  await page.getByRole('status').filter({ hasText: 'Resend recorded' }).waitFor();
  await page.getByRole('button', { name: 'Check existing invitation →', exact: true }).waitFor();
  assert.equal((await snapshot()).counts.invitations, invitationsBefore + 1);
  assert.match(await page.locator('[aria-label="Combined BOS and BA invitation allowance"]').innerText(), /0 of 5 remaining/);
  await screenshot('explicit-resend-same-final-slot');
  await page.getByLabel('Recruit name', { exact: true }).fill('No Slot Person');
  await page.getByLabel('Recruit email', { exact: true }).fill('no-slot@example.test');
  await operation('CREATE_INVITATION', () => page.getByRole('button', { name: 'Check existing invitation →', exact: true }).click(), { expectedOk: false });
  const quotaFailureProof = await humanInvitationFailure(/No free invitations remain.*Resets.+\(UTC\)/s);
  report.quota_error_screenshot = resolve(output, 'quota-error-before-recovery.png');
  await page.screenshot({ path: report.quota_error_screenshot, fullPage: true });
  assert.equal((await snapshot()).counts.invitations, invitationsBefore + 1);
  await page.getByLabel('Recruit name', { exact: true }).fill('Jordan Lee');
  await page.getByLabel('Recruit email', { exact: true }).fill('jordan@example.test');
  const afterError = await operation('CREATE_INVITATION', () => page.getByRole('button', { name: 'Check existing invitation →', exact: true }).click());
  assert.equal(afterError.duplicate_active, true);
  await page.getByRole('status').filter({ hasText: 'already invited' }).waitFor();
  await screenshot('exhaustion-and-csrf-error-recovery', { failure_presentation: quotaFailureProof, quota_error_screenshot: report.quota_error_screenshot });

  await page.goto(`${base}/__review/login?role=admin`);
  await page.getByRole('button', { name: /Manager Accounts/ }).waitFor();
  assert.equal(await page.locator('.campaign-map-card').count(), 2);
  await page.getByRole('button', { name: /Manager Accounts/ }).click();
  await page.getByRole('button', { name: /Invite manager/ }).click();
  await page.getByLabel('Manager name', { exact: true }).fill('Synthetic Setup Manager');
  await page.getByLabel('Verified business email', { exact: true }).fill('setup-manager@example.test');
  await page.getByLabel('Enterprise / company', { exact: true }).fill('QA Setup Realty');
  await operation('ADMIN_CREATE_MANAGER', () => page.getByRole('button', { name: 'Invite manager and send setup →', exact: true }).click());
  await page.locator('.master-row').filter({ hasText: 'Synthetic Setup Manager' }).waitFor();
  await screenshot('admin-nested-manager-setup');
  const final = await snapshot();
  assert.equal(final.production_mutations, 0);
  assert.equal(final.credentials_loaded, false);
  assert.deepEqual(final.egress_attempts, []);
  assert.equal(final.counts.memberships, initial.counts.memberships + 1);
  assert.equal(final.delivery_records.filter((item) => item.kind === 'MANAGER_SETUP' && item.recipient === 'setup-manager@example.test').length, 1);
  assert.deepEqual(final.sessions.find((item) => item.session_id === firstSessionId).accepted_plan_snapshot, accepted);
  assert.equal(final.delivery_records.filter((item) => item.kind === 'CONSULTING_AGREED_PLAN').length, 2);
  assert.equal(report.unexpected_requests.length, 0);
  assert.equal(report.errors.length, 0);
  report.final_snapshot = final;
  report.passed = true;
} catch (error) {
  report.passed = false;
  report.errors.push(error.stack);
  await page.screenshot({ path: resolve(output, 'failure.png'), fullPage: true }).catch(() => {});
  report.final_snapshot = await snapshot().catch(() => null);
  process.exitCode = 1;
} finally {
  report.finished_at = new Date().toISOString();
  await writeFile(resolve(output, 'report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ passed: report.passed, steps: report.steps.length, actions: report.actions.length, errors: report.errors, output }));
  await context.close();
  await browser.close();
}
