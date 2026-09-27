// Injected offline request/receipt proof, not browser or real-model acceptance.
import test from 'node:test';
import assert from 'node:assert/strict';
import net from 'node:net';
import tls from 'node:tls';
import http from 'node:http';
import https from 'node:https';
import {hashCanonicalJson} from '../src/lib/intelligenceFabric/hashing.js';
import {BOS_LIBRARY,LIBRARY_MANIFEST_SHA256} from '../src/lib/newBosPersonalityDnaV1/libraryRegistry.js';
import {retrieveAthleteKnowledge} from '../server/athleteAcademyV1/coaching/knowledge.js';
import {createCoach,coachingInput,flagshipCoachingInput,validateMainCoachViewContext,INSTRUCTIONS,FLAGSHIP_INSTRUCTIONS,SCHEMA,parseCoachResponse} from '../server/athleteAcademyV1/coaching/coach.js';
const deny=()=>{throw Error('OFFLINE_NETWORK_DENIED');};globalThis.fetch=deny;net.connect=deny;net.createConnection=deny;tls.connect=deny;http.request=deny;https.request=deny;
const bundle={person:{mm:'MM-FICTIONAL-INPUT',name:'Fictional input',synthetic:true},binding:{actorId:'fictional-owner',mm:'MM-FICTIONAL-INPUT',bos:'a'.repeat(64),apa:'b'.repeat(64)},bos:{artifact_sha256:'a'.repeat(64),reading:{original:true},evidence:{}},bos_source:{answers:[]},apa:{artifact_sha256:'b'.repeat(64),report:{original:true}},current_apa:{artifact_sha256:'c'.repeat(64),current_apa_version:2,report:{lastPublished:true}},coach_note_observations:[{text:'Fictional attributed unverified observation',reviewed_by:'fictional-coach'}]};
function state(){const scope=hashCanonicalJson({scopeId:'athlete-academy-private',actor_id:bundle.binding.actorId,mm:bundle.person.mm,bos_hash:bundle.binding.bos,apa_hash:bundle.binding.apa});return {mm:bundle.person.mm,messages:[{id:'own-message',role:'user',speaker:'athlete',text:'Compare my options',at:'2026-09-25T12:00:00.000Z'}],learning:[],plan:null,draft:null,sessions:[],view:'sport',viewContext:{section:'futures',reading:'current',objectId:'future-current_course'},speaker:'athlete',status:'active',apaNeedsReview:true,governedMemory:{contract:'athlete_academy_rsl_context_v1',scope_hash:scope,source_watermark:'d'.repeat(64),items:[],omitted_count:0,raw_transcript_included:false,coach_observation_promoted:false,correction_targets_receipt:{contract:'athlete_academy_rsl_correction_targets_receipt_v1',scope_hash:scope,source_watermark:'d'.repeat(64),target_count:0,omitted_count:0}}};}
const response=()=>({status:'completed',model:'gpt-5.6-sol',usage:{total_tokens:0},output_text:JSON.stringify({reply:'Fictional offline reply',plan:null,plan_change:'none',retire_draft:false,learning:[],recap:''})});
const retriever={async retrieve({manifest_sha256,authorities}){assert.equal(manifest_sha256,LIBRARY_MANIFEST_SHA256);return {manifest_sha256,authorities:authorities.map(entry=>({...entry,bounded_block:entry.title+'\n\n--- BOUNDED DOCTRINE BLOCK ---\n\nFictional verified excerpt for structural input proof.'}))};}};
const knowledge=input=>retrieveAthleteKnowledge({...input,retriever});
test('main knowledge wrapper preserves bounded pinned manifest/source/excerpt receipts without sport invention',async()=>{
 const result=await knowledge({task:'CHAT',view:'sport',text:'Compare possible futures under pressure'});
 assert.equal(result.context.blocks.length,3);assert.ok(result.context.blocks.some(block=>block.id===14));assert.equal(result.receipt.athlete_sport_coaching_library,'NOT_AVAILABLE_AS_APPROVED_PINNED_SOURCE');
 for(const source of result.receipt.sources){const original=BOS_LIBRARY.find(entry=>entry.id===source.id);assert.equal(source.source_sha256,original.sha256);assert.match(source.excerpt_sha256,/^[a-f0-9]{64}$/u);}
 await assert.rejects(retrieveAthleteKnowledge({task:'OPENING',view:'home',retriever:{retrieve:async()=>({manifest_sha256:'x',authorities:[]})}}),/KNOWLEDGE_INTEGRITY/u);
});
test('flagged main withholds pending current APA, preserves exact descriptor and opening-only attributed notes',async()=>{
 const s=state(),before=structuredClone({bundle,s}),events=[],requests=[];
 const coach=createCoach({env:{},flagship:true,knowledgeRetriever:knowledge,evidenceSink:event=>events.push(event),transport:async(request,options)=>{requests.push(request);assert.equal(options.maxRetries,0);return response();}});
 await coach(bundle,s,'OPENING');const input=JSON.parse(requests[0].input);
 assert.equal(input.full_youth_apa,null);assert.deepEqual(input.apa_currency,{contract:'athlete_academy_current_apa_v1',baseline_apa_sha256:bundle.apa.artifact_sha256,current_apa_sha256:bundle.current_apa.artifact_sha256,version:2,requires_review:true});
 assert.deepEqual(input.reviewed_coach_observations,bundle.coach_note_observations);assert.equal(input.athlete.actorId,bundle.binding.actorId);assert.deepEqual(input.governed_personal_memory,s.governedMemory);
 assert.deepEqual(input.visible_view_context,s.viewContext);assert.equal(requests[0].instructions,FLAGSHIP_INSTRUCTIONS);assert.deepEqual(requests[0].text.format.schema,SCHEMA);
 assert.deepEqual(events.map(event=>event.kind),['request','response','receipt']);assert.equal(events[0].record.knowledge_receipt.manifest_sha256,LIBRARY_MANIFEST_SHA256);assert.deepEqual(events[2].knowledge_receipt,events[0].record.knowledge_receipt);
 assert.deepEqual({bundle,s},before);assert.equal(flagshipCoachingInput(bundle,s,'CHAT').reviewed_coach_observations,undefined);
 s.apaNeedsReview=false;assert.equal(flagshipCoachingInput(bundle,s,'CHAT').full_youth_apa.artifact_sha256,bundle.current_apa.artifact_sha256);
 assert.equal(flagshipCoachingInput(bundle,s,'CHAT').athlete.actorId,bundle.binding.actorId);
});
test('default-off preserves legacy packet, instructions/schema and raw saved response parsing; no knowledge access',async()=>{
 const events=[],requests=[],s=state();let retrievals=0;
 const coach=createCoach({env:{},knowledgeRetriever:()=>{retrievals++;throw Error('Must not retrieve');},evidenceSink:event=>events.push(event),transport:async request=>{requests.push(request);return response();}});
 await coach(bundle,s,'OPENING');assert.equal(retrievals,0);const input=JSON.parse(requests[0].input);
 assert.equal(requests[0].instructions,INSTRUCTIONS);assert.deepEqual(requests[0].text.format.schema,SCHEMA);
 assert.equal(input.full_youth_apa.artifact_sha256,bundle.current_apa.artifact_sha256);assert.equal(input.apa_currency.requires_review,undefined);assert.equal(input.governed_personal_memory,undefined);assert.equal(input.visible_view_context,undefined);assert.equal(events[0].record.knowledge_receipt,undefined);assert.equal(events[2].knowledge_receipt,undefined);
 assert.equal(coachingInput(bundle,s,'OPENING').apa_currency.source.includes('athlete-reviewed'),true);assert.equal(parseCoachResponse(response()).reply,'Fictional offline reply');
});
test('flagged compatibility learning channel excludes unknown/foreign/unapproved saved legacy items',()=>{
 const s=state(),at='2026-09-25T12:00:00.000Z';
 const approved={id:'own-approved',actorId:bundle.binding.actorId,speaker:'athlete',approved_at:at,text:'A reviewed short reminder'};
 s.learning=[approved,{id:'old',text:'Unknown historical reminder',confirmed_by:'athlete'},
  {...approved,id:'foreign',actorId:'foreign-owner'},{...approved,id:'coach',speaker:'coach'},
  {...approved,id:'unapproved',approved_at:undefined},{...approved,id:'bad-time',approved_at:'yesterday'},
  {...approved,id:'too-large',text:'a'.repeat(1201)}];
 assert.deepEqual(flagshipCoachingInput(bundle,s,'CHAT').approved_learning,[approved]);
 assert.equal(s.learning.length,7);assert.equal(coachingInput(bundle,s,'CHAT').approved_learning.length,7);
});
test('knowledge failure is first private failure before any provider/request and no automatic retry',async()=>{
 const events=[];let calls=0,reads=0;const coach=createCoach({env:{},flagship:true,knowledgeRetriever:()=>{reads++;throw Error('ATHLETE_KNOWLEDGE_INTEGRITY');},evidenceSink:event=>events.push(event),transport:async()=>{calls++;return response();}});
 await assert.rejects(coach(bundle,state(),'CHAT'),/COACH_KNOWLEDGE_INTEGRITY/u);assert.equal(calls,0);assert.equal(reads,1);assert.equal(events.length,1);assert.equal(events[0].kind,'failure');assert.equal(events[0].stage,'knowledge_retrieval');assert.equal(events[0].request_sha256,null);
});
test('foreign memory/correction receipt and invalid view hint fail before provider',async()=>{
 for(const mutate of [s=>s.governedMemory.scope_hash='f'.repeat(64),s=>s.governedMemory.correction_targets_receipt.source_watermark=null,s=>s.governedMemory.coach_observation_promoted=true,s=>s.viewContext.actorId='spoof',s=>s.viewContext.reading='foreign',s=>s.viewContext.objectId='foreign']){
  const s=state();mutate(s);let calls=0;const events=[];
  const coach=createCoach({env:{},flagship:true,knowledgeRetriever:knowledge,evidenceSink:event=>events.push(event),transport:async()=>{calls++;return response();}});
  await assert.rejects(coach(bundle,s,'CHAT'),/COACH_(GOVERNED_MEMORY|VIEW_CONTEXT)_INVALID/u);assert.equal(calls,0);assert.equal(events.at(-1).kind,'failure');
 }
 assert.equal(validateMainCoachViewContext('home',null),null);assert.throws(()=>validateMainCoachViewContext('you',{section:'futures'}),/VIEW_CONTEXT_INVALID/u);
});
