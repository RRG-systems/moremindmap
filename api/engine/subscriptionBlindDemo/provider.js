import OpenAI from 'openai';
import { PRIVATE_ASSIGNMENT } from './privateAssignment.js';
import { assertBlindScope } from './authority.js';
import { createSubscriptionLiveDemoOpenAiTransport } from '../subscriptionV1/liveDemoOpenAiTransport.js';
import { createSubscriptionS2OpenAiTransport } from '../subscriptionS2/openAiTransport.js';

// This is the sole consumer of the additional credential. A request cannot mint
// the in-process scope: the authenticated, server-resolved demo route must do it.
export function createBlindProvider({ scope, env, clientFactory = (args) => new OpenAI(args) }) {
  assertBlindScope(scope);
  const kind = PRIVATE_ASSIGNMENT[scope.selection];
  if (!kind) throw new Error('BLIND_DEMO_PROVIDER_ASSIGNMENT_DENIED');
  const canonical = kind === 'canonical';
  const apiKey = canonical ? env.OPENAI_API_KEY : env.SUBSCRIPTION_DEMO_EXPERIMENT_API_KEY;
  if (typeof apiKey !== 'string' || !apiKey.trim()) throw new Error('BLIND_DEMO_PROVIDER_BINDING_REQUIRED');
  const model = canonical ? 'gpt-5.6-sol' : 'grok-4.6';
  const baseURL = canonical ? 'https://api.openai.com/v1' : 'https://api.x.ai/v1';
  const client = clientFactory({ apiKey, baseURL, maxRetries: 0, timeout: 300000 });
  const guardedClient = { responses: { async create(request, options) {
    assertBlindScope(scope);
    if (request?.model !== 'gpt-5.6-sol' || request?.reasoning?.effort !== 'xhigh'
      || request?.store !== false || request?.background !== false) throw new Error('BLIND_DEMO_REQUEST_POLICY_DENIED');
    const wire = { ...request, model };
    // The sealed coach-off required omission of this unsupported false field.
    // Instructions, schemas, reasoning, tool choice and budgets are unchanged.
    if (!canonical) delete wire.background;
    try { return await client.responses.create(wire, options); }
    catch (error) {
      const safe = new Error('BLIND_DEMO_PROVIDER_REQUEST_FAILED');
      safe.code = 'BLIND_DEMO_PROVIDER_REQUEST_FAILED';
      if (Number.isInteger(error?.status)) safe.status = error.status;
      throw safe;
    }
  } } };
  return Object.freeze({
    coaching: createSubscriptionLiveDemoOpenAiTransport({ apiKey, client: guardedClient, timeoutMs: 300000, maxTransportRetries: 1 }),
    visual: createSubscriptionS2OpenAiTransport({ apiKey, client: guardedClient, timeoutMs: 300000, maxTransportRetries: 1 }),
  });
}
