// Test-only runner seam: keep every V1 assertion/source byte unchanged while
// preventing Vite's repository config loader from writing its bundled config
// through the dependency symlink into Home Base.
import { registerHooks, createRequire, syncBuiltinESMExports } from 'node:module';
import { mkdtempSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import net from 'node:net';
import tls from 'node:tls';
import http from 'node:http';
import https from 'node:https';

const require = createRequire(import.meta.url);
const testUrl = new URL('../../test/athleteLivingConsultOneShotV1.ui.test.js', import.meta.url);
const digest = () => createHash('sha256').update(readFileSync(testUrl)).digest('hex');
const originalTestHash = digest();
const isolatedCache = mkdtempSync(join(tmpdir(), 'athlete-v2-v1-ui-isolated-'));
let interceptedImports = 0;
let outboundAttempts = 0;

function denyOutbound() {
  outboundAttempts += 1;
  throw new Error('ATHLETE_V1_UI_OFFLINE_NETWORK_DENIED');
}
globalThis.fetch = denyOutbound;
net.Socket.prototype.connect = denyOutbound;
net.connect = denyOutbound;
net.createConnection = denyOutbound;
tls.connect = denyOutbound;
http.request = denyOutbound;
http.get = denyOutbound;
https.request = denyOutbound;
https.get = denyOutbound;
syncBuiltinESMExports();

const wrapper = `
import {createServer as originalCreateServer} from ${JSON.stringify(pathToFileURL(require.resolve('vite')).href)};
import react from ${JSON.stringify(pathToFileURL(require.resolve('@vitejs/plugin-react')).href)};
export const createServer = (options = {}) => originalCreateServer({
  ...options,
  root: ${JSON.stringify(fileURLToPath(new URL('../../', import.meta.url)))},
  configFile: false,
  envFile: false,
  cacheDir: ${JSON.stringify(isolatedCache)},
  plugins: [react()],
  server: { ...options.server, middlewareMode: true, hmr: false, watch: null, proxy: undefined },
});
`;
const wrapperUrl = `data:text/javascript,${encodeURIComponent(wrapper)}`;
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === 'vite' && context.parentURL === testUrl.href) {
      interceptedImports += 1;
      return { url: wrapperUrl, shortCircuit: true };
    }
    return nextResolve(specifier, context);
  },
});

process.on('exit', () => {
  const unchanged = digest() === originalTestHash;
  console.log(JSON.stringify({
    proof: 'athlete-v1-ui-isolated-config-preload',
    test_sha256: originalTestHash,
    test_unchanged: unchanged,
    intercepted_imports: interceptedImports,
    outbound_attempts: outboundAttempts,
    cache_directory: isolatedCache,
    config_file: false,
    env_file: false,
    live_plugins: false,
  }));
  if (!unchanged || outboundAttempts) process.exitCode = 1;
});
