import assert from 'node:assert/strict';
import { build } from 'vite';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../../', import.meta.url));

// Pure SSR fixture adapter. Existing assertions still render the real source;
// no development server, listener, file watcher, env file or cache is created.
export async function createServer() {
  return {
    async ssrLoadModule(modulePath) {
      assert.match(modulePath, /^\/src\/[A-Za-z0-9_./-]+\.(?:jsx|js)$/);
      const input = path.resolve(root, modulePath.slice(1));
      assert.ok(input.startsWith(root));
      const compiled = await build({ root, configFile: false, envDir: false, logLevel: 'silent',
        css: { postcss: { plugins: [] } },
        plugins: [{ name: 'synthetic-ssr-no-customer-evidence',
          resolveDynamicImport(specifier, importer) {
            // Match the normal lazy SSR boundary. The selected synthetic-mid
            // fixture never invokes this private customer branch. Do not import
            // evidence-only Patricia assets to make a synthetic check compile.
            if (importer === path.join(root, 'src/lab/baProgressiveDisclosureV1/loadBaProgressiveDisclosureV1.js')
              && specifier === '../baV2CustomerRealization/loadPatriciaBaV2Realization.js')
              return { id: 'test-customer-evidence-branch-not-authorized', external: true };
            return null;
          } }],
        server: { host: '127.0.0.1', hmr: false, watch: null, fs: { allow: [root] } },
        build: { ssr: input, write: false, minify: false,
          rolldownOptions: { output: { codeSplitting: false } } } });
      const chunks = compiled.output.filter(item => item.type === 'chunk');
      assert.equal(chunks.length, 1, 'one in-memory SSR module; no missing relative chunk');
      const code = chunks[0].code.replace(/(from\s+|import\s+)(["'])([^"']+)\2/g,
        (match, prefix, _quote, dependency) => {
          if (dependency.startsWith('node:') || dependency.startsWith('/') || dependency.startsWith('.')) return match;
          return `${prefix}${JSON.stringify(import.meta.resolve(dependency))}`;
        });
      return import(`data:text/javascript,${encodeURIComponent(code)}`);
    },
    async close() {},
  };
}
