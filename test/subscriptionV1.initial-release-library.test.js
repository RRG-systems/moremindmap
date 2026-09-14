import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { createHash } from 'node:crypto';
import { createSubscriptionLiveDemoOpenAiTransport } from '../api/engine/subscriptionV1/liveDemoOpenAiTransport.js';
import { pinnedSubscriptionSources } from '../api/engine/subscriptionV1/pinnedSources.js';
import { MORE_SOURCE_TOOLS } from '../api/engine/subscriptionV1/readOnlySources.js';
import { createFrontierConversationSeamV2 } from '../src/lib/subscriptionV1/freeGptV2/providerSeams.js';
import { createSyntheticLivingRelationshipLab } from '../src/lab/subscriptionLivingBusinessRelationshipV1/createSyntheticLivingRelationshipLab.js';
import { buildSubscriptionS2GuWorld, subscriptionS2CustomerText } from '../src/lib/subscriptionS2/guContract.js';
import { scopeFingerprint } from '../src/lib/subscriptionV1/contracts.js';
import { appendDiagnostics } from '../api/engine/subscriptionV1/internalDevInfrastructure.js';
import { redactPaidRuntimePayload } from '../api/engine/subscriptionV1/paidRuntimeHandler.js';
const copy=x=>JSON.parse(JSON.stringify(x));
const response=(output,n)=>({id:`offline-release-${n}`,status:'completed',output,usage:{input_tokens:120,output_tokens:25,input_tokens_details:{cached_tokens:0}}});
const final=(message,n)=>response([{type:'message',role:'assistant',content:[{type:'output_text',text:JSON.stringify({customer_message:message}),annotations:[]}]}],n);
const call=(name,args,n)=>response([{type:'reasoning',id:`opaque-${n}`,summary:[],encrypted_content:`offline-opaque-${n}`},{type:'function_call',call_id:`call-${n}`,name,arguments:JSON.stringify(args),status:'completed'}],n);
const request=()=>({model:'gpt-5.6-sol',reasoning:{effort:'xhigh'},store:false,background:false,max_output_tokens:2000,tools:[],text:{format:{type:'json_schema',name:'offline',strict:true,schema:{type:'object'}}},input:[{role:'user',content:'Use MORE references to help think about relationship choices. Keep the work uncommitted.'}]});
const EXPECTED_RUNTIME_INCLUDE_GLOB = '{api/engine/subscriptionV1/{syntheticQaProviderCandidate.json,sourceLibrary/**},docs/{ba-intelligence-authority-library-v1/**,lo-cassette-2-final-canonical-authority-v1/{0[2-9]_*,1?_*,2[0-4]_*,SOURCE*}},package*.json,vercel.json}';
const runtimeIncludeGlobCovers = path => path === 'api/engine/subscriptionV1/syntheticQaProviderCandidate.json'
  || path.startsWith('api/engine/subscriptionV1/sourceLibrary/')
  || path.startsWith('docs/ba-intelligence-authority-library-v1/')
  || /^docs\/lo-cassette-2-final-canonical-authority-v1\/(?:0[2-9]_|1._|2[0-4]_|SOURCE)/u.test(path)
  || /^package.*\.json$/u.test(path)
  || path === 'vercel.json';
const isFileLoadedRuntimeAsset = path => path.startsWith('api/engine/subscriptionV1/sourceLibrary/')
  || path.startsWith('docs/ba-intelligence-authority-library-v1/')
  || path.startsWith('docs/lo-cassette-2-final-canonical-authority-v1/')
  || /^package.*\.json$/u.test(path)
  || path === 'vercel.json';

