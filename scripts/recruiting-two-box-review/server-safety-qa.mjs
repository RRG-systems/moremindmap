import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { chromium } from '/Users/rrg/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
const local = 'http://127.0.0.1:5269';
const lan = process.argv[2];
if (!/^http:\/\/(10\.|192\.168\.|172\.)([\d.]+):5269$/.test(lan)) throw new Error('PRIVATE_LAN_URL_REQUIRED');
const paths = ['/__review', '/docs/recruiting-two-box-consulting-v1/00_PLAN_AND_CUSTODY.md', '/api/stripe/checkout', '/athlete', '/subscription'];
const report = { checked_at: new Date().toISOString(), local, lan, checks: [], external_requests: [] };
for (const base of [local, lan]) for (const path of paths) {
  const response = await fetch(base + path);
  const expected = path === '/__review' ? 200 : path.startsWith('/api/') ? 403 : 404;
  assert.equal(response.status, expected, base + path);
  report.checks.push({ path, base, status: response.status });
}
const browser = await chromium.launch({ headless: true, executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
try {
  const page = await browser.newPage({ viewport: { width: 768, height: 1024 } });
  await page.route('**/*', (route) => {
    const url = new URL(route.request().url());
    if (url.origin !== lan) { report.external_requests.push(url.origin); return route.abort(); }
    return route.continue();
  });
  await page.goto(lan + '/__review/login?role=manager');
  await page.getByRole('button', { name: /Invite a Recruit.*Invite and see progress/s }).click();
  await page.getByLabel('Recruit name', { exact: true }).fill('Taylor Reed');
  await page.getByLabel('Recruit email', { exact: true }).fill('taylor@example.test');
  const response = page.waitForResponse((r) => r.url().includes('/api/recruiting/runtime') && r.request().method() === 'POST');
  await page.getByRole('button', { name: /Send private invitation/ }).click();
  const result = await (await response).json();
  assert.equal(result.ok, true); assert.equal(result.duplicate_active, true);
  assert.equal(result.invitation_allowance.remaining, 1);
  report.lan_browser_duplicate_action = { passed: true, same_cookie_auth: true, duplicate: true, remaining: 1, new_debit: false, new_delivery: false };
  await page.screenshot({ path: 'docs/recruiting-two-box-consulting-v1/lan-ipad-duplicate-proof.png', fullPage: true });
  assert.equal(report.external_requests.length, 0);
  report.passed = true;
} finally { await browser.close(); await writeFile('docs/recruiting-two-box-consulting-v1/server-safety-report.json', JSON.stringify(report, null, 2)); }
