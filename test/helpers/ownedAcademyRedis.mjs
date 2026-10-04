import { spawn } from 'node:child_process';
import { mkdtemp } from 'node:fs/promises';
import { createServer } from 'node:net';
import os from 'node:os';
import path from 'node:path';

// A new disposable fixture, never a probe of an existing localhost database.
// A client URL is returned only after this exact owned Redis process is ready.
export async function ownedAcademyRedis({ durable = false } = {}) {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'academy-owned-redis-'));
  const reservation = createServer();
  await new Promise((resolve, reject) => {
    reservation.once('error', reject);
    reservation.listen(0, '127.0.0.1', resolve);
  });
  const port = reservation.address().port;
  await new Promise((resolve, reject) => reservation.close(error => error ? reject(error) : resolve()));
  let child = null;
  async function start() {
    if (child && child.exitCode === null && child.signalCode === null) throw Error('OWNED_REDIS_ALREADY_RUNNING');
    const owned = spawn('/opt/homebrew/bin/redis-server', [
      '--port', String(port), '--bind', '127.0.0.1', '--protected-mode', 'yes',
      '--dir', dir, '--save', '', '--appendonly', durable ? 'yes' : 'no',
      '--appendfsync', 'always',
    ], { env: { LANG: 'C', TZ: 'America/Los_Angeles' }, stdio: ['ignore', 'pipe', 'pipe'] });
    child = owned;
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(Error('OWNED_REDIS_READY_DEADLINE')), 10000);
      let terminal = false;
      const finish = error => {
        if (terminal) return;
        terminal = true; clearTimeout(timer);
        owned.stdout.off('data', ready); owned.stderr.off('data', ready);
        owned.off('error', failed); owned.off('exit', exited);
        error ? reject(error) : resolve();
      };
      const ready = bytes => { if (bytes.toString().includes('Ready to accept connections')) finish(); };
      const failed = () => finish(Error('OWNED_REDIS_START_FAILED'));
      const exited = () => finish(Error('OWNED_REDIS_EXIT_BEFORE_READY'));
      owned.stdout.on('data', ready); owned.stderr.on('data', ready);
      owned.once('error', failed); owned.once('exit', exited);
    }).catch(async error => { await stop(); throw error; });
    return `redis://127.0.0.1:${port}`;
  }
  async function stop(signal = 'SIGTERM') {
    const owned = child;
    if (!owned || owned.exitCode !== null || owned.signalCode !== null) return;
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(Error('OWNED_REDIS_CLOSE_DEADLINE')), 10000);
      owned.once('close', () => { clearTimeout(timer); resolve(); });
      owned.kill(signal);
    });
  }
  const fixture = { start, stop, dir, url: `redis://127.0.0.1:${port}` };
  await start();
  return fixture;
}