test('ordinary seam executes pinned search/read/final with no web and retains private source custody',async()=>{
  const library=pinnedSubscriptionSources();assert.equal(library.info.status,'AVAILABLE');assert.equal(library.info.document_count,17);
  const args={query:'repeat referral relationship thoughtful choice',namespace:null};const found=library.execute('more_source_search',args);const chosen=found.results[0];
  const readArgs={source_id:chosen.source_id,version:chosen.version,document_sha256:chosen.document_sha256,start_line:chosen.start_line,line_count:18};
  const queue=[call('more_source_search',args,1),call('more_source_read',readArgs,2),final(`This is exploration, not a new commitment. Source: ${chosen.citation}. What makes this relationship important?`,3)];const wires=[];
  const transport=createSubscriptionLiveDemoOpenAiTransport({apiKey:'offline-only',sourceLibrary:library,maxTransportRetries:0,client:{responses:{create:async wire=>{wires.push(copy(wire));assert.ok(queue.length);return queue.shift();}}}});
  const lab=await createSyntheticLivingRelationshipLab({subject_key:'re-mid',seed_weekly_fixture:false});
  const seam=createFrontierConversationSeamV2({transport,enabled:true,web_search_enabled:false});
  const before=copy(lab.controller.current());
  const result=await seam.coach({packet:lab.controller.wholeUnderstandingPacket(),customer_message:'Help me think; do not add a commitment.'});
  assert.equal(result.ok,true,result.code);assert.equal(wires.length,3);
  for(const wire of wires){assert.equal(wire.tools.some(t=>t.type==='web_search'),false);assert.equal(Object.hasOwn(wire,'max_tool_calls'),false);assert.equal(Object.hasOwn(wire,'tool_choice'),false);assert.equal(wire.store,false);assert.equal(wire.reasoning.effort,'xhigh');}
  assert.deepEqual(wires[0].tools,MORE_SOURCE_TOOLS);assert.deepEqual(wires[2].tools,[]);
  assert.equal(wires[1].input.find(x=>x.id==='opaque-1').encrypted_content,'offline-opaque-1');
  assert.equal(result.research.internal_source_calls,2);assert.equal(result.receipt.governed_reference_material.calls.length,2);
  assert.equal(result.research.used,false);assert.equal(result.mutation_performed,false);assert.deepEqual(lab.controller.current(),before);
  const read=library.execute('more_source_read',readArgs);assert.equal(createHash('sha256').update(read.excerpt).digest('hex'),read.excerpt_sha256);
  let saved; const redis={lpush:async(_key,value)=>{saved=JSON.parse(value)},ltrim:async()=>{},expire:async()=>{}};
  await appendDiagnostics({redis,key:'isolated-paid-diagnostics',event:'OFFLINE_SOURCE_ACCEPTED',receipts:[result.receipt]});
  assert.deepEqual(saved.receipts[0].governed_reference_material,result.receipt.governed_reference_material);
  assert.equal(JSON.stringify(saved).includes(read.excerpt),false);
  assert.equal(JSON.stringify(redactPaidRuntimePayload({ok:true,receipt:result.receipt,research:result.research})).includes('governed_reference_material'),false);
  assert.equal(JSON.stringify(redactPaidRuntimePayload({ok:true,receipt:result.receipt,research:result.research})).includes('internal_source_calls'),false);
});

test('optional library does not force tool use or retry a final answer',async()=>{
 let local=0,sdk=0;const transport=createSubscriptionLiveDemoOpenAiTransport({apiKey:'offline-only',maxTransportRetries:0,sourceLibrary:{info:{status:'AVAILABLE'},execute:()=>{local++}},client:{responses:{create:async()=>{sdk++;return final('The conversation is enough.',1)}}}});
 const out=await transport(request(),{stage:'CONVERSATION'});assert.equal(local,0);assert.equal(sdk,1);assert.equal(out.internal_source_calls,0);
});

test('no-web policy rejects hosted output in both source and direct branches, without reroll',async()=>{
 for(const sourceLibrary of [null,pinnedSubscriptionSources()]){let calls=0;const bad=final('I checked the web.',1);bad.output.unshift({type:'web_search_call',status:'searching',action:null});const transport=createSubscriptionLiveDemoOpenAiTransport({apiKey:'offline-only',sourceLibrary,maxTransportRetries:0,client:{responses:{create:async()=>{calls++;return bad}}}});await assert.rejects(transport(request(),{stage:'CONVERSATION'}),/DISABLED_WEB_CALL_DENIED/);assert.equal(calls,1);}
});

