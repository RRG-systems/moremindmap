import assert from 'node:assert/strict';
import test from 'node:test';

let moduleSequence = 0;

async function loadClient() {
  moduleSequence += 1;
  return import(new URL(`../src/lib/recruitingGuV1/client.js?reset-csrf-test=${moduleSequence}`, import.meta.url));
}

function response(status, payload) {
  return {
    ok: status >= 200 && status < 300,
    status,
    async json() { return payload; },
  };
}

async function withBrowser({ pathname = '/recruiting-gu-v1/demo', fetchImpl }, operation) {
  const previousWindow = globalThis.window;
  const previousFetch = globalThis.fetch;
  globalThis.window = {
    location: {
      origin: 'https://moremindmap.com',
      pathname,
      search: '',
    },
  };
  globalThis.fetch = fetchImpl;
  try {
    return await operation();
  } finally {
    globalThis.window = previousWindow;
    globalThis.fetch = previousFetch;
  }
}

for (const subject of ['PATRICIA', 'SYNTHETIC']) {
  test(`legitimate ${subject} reset refreshes demo CSRF before one subject-scoped POST`, async () => {
    const calls = [];
    const freshProof = `${subject.toLowerCase()}-${'a'.repeat(64)}`;
    const rotatedProof = `${subject.toLowerCase()}-${'b'.repeat(64)}`;
    await withBrowser({
      fetchImpl: async (input, init = {}) => {
        calls.push({ input: String(input), init });
        if (calls.length === 1) return response(200, { ok: true, csrf_token: freshProof, active_subject: subject });
        return response(200, {
          ok: true,
          csrf_token: rotatedProof,
          reset: true,
          subject,
          external_mutation: false,
          canonical_mutation: false,
        });
      },
    }, async () => {
      const client = await loadClient();
      const receipt = await client.resetGuDemoSubject(subject);
      assert.equal(receipt.reset, true);
      assert.equal(receipt.subject, subject);
    });

    assert.equal(calls.length, 2);
    assert.equal(new URL(calls[0].input).pathname, '/api/recruiting/gu-v1-demo');
    assert.equal(new URL(calls[0].input).searchParams.get('view'), 'home');
    assert.equal(calls[0].init.method, undefined);
    assert.equal(calls[1].input, '/api/recruiting/gu-v1-demo');
    assert.equal(calls[1].init.method, 'POST');
    assert.equal(calls[1].init.headers['x-recruiting-gu-v1-csrf'], freshProof);
    assert.deepEqual(JSON.parse(calls[1].init.body), { action: 'RESET_SYNTHETIC_DEMO', subject });
  });
}

test('reset refuses non-demo routes and non-exact subjects before any network request', async () => {
  for (const [pathname, subject] of [['/recruiting-gu-v1', 'PATRICIA'], ['/recruiting-gu-v1/demo', 'BOTH']]) {
    let calls = 0;
    await withBrowser({ pathname, fetchImpl: async () => { calls += 1; throw new Error('NETWORK_MUST_NOT_RUN'); } }, async () => {
      const client = await loadClient();
      await assert.rejects(
        () => client.resetGuDemoSubject(subject),
        /RECRUITING_GU_V1_DEMO_RESET_(?:ROUTE|SUBJECT)_DENIED/u,
      );
    });
    assert.equal(calls, 0);
  }
});

test('reset fails closed when CSRF refresh is missing and never sends the reset POST', async () => {
  const calls = [];
  await withBrowser({
    fetchImpl: async (input, init = {}) => {
      calls.push({ input: String(input), init });
      return response(200, { ok: true, active_subject: 'PATRICIA' });
    },
  }, async () => {
    const client = await loadClient();
    await assert.rejects(() => client.resetGuDemoSubject('PATRICIA'), /RECRUITING_GU_V1_DEMO_RESET_CSRF_REFRESH_FAILED/u);
  });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].init.method, undefined);
});

test('server CSRF denial remains fail-closed and is not retried', async () => {
  const calls = [];
  const freshProof = `fresh-${'c'.repeat(64)}`;
  await withBrowser({
    fetchImpl: async (input, init = {}) => {
      calls.push({ input: String(input), init });
      if (calls.length === 1) return response(200, { ok: true, csrf_token: freshProof });
      return response(403, { ok: false, code: 'RECRUITING_GU_V1_CSRF_DENIED' });
    },
  }, async () => {
    const client = await loadClient();
    await assert.rejects(() => client.resetGuDemoSubject('SYNTHETIC'), /RECRUITING_GU_V1_CSRF_DENIED/u);
  });
  assert.equal(calls.length, 2);
  assert.equal(calls[1].init.method, 'POST');
});
