// Offline structural proof only: no runtime, account, network or model acceptance.
import test from 'node:test';
import assert from 'node:assert/strict';
import net from 'node:net';
import tls from 'node:tls';
import http from 'node:http';
import https from 'node:https';
import nia from '../server/athleteConsultingV2/fixtures/nia.json' with {type:'json'};
import {hashCanonicalJson as h} from '../src/lib/intelligenceFabric/hashing.js';
import {buildCanonicalCoachBundle,hash} from '../server/athleteAcademyV1/coaching/bundle.js';
import {createMainAthleteRslAdapter} from '../server/athleteAcademyV1/coaching/rsl.js';
import * as demo from '../server/athleteConsultingV2/rsl.js';
const deny=()=>{throw Error('OFFLINE_NETWORK_DENIED');};
globalThis.fetch=deny;net.connect=deny;net.createConnection=deny;tls.connect=deny;http.request=deny;https.request=deny;
const at='2026-09-25T12:00:00.000Z', clone=v=>structuredClone(v);
function canonicalCase(label='alpha') {
 const mm='MM-FICTIONAL-RSL-'+label,actorId='fictional-rsl-account-'+label;
 const replace=value=>JSON.parse(JSON.stringify(value).replaceAll(nia.person.mm,mm));
 const bos=replace(nia.bos),apa=replace(nia.apa),bosInput=replace(nia.bos_source);
 bos.mm=mm;bos.synthetic=true;bos.subject.age=18;delete bos.artifact_sha256;bos.artifact_sha256=hash(bos);
 apa.mm=mm;apa.synthetic=true;apa.identity.age=18;apa.identity.reading_sha256=hash(bos);apa.bos_sha256=hash(bos);delete apa.artifact_sha256;apa.artifact_sha256=hash(apa);
 const person={actorId,mm,name:'Fictional structural replay',age:18,sport:'Volleyball',synthetic:true};
 bosInput.person={...bosInput.person,...person};
 const principal={authenticated:true,actorId,subjectActorId:actorId,mm,role:'athlete',grants:{reportsRead:true,coachingRead:true,participation:true}};
 const bundle=buildCanonicalCoachBundle({person,bos,apa,bosInput},principal);
 const state={mm,sourceBinding:clone(bundle.binding),messages:[],learning:[],plan:null,rslEvents:[]};
 const authority=Object.freeze({offline:true});
 const adapter=createMainAthleteRslAdapter({assertFencedAuthority:input=>input.authority===authority&&input.state===state&&input.principal===principal});
 const input={bundle,principal,state,authority};
 return {...input,adapter};
}
function statement(f,id='one',text='My school afternoon changed.') {
 const sourceMessage={id,role:'user',speaker:'athlete',actorId:f.principal.actorId,text,at};
 f.state.messages.push(sourceMessage);
 return f.adapter.createRslEvent({...f,type:'ATHLETE_STATEMENT',sourceId:id,recordedAt:at,text,sourceMessage,authorityName:'EXPLICIT_ATHLETE_SELF_REPORT'});
}
test('demo shared extraction preserves pre-extraction golden bytes and synthetic scope guards',()=>{
 const slug='nia',mm='SYNTHETIC-NIA',bundle={person:{synthetic:true,slug,mm},bos:{synthetic:true,mm,artifact_sha256:h({slug,report:'bos'})},apa:{synthetic:true,mm,artifact_sha256:h({slug,report:'apa'})}};
 const scope=demo.createAthleteRslScope({scopeId:'darren-demo-leadership-A',bundle});
 const msg=(id,text)=>({id,role:'user',speaker:'athlete',text,at});
 const message=msg('message-one','My school afternoon changed.');
 const event=demo.createAthleteRslEvent({scope,type:'ATHLETE_STATEMENT',sourceId:'one',recordedAt:at,text:message.text,sourceMessage:message,authority:'EXPLICIT_ATHLETE_SELF_REPORT'});
 const correction=msg('message-two','My school afternoon is free.');
 const fix=demo.createAthleteRslEvent({scope,type:'CORRECTION',sourceId:'two',recordedAt:at,text:correction.text,sourceMessage:correction,targetEventId:event.event_id,authority:'EXPLICIT_ATHLETE_CORRECTION'}),events=[event,fix];
 assert.deepEqual({scope:h(scope),event:h(event),fix:h(fix),replay:h(demo.replayAthleteRsl({scope,events})),context:h(demo.athleteRslRetrievalContext({scope,events,queryText:'school'})),targets:h(demo.athleteRslActiveCorrectionTargets({scope,events}))},
 {scope:'910dabc70443eb8bc61edd8280333b43e45f3cf4d52bf58967b20ba557de8f04',event:'613852001ff68c2115bc70bd93fe65678474805117cba8f1cce4636477aa06d7',fix:'9d9084e7f82dd6674319d811d6796ba6d739cbea918d6d5029038956c8a1d191',replay:'2e8897ed3344671bbba1b814156f0eff81d3a8367dc43fb81f2c7c66b75571ba',context:'f758728723ce2be1c2254b0387889a76659933fe936f41fd931fb7dbef0ac7a5',targets:'8aa881a707fd94023838c3aa5c05670b23c12e62b3af5f166aae09f80876e88c'});
 assert.throws(()=>demo.createAthleteRslScope({scopeId:'x',bundle:{...bundle,person:{...bundle.person,synthetic:false}}}),/SCOPE_DENIED/u);
 assert.throws(()=>demo.createAthleteRslScope({scopeId:'x',bundle:{...bundle,person:{...bundle.person,slug:'account'}}}),/SCOPE_DENIED/u);
});
test('main explicit correction cold replay is exact actor/MM/source bound with bounded receipt',()=>{
 const f=canonicalCase(),event=statement(f);f.state.rslEvents=[event];
 const sourceMessage={id:'two',role:'user',speaker:'athlete',actorId:f.principal.actorId,text:'My school afternoon is free.',at};f.state.messages.push(sourceMessage);
 const fix=f.adapter.createRslEvent({...f,type:'CORRECTION',sourceId:'two',recordedAt:at,text:sourceMessage.text,sourceMessage,targetEventId:event.event_id,authorityName:'EXPLICIT_ATHLETE_CORRECTION'});f.state.rslEvents.push(fix);
 const view=f.adapter.retrieveRslContext({...f,queryText:'school',maxItems:1});
 assert.equal(view.contract,'athlete_academy_rsl_context_v1');assert.equal(view.items.length,1);assert.equal(view.items[0].event_type,'CORRECTION');assert.equal(view.items[0].payload.text,sourceMessage.text);
 assert.equal(view.correction_targets_receipt.target_count,1);assert.equal(view.correction_targets_receipt.source_watermark,view.source_watermark);
 assert.equal(f.adapter.replayRsl({...f,state:clone(f.state)}).active_events.length,1);
 assert.equal(f.adapter.retrieveRslCorrectionTargets(f).items[0].event_id,fix.event_id);
 assert.throws(()=>f.adapter.replayRsl({...f,events:[fix]}),/TARGET_NOT_ACTIVE/u);
});
test('main rejects scope/account/source/confirmation spoof before event creation or read',()=>{
 const f=canonicalCase(),event=statement(f);f.state.rslEvents=[event];
 assert.throws(()=>createMainAthleteRslAdapter(),/FENCE_REQUIRED/u);
 assert.throws(()=>statement({...f,authority:{offline:true}},'forged'),/FENCE_REQUIRED/u);
 const sourceMessage=f.state.messages[0];
 for(const change of [{actorId:'foreign'},{speaker:'coach'},{capture:{}},{mm:'other-mm'}]){
  Object.assign(sourceMessage,change);
  assert.throws(()=>f.adapter.createRslEvent({...f,type:'ATHLETE_STATEMENT',sourceId:'bad',recordedAt:at,text:sourceMessage.text,sourceMessage,authorityName:'EXPLICIT_ATHLETE_SELF_REPORT'}),/SOURCE_MESSAGE_INVALID/u);
  delete sourceMessage.capture;delete sourceMessage.mm;sourceMessage.actorId=f.principal.actorId;sourceMessage.speaker='athlete';
 }
 assert.throws(()=>f.adapter.replayRsl({...f,principal:{...f.principal,actorId:'foreign'}}),/PRIVATE_ACCESS_DENIED/u);
 assert.throws(()=>f.adapter.replayRsl({...f,scope:{...f.adapter.createRslScope(f),scope_hash:'a'.repeat(64)}}),/SCOPE_DENIED/u);
 assert.throws(()=>canonicalCase('other').adapter.replayRsl({...canonicalCase('other'),events:[event]}),/EVENT_SCOPE_DENIED/u);
 sourceMessage.text='Rewritten old text';assert.throws(()=>f.adapter.replayRsl(f),/SOURCE_MESSAGE_INVALID/u);
});
test('main current snapshot derives only owner-approved learning and exact account-ID accepted plan',()=>{
 const f=canonicalCase();statement(f);
 f.state.learning=[{id:'learning',speaker:'athlete',actorId:f.principal.actorId,text:'One precise cue helps.',approved_at:at},{id:'old',speaker:'athlete',text:'Unattributed old learning',approved_at:at},{id:'coach',speaker:'coach',actorId:f.principal.actorId,text:'Not an athlete choice',approved_at:at}];
 const body={title:'Try one cue',why:'The athlete chose it',steps:[{owner:'athlete',notice:'Whether useful',when:'Practice',action:'Pause once'}],review:'Next check-in'};
 f.state.plan={...body,id:'plan-one',hash:hash(body),accepted_at:at,visibility:'private',approvals:[{actorId:f.principal.actorId,hash:hash(body),at}]};
 const events=f.adapter.deriveRslEvents(f);assert.equal(events.length,2);assert.equal(events.some(event=>event.event_type==='ATHLETE_STATEMENT'),false);
 assert.equal(f.adapter.replayRsl({...f,events}).active_events.length,2);
 for(const change of [{approvals:['athlete']},{approvals:[{actorId:'foreign',hash:hash(body),at}]},{hash:'a'.repeat(64)},{visibility:'shared'}])assert.throws(()=>f.adapter.deriveRslEvents({...f,state:Object.assign(f.state,{plan:{...f.state.plan,...change}})}),/PLAN_NOT_ACCEPTED/u);
});