test('current-exchange GU preserves negation and adds no governed object or closing confirmation',async()=>{
 const lab=await createSyntheticLivingRelationshipLab({subject_key:'re-mid',seed_weekly_fixture:false});const current=lab.controller.current();const common={packet:lab.controller.wholeUnderstandingPacket(),publication:current.publication,viewModel:current.view_model,relationshipScopeHash:scopeFingerprint(lab.scope)};
 const exchange={customer_message:'No outreach. Do not make this recurring.',coach_message:'We have not agreed to outreach or recurrence; this remains exploration.'};
 const plain=buildSubscriptionS2GuWorld({...common,event:'COACHING_MOMENT'});const withExchange=buildSubscriptionS2GuWorld({...common,event:'COACHING_MOMENT',currentExchange:exchange});
 assert.deepEqual(withExchange.objects,plain.objects);assert.equal(withExchange.coachingMomentContext.customerMessage,exchange.customer_message);assert.equal(withExchange.coachingMomentContext.coachMessage,exchange.coach_message);assert.match(withExchange.truthBoundaries.currentExchange,/cannot create or alter/);
 assert.notEqual(withExchange.stateBinding.triggerHash,plain.stateBinding.triggerHash);
 assert.throws(()=>buildSubscriptionS2GuWorld({...common,event:'SESSION_CLOSING',currentExchange:exchange}),/CURRENT_EXCHANGE_EVENT_DENIED/);
 assert.equal(subscriptionS2CustomerText('an unreconciled shared list—not an agreement'), 'an unreconciled shared list—not an agreement');
});

test('source receipt merge preserves HB close/extraction implementation and ordinary mission',()=>{
 const sha=value=>createHash('sha256').update(value).digest('hex');
 const candidate=readFileSync(new URL('../src/lib/subscriptionV1/freeGptV2/providerSeams.js',import.meta.url),'utf8');const marker='export function createSessionCloseSeamV1';
 assert.equal(sha(candidate.slice(candidate.indexOf(marker))),'e5f450ef73373e3b11dae7f51074e23c6b21c8c2c7b36bcd76c46f4da46de6a2');
 assert.equal(sha(readFileSync(new URL('../src/lib/subscriptionV1/freeGptV2/constants.js',import.meta.url))),'3dbf988ca358de87de065fd667a90103f131a4a5339075b636cae95a65071063');
});

test('paid function bundles pinned libraries plus the exact synthetic QA runtime custody set',()=>{
 const config=JSON.parse(readFileSync(new URL('../vercel.json',import.meta.url),'utf8'));
 const includeFiles=config.functions['api/internal/subscription-v1-runtime.js'].includeFiles;
 assert.equal(includeFiles,EXPECTED_RUNTIME_INCLUDE_GLOB);
 assert.ok(Buffer.byteLength(includeFiles)<=256);
 assert.equal(includeFiles.includes('api/**'),false);
 assert.equal(includeFiles.includes('src/lib/**'),false);
 const candidate=JSON.parse(readFileSync(new URL('../api/engine/subscriptionV1/syntheticQaProviderCandidate.json',import.meta.url),'utf8'));
 assert.ok(runtimeIncludeGlobCovers('api/engine/subscriptionV1/syntheticQaProviderCandidate.json'));
 assert.equal(candidate.contract,'SYNTHETIC_QA_PROVIDER_CANDIDATE_CLOSURE_V3');
 const paths=new Set(candidate.files.map(file=>file.path));
 assert.equal(paths.size,candidate.files.length);
 assert.ok(candidate.files.length<=300);
 for(const required of [
  'docs/ba-intelligence-authority-library-v1/freeze/BA_INTELLIGENCE_AUTHORITY_LIBRARY_MANIFEST_V1.json',
  'docs/lo-cassette-2-final-canonical-authority-v1/23_AUTHORITY_DEPENDENCY_MANIFEST_V1.json',
  'docs/lo-cassette-2-final-canonical-authority-v1/24_CANONICAL_AUTHORITY_ROOT_V1.json',
 ]) assert.ok(paths.has(required),required);
 for(const file of candidate.files.filter(file=>isFileLoadedRuntimeAsset(file.path))) {
  assert.ok(runtimeIncludeGlobCovers(file.path),file.path);
 }
 assert.equal(pinnedSubscriptionSources().info.status,'AVAILABLE');
});
