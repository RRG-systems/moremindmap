/* global process */
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium } from '/Users/rrg/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import pixelmatch from '/Users/rrg/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/pixelmatch/index.js';
import { PNG } from '/Users/rrg/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/pngjs/lib/png.js';
import sharp from '/Users/rrg/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp/dist/index.mjs';

const candidateBase = process.env.MMM_AIRLOCK_URL || 'http://127.0.0.1:5223/';
const frozenBase = process.env.MMM_V21_URL || 'http://127.0.0.1:5221/prototypes/mmm-public-site-founder-v2-1/';
const outputRoot = resolve(process.argv[2] || 'docs/mmm-public-site-final-airlock-candidate-v1/browser');
const executablePath = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const viewports = Object.freeze([
  { name: 'desktop', width: 1440, height: 1000 },
  { name: 'ipad-landscape', width: 1024, height: 768 },
  { name: 'ipad-portrait', width: 768, height: 1024 },
  { name: 'mobile', width: 390, height: 844 },
]);
const routes = Object.freeze([
  { name: 'home', candidate: '/', frozen: '', heading: 'Start with the map.' },
  { name: 'step-1', candidate: '/step-1', frozen: 'step-1', heading: 'BUILD YOUR MINDMAP' },
  { name: 'step-2', candidate: '/step-2', frozen: 'step-2', heading: 'ASSESS YOUR BUSINESS' },
  { name: 'step-3', candidate: '/step-3', frozen: 'step-3', heading: 'KEEP YOUR MAP ALIVE' },
  { name: 'step-4', candidate: '/step-4', frozen: 'step-4', heading: 'MAKE YOUR CRM DISAPPEAR.' },
]);

await mkdir(outputRoot, { recursive: true });
const browser = await chromium.launch({ headless: true, executablePath });
const report = {
  generated_at: new Date().toISOString(),
  candidate_base: candidateBase,
  frozen_base: frozenBase,
  browser: 'Google Chrome via Playwright',
  viewports: [],
  totals: { assertions: 0, screenshots: 0, comparisons: 0 },
  boundaries: {
    provider_calls: 0,
    production_mutations: 0,
    customer_data_used: false,
    browser_requests_are_local_only: true,
    viewport_emulation_note: 'Literal Chromium rendering at four viewport sizes; not physical Safari certification.',
  },
};

function candidateUrl(route) {
  return new URL(route, candidateBase).href;
}

function frozenUrl(route) {
  const url = new URL(frozenBase);
  url.hash = route ? `/${route}` : '/';
  return url.href;
}

async function compareScreenshots(leftPath, rightPath, name) {
  const left = PNG.sync.read(await sharp(leftPath).png().toBuffer());
  const right = PNG.sync.read(await sharp(rightPath).png().toBuffer());
  const width = Math.max(left.width, right.width);
  const height = Math.max(left.height, right.height);
  const normalize = async (input, image) => PNG.sync.read(await sharp(input)
    .extend({ right: width - image.width, bottom: height - image.height, background: '#000000' })
    .png().toBuffer());
  const a = await normalize(leftPath, left);
  const b = await normalize(rightPath, right);
  const diff = new PNG({ width, height });
  const mismatch = pixelmatch(a.data, b.data, diff.data, width, height, { threshold: 0.1 });
  const diffPath = resolve(outputRoot, `${name}__pixel-diff.png`);
  const sidePath = resolve(outputRoot, `${name}__side-by-side.png`);
  await writeFile(diffPath, PNG.sync.write(diff));
  await sharp({ create: { width: width * 2, height, channels: 4, background: '#000000' } })
    .composite([{ input: await sharp(leftPath).png().toBuffer(), left: 0, top: 0 }, { input: await sharp(rightPath).png().toBuffer(), left: width, top: 0 }])
    .png().toFile(sidePath);
  report.totals.comparisons += 1;
  return {
    candidate: leftPath,
    frozen: rightPath,
    candidate_dimensions: { width: left.width, height: left.height },
    frozen_dimensions: { width: right.width, height: right.height },
    compared_dimensions: { width, height },
    mismatched_pixels: mismatch,
    mismatch_ratio: mismatch / (width * height),
    diff: diffPath,
    side_by_side: sidePath,
  };
}

