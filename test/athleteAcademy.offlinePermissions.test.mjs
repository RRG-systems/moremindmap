import test from 'node:test';
import assert from 'node:assert/strict';

test('offline validation has no network, writes, child processes, workers, native addons, WASI or inspector permission', () => {
  assert.equal(typeof process.permission?.has, 'function');
  for (const scope of ['net', 'fs.write', 'child', 'worker', 'addons', 'wasi', 'inspector'])
    assert.equal(process.permission.has(scope), false, scope);
  assert.equal(process.permission.has('fs.read', '/private/tmp/youth-ungranted-marker-v3'), false);
});
