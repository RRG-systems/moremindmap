import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium } from '/Users/rrg/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';

const base = process.argv[2] || 'http://127.0.0.1:5269';
if (!/^http:\/\/(127\.0\.0\.1|192\.168\.\d+\.\d+):\d+$/.test(base)) throw new Error('LOCAL_QA_URL_REQUIRED');
const output = resolve(process.argv[3] || 'docs/recruiting-two-box-consulting-v1/browser');
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true, executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
const report = { started_at: new Date().toISOString(), base, browser: browser.version(), boundaries: { actual_http_handlers: true, synthetic_fixtures: true, deterministic_frontier: true, real_provider_proof: false, physical_ipad_proof: false }, cells: [], unexpected_requests: [], errors: [] };
const sizes = [{ name: 'desktop', width: 1440, height: 1000 }, { name: 'ipad-landscape', width: 1024, height: 768 }, { name: 'ipad-portrait', width: 768, height: 1024 }, { name: 'mobile', width: 390, height: 844 }];

try {
  for (const viewport of sizes) {
    const context = await browser.newContext({ viewport, deviceScaleFactor: 1 });
    await context.route('**/*', (route) => {
      const url = new URL(route.request().url());
      if (url.origin !== base && !['data:', 'blob:'].includes(url.protocol)) { report.unexpected_requests.push(url.origin + url.pathname); return route.abort(); }
      return route.continue();
    });
    const page = await context.newPage();
    const pageErrors = [];
    page.on('pageerror', (error) => pageErrors.push(error.message));
    async function shot(name) {
      await page.screenshot({ path: resolve(output, `${viewport.name}-${name}.png`), fullPage: true });
      const geometry = await page.evaluate(() => ({ viewport: innerWidth, document: document.documentElement.scrollWidth, body: document.body.scrollWidth }));
      assert.ok(geometry.document <= geometry.viewport, `${name} document overflow ${JSON.stringify(geometry)}`);
      report.cells.push({ viewport: viewport.name, step: name, url: page.url(), geometry, passed: true });
    }
    await page.goto(`${base}/__review/login?role=manager`);
    await page.getByRole('button', { name: /Consulting Tool.*See ready people/s }).waitFor({ timeout: 60000 });
    assert.equal(await page.locator('.campaign-map-card').count(), 2);
    await shot('manager-two-box');
    if (process.argv.includes('--smoke')) { await context.close(); break; }
    await page.getByRole('button', { name: /Invite a Recruit.*Invite and see progress/s }).click();
    await page.locator('[data-surface="invite"]').waitFor();
    await shot('all-invitations');
    assert.match(await page.locator('body').innerText(), /Jordan Lee/);
    assert.match(await page.locator('body').innerText(), /Casey Rivera/);
    await page.goto(`${base}/recruiting/consulting`);
    await page.getByRole('button', { name: /Jordan Lee/ }).waitFor();
    assert.equal(await page.getByRole('button', { name: /Casey Rivera/ }).count(), 0);
    await shot('consulting-ready');
    await page.getByRole('button', { name: /Jordan Lee/ }).click();
    await page.locator('[data-real-consulting="true"]').waitFor();
    await page.locator('.gu-selected-person').getByText('Jordan Lee', { exact: true }).waitFor();
    await page.getByRole('button', { name: 'HOME', exact: true }).click();
    await page.getByRole('heading', { name: /consultation with Jordan Lee/i }).waitFor();
    await shot('named-consulting-home');
    await page.getByRole('button', { name: 'YOU', exact: true }).click();
    await page.locator('[data-room="YOU"]').waitFor();
    await shot('you-bos');
    await page.getByRole('button', { name: 'HOME', exact: true }).click();
    await page.getByRole('heading', { name: /consultation with Jordan Lee/i }).waitFor();
    await page.getByRole('button', { name: 'YOUR BUSINESS', exact: true }).click();
    await page.locator('[data-room="YOUR_BUSINESS"]').waitFor();
    await shot('your-business-ba');
    await page.getByRole('button', { name: 'PLAN', exact: true }).click();
    await page.locator('[data-room="PLAN"]').waitFor();
    await shot('plan');
    await page.reload();
    await page.locator('[data-real-consulting="true"]').waitFor();
    await page.locator('.gu-selected-person').getByText('Jordan Lee', { exact: true }).waitFor();
    assert.match(await page.locator('body').innerText(), /Jordan Lee/);
    await page.getByRole('button', { name: /Back to My Recruits/ }).click();
    await page.getByRole('button', { name: /Avery Brooks/ }).waitFor();
    await page.getByRole('button', { name: /Avery Brooks/ }).click();
    await page.locator('.gu-selected-person').getByText('Avery Brooks', { exact: true }).waitFor();
    await page.getByRole('button', { name: 'HOME', exact: true }).click();
    await page.getByRole('heading', { name: /consultation with Avery Brooks/i }).waitFor();
    assert.doesNotMatch(await page.locator('.gu-selected-person').innerText(), /Jordan Lee/);
    await shot('second-subject-isolation');
    for (const route of ['opportunity', 'evidence', 'intelligence', 'meeting']) {
      await page.goto(`${base}/recruiting/${route}`);
      await page.waitForURL('**/recruiting/home');
      assert.equal(await page.locator('.campaign-map-card').count(), 2);
    }
    await page.goto(`${base}/__review/login?role=empty`);
    await page.goto(`${base}/recruiting/consulting`);
    await page.getByRole('heading', { name: 'No one is ready to consult yet.' }).waitFor();
    await shot('empty-manager');
    await page.goto(`${base}/__review/login?role=admin`);
    await page.getByRole('button', { name: /Manager Accounts/ }).waitFor();
    assert.equal(await page.locator('.campaign-map-card').count(), 2);
    await shot('admin-two-box');
    await page.getByRole('button', { name: /Manager Accounts/ }).click();
    await page.getByRole('heading', { name: /Manager Accounts/ }).waitFor();
    await shot('admin-manager-roster');
    assert.equal(pageErrors.length, 0, JSON.stringify(pageErrors));
    await context.close();
  }
  assert.equal(report.unexpected_requests.length, 0);
  report.passed = true;
} catch (error) { report.passed = false; report.errors.push(error.stack); throw error; }
finally { report.finished_at = new Date().toISOString(); await writeFile(resolve(output, 'report.json'), JSON.stringify(report, null, 2)); await browser.close(); }
