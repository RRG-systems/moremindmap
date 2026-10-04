import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('private register screen precedes guardian fallback and is bound only to authenticated server capability', async () => {
  const source = await readFile(new URL('../src/athleteAcademyV1/App.jsx', import.meta.url), 'utf8');
  const branch = source.indexOf("else if(page==='youth-approvals')");
  assert.ok(branch > 0 && branch < source.indexOf("else if(session.account?.role==='guardian'"));
  assert.match(source, /session\.account&&session\.capabilities\.youthApprovalRegister\?<YouthApprovalRegisterPanel key=\{session\.account\.id\}/);
  assert.match(source, /session\.capabilities\.youthApprovalRegister&&<a href="#youth-approvals"/);
});

test('register UI clears old results before reauthorization and does not persist or export private records', async () => {
  const source = await readFile(new URL('../src/athleteAcademyV1/YouthApprovalRegisterPanel.jsx', import.meta.url), 'utf8');
  assert.ok(source.indexOf('setResult(null)') < source.indexOf("await call('youth_approval_register'"));
  assert.match(source, /not independent verification of age or guardianship/);
  assert.doesNotMatch(source, /localStorage|sessionStorage|download=|createObjectURL|dangerouslySetInnerHTML|\.intake|\.reports|\.transcript/);
});

test('guardian confirmation captures an explicit claimed relationship without asserting independent verification', async () => {
  const source = await readFile(new URL('../src/athleteAcademyV1/App.jsx', import.meta.url), 'utf8');
  assert.match(source, /id="guardian-relationship"/);
  assert.match(source, /guardianRelationship:relationship/);
  assert.match(source, /does not independently verify your age or guardianship/);
});
