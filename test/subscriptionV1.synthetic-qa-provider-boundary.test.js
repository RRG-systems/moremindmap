import test from 'node:test';
import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { createHash, createHmac } from 'node:crypto';
import { readFileSync, mkdtempSync, mkdirSync, copyFileSync, unlinkSync, rmSync, existsSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, dirname, extname, join, relative } from 'node:path';
import process from 'node:process';
import { setImmediate } from 'node:timers';
import { canonicalJson, hashCanonicalJson } from '../src/lib/intelligenceFabric/hashing.js';
import { scopeFingerprint } from '../src/lib/subscriptionV1/contracts.js';
import { fullPersonQaCustodySha256, parseFullPersonQaManifest, fullPersonQaProfileDigest, fullPersonQaAssessmentDigest } from '../api/engine/subscriptionV1/fullPersonQaAccess.js';
import { pinnedSubscriptionSources, pinnedLoanOriginatorSubscriptionSources } from '../api/engine/subscriptionV1/pinnedSources.js';
import { syntheticQaScope } from '../api/engine/subscriptionV1/syntheticQaRuntimeInfrastructure.js';
import { createSyntheticQaProviderBoundary, syntheticQaProviderEnabled, syntheticQaProviderCandidateSha256,
  SYNTHETIC_QA_GRANT_DOMAIN, SYNTHETIC_QA_COACHING_RENEWAL_DOMAIN,
  SYNTHETIC_QA_COACHING_SECOND_RENEWAL_DOMAIN,
  SYNTHETIC_QA_RENEWAL_CONTINUITY } from '../api/engine/subscriptionV1/syntheticQaProviderBoundary.js';
import { SYNTHETIC_QA_CAMPAIGN, SYNTHETIC_QA_ALLOCATION, SYNTHETIC_QA_BUDGET_KEYS,
  syntheticQaBudgetCustody, syntheticQaBudgetGrantSha256, createSyntheticQaProviderBudget } from '../api/engine/subscriptionV1/syntheticQaProviderBudget.js';

// In-memory fictional approvals only. This constant is NOT a deployed signing
// key; no sealed grant, key, environment file, or ledger is written by tests.
const FAKE_SIGNING_KEY = 'OFFLINE_TEST_ONLY_NOT_A_REAL_CREDENTIAL_20260914';
const NOW = Date.parse('2026-09-14T12:00:00.000Z');
const hash = value => createHash('sha256').update(value).digest('hex');
const cases = ['COHORT-V1-LO-A','COHORT-V1-LO-B','COHORT-V1-RE-A','COHORT-V1-RE-B'];
const FAKE_DIGEST_KEY = 'OFFLINE_TEST_ONLY_NOT_A_REAL_DIGEST_KEY_20260914';
const profiles = cases.map((c,i) => `mm-20260914-0000000${i}`);
const assessments = cases.map((c,i) => `ba-20260914-0000000${i}`);
const fields = ['profile_digest','assessment_digest','vertical_binding_sha256','canonical_profile_artifact_sha256',
  'bos_canonical_source_sha256','assessment_evidence_sha256','ba_realization_id_digest','ba_realization_identity_sha256',
  'ba_artifact_sha256','ba_envelope_sha256','bos_realization_id_digest','bos_realization_identity_sha256','bos_artifact_sha256',
  'bos_envelope_sha256','synthetic_provenance_sha256'];
const entries = cases.map((case_id,index) => {
  const vertical_id = case_id.includes('-LO-') ? 'loan_originator' : 'real_estate';
  const entry = { authority_id: `synthetic_qa_authority_${hash(case_id).slice(0,24)}`, case_id, vertical_id,
    vertical_authority_sha256: hash(vertical_id), expires_at: '2026-09-15T12:00:00.000Z', status: 'active',
    ...Object.fromEntries(fields.map(field => [field, hash(`${case_id}:${field}`)])) };
  entry.profile_digest = fullPersonQaProfileDigest(profiles[index],FAKE_DIGEST_KEY);
  entry.assessment_digest = fullPersonQaAssessmentDigest(assessments[index],FAKE_DIGEST_KEY);
  return { ...entry, custody_sha256: fullPersonQaCustodySha256(entry) };
});
const scopes=entries.map((entry,index)=>syntheticQaScope({profile_id:profiles[index],assessment_id:assessments[index],vertical_binding_sha256:entry.vertical_binding_sha256,authority_id:entry.authority_id}));
const manifests = parseFullPersonQaManifest(JSON.stringify(entries));
const source = index => index < 2 ? pinnedLoanOriginatorSubscriptionSources() : pinnedSubscriptionSources();
const EXPECTED_CLOSURE_ROOTS = ['api/internal/subscription-v1-runtime.js'];
const EXPECTED_EXCLUDED_DYNAMIC_EDGES = [{
  from: 'api/internal/subscription-v1-runtime.js',
  specifier: '../engine/subscriptionS2/demoSubscriberLoader.js',
  reason: 'UNREACHABLE_AFTER_EXACT_SYNTHETIC_QA_AUTHORITY_SELECTION',
}, {
  from: 'api/internal/subscription-v1-runtime.js',
  specifier: '../engine/subscriptionBlindDemo/runtime.js',
  reason: 'NON_SYNTHETIC_QA_ROUTE_BRANCH',
}, {
  from: 'api/internal/subscription-v1-runtime.js',
  specifier: '../engine/subscriptionV1/paidRuntimeComposition.js',
  reason: 'NON_SYNTHETIC_QA_ROUTE_BRANCH',
}];
const REGISTRY_PATHS = ['api/engine/subscriptionV1/sourceLibrary/SOURCE_REGISTRY.json',
  'api/engine/subscriptionV1/sourceLibrary/LOAN_ORIGINATOR_SOURCE_REGISTRY.json'];
const CONFIG_SNAPSHOT_PATH = 'api/engine/subscriptionV1/sourceLibrary/VERCEL_SOURCE_CONFIG_SNAPSHOT_V1.json';
const DEPENDENCY_IDENTITY_PATHS = ['package.json', 'package-lock.json', 'vercel.json', CONFIG_SNAPSHOT_PATH];
const BA_AUTHORITY_ROOT = 'docs/ba-intelligence-authority-library-v1';
const BA_AUTHORITY_MANIFEST = `${BA_AUTHORITY_ROOT}/freeze/BA_INTELLIGENCE_AUTHORITY_LIBRARY_MANIFEST_V1.json`;
const LO_AUTHORITY_ROOT = 'docs/lo-cassette-2-final-canonical-authority-v1';
const LO_AUTHORITY_MANIFEST = `${LO_AUTHORITY_ROOT}/23_AUTHORITY_DEPENDENCY_MANIFEST_V1.json`;
const LO_AUTHORITY_ROOT_RECORD = `${LO_AUTHORITY_ROOT}/24_CANONICAL_AUTHORITY_ROOT_V1.json`;
const EXPECTED_RUNTIME_INCLUDE_GLOB = '{api/engine/subscriptionV1/{syntheticQaProviderCandidate.json,sourceLibrary/**},docs/{ba-intelligence-authority-library-v1/**,lo-cassette-2-final-canonical-authority-v1/{0[2-9]_*,1?_*,2[0-4]_*,SOURCE*}},package*.json,vercel.json}';

function runtimeIncludeGlobCovers(path) {
  return path === 'api/engine/subscriptionV1/syntheticQaProviderCandidate.json'
    || path.startsWith('api/engine/subscriptionV1/sourceLibrary/')
    || path.startsWith('docs/ba-intelligence-authority-library-v1/')
    || /^docs\/lo-cassette-2-final-canonical-authority-v1\/(?:0[2-9]_|1._|2[0-4]_|SOURCE)/u.test(path)
    || /^package.*\.json$/u.test(path)
    || path === 'vercel.json';
}

function isFileLoadedRuntimeAsset(path) {
  return path.startsWith('api/engine/subscriptionV1/sourceLibrary/')
    || path.startsWith(`${BA_AUTHORITY_ROOT}/`)
    || path.startsWith(`${LO_AUTHORITY_ROOT}/`)
    || /^package.*\.json$/u.test(path)
    || path === 'vercel.json';
}

