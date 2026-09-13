import assert from 'node:assert/strict';
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
 const original=readFileSync('/private/tmp/moremindmap-home-base-v2-paid-subscription-integration-v1/src/lib/subscriptionV1/freeGptV2/providerSeams.js','utf8');const candidate=readFileSync(new URL('../src/lib/subscriptionV1/freeGptV2/providerSeams.js',import.meta.url),'utf8');const marker='export function createSessionCloseSeamV1';assert.equal(candidate.slice(candidate.indexOf(marker)),original.slice(original.indexOf(marker)));
 const mission='../src/lib/subscriptionV1/freeGptV2/constants.js';assert.equal(readFileSync(new URL(mission,import.meta.url),'utf8'),readFileSync('/private/tmp/moremindmap-home-base-v2-paid-subscription-integration-v1/src/lib/subscriptionV1/freeGptV2/constants.js','utf8'));
});

test('paid function explicitly bundles only the pinned library at its declared path',()=>{
 const config=JSON.parse(readFileSync(new URL('../vercel.json',import.meta.url),'utf8'));
 assert.equal(config.functions['api/internal/subscription-v1-runtime.js'].includeFiles,'api/engine/subscriptionV1/sourceLibrary/**');
 assert.equal(pinnedSubscriptionSources().info.status,'AVAILABLE');
});