for (const viewport of viewports) {
  const context = await browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
    colorScheme: 'dark',
    reducedMotion: 'reduce',
  });
  await context.route('**/api/public-v1/inquiry', (route) => route.fulfill({
    // Browser harness supplies the disabled contract body without invoking a
    // serverless runtime; handler status semantics are covered in node tests.
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ ok: false, error: 'not_found' }),
  }));
  const candidatePage = await context.newPage();
  const frozenPage = await context.newPage();
  const row = {
    ...viewport,
    assertions: [],
    console_errors: [],
    page_errors: [],
    request_failures: [],
    candidate_requests: [],
    routes: [],
  };
  const watch = (page, side) => {
    page.on('console', (message) => { if (message.type() === 'error') row.console_errors.push({ side, text: message.text() }); });
    page.on('pageerror', (error) => row.page_errors.push({ side, text: error.message }));
    page.on('requestfailed', (request) => row.request_failures.push({ side, url: request.url(), error: request.failure()?.errorText || 'unknown' }));
    page.on('request', (request) => { if (side === 'candidate') row.candidate_requests.push(request.url()); });
  };
  watch(candidatePage, 'candidate');
  watch(frozenPage, 'frozen');
  const check = (condition, label) => {
    assert.ok(condition, `${viewport.name}: ${label}`);
    row.assertions.push(label);
    report.totals.assertions += 1;
  };

  for (const route of routes) {
    await candidatePage.goto(candidateUrl(route.candidate), { waitUntil: 'networkidle' });
    await frozenPage.goto(frozenUrl(route.frozen), { waitUntil: 'networkidle' });
    check(await candidatePage.getByRole('heading', { name: route.heading, exact: true }).isVisible(), `${route.name} heading renders`);
    const dimensions = await candidatePage.evaluate(() => ({
      document_width: document.documentElement.scrollWidth,
      body_width: document.body.scrollWidth,
      viewport_width: document.documentElement.clientWidth,
    }));
    const overflow = Math.max(dimensions.document_width, dimensions.body_width) - dimensions.viewport_width;
    check(overflow <= 0, `${route.name} has zero horizontal overflow`);

    const candidateShot = resolve(outputRoot, `${viewport.name}__${route.name}__candidate.png`);
    const frozenShot = resolve(outputRoot, `${viewport.name}__${route.name}__frozen-v2-1.png`);
    await candidatePage.screenshot({ path: candidateShot, fullPage: true, animations: 'disabled' });
    await frozenPage.screenshot({ path: frozenShot, fullPage: true, animations: 'disabled' });
    report.totals.screenshots += 2;
    const comparison = await compareScreenshots(candidateShot, frozenShot, `${viewport.name}__${route.name}`);
    row.routes.push({ name: route.name, overflow, ...dimensions, comparison });
  }

  await candidatePage.goto(candidateUrl('/'), { waitUntil: 'networkidle' });
  check(await candidatePage.locator('.path-card').count() === 4, 'exactly four Founder cards render');
  check(await candidatePage.getByText('Your AI self-coaching relationship starts here.', { exact: true }).isVisible(), 'Founder-approved Step 3 card language is exact');
  const desktopNavVisible = await candidatePage.locator('.desktop-nav').isVisible();
  if (viewport.width > 1120) {
    check(desktopNavVisible, 'desktop navigation is visible');
  } else {
    check(!desktopNavVisible, 'compressed viewport uses mobile navigation');
    await candidatePage.getByRole('button', { name: 'Open navigation' }).click();
    check(await candidatePage.locator('#mobile-navigation').isVisible(), 'mobile navigation opens');
  }
  const activeNav = viewport.width > 1120 ? candidatePage.locator('.desktop-nav') : candidatePage.locator('#mobile-navigation');
  const classes = await activeNav.locator('a').evaluateAll((nodes) => nodes.map((node) => node.className));
  check(classes.indexOf('athlete-link') + 1 === classes.indexOf('leadership-link'), 'Athlete remains immediately before Leadership');
  check(await activeNav.locator('.athlete-link svg').isVisible(), 'Athlete retains the approved running glyph');
  check(await activeNav.locator('.athlete-link').getAttribute('href') === '#athlete-destination-gated', 'unpublished Athlete destination fails closed');
  check(await activeNav.locator('.leadership-link').getAttribute('href') === '/leadership', 'Leadership route remains unchanged');

  await candidatePage.goto(candidateUrl('/step-3'), { waitUntil: 'networkidle' });
  check(await candidatePage.getByText('$38.95', { exact: true }).isVisible(), 'Step 3 renders the sole approved monthly price');
  check(await candidatePage.getByText('YOUR CONTINUING AI SELF-COACH', { exact: true }).isVisible(), 'Step 3 panel eyebrow is exact');
  check(await candidatePage.getByText('COACH CONNECT', { exact: false }).count() === 0, 'public Step 3 has no Coach Connect surface');
  await candidatePage.locator('#step3-profile').fill('MM-20990101-DEMO0002');
  await candidatePage.locator('form').getByRole('button', { name: /Keep My Map Alive/u }).click();
  check(await candidatePage.getByText('Subscription checkout is not open in this candidate.', { exact: false }).isVisible(), 'Step 3 remains truthfully nontransactional before Home Base destination proof');

  await candidatePage.goto(candidateUrl('/step-4'), { waitUntil: 'networkidle' });
  await candidatePage.locator('#contact-name').fill('Synthetic Airlock');
  await candidatePage.locator('#contact-phone').fill('555-010-0199');
  await candidatePage.locator('#contact-email').fill('review@example.test');
  await candidatePage.getByRole('button', { name: /LET’S TALK/u }).click();
  await candidatePage.getByText('This action is not enabled in the current review configuration.', { exact: true }).waitFor();
  check(await candidatePage.getByText('This action is not enabled in the current review configuration.', { exact: true }).isVisible(), 'disabled inquiry intake makes no delivery claim');

  await candidatePage.goto(candidateUrl('/'), { waitUntil: 'networkidle' });
  await candidatePage.locator('.path-card').first().click();
  check(new URL(candidatePage.url()).pathname === '/step-1', 'home card reaches Step 1 route');
  await candidatePage.goBack();
  check(await candidatePage.getByRole('heading', { name: 'Start with the map.' }).isVisible(), 'browser back returns home');
  await candidatePage.goForward();
  await candidatePage.reload({ waitUntil: 'networkidle' });
  check(await candidatePage.getByRole('heading', { name: 'BUILD YOUR MINDMAP' }).isVisible(), 'deep route survives forward and reload');

  await candidatePage.keyboard.press('Tab');
  const focus = await candidatePage.evaluate(() => {
    const element = document.activeElement;
    if (!element) return null;
    const style = getComputedStyle(element);
    return { tag: element.tagName, outline_style: style.outlineStyle, outline_width: style.outlineWidth };
  });
  check(Boolean(focus?.tag), 'keyboard focus enters the document');

  const localOnly = row.candidate_requests.every((value) => {
    const url = new URL(value);
    return ['127.0.0.1', 'localhost'].includes(url.hostname) && url.port === '5223';
  });
  check(localOnly, 'candidate browser requests remain localhost-only');
  if (row.console_errors.length || row.page_errors.length || row.request_failures.length) {
    process.stderr.write(`${JSON.stringify({
      viewport: viewport.name,
      console_errors: row.console_errors,
      page_errors: row.page_errors,
      request_failures: row.request_failures,
    }, null, 2)}\n`);
  }
  check(row.console_errors.length === 0, 'console has zero errors');
  check(row.page_errors.length === 0, 'page has zero uncaught errors');
  check(row.request_failures.length === 0, 'browser has zero failed requests');
  report.viewports.push(row);
  await context.close();
}

await browser.close();
await writeFile(resolve(outputRoot, 'browser-qa.json'), `${JSON.stringify(report, null, 2)}\n`, 'utf8');
process.stdout.write(`${JSON.stringify({ status: 'PASS', ...report.totals, output: resolve(outputRoot, 'browser-qa.json') }, null, 2)}\n`);
