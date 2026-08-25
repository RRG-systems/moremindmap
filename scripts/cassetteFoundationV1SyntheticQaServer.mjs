import { createServer } from 'vite';

const HOST = '127.0.0.1';
const PORT = Number(process.env.CASSETTE_FOUNDATION_QA_PORT || 5203);

const PROFILES = Object.freeze({
  'MM-20260821-BLANK001': { name: 'Blake Synthetic', industry: '' },
  'MM-20260821-REALEST1': { name: 'Riley Synthetic', industry: 'Real Estate' },
  'MM-20260821-UNSUP001': { name: 'Uma Synthetic', industry: 'Marine Services' },
  'MM-20260821-RETURN01': { name: 'Rowan Synthetic', industry: 'Real Estate', returning: true },
});

function json(res, status, payload) {
  res.statusCode = status;
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(payload));
}

function qaPlugin() {
  return {
    name: 'cassette-foundation-v1-synthetic-api',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = new URL(req.url || '/', `http://${HOST}:${PORT}`);
        const id = String(url.searchParams.get('id') || '').toUpperCase();
        const profile = PROFILES[id];

        if (url.pathname === '/api/moremindmap/retrieve-profile') {
          if (!profile) return json(res, 404, { found: false });
          return json(res, 200, {
            profile_id: id,
            canonical_dossier: {
              person_name: profile.name,
              canonical_profile_json: {
                profile_id: id,
                person_name: profile.name,
                profile_type: 'Synthetic QA Profile',
                metadata: { organization: { industry: profile.industry } },
              },
            },
          });
        }

        if (url.pathname === '/api/moremindmap/new-ba') {
          if (profile?.returning) return json(res, 200, { artifact: { synthetic_route_proof: true } });
          return json(res, 404, { safe_code: 'new_ba_business_assessment_not_found' });
        }

        if (url.pathname === '/api/business-assessment/retrieve') {
          return json(res, 404, { success: true, found: false, status: 'not_found' });
        }

        if (url.pathname === '/business-twin' && profile?.returning) {
          res.statusCode = 200;
          res.setHeader('content-type', 'text/html; charset=utf-8');
          res.end(`<!doctype html><html><head><title>Synthetic Business Twin route proof</title><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;background:#050607;color:#f7f2e8;font-family:system-ui;display:grid;min-height:100vh;place-items:center"><main><p style="color:#55d783">REAL ESTATE CASSETTE CONFIRMED</p><h1>Governed Business Twin route reached.</h1><p>Returning synthetic customer bypassed re-onboarding.</p></main></body></html>`);
          return;
        }

        next();
      });
    },
  };
}

const server = await createServer({
  root: process.cwd(),
  envFile: false,
  cacheDir: '/private/tmp/moremindmap-cassette-foundation-v1-vite-cache',
  resolve: { preserveSymlinks: true, dedupe: ['react', 'react-dom', 'react-router-dom'] },
  optimizeDeps: { force: true },
  server: { host: HOST, port: PORT, strictPort: true },
  plugins: [qaPlugin()],
  clearScreen: false,
});

await server.listen();
console.log(`CASSETTE_FOUNDATION_SYNTHETIC_QA_READY http://${HOST}:${PORT}/business-assessment`);

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, async () => {
    await server.close();
    process.exit(0);
  });
}
