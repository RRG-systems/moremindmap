#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, resolve } from 'node:path';
import { atomicWriteJson } from './contract.mjs';

function value(name, fallback = null) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : fallback;
}

const executable = resolve(value('--browser', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'));
const receiptPath = value('--receipt');
if (!receiptPath) throw new Error('USAGE: --browser PATH --receipt PATH');
const profile = await mkdtemp(`${tmpdir()}/more-release-browser-preflight-`);
const started = Date.now();
let timedOut = false;

try {
  const args = [
    '--headless=new',
    '--disable-gpu',
    '--disable-background-networking',
    '--disable-component-update',
    '--disable-sync',
    '--metrics-recording-only',
    '--no-first-run',
    '--no-default-browser-check',
    `--user-data-dir=${profile}`,
    '--remote-debugging-port=0',
    'data:text/html,<title>MORE release browser preflight</title><main>green</main>',
  ];
  const child = spawn(executable, args, { stdio: ['ignore', 'pipe', 'pipe'] });
  let devtoolsUrl = null;
  let stderrBytes = 0;
  let stderrTail = '';
  let ready;
  const readyPromise = new Promise((resolveReady) => { ready = resolveReady; });
  child.stdout.on('data', () => {});
  child.stderr.on('data', (chunk) => {
    stderrBytes += chunk.length;
    stderrTail = `${stderrTail}${chunk}`.slice(-8192);
    const match = stderrTail.match(/DevTools listening on (ws:\/\/[^\s]+)/u);
    if (match && !devtoolsUrl) { devtoolsUrl = match[1]; ready(devtoolsUrl); }
  });
  const closePromise = new Promise((resolveExit, reject) => {
    child.once('error', reject);
    child.once('close', (exitCode, signal) => resolveExit({ exitCode, signal }));
  });
  let deadlineTimer;
  const deadline = new Promise((resolveDeadline) => { deadlineTimer = setTimeout(() => resolveDeadline(null), 20_000); });
  const endpoint = await Promise.race([readyPromise, deadline]);
  clearTimeout(deadlineTimer);
  if (!endpoint) {
    timedOut = true;
    child.kill('SIGTERM');
  } else {
    await new Promise((resolveClose, reject) => {
      const socket = new WebSocket(endpoint);
      const timer = setTimeout(() => { socket.close(); reject(new Error('BROWSER_CLOSE_TIMEOUT')); }, 10_000);
      socket.addEventListener('open', () => socket.send(JSON.stringify({ id: 1, method: 'Browser.close' })));
      socket.addEventListener('message', () => { clearTimeout(timer); resolveClose(); });
      socket.addEventListener('close', () => { clearTimeout(timer); resolveClose(); });
      socket.addEventListener('error', (event) => { clearTimeout(timer); reject(event.error || new Error('BROWSER_CLOSE_FAILED')); });
    });
  }
  const { exitCode, signal } = await closePromise;
  const passed = Boolean(devtoolsUrl) && exitCode === 0 && !signal && !timedOut;
  const receipt = {
    schema: 'more.home-base.browser-preflight/v1',
    verdict: passed ? 'BROWSER_LAUNCH_AND_CLOSE_GREEN' : 'BROWSER_PREFLIGHT_FAILED',
    browser_executable_name: basename(executable),
    launched: Boolean(devtoolsUrl),
    closed: exitCode !== null && !signal,
    exit_code: exitCode,
    exit_signal: signal,
    timed_out: timedOut,
    data_url_only: true,
    external_navigation: false,
    stderr_bytes_observed_not_persisted: stderrBytes,
    duration_ms: Date.now() - started,
  };
  await atomicWriteJson(resolve(receiptPath), receipt);
  console.log(JSON.stringify(receipt));
  if (!passed) process.exitCode = 1;
} finally {
  await rm(profile, { recursive: true, force: true });
}