function resolveLocalImport(root, from, specifier) {
  if (!specifier.startsWith('.')) return null;
  const base=resolve(root,dirname(from),specifier.replace(/[?#].*$/u,''));
  for(const candidate of [base,`${base}.js`,`${base}.mjs`,`${base}.json`,join(base,'index.js')])
    if(existsSync(candidate)&&statSync(candidate).isFile())return relative(root,candidate);
  throw new Error(`UNRESOLVED_LITERAL_IMPORT:${from}:${specifier}`);
}

function exactRuntimeClosure(root, roots, excludedDynamicEdges) {
  const seen=new Set(),queue=[...roots];
  while(queue.length){const path=queue.shift();if(seen.has(path))continue;seen.add(path);
    const sourceText=readFileSync(resolve(root,path),'utf8');if(!['.js','.mjs'].includes(extname(path)))continue;
    const patterns=[{dynamic:false,regex:/\b(?:import|export)\s+(?:[^'";]*?\s+from\s+)?['"]([^'"]+)['"]/gu},
      {dynamic:true,regex:/\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/gu}];
    for(const {dynamic,regex} of patterns){let match;while((match=regex.exec(sourceText))){
      if(dynamic&&excludedDynamicEdges.some(edge=>edge.from===path&&edge.specifier===match[1]))continue;
      const imported=resolveLocalImport(root,path,match[1]);if(imported&&!seen.has(imported))queue.push(imported);
    }}
  }
  return seen;
}

function fileLoadedAuthorityPaths(root) {
  const paths=new Set(REGISTRY_PATHS);
  for(const registryPath of REGISTRY_PATHS){const registry=JSON.parse(readFileSync(resolve(root,registryPath),'utf8'));
    for(const document of registry.documents){const path=join(dirname(registryPath),document.relativePath);
      assert.equal(hash(readFileSync(resolve(root,path))),document.sha256,path);paths.add(path);}}
  const ba=JSON.parse(readFileSync(resolve(root,BA_AUTHORITY_MANIFEST),'utf8'));paths.add(BA_AUTHORITY_MANIFEST);
  assert.equal(ba.artifacts_excluding_self.length,58);
  for(const artifact of ba.artifacts_excluding_self){const path=join(BA_AUTHORITY_ROOT,artifact.path);
    const bytes=readFileSync(resolve(root,path));assert.equal(bytes.length,artifact.bytes,path);
    assert.equal(hash(bytes),artifact.sha256,path);paths.add(path);}
  const loBytes=readFileSync(resolve(root,LO_AUTHORITY_MANIFEST));const lo=JSON.parse(loBytes);
  const loRoot=JSON.parse(readFileSync(resolve(root,LO_AUTHORITY_ROOT_RECORD),'utf8'));
  assert.equal(lo.artifacts.length,22);assert.equal(hash(loBytes),loRoot.root_authority_sha256);
  paths.add(LO_AUTHORITY_MANIFEST);paths.add(LO_AUTHORITY_ROOT_RECORD);
  for(const artifact of lo.artifacts){const path=join(LO_AUTHORITY_ROOT,artifact.path);
    const bytes=readFileSync(resolve(root,path));assert.equal(bytes.length,artifact.bytes,path);
    assert.equal(hash(bytes),artifact.sha256,path);paths.add(path);}
  return paths;
}

function nativeFixture() {
  return {contract:'FOUR_SYNTHETIC_NATIVE_GENERATION_APPROVAL_V1',status:'APPROVED',campaignId:SYNTHETIC_QA_CAMPAIGN,
    freshAllowanceMicroUsd:20_000_000,coachingReserveMicroUsd:8_000_000,freshAllowanceSeparatelyApproved:true,model:'gpt-5.6-sol',
    maxCreates:88,maxCreatesPerCase:22,enabledCaseIds:['COHORT-V1-RE-A','COHORT-V1-RE-B','COHORT-V1-LO-A','COHORT-V1-LO-B'],
    deadlineUtc:'2026-09-14T13:00:00.000Z',nativeSourceManifestSha256:hash('fictional-native-manifest'),
    executionFiles:[{path:'adapter.mjs',sha256:hash('fictional-adapter')}],operatorRoot:'/fictional-not-created/operator',nativeRoot:'/fictional-not-created/native',
    campaignDir:'/fictional-not-created/operator/RUN_STATE',sharedSpendDir:'/fictional-not-created/operator/RUN_STATE/SHARED_SPEND',
    preparedCases:cases.map((caseId,i)=>({caseId,profileId:profiles[i],sha256:hash(`fictional-prepared-${i}`)}))};
}
function grantFixture() {
  return { contract: 'SYNTHETIC_QA_MODEL2_PROVIDER_GRANT_V1', status: 'APPROVED', campaign_id: SYNTHETIC_QA_CAMPAIGN,
    approval_sha256: hash(JSON.stringify(nativeFixture())), native_approval_sha256: hash(JSON.stringify(nativeFixture())),
    native_source_manifest_sha256: nativeFixture().nativeSourceManifestSha256, native_execution_files_sha256: hashCanonicalJson(nativeFixture().executionFiles),
    ledger_initialization_id: '00000000-0000-4000-8000-000000000001', allocation: { ...SYNTHETIC_QA_ALLOCATION },
    model: 'gpt-5.6-sol', selection: 'MODEL2', reasoning_effort: 'xhigh', store: false, web_enabled: false,
    winner_acceptance_sha256: '2186522347323e4576b559bf55f7db3904a8a66d3d4ced177c89dfc76a96b9a3',
    pricing_policy: 'CONSERVATIVE_USAGE_BOUND_10_INPUT_60_OUTPUT_MICROUSD_V1',
    starts_at: '2026-09-14T11:00:00.000Z', deadline: '2026-09-14T13:00:00.000Z',
    candidate_sha256: syntheticQaProviderCandidateSha256(), manifest_sha256: manifests.manifest_sha256,
    cohort: entries.map((e, i) => ({ case_id: e.case_id, assessment_id: assessments[i], authority_id: e.authority_id, custody_sha256: e.custody_sha256,
      vertical_id: e.vertical_id, scope_sha256: scopeFingerprint(scopes[i]), source_registry_sha256: source(i).info.registry_sha256 })) };
}
function envFixture(grant) {
  const signature = createHmac('sha256', FAKE_SIGNING_KEY).update(SYNTHETIC_QA_GRANT_DOMAIN).update('\0').update(canonicalJson(grant)).digest('hex');
  return { MOREMINDMAP_SERVER_ONLY_SUBSCRIPTION_SYNTHETIC_QA_PROVIDER_GRANT: JSON.stringify({ grant, signature }),
    MOREMINDMAP_SERVER_ONLY_SUBSCRIPTION_SYNTHETIC_QA_MANIFEST: JSON.stringify(entries),
    MOREMINDMAP_SERVER_ONLY_SUBSCRIPTION_SYNTHETIC_QA_NATIVE_APPROVED_EXECUTION: JSON.stringify(nativeFixture()),
    MOREMINDMAP_SERVER_ONLY_SUBSCRIPTION_SYNTHETIC_QA_DIGEST_KEY: FAKE_DIGEST_KEY,
    MOREMINDMAP_SERVER_ONLY_SUBSCRIPTION_SYNTHETIC_QA_SIGNING_KEY: FAKE_SIGNING_KEY };
}
class MemoryRedis {
  constructor(grant) {
    const grantSha256 = syntheticQaBudgetGrantSha256(grant);
    this.values = new Map([[SYNTHETIC_QA_BUDGET_KEYS.custody, canonicalJson(syntheticQaBudgetCustody(grantSha256, grant))],
      [SYNTHETIC_QA_BUDGET_KEYS.ledger, canonicalJson({ contract: 'SYNTHETIC_QA_LIVE_PROVIDER_SPEND_V1',
        grant_sha256: grantSha256, initialization_id: grant.ledger_initialization_id, revision: 0, attempts: [], halted: false })]]);
    this.reads = 0; this.writes = 0;
  }
  async get(key) { this.reads += 1; return this.values.get(key) ?? null; }
  async eval(script, count, custodyKey, ledgerKey, expectedCustody, old, next) {
    assert.equal(count, 2); assert.equal(script.includes('EXPIRE'), false); assert.equal(script.includes('DEL'), false);
    if (this.values.get(custodyKey) !== expectedCustody) return -1;
    if (this.values.get(ledgerKey) !== old) return 0;
    this.values.set(ledgerKey, next); this.writes += 1; return 1;
  }
  state() { return JSON.parse(this.values.get(SYNTHETIC_QA_BUDGET_KEYS.ledger)); }
}
const schemas = { CONVERSATION: ['subscription_v1_free_gpt_conversation_v2',16000],
  CANDIDATE_EXTRACTION: ['subscription_v1_post_response_candidate_v1',12000],
  NATURAL_AUTHORIZATION: ['subscription_v1_natural_authorization_v1',5000], SESSION_CLOSE: ['subscription_flagship_s1_1_session_close_v1',8000] };
function request(stage = 'CONVERSATION', content = 'fictional test exchange') {
  return { model: 'gpt-5.6-sol', store: false, background: false, tools: [], reasoning: { effort: 'xhigh' },
    max_output_tokens: schemas[stage][1], input: [{role:'user',content}],
    text: { format: { type:'json_schema',strict:true,name:schemas[stage][0],schema:{type:'object'} } } };
}
const response = (extra = {}) => ({ id:'resp_offline_fake', model:'gpt-5.6-sol', status:'completed', output:[],
  output_text:'{"synthetic_result":true}', usage:{input_tokens:10,output_tokens:5,total_tokens:15}, ...extra });
function setup({ mutateGrant = () => {}, provider = async () => response(), now = () => NOW,
  renewalContinuityForGrant = null } = {}) {
  const grant = grantFixture(); mutateGrant(grant);
  const env = envFixture(grant), redis = new MemoryRedis(grant); let calls = 0, factories = 0;
  const renewalContinuity = renewalContinuityForGrant?.(grant);
  const options = { env, redis, now, ...(renewalContinuity ? { renewalContinuity } : {}),
    providerClientFactory: () => { factories += 1; return { responses: {
    async create(wire, options) {
      calls += 1; assert.equal(options.maxRetries,0);
      assert.ok(redis.state().attempts.some(a => a.status === 'RESERVED'));
      return provider(wire, redis, calls);
    } } }; } };
  const boundary = createSyntheticQaProviderBoundary(options);
  return { grant, env, redis, options, boundary, calls: () => calls, factories: () => factories,
    transport: (index = 0, selected = boundary) => selected.createTransport({ scope:scopes[index],
      projection:{synthetic_only:true,doctrine_vertical_id:index<2?'LOAN_ORIGINATOR':'REAL_ESTATE'},sourceLibrary:source(index) }) };
}

test('default denial and env booleans never read key/provider/Redis', async () => {
  const env = new Proxy({ PUBLIC_SUBSCRIPTION_SYNTHETIC_QA_ENABLED:'true', SYNTHETIC_QA_PROVIDER_ENABLED:'true',
    MOREMINDMAP_SERVER_ONLY_SUBSCRIPTION_SYNTHETIC_QA_COACHING_RENEWAL:'{}' }, {
    get(target,key) { if (String(key).includes('KEY')) assert.fail('credential read without grant'); return target[key]; } });
  const boundary = createSyntheticQaProviderBoundary({ env, redis: { get: () => assert.fail('store touched') }, providerClientFactory: () => assert.fail('provider touched') });
  assert.equal(syntheticQaProviderEnabled(env),false);
  assert.throws(() => boundary.createTransport(), /BUDGET_NOT_AUTHORIZED/);
  await assert.rejects(boundary.generateGu(), /BUDGET_NOT_AUTHORIZED/);
});

test('unsigned, expired, altered model/candidate/source/cohort/split/native grant denied before dispatch', () => {
  const mutations = [g => {g.deadline='2026-09-14T11:59:00.000Z';}, g => {g.model='other';},
    g => {g.candidate_sha256=hash('drift');},g => {g.cohort[0].source_registry_sha256=hash('drift');},
    g => {g.cohort.pop();},g => {g.cohort[0].custody_sha256=hash('drift');},
    g => {g.allocation.live_coaching_micro_usd=12_000_000;},g => {g.native_approval_sha256=hash('different');}];
  for (const mutateGrant of mutations) {
    const fixture=setup({mutateGrant}); assert.throws(() => fixture.transport(), /BUDGET_NOT_AUTHORIZED/);
    assert.equal(fixture.calls(),0);assert.equal(fixture.factories(),0);assert.equal(fixture.redis.writes,0);
  }
  const fixture=setup(); const envelope=JSON.parse(fixture.env.MOREMINDMAP_SERVER_ONLY_SUBSCRIPTION_SYNTHETIC_QA_PROVIDER_GRANT);
  envelope.signature=hash('wrong');fixture.env.MOREMINDMAP_SERVER_ONLY_SUBSCRIPTION_SYNTHETIC_QA_PROVIDER_GRANT=JSON.stringify(envelope);
  assert.throws(()=>fixture.transport(),/BUDGET_NOT_AUTHORIZED/);
});

test('a signed cross-person grant and a native reserve taken from the live portion both fail closed',()=>{
  const swapped=setup({mutateGrant:g=>{[g.cohort[0].scope_sha256,g.cohort[1].scope_sha256]=[g.cohort[1].scope_sha256,g.cohort[0].scope_sha256];}});
  assert.throws(()=>swapped.transport(),/PROFILE_CASE_MISMATCH/);assert.equal(swapped.calls(),0);
  const native=nativeFixture();native.coachingReserveMicroUsd=2_000_000;
  const changed=setup({mutateGrant:g=>{g.approval_sha256=hash(JSON.stringify(native));g.native_approval_sha256=g.approval_sha256;}});
  changed.env.MOREMINDMAP_SERVER_ONLY_SUBSCRIPTION_SYNTHETIC_QA_NATIVE_APPROVED_EXECUTION=JSON.stringify(native);
  assert.throws(()=>changed.transport(),/NATIVE_ALLOCATION_OR_CUSTODY/);assert.equal(changed.calls(),0);
});

test('all four exact identities use their own LO/RE sources and settle observed usage', async () => {
  const fixture=setup();
  for(let index=0;index<4;index+=1) {
    const result=await fixture.transport(index)(request('CONVERSATION',`fictional ${index}`),{stage:'CONVERSATION'});
    assert.equal(result.source_library.registry_sha256,source(index).info.registry_sha256);
    assert.equal(result.attempt_count,1);
  }
  assert.equal(fixture.calls(),4); assert.equal(fixture.redis.state().attempts.length,4);
  for(const attempt of fixture.redis.state().attempts){assert.equal(attempt.status,'SETTLED');assert.equal(attempt.held_micro_usd,400);}
});

test('every source-tool continuation reserves separately and retains exact vertical',async()=>{
  const fixture=setup({provider:async(wire,redis,n)=>n===1?response({output_text:'',output:[{type:'function_call',name:source(0).tools[0].name,
    call_id:'fake_source_call',arguments:JSON.stringify({query:'loan',namespace:source(0).info.namespaces[0]})}]}):response()});
  const result=await fixture.transport()(request(),{stage:'CONVERSATION'});
  assert.equal(fixture.calls(),2);assert.equal(result.internal_source_calls,1);assert.equal(fixture.redis.state().attempts.length,2);
});

test('extraction, authorization and close share the same live ledger with original output limits',async()=>{
  const fixture=setup();for(const stage of ['CANDIDATE_EXTRACTION','NATURAL_AUTHORIZATION','SESSION_CLOSE'])
    await fixture.transport()(request(stage),{stage});
  assert.deepEqual(fixture.redis.state().attempts.map(a=>a.stage),['CANDIDATE_EXTRACTION','NATURAL_AUTHORIZATION','SESSION_CLOSE']);
  assert.equal(fixture.calls(),3);
});

test('shipped helper retry is counted separately and preserves failed reservation',async()=>{
  const fixture=setup({provider:async(wire,redis,n)=>{if(n===1)throw Object.assign(new Error('fictional throttle'),{status:429});return response();}});
  const result=await fixture.transport()(request('CANDIDATE_EXTRACTION'),{stage:'CANDIDATE_EXTRACTION'});
  assert.equal(result.attempt_count,2);assert.equal(fixture.calls(),2);
  const [failed,succeeded]=fixture.redis.state().attempts;
  assert.equal(failed.status,'UNRESOLVED');assert.equal(failed.held_micro_usd,failed.reserved_micro_usd);
  assert.equal(succeeded.status,'SETTLED');assert.equal(succeeded.held_micro_usd,400);
});

test('real GU runtime preserves current exchange, shipped transport retry and validation repair under the same ledger',async()=>{
  const fixture=setup({provider:async(wire,redis,n)=>{
    assert.equal(wire.max_output_tokens,6000);
    const payload=JSON.parse(wire.input.at(-1).content);
    assert.equal(payload.governedWorld.coachingMomentContext.customerMessage,'fictional customer exchange');
    if(n===1)throw Object.assign(new Error('fictional throttle'),{status:429});
    const output={renderDecision:{render:false,reason:'Conversation is enough'},guidance:{summary:'Continue the conversation.',nextCue:'Choose a useful next step.'},
      blocks:n===2?[{blockId:'fictional-invalid',type:'UNKNOWN',objectIds:[],evidenceIds:[]}]:[],interactions:[]};
    return response({output_text:JSON.stringify(output)});
  }});
  const packet={packet_hash:hash('fictional-packet'),session_id:'fictional-session',provider_understanding:{}};
  const current={ok:true,publication:{publication_hash:hash('fictional-publication'),publication_version:1},view_model:{}};
  const loaded={scope:scopes[0],identity:{synthetic_only:true},controller:{current:()=>current,wholeUnderstandingPacket:()=>packet}};
  const result=await fixture.boundary.generateGu({event:'COACHING_MOMENT',loaded,keys:{scope_hash:scopeFingerprint(scopes[0])},
    currentExchange:{customer_message:'fictional customer exchange',coach_message:'fictional coach exchange'}});
  assert.equal(result.ok,true);assert.equal(result.receipt.attempts,2);assert.equal(fixture.calls(),3);
  const attempts=fixture.redis.state().attempts;assert.deepEqual(attempts.map(a=>a.stage),['GU','GU','GU']);
  assert.equal(attempts[0].held_micro_usd,attempts[0].reserved_micro_usd);
  assert.equal(attempts[1].held_micro_usd,attempts[1].reserved_micro_usd);
  assert.equal(attempts[2].held_micro_usd,400);
});

test('explicit function packaging includes candidate manifest and every hashed source asset',()=>{
  const config=JSON.parse(readFileSync(new URL('../vercel.json',import.meta.url),'utf8'));
  const candidate=JSON.parse(readFileSync(new URL('../api/engine/subscriptionV1/syntheticQaProviderCandidate.json',import.meta.url),'utf8'));
  const includes=config.functions['api/internal/subscription-v1-runtime.js'].includeFiles;
  assert.equal(includes,EXPECTED_RUNTIME_INCLUDE_GLOB);
  assert.ok(Buffer.byteLength(includes)<=256);
  assert.equal(includes.includes('api/**'),false);
  assert.equal(includes.includes('src/lib/**'),false);
  assert.ok(runtimeIncludeGlobCovers('api/engine/subscriptionV1/syntheticQaProviderCandidate.json'));
  for(const file of candidate.files.filter(file=>isFileLoadedRuntimeAsset(file.path))) {
    assert.ok(runtimeIncludeGlobCovers(file.path),file.path);
  }
});

test('candidate custody preserves the sealed Subscription config while permitting unrelated additive function entries',()=>{
  const root=process.cwd();
  const sealedConfig=JSON.parse(readFileSync(resolve(root,CONFIG_SNAPSHOT_PATH),'utf8'));
  const currentConfig=JSON.parse(readFileSync(resolve(root,'vercel.json'),'utf8'));
  assert.equal(currentConfig.buildCommand,sealedConfig.buildCommand);
  assert.equal(currentConfig.outputDirectory,sealedConfig.outputDirectory);
  assert.equal(currentConfig.framework,sealedConfig.framework);
  assert.deepEqual(currentConfig.rewrites,sealedConfig.rewrites);
  for(const [path,config] of Object.entries(sealedConfig.functions))assert.deepEqual(currentConfig.functions[path],config,path);
  const candidate=JSON.parse(readFileSync(resolve(root,'api/engine/subscriptionV1/syntheticQaProviderCandidate.json'),'utf8'));
  assert.equal(candidate.contract,'SYNTHETIC_QA_PROVIDER_CANDIDATE_CLOSURE_V3');
  assert.deepEqual(candidate.closure_roots,EXPECTED_CLOSURE_ROOTS);
  assert.deepEqual(candidate.excluded_dynamic_edges,EXPECTED_EXCLUDED_DYNAMIC_EDGES);
  const expected=exactRuntimeClosure(root,EXPECTED_CLOSURE_ROOTS,EXPECTED_EXCLUDED_DYNAMIC_EDGES);
  for(const path of fileLoadedAuthorityPaths(root))expected.add(path);
  for(const path of DEPENDENCY_IDENTITY_PATHS)expected.add(path);
  expected.delete('api/engine/subscriptionV1/syntheticQaProviderCandidate.json');
  assert.deepEqual(candidate.files.map(file=>file.path).sort(),[...expected].sort());
});

test('custody executes from a copied function-package root and denies a missing included asset',()=>{
  const originalRoot=process.cwd();const bundleRoot=mkdtempSync(resolve(tmpdir(),'synthetic-qa-offline-function-'));
  const manifestPath='api/engine/subscriptionV1/syntheticQaProviderCandidate.json';
  const candidate=JSON.parse(readFileSync(resolve(originalRoot,manifestPath),'utf8'));
  const expected=syntheticQaProviderCandidateSha256();
  try {
    for(const file of [...candidate.files.map(f=>f.path),manifestPath]) {
      const destination=resolve(bundleRoot,file);mkdirSync(dirname(destination),{recursive:true});copyFileSync(resolve(originalRoot,file),destination);
    }
    process.chdir(bundleRoot);
    assert.equal(syntheticQaProviderCandidateSha256(),expected);
    const critical=['api/engine/subscriptionV1/syntheticQaRuntimeAuth.js','api/engine/subscriptionV1/paidRuntimeHandler.js',
      'api/engine/subscriptionV1/paidConversationHistory.js','api/engine/subscriptionV1/paidSubscriberCustody.js',
      'api/engine/subscriptionV1/internalDevInfrastructure.js','api/engine/subscriptionV1/paidRuntimeInfrastructure.js',
      'src/lib/subscriptionV1/freeGptV2/livingRelationshipRuntime.js','src/lib/subscriptionV1/afw04/doctrine.js',
      'api/engine/newBaProductionReadinessV1/canonicalReader.js','package-lock.json'];
    for(const path of critical){const destination=resolve(bundleRoot,path);const original=readFileSync(destination);
      writeFileSync(destination,Buffer.concat([original,Buffer.from('\nOFFLINE_TAMPER')]));
      assert.throws(()=>syntheticQaProviderCandidateSha256(),/CANDIDATE_BYTES_CHANGED/,path);
      writeFileSync(destination,original);assert.equal(syntheticQaProviderCandidateSha256(),expected);}
    const packagedConfig=resolve(bundleRoot,'vercel.json');
    const sourceConfig=readFileSync(packagedConfig);
    writeFileSync(packagedConfig,Buffer.from('{"vercel_runtime_rewrite":true}\n'));
    assert.equal(syntheticQaProviderCandidateSha256(),expected);
    writeFileSync(packagedConfig,sourceConfig);
    const snapshot=resolve(bundleRoot,CONFIG_SNAPSHOT_PATH);
    const originalSnapshot=readFileSync(snapshot);
    writeFileSync(snapshot,Buffer.from('{"tampered":true}\n'));
    assert.throws(()=>syntheticQaProviderCandidateSha256(),/CANDIDATE_BYTES_CHANGED/);
    writeFileSync(snapshot,originalSnapshot);
    assert.equal(syntheticQaProviderCandidateSha256(),expected);
    unlinkSync(resolve(bundleRoot,candidate.files[0].path));
    assert.throws(()=>syntheticQaProviderCandidateSha256(),/ENOENT|CUSTODY|BYTES_CHANGED/);
  } finally {process.chdir(originalRoot);rmSync(bundleRoot,{recursive:true,force:true});}
});

test('a prior signed grant rejects changed reachable bytes before Redis or provider access',()=>{
  const originalRoot=process.cwd();const bundleRoot=mkdtempSync(resolve(tmpdir(),'synthetic-qa-offline-prior-grant-'));
  const manifestPath='api/engine/subscriptionV1/syntheticQaProviderCandidate.json';
  const candidate=JSON.parse(readFileSync(resolve(originalRoot,manifestPath),'utf8'));const fixture=setup();
  try{for(const file of [...candidate.files.map(f=>f.path),manifestPath]){const destination=resolve(bundleRoot,file);
      mkdirSync(dirname(destination),{recursive:true});copyFileSync(resolve(originalRoot,file),destination);}
    const auth=resolve(bundleRoot,'api/engine/subscriptionV1/syntheticQaRuntimeAuth.js');
    writeFileSync(auth,Buffer.concat([readFileSync(auth),Buffer.from('\nOFFLINE_TAMPER')]));process.chdir(bundleRoot);
    assert.throws(()=>fixture.transport(),/CANDIDATE_BYTES_CHANGED/);
    assert.equal(fixture.redis.reads,0);assert.equal(fixture.redis.writes,0);assert.equal(fixture.calls(),0);assert.equal(fixture.factories(),0);
  }finally{process.chdir(originalRoot);rmSync(bundleRoot,{recursive:true,force:true});}
});

test('malformed persisted attempt schemas fail closed with no additional write or provider call',async()=>{
  const mutations=[a=>{a.wire_sha256='invalid';},a=>{a.operation_id='invalid';},a=>{a.ordinal=0;},a=>{a.stage='OTHER';},
    a=>{delete a.usage;},a=>{a.unexpected=true;},a=>{a.status='RESERVED';}];
  for(const mutate of mutations){const fixture=setup();await fixture.transport()(request('CONVERSATION','seed'),{stage:'CONVERSATION'});
    const state=fixture.redis.state();mutate(state.attempts[0]);fixture.redis.values.set(SYNTHETIC_QA_BUDGET_KEYS.ledger,canonicalJson(state));
    const writes=fixture.redis.writes,calls=fixture.calls();
    await assert.rejects(fixture.transport()(request('CONVERSATION','different'),{stage:'CONVERSATION'}),/BUDGET_CUSTODY_INVALID/);
    assert.equal(fixture.redis.writes,writes);assert.equal(fixture.calls(),calls);}
});

test('concurrent boundary instances cannot spend the live allocation twice',async()=>{
  let release;const pending=new Promise(resolve=>{release=resolve;});
  const fixture=setup({provider:async()=>{await pending;return response();}});
  const second=createSyntheticQaProviderBoundary(fixture.options);
  const firstCall=fixture.transport()(request('NATURAL_AUTHORIZATION','x'.repeat(500_000)),{stage:'NATURAL_AUTHORIZATION'});
  while(!fixture.calls()) await new Promise(resolve=>setImmediate(resolve));
  await assert.rejects(fixture.transport(1,second)(request('NATURAL_AUTHORIZATION','y'.repeat(500_000)),{stage:'NATURAL_AUTHORIZATION'}),/ALLOCATION_EXHAUSTED/);
  assert.equal(fixture.calls(),1);release();await firstCall;
});

test('missing ledger/custody never initialize or refresh an allowance',async()=>{
  for(const key of Object.values(SYNTHETIC_QA_BUDGET_KEYS)) {
    const fixture=setup();fixture.redis.values.delete(key);
    await assert.rejects(fixture.transport()(request(),{stage:'CONVERSATION'}),/PREINITIALIZED_CUSTODY_REQUIRED/);
    assert.equal(fixture.calls(),0);assert.equal(fixture.redis.writes,0);
  }
});

test('deadline and durable custody are rechecked after reservation before client acquisition',async()=>{
  for(const mode of ['deadline','custody']) {
    const fixture=setup();let clock=NOW;const original=fixture.redis.eval.bind(fixture.redis);
    fixture.redis.eval=async(...args)=>{const result=await original(...args);if(fixture.redis.writes===1) {
      if(mode==='deadline')clock=Date.parse(fixture.grant.deadline);else fixture.redis.values.delete(SYNTHETIC_QA_BUDGET_KEYS.custody);
    }return result;};
    const boundary=createSyntheticQaProviderBoundary({...fixture.options,now:()=>clock});
    await assert.rejects(fixture.transport(0,boundary)(request(),{stage:'CONVERSATION'}));
    assert.equal(fixture.calls(),0);assert.equal(fixture.factories(),0);
    const attempt=fixture.redis.state().attempts[0];assert.equal(attempt.held_micro_usd,attempt.reserved_micro_usd);
  }
});

test('timeout, malformed output, missing usage, incomplete response and hosted-tool output retain full reservation with no reroll',async()=>{
  const providers=[async()=>{throw Object.assign(new Error('fake timeout'),{status:429});},async()=>response({output_text:'invalid JSON'}),
    async()=>response({usage:undefined}),async()=>response({status:'incomplete'}),async()=>response({output:[{type:'web_search_call'}]})];
  for(const provider of providers) {
    const fixture=setup({provider});await assert.rejects(fixture.transport()(request(),{stage:'CONVERSATION'}));
    assert.equal(fixture.calls(),1);const state=fixture.redis.state();assert.equal(state.attempts[0].failure_preserved,true);
    assert.equal(state.attempts[0].held_micro_usd,state.attempts[0].reserved_micro_usd);
    const restarted=createSyntheticQaProviderBoundary(fixture.options);
    await assert.rejects(fixture.transport(0,restarted)(request(),{stage:'CONVERSATION'}),/REPLAY_OR_REROLL/);
    assert.equal(fixture.calls(),1);
  }
});

test('restart leaves pending reservations intact and rejects identical replay',async()=>{
  let release;const pending=new Promise(resolve=>{release=resolve;});const fixture=setup({provider:async()=>{await pending;return response();}});
  const first=fixture.transport()(request(),{stage:'CONVERSATION'});
  while(!fixture.calls()) await new Promise(resolve=>setImmediate(resolve));
  const held=fixture.redis.state().attempts[0].held_micro_usd;
  const restarted=createSyntheticQaProviderBoundary(fixture.options);
  await assert.rejects(fixture.transport(0,restarted)(request(),{stage:'CONVERSATION'}),/REPLAY_OR_REROLL/);
  assert.equal(fixture.redis.state().attempts[0].held_micro_usd,held);release();await first;
});

test('web, model, output budget, background and wrong source/scope are denied',async()=>{
  for(const change of [r=>{r.tools=[{type:'web_search'}];},r=>{r.model='other';},r=>{r.max_output_tokens=100;},r=>{r.background=true;}]) {
    const fixture=setup();const wire=request();change(wire);await assert.rejects(fixture.transport()(wire,{stage:'CONVERSATION'}));assert.equal(fixture.calls(),0);
  }
  const fixture=setup();assert.throws(()=>fixture.boundary.createTransport({scope:scopes[0],projection:{synthetic_only:true,doctrine_vertical_id:'REAL_ESTATE'},sourceLibrary:source(2)}),/SOURCE_SCOPE/);
  assert.throws(()=>fixture.boundary.createTransport({scope:{...scopes[0],profile_id:'foreign-profile'},projection:{synthetic_only:true},sourceLibrary:source(0)}),/SCOPE_DENIED/);
});

test('actual route passes server env to repaired composition, all GU creates use guarded client with existing repair defaults',()=>{
  const composition=readFileSync(new URL('../api/engine/subscriptionV1/syntheticQaRuntimeComposition.js',import.meta.url),'utf8');
  const route=readFileSync(new URL('../api/internal/subscription-v1-runtime.js',import.meta.url),'utf8');
  const boundary=readFileSync(new URL('../api/engine/subscriptionV1/syntheticQaProviderBoundary.js',import.meta.url),'utf8');
  assert.match(route,/createSyntheticQaSubscriptionV1RuntimeComposition\(\{ redis, env \}\)/);
  assert.match(composition,/createSyntheticQaProviderBoundary\(\{ redis, env, winnerAcceptance \}\)/);
  assert.equal(composition.includes('renewalContinuity'),false);
  assert.match(boundary,/createSubscriptionS2OpenAiTransport\(\{ client: call.guardedClient, maxTransportRetries: 1 \}\)/);
  assert.match(boundary,/createSubscriptionS2GuRuntime\(\{ transport, maxAttempts: 2 \}\)/);
  assert.equal(boundary.includes('process.env'),false);
});

test('test process is network denied',async()=>{assert.throws(()=>fetch('https://example.com'),/OFFLINE_NETWORK_DENIED/);});


const RENEWAL_APPROVED_AT = '2026-09-15T21:49:52.000Z';
const RENEWAL_EXPIRES_AT = '2026-09-16T21:49:52.000Z';
const RENEWAL_NOW = Date.parse('2026-09-16T12:00:00.000Z');
const RENEWAL_ENV = 'MOREMINDMAP_SERVER_ONLY_SUBSCRIPTION_SYNTHETIC_QA_COACHING_RENEWAL';
function renewedFixture({ nowValue = RENEWAL_NOW, authorityExpiresAt = RENEWAL_EXPIRES_AT } = {}) {
  const authority = { ...entries[0], expires_at: authorityExpiresAt };
  authority.custody_sha256 = fullPersonQaCustodySha256(authority);
  const renewedManifest = parseFullPersonQaManifest(JSON.stringify([authority]));
  let continuity;
  const fixture = setup({ now: () => nowValue, mutateGrant(grant) {
    grant.contract = 'SYNTHETIC_QA_MODEL2_PROVIDER_GRANT_V2';
    grant.cohort = [{ ...grant.cohort[0], custody_sha256: authority.custody_sha256 }];
    grant.manifest_sha256 = renewedManifest.manifest_sha256;
  }, renewalContinuityForGrant(grant) {
    continuity = {
      authorizationReceiptCanonicalSha256: hash('fictional canonical renewal receipt'),
      authorizationReceiptFileSha256: hash('fictional raw renewal receipt'),
      budgetGrantSha256: syntheticQaBudgetGrantSha256(grant),
      caseyKeysetSha256: hash('fictional Casey keyset'),
      caseyPairSha256: hash('fictional Casey pair'),
      originalApprovalSha256: grant.approval_sha256,
      previousDeadline: grant.deadline,
      priorCandidateSha256: hash('fictional prior candidate'),
      priorManifestSha256: hash('fictional prior manifest'),
      priorStageGrantSha256: hash('fictional prior stage grant'),
    };
    return continuity;
  } });
  fixture.env.MOREMINDMAP_SERVER_ONLY_SUBSCRIPTION_SYNTHETIC_QA_MANIFEST = JSON.stringify([authority]);
  const renewal = {
    additional_budget: false,
    additional_budget_micro_usd: 0,
    approval_sha256: fixture.grant.approval_sha256,
    approved_at: RENEWAL_APPROVED_AT,
    authority_id: authority.authority_id,
    authorization_receipt_canonical_sha256: continuity.authorizationReceiptCanonicalSha256,
    authorization_receipt_file_sha256: continuity.authorizationReceiptFileSha256,
    budget_grant_sha256: syntheticQaBudgetGrantSha256(fixture.grant),
    budget_reset: false,
    campaign_id: SYNTHETIC_QA_CAMPAIGN,
    candidate_sha256: fixture.grant.candidate_sha256,
    case_id: 'COHORT-V1-LO-A',
    coaching_cap_micro_usd: 8_000_000,
    contract: 'SYNTHETIC_QA_CASEY_COACHING_RENEWAL_V1',
    custody_sha256: authority.custody_sha256,
    expires_at: RENEWAL_EXPIRES_AT,
    ledger_initialization_id: fixture.grant.ledger_initialization_id,
    manifest_sha256: renewedManifest.manifest_sha256,
    native_regeneration: false,
    previous_deadline: fixture.grant.deadline,
    prior_candidate_sha256: continuity.priorCandidateSha256,
    prior_casey_keyset_sha256: continuity.caseyKeysetSha256,
    prior_casey_pair_sha256: continuity.caseyPairSha256,
    prior_manifest_sha256: continuity.priorManifestSha256,
    prior_stage_grant_sha256: continuity.priorStageGrantSha256,
    provider_assignment_changed: false,
    scope_sha256: fixture.grant.cohort[0].scope_sha256,
    stage_grant_sha256: hashCanonicalJson(fixture.grant),
    status: 'APPROVED',
    total_cap_micro_usd: 20_000_000,
  };
  const signature = createHmac('sha256', FAKE_SIGNING_KEY).update(SYNTHETIC_QA_COACHING_RENEWAL_DOMAIN)
    .update('\0').update(canonicalJson(renewal)).digest('hex');
  fixture.env[RENEWAL_ENV] = JSON.stringify({ renewal, signature });
  return { ...fixture, authority, continuity, renewal };
}
function mutateAndResignRenewal(fixture, mutate) {
  const envelope = JSON.parse(fixture.env[RENEWAL_ENV]);
  mutate(envelope.renewal);
  envelope.signature = createHmac('sha256', FAKE_SIGNING_KEY).update(SYNTHETIC_QA_COACHING_RENEWAL_DOMAIN)
    .update('\0').update(canonicalJson(envelope.renewal)).digest('hex');
  fixture.env[RENEWAL_ENV] = JSON.stringify(envelope);
}

const SECOND_RENEWAL_APPROVED_AT = '2026-09-16T22:59:44.502Z';
const SECOND_RENEWAL_EXPIRES_AT = '2026-09-17T22:59:44.000Z';
const SECOND_RENEWAL_ENV = 'MOREMINDMAP_SERVER_ONLY_SUBSCRIPTION_SYNTHETIC_QA_COACHING_RENEWAL_V2';
function secondRenewedFixture({ nowValue = Date.parse('2026-09-17T12:00:00.000Z') } = {}) {
  const fixture = renewedFixture({ nowValue, authorityExpiresAt: SECOND_RENEWAL_EXPIRES_AT });
  mutateAndResignRenewal(fixture, prior => {
    prior.stage_grant_sha256 = '2b2e867c6003a3732630e85a09f169d7809a4318271f461788f2ac66444c19e2';
    prior.candidate_sha256 = 'c994624fabd9f048df9525e17b052212609b7b5207848d89de05827e658525d9';
  });
  const prior = JSON.parse(fixture.env[RENEWAL_ENV]).renewal;
  const renewal = {
    ...prior,
    approved_at: SECOND_RENEWAL_APPROVED_AT,
    authorization_receipt_canonical_sha256: '9f15080df57c963eb5cb24fc5f9eae6b28716d151cab475db7005012aa5f2406',
    authorization_receipt_file_sha256: 'a3e1918761116d6b261eede363bf9af6a8f9f5bf30ef2b6b78cf54fd1639bb19',
    candidate_sha256: fixture.grant.candidate_sha256,
    contract: 'SYNTHETIC_QA_CASEY_COACHING_RENEWAL_V2',
    expires_at: SECOND_RENEWAL_EXPIRES_AT,
    prior_candidate_sha256: prior.candidate_sha256,
    prior_effective_deadline: prior.expires_at,
    prior_manifest_sha256: prior.manifest_sha256,
    prior_renewal_sha256: hashCanonicalJson(prior),
    prior_stage_grant_sha256: prior.stage_grant_sha256,
    stage_grant_sha256: hashCanonicalJson(fixture.grant),
  };
  const signature = createHmac('sha256', FAKE_SIGNING_KEY).update(SYNTHETIC_QA_COACHING_SECOND_RENEWAL_DOMAIN)
    .update('\0').update(canonicalJson(renewal)).digest('hex');
  fixture.env[SECOND_RENEWAL_ENV] = JSON.stringify({ renewal, signature });
  return { ...fixture, secondRenewal: renewal };
}

test('second signed Casey renewal carries the same budget ledger and allows only the renewed window', async () => {
  const fixture = secondRenewedFixture();
  const before = fixture.redis.state();
  assert.equal(before.attempts.length, 0);
  assert.equal(fixture.secondRenewal.additional_budget, false);
  assert.equal(fixture.secondRenewal.budget_reset, false);
  assert.equal(fixture.secondRenewal.native_regeneration, false);
  assert.equal(fixture.secondRenewal.provider_assignment_changed, false);
  await fixture.transport()(request('CONVERSATION', 'second renewal Casey coaching'), { stage: 'CONVERSATION' });
  assert.equal(fixture.calls(), 1);
  assert.equal(fixture.redis.state().attempts[0].case_id, 'COHORT-V1-LO-A');
  assert.equal(fixture.redis.state().grant_sha256, before.grant_sha256);
  const expired = secondRenewedFixture({ nowValue: Date.parse(SECOND_RENEWAL_EXPIRES_AT) });
  assert.throws(() => expired.transport(), /BUDGET_NOT_AUTHORIZED/);
  assert.equal(expired.redis.reads, 0); assert.equal(expired.calls(), 0);
});

test('second renewal rejects missing, malformed, unsigned, drifted or non-continuous control before Redis/provider', () => {
  for (const mutate of [
    fixture => { delete fixture.env[SECOND_RENEWAL_ENV]; },
    fixture => { fixture.env[SECOND_RENEWAL_ENV] = '{}'; },
    fixture => { fixture.env[RENEWAL_ENV] = '{}'; },
    fixture => { const value = JSON.parse(fixture.env[SECOND_RENEWAL_ENV]); value.signature = hash('wrong'); fixture.env[SECOND_RENEWAL_ENV] = JSON.stringify(value); },
    fixture => { const value = JSON.parse(fixture.env[SECOND_RENEWAL_ENV]); value.renewal.prior_renewal_sha256 = hash('wrong'); fixture.env[SECOND_RENEWAL_ENV] = JSON.stringify(value); },
    fixture => { const value = JSON.parse(fixture.env[SECOND_RENEWAL_ENV]); value.renewal.additional_budget = true; fixture.env[SECOND_RENEWAL_ENV] = JSON.stringify(value); },
  ]) {
    const fixture = secondRenewedFixture(); mutate(fixture);
    assert.throws(() => fixture.transport(), /BUDGET_NOT_AUTHORIZED/);
    assert.equal(fixture.redis.reads, 0); assert.equal(fixture.redis.writes, 0);
    assert.equal(fixture.calls(), 0); assert.equal(fixture.factories(), 0);
  }
});

test('signed Casey renewal extends only the effective coaching window and preserves base budget/native identity', async () => {
  const fixture = renewedFixture();
  assert.equal(fixture.grant.deadline, nativeFixture().deadlineUtc);
  assert.equal(fixture.renewal.budget_grant_sha256, syntheticQaBudgetGrantSha256(fixture.grant));
  assert.equal(fixture.renewal.approval_sha256, hash(fixture.env.MOREMINDMAP_SERVER_ONLY_SUBSCRIPTION_SYNTHETIC_QA_NATIVE_APPROVED_EXECUTION));
  assert.equal(fixture.renewal.additional_budget, false);
  assert.equal(fixture.renewal.budget_reset, false);
  assert.equal(fixture.renewal.native_regeneration, false);
  assert.equal(fixture.renewal.provider_assignment_changed, false);
  await fixture.transport()(request('CONVERSATION', 'renewed Casey coaching'), { stage: 'CONVERSATION' });
  assert.equal(fixture.calls(), 1);
  assert.equal(fixture.redis.state().attempts[0].case_id, 'COHORT-V1-LO-A');
});

test('runtime default pins the exact carried allowance and both renewal receipt digests before Redis', () => {
  assert.deepEqual(SYNTHETIC_QA_RENEWAL_CONTINUITY, {
    authorizationReceiptCanonicalSha256: 'e7c17053ff3d7c927de68c81a24ab7fe19957f83d92cca4a1fe2347b184e6912',
    authorizationReceiptFileSha256: '69585b12685bf61d1e59beb96dbbd0eb6b8febfc69feeffcc048b13fd775e31a',
    budgetGrantSha256: 'acbb68bba4bd4fd8a6a02ac04abc7b55ec7d3ba90dc64b2b792d51651cdce36a',
    caseyKeysetSha256: 'ef55a9808616d0fd89df68fe4cb282cdde3339ba5af3f739a1d2c56473c098e0',
    caseyPairSha256: '521a4d05fb0e70483e68fedaee461501e37d7bbc7200a51ffdceeec351d81f1b',
    originalApprovalSha256: '248e70e0806420be62eb9f167e8899de2431c71db533c0d24fd14daea2d30b42',
    previousDeadline: '2026-09-15T21:37:44.954Z',
    priorCandidateSha256: 'd70ad658ea29ceed9aa752dd398bbd2d8a535757b94b1ed786c51374cde3ac81',
    priorManifestSha256: '2100eda676edb07a695762d7a0cfc9b4b5d548eb3cb258b88fa9d9c32385096a',
    priorStageGrantSha256: 'd850eaed97e59d046b416971374b66e221e7a3b3607fec5f3d1854a5a37fad72',
  });
  assert.equal(Object.entries(SYNTHETIC_QA_RENEWAL_CONTINUITY)
    .filter(([key]) => key !== 'previousDeadline')
    .every(([, value]) => /^[a-f0-9]{64}$/u.test(value)), true);
  const fixture = renewedFixture();
  const strict = createSyntheticQaProviderBoundary({ ...fixture.options,
    renewalContinuity: SYNTHETIC_QA_RENEWAL_CONTINUITY });
  assert.throws(() => fixture.transport(0, strict), /BUDGET_NOT_AUTHORIZED/);
  assert.equal(fixture.redis.reads, 0); assert.equal(fixture.calls(), 0); assert.equal(fixture.factories(), 0);
});

test('renewal absent, malformed, unsigned, drifted, early, expired, or longer than Casey authority denies before Redis/provider', () => {
  const mutations = [
    renewal => { renewal.case_id = 'COHORT-V1-LO-B'; },
    renewal => { renewal.scope_sha256 = hash('wrong scope'); },
    renewal => { renewal.authority_id = 'synthetic_qa_authority_wrong000000'; },
    renewal => { renewal.custody_sha256 = hash('wrong custody'); },
    renewal => { renewal.prior_stage_grant_sha256 = hash('wrong prior'); },
    renewal => { renewal.prior_candidate_sha256 = hash('wrong prior candidate'); },
    renewal => { renewal.prior_manifest_sha256 = hash('wrong prior manifest'); },
    renewal => { renewal.prior_casey_pair_sha256 = hash('wrong pair'); },
    renewal => { renewal.prior_casey_keyset_sha256 = hash('wrong keyset'); },
    renewal => { renewal.stage_grant_sha256 = hash('wrong stage'); },
    renewal => { renewal.budget_grant_sha256 = hash('wrong budget'); },
    renewal => { renewal.approval_sha256 = hash('wrong approval'); },
    renewal => { renewal.ledger_initialization_id = '00000000-0000-4000-8000-000000000099'; },
    renewal => { renewal.previous_deadline = '2026-09-15T21:37:44.953Z'; },
    renewal => { renewal.manifest_sha256 = hash('wrong manifest'); },
    renewal => { renewal.candidate_sha256 = hash('wrong candidate'); },
    renewal => { renewal.authorization_receipt_file_sha256 = hash('wrong raw receipt'); },
    renewal => { renewal.authorization_receipt_canonical_sha256 = hash('wrong canonical receipt'); },
    renewal => { renewal.coaching_cap_micro_usd = 8_000_001; },
    renewal => { renewal.additional_budget = true; },
    renewal => { renewal.additional_budget_micro_usd = 1; },
    renewal => { renewal.budget_reset = true; },
    renewal => { renewal.native_regeneration = true; },
    renewal => { renewal.provider_assignment_changed = true; },
    renewal => { renewal.unreviewed = true; },
  ];
  for (const mutate of mutations) {
    const fixture = renewedFixture(); mutateAndResignRenewal(fixture, mutate);
    assert.throws(() => fixture.transport(), /BUDGET_NOT_AUTHORIZED/);
    assert.equal(fixture.redis.reads, 0); assert.equal(fixture.calls(), 0); assert.equal(fixture.factories(), 0);
  }
  for (const prepare of [
    fixture => { delete fixture.env[RENEWAL_ENV]; },
    fixture => { fixture.env[RENEWAL_ENV] = '{}'; },
    fixture => { const value = JSON.parse(fixture.env[RENEWAL_ENV]); value.signature = hash('unsigned'); fixture.env[RENEWAL_ENV] = JSON.stringify(value); },
    fixture => { const value = JSON.parse(fixture.env[RENEWAL_ENV]); value.signature = createHmac('sha256', FAKE_SIGNING_KEY)
      .update('wrong-renewal-domain').update('\0').update(canonicalJson(value.renewal)).digest('hex');
    fixture.env[RENEWAL_ENV] = JSON.stringify(value); },
  ]) {
    const fixture = renewedFixture(); prepare(fixture);
    assert.throws(() => fixture.transport(), /BUDGET_NOT_AUTHORIZED/);
    assert.equal(fixture.redis.reads, 0); assert.equal(fixture.calls(), 0); assert.equal(fixture.factories(), 0);
  }
  for (const nowValue of [Date.parse('2026-09-15T21:49:51.999Z'), Date.parse(RENEWAL_EXPIRES_AT)]) {
    const fixture = renewedFixture({ nowValue });
    assert.throws(() => fixture.transport(), /BUDGET_NOT_AUTHORIZED/);
    assert.equal(fixture.redis.reads, 0); assert.equal(fixture.calls(), 0); assert.equal(fixture.factories(), 0);
  }
  const shortAuthority = renewedFixture({ authorityExpiresAt: '2026-09-16T20:00:00.000Z' });
  assert.throws(() => shortAuthority.transport(), /BUDGET_NOT_AUTHORIZED/);
  assert.equal(shortAuthority.redis.reads, 0); assert.equal(shortAuthority.calls(), 0); assert.equal(shortAuthority.factories(), 0);
});

test('original pre-expiry staged behavior remains valid without a renewal control', async () => {
  const fixture = stagedFixture([0]);
  assert.equal(Object.hasOwn(fixture.env, RENEWAL_ENV), false);
  await fixture.transport()(request('CONVERSATION', 'original pre-expiry path'), { stage: 'CONVERSATION' });
  assert.equal(fixture.calls(), 1);
});

test('renewal is revalidated after reservation and revocation prevents provider creation', async () => {
  const fixture = renewedFixture();
  const original = fixture.redis.eval.bind(fixture.redis);
  fixture.redis.eval = async (...args) => {
    const saved = await original(...args);
    if (fixture.redis.writes === 1) delete fixture.env[RENEWAL_ENV];
    return saved;
  };
  await assert.rejects(fixture.transport()(request('CONVERSATION', 'revalidate renewed authority'), { stage: 'CONVERSATION' }),
    /BUDGET_NOT_AUTHORIZED/);
  assert.equal(fixture.calls(), 0); assert.equal(fixture.factories(), 0);
  const attempt = fixture.redis.state().attempts[0];
  assert.equal(attempt.status, 'UNRESOLVED'); assert.equal(attempt.held_micro_usd, attempt.reserved_micro_usd);
});

test('renewal activation changes only active custody and preserves exact ledger bytes and remaining allowance', async () => {
  const first = stagedFixture([0]);
  await first.transport()(request('CONVERSATION', 'settled before renewal'), { stage: 'CONVERSATION' });
  const oldBudget = stagedBudget(first);
  const pending = await oldBudget.reserve({ requestSha256: hash('pending before renewal'),
    operationId: '00000000-0000-4000-8000-000000000071', ordinal: 1,
    caseId: cases[0], stage: 'GU', reservedMicroUsd: 1_000_000 });
  const unresolved = await oldBudget.reserve({ requestSha256: hash('unresolved before renewal'),
    operationId: '00000000-0000-4000-8000-000000000072', ordinal: 1,
    caseId: cases[0], stage: 'GU', reservedMicroUsd: 2_000_000 });
  await oldBudget.retain([unresolved]);
  const rawBefore = first.redis.values.get(SYNTHETIC_QA_BUDGET_KEYS.ledger);
  const attemptsBefore = structuredClone(first.redis.state().attempts);
  const renewed = renewedFixture();
  assert.equal(syntheticQaBudgetGrantSha256(renewed.grant), syntheticQaBudgetGrantSha256(first.grant));
  assert.notEqual(hashCanonicalJson(renewed.grant), hashCanonicalJson(first.grant));
  reviewedMemoryStage(first, renewed);
  assert.equal(first.redis.values.get(SYNTHETIC_QA_BUDGET_KEYS.ledger), rawBefore);
  await assert.rejects(first.transport()(request('CONVERSATION', 'old stage after renewal'), { stage: 'CONVERSATION' }),
    /PREINITIALIZED_CUSTODY_REQUIRED/);
  await assert.rejects(oldBudget.confirm(pending), /PREINITIALIZED_CUSTODY_REQUIRED/);
  await renewed.transport(0, renewed.boundary)(request('CONVERSATION', 'renewed stage'), { stage: 'CONVERSATION' });
  assert.deepEqual(first.redis.state().attempts.slice(0, attemptsBefore.length), attemptsBefore);
  assert.equal(first.redis.state().attempts.at(-1).stage_grant_sha256, hashCanonicalJson(renewed.grant));
  assert.equal(first.redis.state().attempts.reduce((sum, attempt) => sum + attempt.held_micro_usd, 0) <= 8_000_000, true);
});


// Fictional grants and custody transitions below exist only inside MemoryRedis.
function stagedFixture(indexes, options = {}) {
  const fixture = setup({ ...options, mutateGrant(grant) {
    grant.contract = 'SYNTHETIC_QA_MODEL2_PROVIDER_GRANT_V2';
    grant.cohort = grant.cohort.filter(entry => indexes.includes(cases.indexOf(entry.case_id)));
    grant.manifest_sha256 = parseFullPersonQaManifest(JSON.stringify(indexes.map(i => entries[i]))).manifest_sha256;
    options.mutateGrant?.(grant);
  } });
  fixture.env.MOREMINDMAP_SERVER_ONLY_SUBSCRIPTION_SYNTHETIC_QA_MANIFEST = JSON.stringify(indexes.map(i => entries[i]));
  return fixture;
}
function stagedBudget(fixture, grant = fixture.grant) {
  return createSyntheticQaProviderBudget({ redis: fixture.redis, grant, grantSha256: hashCanonicalJson(grant) });
}
function reviewedMemoryStage(fixture, next) {
  // Simulate the future reviewed custody-only CAS. Production has no transition,
  // initializer or reset operation; this must not touch ledger bytes.
  const before = fixture.redis.values.get(SYNTHETIC_QA_BUDGET_KEYS.ledger);
  fixture.redis.values.set(SYNTHETIC_QA_BUDGET_KEYS.custody,
    canonicalJson(syntheticQaBudgetCustody(syntheticQaBudgetGrantSha256(next.grant), next.grant)));
  assert.equal(fixture.redis.values.get(SYNTHETIC_QA_BUDGET_KEYS.ledger), before);
  next.redis.values = fixture.redis.values;
  next.options.redis = fixture.redis;
  next.boundary = createSyntheticQaProviderBoundary(next.options);
  return next;
}

test('V2 allows each complete reviewed subset, with omitted and unknown cases denied before provider or ledger', async () => {
  for (const indexes of [[0], [2], [0, 1], [0, 2, 3], [0, 1, 2, 3]]) {
    const fixture = stagedFixture(indexes);
    for (let i = 0; i < cases.length; i += 1) {
      if (indexes.includes(i)) await fixture.transport(i)(request('CONVERSATION', `subset ${indexes} ${i}`), { stage: 'CONVERSATION' });
      else {
        const reads = fixture.redis.reads;
        assert.throws(() => fixture.transport(i), /SCOPE_DENIED/);
        assert.equal(fixture.redis.reads, reads);
      }
    }
    assert.equal(fixture.calls(), indexes.length);
  }
  const fixture = stagedFixture([0], { mutateGrant: grant => { grant.cohort[0].case_id = 'COHORT-V1-LO-C'; } });
  assert.throws(() => fixture.transport(), /BUDGET_NOT_AUTHORIZED/);
  assert.equal(fixture.calls(), 0); assert.equal(fixture.redis.reads, 0);
});

test('V2 cannot expand access by grant alone, omit a reviewed active manifest row, or substitute same-vertical scope', () => {
  const expanded = stagedFixture([0], { mutateGrant: grant => { grant.cohort.push(grantFixture().cohort[1]); } });
  assert.throws(() => expanded.transport(), /BUDGET_NOT_AUTHORIZED/);
  const mismatched = stagedFixture([0]);
  mismatched.env.MOREMINDMAP_SERVER_ONLY_SUBSCRIPTION_SYNTHETIC_QA_MANIFEST = JSON.stringify(entries.slice(0, 2));
  assert.throws(() => mismatched.transport(), /BUDGET_NOT_AUTHORIZED/);
  const swapped = stagedFixture([0], { mutateGrant: grant => { grant.cohort[0].scope_sha256 = scopeFingerprint(scopes[1]); } });
  assert.throws(() => swapped.transport(1), /PROFILE_CASE_MISMATCH/);
  for (const fixture of [expanded, mismatched, swapped]) {
    assert.equal(fixture.calls(), 0); assert.equal(fixture.redis.reads, 0);
  }
});

test('V2 stages preserve settled, pending and unresolved history across growth, omission and restart; old stage cannot reserve', async () => {
  const first = stagedFixture([0]);
  await first.transport()(request('CONVERSATION', 'first completed stage'), { stage: 'CONVERSATION' });
  const budget = stagedBudget(first);
  const pending = await budget.reserve({ requestSha256: hash('pending old stage'), operationId: '00000000-0000-4000-8000-000000000004', ordinal: 1,
    caseId: cases[0], stage: 'GU', reservedMicroUsd: 1_000_000 });
  const unresolved = await budget.reserve({ requestSha256: hash('unresolved old stage'), operationId: '00000000-0000-4000-8000-000000000005', ordinal: 1,
    caseId: cases[0], stage: 'GU', reservedMicroUsd: 2_000_000 });
  await budget.retain([unresolved]);
  const prior = structuredClone(first.redis.state().attempts);
  const expanded = stagedFixture([0, 1]);
  assert.equal(syntheticQaBudgetGrantSha256(expanded.grant), syntheticQaBudgetGrantSha256(first.grant));
  // Deploying only a changed signed grant does not activate a stage.
  await assert.rejects(createSyntheticQaProviderBoundary({ ...expanded.options, redis: first.redis }).createTransport({
    scope: scopes[1], projection: { synthetic_only: true, doctrine_vertical_id: 'LOAN_ORIGINATOR' }, sourceLibrary: source(1),
  })(request(), { stage: 'CONVERSATION' }), /PREINITIALIZED_CUSTODY_REQUIRED/);
  reviewedMemoryStage(first, expanded);
  await expanded.transport(1, expanded.boundary)(request('CONVERSATION', 'expanded second case'), { stage: 'CONVERSATION' });
  assert.deepEqual(first.redis.state().attempts.slice(0, 3), prior);
  const omitted = stagedFixture([1]); reviewedMemoryStage(first, omitted);
  const restarted = createSyntheticQaProviderBoundary({ ...omitted.options, redis: first.redis });
  assert.throws(() => omitted.transport(0, restarted), /SCOPE_DENIED/);
  await assert.rejects(first.transport()(request('CONVERSATION', 'old deployment'), { stage: 'CONVERSATION' }), /PREINITIALIZED_CUSTODY_REQUIRED/);
  await assert.rejects(budget.confirm(pending), /PREINITIALIZED_CUSTODY_REQUIRED/);
  // The current stage may preserve a prior in-flight failure; it cannot drop it.
  await createSyntheticQaProviderBudget({ redis: first.redis, grant: omitted.grant, grantSha256: hashCanonicalJson(omitted.grant) }).retain([pending]);
  assert.equal(first.redis.state().attempts[1].held_micro_usd, 1_000_000);
  assert.equal(first.redis.state().attempts[2].held_micro_usd, 2_000_000);
  assert.equal(first.redis.state().attempts[0].stage_grant_sha256, hashCanonicalJson(first.grant));
  assert.equal(first.redis.state().grant_sha256, syntheticQaBudgetGrantSha256(first.grant));
  assert.equal(first.redis.state().initialization_id, first.grant.ledger_initialization_id);
});

test('V2 cap is the same eight-dollar coaching partition after stage change and concurrent reservations', async () => {
  const first = stagedFixture([0]);
  const reserve = (budget, index, caseId) => budget.reserve({ requestSha256: hash(`cap ${index}`),
    operationId: `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`, ordinal: 1, caseId, stage: 'GU', reservedMicroUsd: 1_000_000 });
  const old = stagedBudget(first);
  for (let i = 1; i <= 5; i += 1) await old.retain([await reserve(old, i, cases[0])]);
  const next = stagedFixture([1]); reviewedMemoryStage(first, next);
  const budget = createSyntheticQaProviderBudget({ redis: first.redis, grant: next.grant, grantSha256: hashCanonicalJson(next.grant) });
  const results = await Promise.allSettled(Array.from({ length: 7 }, (_, i) => reserve(budget, i + 6, cases[1])));
  assert.equal(results.filter(result => result.status === 'fulfilled').length, 3);
  assert.equal(first.redis.state().attempts.reduce((sum, attempt) => sum + attempt.held_micro_usd, 0), 8_000_000);
  assert.deepEqual(SYNTHETIC_QA_ALLOCATION, { total_micro_usd: 20_000_000, native_generation_micro_usd: 12_000_000, live_coaching_micro_usd: 8_000_000 });
  assert.equal(SYNTHETIC_QA_BUDGET_KEYS.ledger, 'more:subscription:synthetic-qa:provider-budget:live-four-synthetics-generation-v1:ledger');
  await assert.rejects(reserve(budget, 30, cases[0]), /RESERVATION_SCHEMA_INVALID/);
});

test('V2 changed financial identity, missing ledger, and existing V1 ledger fail without migration or reset', async () => {
  for (const mutate of [grant => { grant.ledger_initialization_id = '00000000-0000-4000-8000-000000000099'; },
    grant => { grant.starts_at = '2026-09-14T11:01:00.000Z'; }, grant => { grant.native_execution_files_sha256 = hash('different native files'); }]) {
    const first = stagedFixture([0]), next = stagedFixture([0], { mutateGrant: mutate });
    assert.notEqual(syntheticQaBudgetGrantSha256(next.grant), syntheticQaBudgetGrantSha256(first.grant));
    reviewedMemoryStage(first, next); // Even a custody-only change cannot reinterpret prior ledger dollars.
    await assert.rejects(stagedBudget({ ...next, redis: first.redis }).confirm('missing'), /BUDGET_CUSTODY_INVALID/);
  }
  const fixture = stagedFixture([0]); fixture.redis.values.delete(SYNTHETIC_QA_BUDGET_KEYS.ledger);
  await assert.rejects(fixture.transport()(request(), { stage: 'CONVERSATION' }), /PREINITIALIZED_CUSTODY_REQUIRED/);
  assert.equal(fixture.redis.writes, 0);
  const v1 = setup(), v2 = stagedFixture([0]); reviewedMemoryStage(v1, v2);
  await assert.rejects(v2.transport(0, v2.boundary)(request(), { stage: 'CONVERSATION' }), /BUDGET_CUSTODY_INVALID/);
  assert.equal(v1.redis.writes, 0);
});


test('V2 stage revocation between reserve and confirm prevents provider creation and retains the pending hold', async () => {
  const fixture = stagedFixture([0]), next = stagedFixture([1]);
  const original = fixture.redis.eval.bind(fixture.redis);
  fixture.redis.eval = async (...args) => {
    const saved = await original(...args);
    if (fixture.redis.writes === 1) reviewedMemoryStage(fixture, next);
    return saved;
  };
  await assert.rejects(fixture.transport()(request('CONVERSATION', 'stage transition before dispatch'), { stage: 'CONVERSATION' }),
    /PREINITIALIZED_CUSTODY_REQUIRED/);
  assert.equal(fixture.calls(), 0); assert.equal(fixture.factories(), 0);
  const attempt = fixture.redis.state().attempts[0];
  assert.equal(attempt.status, 'RESERVED'); assert.equal(attempt.held_micro_usd, attempt.reserved_micro_usd);
  assert.equal(attempt.stage_grant_sha256, hashCanonicalJson(fixture.grant));
});
