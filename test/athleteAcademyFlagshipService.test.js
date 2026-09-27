// STRUCTURAL ONLY: adapted Nia JSON and fictional account/report metadata exercise the actual
// service/CAS contracts. NOT an independent main browser fixture, normal generated
// assessment baseline, real model quality, account/runtime or acceptance proof.
import test from 'node:test';
import assert from 'node:assert/strict';
import nia from '../server/athleteConsultingV2/fixtures/nia.json' with { type: 'json' };
import { createRedisRepository, CAS_LUA, digest } from '../server/athleteAcademyV1/repository.js';
import { createAcademyService } from '../server/athleteAcademyV1/service.js';
import { createCoachingService } from '../server/athleteAcademyV1/coaching/service.js';
import { createCoachNotesService } from '../server/athleteAcademyV1/coaching/coachNotes.js';
import { COACH_NOTES_POLICY_VERSION, COACH_NOTES_PURPOSE } from '../server/athleteAcademyV1/coaching/coachNotesPolicy.js';
import { initialCoachState } from '../server/athleteAcademyV1/coaching/state.js';
import { MAIN_APA_REFERENCE_CODEC_CONTRACT } from '../server/athleteAcademyV1/coaching/currentApa.js';
import { APA_NARRATIVE_FIELDS, getApaNarrativeValue } from '../server/athleteConsultingV2/apaNarrative.js';
import { hash } from '../server/athleteAcademyV1/coaching/bundle.js';
import { hashCanonicalJson } from '../src/lib/intelligenceFabric/hashing.js';
import net from 'node:net';
import tls from 'node:tls';
import http from 'node:http';
import https from 'node:https';
const deny = () => { throw Error('OFFLINE_NETWORK_DENIED'); };
globalThis.fetch=deny;net.connect=deny;net.createConnection=deny;net.Socket.prototype.connect=deny;tls.connect=deny;http.request=deny;https.request=deny;

const clone = value => structuredClone(value);
const AT = Date.now();
const BOS_VERSION = '22222222-2222-4222-8222-222222222222';
const APA_VERSION = '33333333-3333-4333-8333-333333333333';
const NOTE_TEXT = 'Fictional-only observation: steadier passing before the water break. Ask the athlete what they noticed; do not rewrite their APA.';
function coachResponse(task, overrides = {}) {
  return { status: 'completed', model: 'gpt-5.6-sol', usage: { total_tokens: 0 },
    output_text: JSON.stringify({ reply: 'We can discuss what you noticed without changing your saved reports.',
      plan: null, plan_change: 'none', retire_draft: false, learning: [],
      recap: task === 'CLOSE' ? 'Discussion only. No new plan, learning or assessment was accepted.' : '', ...overrides }) };
}
async function fixture({ enabled = true, flagship = true, failReceiptOnce = false, transportHook = null } = {}) {
  const values = new Map();
  const redis = { beforeEval: null, afterEval: null,
    async get(key) { return values.get(key) ?? null; },
    async eval(script, count, ...args) {
      assert.equal(script, CAS_LUA);
      const keys = args.slice(0, count), prior = args.slice(count, count * 2), next = args.slice(count * 2);
      assert.equal(next.length, count);
      if (redis.beforeEval) await redis.beforeEval({ keys, prior, next, values });
      if (keys.some((key, index) => (values.get(key) ?? '') !== prior[index])) return 0;
      keys.forEach((key, index) => { if (next[index] !== '') values.set(key, next[index]); });
      if (redis.afterEval) await redis.afterEval({ keys, prior, next, values });
      return 1;
    } };
  const baseRepo = createRedisRepository({ redis, prefix: 'more:athlete-academy:{test-flagship-service}' });
  let clock = AT, requestSequence = 0, noteSequence = 0, lost = false;
  const repo = failReceiptOnce ? Object.freeze({ ...baseRepo, async putImmutable(key, value) {
    if (!lost && key.startsWith('coach-evidence:') && key.endsWith(':receipt')) {
      lost = true; throw new Error('OFFLINE_FICTIONAL_RECEIPT_ACK_LOST');
    }
    return baseRepo.putImmutable(key, value);
  } }) : baseRepo;
  const mm = 'MM-FICTIONAL-NOTE-REPLAY', actorId = 'fictional-note-owner';
  const replace = value => JSON.parse(JSON.stringify(value).replaceAll(nia.person.mm, mm).replaceAll('Nia', 'Mira Fictional'));
  const bos = replace(nia.bos), apa = replace(nia.apa), source = replace(nia.bos_source);
  bos.mm = mm; bos.synthetic = false; bos.subject.age = 18;
  delete bos.artifact_sha256; bos.artifact_sha256 = hash(bos);
  apa.mm = mm; apa.synthetic = false; apa.identity.age = 18;
  apa.identity.reading_sha256 = hash(bos); apa.bos_sha256 = hash(bos);
  delete apa.artifact_sha256; apa.artifact_sha256 = hash(apa);
  const person = { mm, name: 'Mira Fictional', dateOfBirth: '2008-02-01', age: 18, sport: 'Volleyball' };
  source.person = { ...source.person, ...person };
  const owner = { id: actorId, mm, email: 'mira@test.invalid', displayName: 'Mira Fictional', verified: true, sessionVersion: 1, role: 'participant' };
  const observer = { id: 'fictional-coach-observer', mm: 'MM-FICTIONAL-OBSERVER', email: 'observer@test.invalid',
    displayName: 'Coach Fictional Alex', verified: true, sessionVersion: 1, role: 'participant' };
  const other = { id: 'fictional-unrelated-account', mm: 'MM-FICTIONAL-OTHER', email: 'other@test.invalid',
    displayName: 'Other Fictional', verified: true, sessionVersion: 1, role: 'participant' };
  const config = { flagshipEnabled: flagship, currentApaEnabled: true, providerEnabled: true, coachNotesEnabled: enabled,
    coachNotesPolicyVersion: COACH_NOTES_POLICY_VERSION, realYouthEnabled: false,
    syntheticPreview: true, reviewedPolicyVersion: 'offline-note-continuity-v1' };
  const dossier = { mm, ownerId: actorId, synthetic: false, archived: false, revision: 0, person,
    entitlements: { bos: true, apa: true, coach: true },
    participation: { athleteAccepted: true, status: 'self_authorized', policyVersion: config.reviewedPolicyVersion },
    reports: { bos: { currentVersionId: BOS_VERSION, artifactHash: bos.artifact_sha256 },
      apa: { currentVersionId: APA_VERSION, artifactHash: apa.artifact_sha256, bosVersionId: BOS_VERSION } },
    jobs: [], events: [], intake: { bos: {}, apa: {} } };
  const reportKeys = [`report:${mm}:bos:${BOS_VERSION}`, `report:${mm}:apa:${APA_VERSION}`];
  const docs = { [`account:${owner.id}`]: owner, [`account:${observer.id}`]: observer, [`account:${other.id}`]: other,
    [`email:${digest(observer.email)}`]: { id: observer.id }, [`email:${digest(other.email)}`]: { id: other.id },
    [`dossier:${mm}`]: dossier, [reportKeys[0]]: { artifact: bos, input: { subject: source } },
    [reportKeys[1]]: { artifact: apa, input: { source: { mm } } } };
  await repo.transact(Object.keys(docs), () => ({ writes: docs, result: true }));
  const now = () => Math.max(clock,Date.now()), calls = [];
  const transport = async (request, options) => {
    const visual = Array.isArray(request.input);
    const packet = JSON.parse(visual ? request.input.find(item=>item.role==='user').content : request.input);
    assert.equal(request.store, false); assert.equal(options.maxRetries, 0);
    calls.push({ request, options, packet, kind: visual ? packet.event : packet.task });
    return transportHook ? transportHook(request, options, packet) : visual ? visualResponse(request,packet) : coachResponse(packet.task);
  };
  const auth = { event: (type, actor, extra = {}) => ({ type, actor, ...extra, at: new Date(clock).toISOString() }) };
  const academy = createAcademyService({ repo, config, auth, transport, now });
  const notesService = createCoachNotesService({ repo, config, academy, now,
    makeId: () => `${(++noteSequence).toString(16).padStart(8, '0')}-1111-4111-8111-111111111111` });
  const service = createCoachingService({ repo, config, academy, notes: notesService, transport, now });
  const bundle = await service.bundle(owner, { mm }), state = initialCoachState(bundle);
  const planBody = {title:'Previously accepted private plan',why:'The fictional athlete separately chose it.',steps:[{action:'Notice one calm pass.',when:'Next practice',notice:'One observation',owner:'athlete'}],review:'At the next chosen review'};
  const acceptedAt=new Date(AT-86400000).toISOString();
  state.plan={...planBody,id:'44444444-4444-4444-8444-444444444444',hash:hash(planBody),accepted_at:acceptedAt,visibility:'private',proposedBy:owner.id,approvals:[{actorId:owner.id,hash:hash(planBody),at:acceptedAt}]};
  state.learning=[{id:'55555555-5555-4555-8555-555555555555',text:'I prefer one short reminder.',speaker:'athlete',actorId:owner.id,approved_at:acceptedAt},{id:'66666666-6666-4666-8666-666666666666',text:'Unattributed old reminder.',confirmed_by:'athlete'}];
  const key = `coach:${mm}`, boxKey = `coach-notes:${mm}`;
  await repo.transact([key], () => ({ writes: { [key]: state }, result: true }));
  const original = { reports: await Promise.all(reportKeys.map(key => repo.read(key))), dossier: clone(dossier),
    plan: clone(state.plan), learning: clone(state.learning), currentApa: state.currentApa, apaDraft: state.apaDraft,
    confirmedChanges: state.apaConfirmedChanges, sourceBinding: clone(state.sourceBinding) };
  const raw = () => repo.read(key), box = () => repo.read(boxKey);
  const body = fields => ({ requestId: `offline-flagship-service-${++requestSequence}`, ...fields });
  const command = async (value, overrides = {}) => body({ mm, revision: (await raw()).revision, command: value, ...overrides });
  const action = async (value, overrides = {}) => service.action(owner, await command(value, overrides));
  const patch = (docKey, change) => repo.transact([docKey], saved => {
    const next = clone(saved[docKey]); change(next); return { writes: { [docKey]: next }, result: true };
  });
  const invite = () => notesService.invite(owner, body({ mm, recipient_email: observer.email,
    purpose: COACH_NOTES_PURPOSE, policy_version: COACH_NOTES_POLICY_VERSION, next_opening_context: true,
    expires_at: new Date(clock + 86400000).toISOString() }));
  const accept = g => notesService.accept(observer, body({ mm, grant_id: g.terms.id, grant_version: g.version,
    terms_hash: g.terms_hash, policy_version: COACH_NOTES_POLICY_VERSION, accepted: true }));
  const append = g => notesService.append(observer, body({ mm, grant_id: g.terms.id, grant_version: g.version,
    text: NOTE_TEXT, reviewed: true }));
  const ready = async () => {
    const pending = (await invite()).invitation;
    assert.equal(pending.status, 'pending');
    const grant = (await accept(pending)).grant;
    const note = (await append(grant)).receipt;
    return { grant, note };
  };
  const revoke = g => notesService.revoke(owner, body({ mm, grant_id: g.terms.id, grant_version: g.version }));
  const immutableEvidence = () => [...values.entries()].filter(([key]) => key.includes(':coach-evidence:'));
  const originalsUnchanged = async ({ dossierChanged = false } = {}) => {
    assert.equal(digest(await Promise.all(reportKeys.map(key => repo.read(key)))),digest(original.reports));
    if (!dossierChanged) assert.equal(digest(await repo.read(`dossier:${mm}`)),digest(original.dossier));
    const saved = await raw();
    assert.equal(digest(saved.plan),digest(original.plan)); assert.equal(digest(saved.learning),digest(original.learning));
    assert.deepEqual(saved.currentApa, original.currentApa); assert.deepEqual(saved.apaDraft, original.apaDraft);
    assert.deepEqual(saved.apaConfirmedChanges, original.confirmedChanges);
  };
  return { repo, redis, values, owner, observer, other, config, academy, notesService, service, bundle, mm, key, boxKey,
    original, raw, box, body, command, action, patch, invite, accept, append, ready, revoke, transport,
    immutableEvidence, originalsUnchanged, reportKeys, calls, now, advance: ms => { clock = now()+ms; } };
}

function visualResponse(request,world,{render=true,invalid=false}={}) {
 const ids=world.event==='SESSION_FINALIZATION'
  ?['athlete-map-change','athlete-session-recap',...['athlete-plan','athlete-draft'].filter(id=>world.objects.some(object=>object.id===id))]
  :[world.objects.some(object=>object.id==='athlete-bos')?'athlete-bos':world.objects[0].id];
 const chosen=world.objects.filter(object=>ids.includes(object.id));
 const candidate={planVersion:request.text.format.schema.properties.planVersion.const,event:world.event,
  stateBinding:clone(world.stateBinding),renderDecision:{render,reason:render?world.presentationCopy.renderReason:world.presentationCopy.noRenderReason},
  guidance:clone(world.presentationCopy.guidance),blocks:render?[{blockId:'athlete-block-offline-source-bound',type:'PLAIN_LANGUAGE',
   ...world.presentationCopy.blocksByType.PLAIN_LANGUAGE,objectIds:invalid?['invented-object']:ids,
   evidenceIds:[...new Set(chosen.flatMap(object=>object.sourceIds))],emphasis:'normal',reason:world.presentationCopy.blockReason}]:[],interactions:[]};
 return {status:'completed',model:'gpt-5.6-sol',usage:{total_tokens:0},output_text:JSON.stringify(candidate)};
}
async function reportsUnchanged(f) {assert.equal(digest(await Promise.all(f.reportKeys.map(key=>f.repo.read(key)))),digest(f.original.reports));}

function cold(f) { return createCoachingService({repo:f.repo,config:f.config,academy:f.academy,notes:f.notesService,transport:f.transport,now:f.now}); }
function defaultResponse(request,packet) {return Array.isArray(request.input)?visualResponse(request,packet):coachResponse(packet.task);}
function loseFinalCommit(f) {
 let lost=false;
 f.redis.beforeEval=({keys,next})=>{
  const at=keys.findIndex(key=>key.endsWith(':'+f.key));if(at<0||!next[at])return;
  const s=JSON.parse(next[at]);
  if(!lost&&s.status==='active'&&!s.pendingAttempt&&s.visuals?.length){lost=true;throw Error('OFFLINE_FINAL_ACK_UNKNOWN');}
 };
 return ()=>{f.redis.beforeEval=null;assert.equal(lost,true);};
}
async function unresolvedFull() {
 const f=await fixture(),release=loseFinalCommit(f);
 await assert.rejects(f.action({action:'start'}),/STORAGE_OUTCOME_UNKNOWN/u);release();
 assert.equal((await f.raw()).status,'working');assert.equal(f.calls.length,2);
 f.advance(420001);await cold(f).state(f.owner,{mm:f.mm});assert.equal((await f.raw()).status,'unknown');
 return f;
}
async function sourceMessage(f,text='My priority is Make calm passing choices. Review on October 3, 2026 and plan through December 1, 2026. Tuesday practice is shorter now.',id='77777777-7777-4777-8777-777777777777') {
 await f.patch(f.key,s=>{s.messages.push({id,role:'user',speaker:'athlete',actorId:f.owner.id,mm:f.mm,text,at:new Date(f.now()-1000).toISOString()});});
 return id;
}
async function confirm(f,id) {
 await f.action({action:'confirm_fact',source_message_id:id,reason:'I explicitly reviewed this saved reality.',kind:'reality',supersedes:[]});
 return (await f.raw()).apaConfirmedChanges.at(-1);
}
function deltaResponse(packet) {
 const source=packet.delta_binding.source_id;
 const timing=[{field:'confirmation.priority',value:'Make calm passing choices',refs:[source]},
   {field:'confirmation.review_date',value:'2026-10-03',refs:[source]},
   {field:'confirmation.horizon_date',value:'2026-12-01',refs:[source]}];
 const narratives=packet.saved_athlete_confirmation.kind==='correction'?APA_NARRATIVE_FIELDS.map(field=>timing.find(item=>item.field===field)||{field,value:clone(getApaNarrativeValue(packet.current_apa.same_as_original_apa?packet.original_apa:packet.current_apa,field)),refs:[source]}):timing;
 return {status:'completed',model:'gpt-5.6-sol',usage:{total_tokens:0},output_text:JSON.stringify({
  contract:MAIN_APA_REFERENCE_CODEC_CONTRACT,binding:packet.delta_binding,domains:[],futures:[],candidates:[],
  narratives:narratives.map(({field,value})=>({field,value,cite_confirmed_update:true}))})};
}
test('flagship is default-off and requires explicit current APA capability',async()=>{
 const f=await fixture({flagship:false});await f.action({action:'start'});
 assert.equal(f.calls.length,1);assert.equal(f.calls[0].packet.governed_personal_memory,undefined);assert.equal(f.calls[0].packet.governed_knowledge,undefined);
 const state=(await f.service.state(f.owner,{mm:f.mm})).state;assert.equal(state.flagship_enabled,undefined);assert.equal(state.visuals?.length||0,0);
 assert.throws(()=>createCoachingService({repo:f.repo,config:{...f.config,flagshipEnabled:true,currentApaEnabled:false},academy:f.academy,transport:f.transport,now:f.now}),/MAIN_FLAGSHIP_CURRENT_APA_REQUIRED/u);
 await f.originalsUnchanged();
});
test('actual CAS opening and mandatory closing bind complete visuals; exact retry and cold read dispatch nothing',async()=>{
 const f=await fixture(),request=await f.command({action:'start'});await f.service.action(f.owner,request);
 let s=await f.raw();assert.equal(s.status,'active',s.pendingAttempt?.errorCode);assert.equal(f.calls.length,2);
 assert.ok(s.sessionStartMap.snapshot_hash);assert.equal(s.sessionStartMap.apa_needs_review,false);
 assert.equal(s.visuals.length,1);assert.equal(s.visuals[0].plan.stateBinding.actorId,f.owner.id);assert.equal(s.visuals[0].plan.stateBinding.mm,f.mm);
 assert.equal(s.visuals[0].plan.interactions.length,0);assert.equal(s.messages.at(-1).id,s.visuals[0].after_message_id);
 const saved=digest(s);await f.service.action(f.owner,request);assert.equal(f.calls.length,2);assert.equal(digest(await f.raw()),saved);
 await f.action({action:'close'});s=await f.raw();assert.equal(s.status,'review',s.pendingAttempt?.errorCode);assert.equal(f.calls.length,4);
 const result=await cold(f).state(f.owner,{mm:f.mm});assert.equal(result.state.closing_reveal_ready,true);
 const objects=s.visuals.at(-1).plan.blocks.flatMap(block=>block.objects);assert.ok(objects.some(o=>o.id==='athlete-map-change'));assert.ok(objects.some(o=>o.id==='athlete-session-recap'));assert.ok(objects.some(o=>o.id==='athlete-plan'));
 await f.action({action:'finish',remember:[]});assert.equal((await f.raw()).status,'closed');assert.equal(f.calls.length,4);await f.originalsUnchanged();
});
test('selective middle visual is bound to the exchange, no-render counts and maximum is two',async()=>{
 let middle=0;
 const f=await fixture({transportHook:(request,_options,packet)=>Array.isArray(request.input)
  ?visualResponse(request,packet,{render:packet.event!=='COACHING_MOMENT'||++middle>1}):coachResponse(packet.task)});
 await f.action({action:'start'});await f.action({action:'message',text:'I noticed a calm pass.'});
 await f.action({action:'message',text:'Compare my options.'});await f.action({action:'message',text:'Show me visually the difference.'});await f.action({action:'message',text:'Compare the possible futures.'});
 const s=await f.raw();assert.equal(s.status,'active',s.pendingAttempt?.errorCode);assert.equal(f.calls.length,8);assert.equal(middle,2);
 const considered=s.events.filter(e=>e.type==='visual_considered'&&e.event==='COACHING_MOMENT');assert.equal(considered.length,2);assert.equal(considered[0].rendered,false);
 const v=s.visuals.find(v=>v.event==='COACHING_MOMENT');assert.ok(v);assert.ok(s.messages.some(m=>m.id===v.after_message_id&&m.role==='assistant'));assert.equal(v.plan.stateBinding.triggerRequestId,v.trigger_request_id);await f.originalsUnchanged();
});
test('full saved Coach and visual recover cold with reserved source identities and zero new dispatch',async()=>{
 const f=await unresolvedFull(),prior=(await f.raw()).pendingAttempt.flagship.reservedIdentity;
 const request=await f.command({action:'recover'});await cold(f).action(f.owner,request);
 const s=await f.raw();assert.equal(s.status,'active');assert.equal(s.pendingAttempt,undefined);assert.equal(s.messages.at(-1).id,prior.assistantId);assert.equal(s.visuals.at(-1).after_message_id,prior.assistantId);
 assert.equal(f.calls.length,2);const saved=digest(s);await cold(f).action(f.owner,request);assert.equal(digest(await f.raw()),saved);assert.equal(f.calls.length,2);await f.originalsUnchanged();
});
test('unknown Coach or saved Coach without mandatory visual never invents a visual or retries provider',async t=>{
 for(const mode of ['transport-unknown','coach-receipt-unknown'])await t.test(mode,async()=>{
  const f=await fixture({failReceiptOnce:mode==='coach-receipt-unknown',transportHook:mode==='transport-unknown'?()=>{throw Error('OFFLINE_DISPATCH_UNKNOWN');}:null});
  await f.action({action:'start'});assert.equal((await f.raw()).status,'unknown');assert.equal(f.calls.length,1);
  const before=digest(await f.raw());await assert.rejects(f.action({action:'recover'}),/RESULT_NOT_YET_RECOVERABLE|VISUAL|COMPOSITION/u);
  assert.equal(digest(await f.raw()),before);assert.equal(f.calls.length,1);assert.equal((await f.raw()).visuals?.length||0,0);await f.originalsUnchanged();
 });
});
test('Coach success plus invalid visual leaves reviewed note dispatched, not delivered or automatically replayed',async()=>{
 let bad=true;
 const f=await fixture({transportHook:(request,_options,packet)=>Array.isArray(request.input)?visualResponse(request,packet,{invalid:bad}):coachResponse(packet.task)});
 await f.ready();await f.action({action:'start'});assert.equal((await f.raw()).status,'unknown');assert.equal(f.calls.length,2);
 assert.equal(f.calls[0].packet.reviewed_coach_observations.length,1);
 const box=await f.box();assert.equal(box.attempts[0].status,'dispatched');assert.equal(box.attempts.filter(a=>a.status==='delivered').length,0);
 await assert.rejects(f.action({action:'recover'}),/VISUAL|COMPOSITION/u);assert.equal(f.calls.length,2);
 await f.action({action:'abandon_response',confirm:true});bad=false;await f.action({action:'start'});assert.equal((await f.raw()).status,'active',(await f.raw()).pendingAttempt?.errorCode);
 assert.equal(f.calls.length,4);assert.equal(f.calls[2].packet.reviewed_coach_observations,undefined);
 assert.equal((await f.box()).attempts[0].status,'dispatched');assert.equal((await f.box()).attempts.filter(a=>a.status==='delivered').length,0);await f.originalsUnchanged();
});
test('strict Coach recovery rejects metadata, ownership and admitted hash tampering without dispatch or state write',async t=>{
 const cases={
  kind:r=>{r.kind='response';},mm:r=>{r.record.mm='MM-FOREIGN';},task:r=>{r.record.task='CLOSE';},id:r=>{r.record.id='foreign-evidence';},
  current:r=>{r.record.current_apa='0'.repeat(64);},baseline:r=>{r.record.source_apa='0'.repeat(64);},
  rehashedActor:r=>{const p=JSON.parse(r.request.input);p.athlete.actorId='foreign';r.request.input=JSON.stringify(p);r.record.request_sha256=digest(r.request);}
 };
 for(const [name,change]of Object.entries(cases))await t.test(name,async()=>{
  const f=await unresolvedFull(),attempt=(await f.raw()).pendingAttempt.id,key='coach-evidence:'+f.mm+':'+attempt+':request';
  await f.patch(key,change);const before=digest(await f.raw());
  await assert.rejects(cold(f).action(f.owner,await f.command({action:'recover'})),/RECOVERED_RESULT_MISMATCH/u);assert.equal(digest(await f.raw()),before);assert.equal(f.calls.length,2);await f.originalsUnchanged();
 });
});
test('strict visual cold recovery rejects rehashed foreign binding and missing raw evidence',async t=>{
 for(const mode of ['foreign-binding','missing-response'])await t.test(mode,async()=>{
  const f=await unresolvedFull(),attempt=(await f.raw()).pendingAttempt.id,key='coach-visual-evidence:'+f.mm+':'+attempt+':response';
  if(mode==='missing-response')f.values.delete('more:athlete-academy:{test-flagship-service}:'+key);
  else {
   await f.patch(key,r=>{const p=JSON.parse(r.response.output_text);p.stateBinding.actorId='foreign';r.response.output_text=JSON.stringify(p);r.response_sha256=hashCanonicalJson(r.response);});
   const changed=await f.repo.read(key);await f.patch('coach-visual-evidence:'+f.mm+':'+attempt+':receipt',r=>{r.response_sha256=changed.response_sha256;});
  }
  const before=digest(await f.raw());await assert.rejects(cold(f).action(f.owner,await f.command({action:'recover'})),/VISUAL|COMPOSITION/u);assert.equal(digest(await f.raw()),before);assert.equal(f.calls.length,2);
 });
});
test('account, participation and report races after Coach success prevent visual admission and success',async t=>{
 for(const mode of ['session','participation','report'])await t.test(mode,async()=>{
  let f,changed=false;
  f=await fixture({transportHook:async(request,_options,packet)=>{
   if(!Array.isArray(request.input)&&!changed){changed=true;await f.patch(mode==='session'?'account:'+f.owner.id:'dossier:'+f.mm,d=>{
    if(mode==='session')d.sessionVersion++;if(mode==='participation')d.participation.athleteAccepted=false;if(mode==='report')d.reports.apa.artifactHash='0'.repeat(64);});}
   return defaultResponse(request,packet);
  }});
  await assert.rejects(f.action({action:'start'}),/SESSION_EXPIRED|PARTICIPATION|COACH_SOURCES_CHANGED|REPORT_INTEGRITY/u);
  assert.equal(f.calls.length,1);const s=await f.raw();assert.equal(s.status,'unknown');assert.equal(s.visuals?.length||0,0);await reportsUnchanged(f);
 });
});
test('pending confirmed source overrides persisted false currency; exact note admits null-APA descriptor without publication',async()=>{
 const f=await fixture(),id=await sourceMessage(f);await confirm(f,id);await f.patch(f.key,s=>{s.apaNeedsReview=false;});await f.ready();
 await f.action({action:'start'});const s=await f.raw();assert.equal(s.status,'active',s.pendingAttempt?.errorCode);
 assert.equal(s.sessionStartMap.apa_needs_review,true);assert.equal(s.apaNeedsReview,true);
 const input=f.calls[0].packet;assert.equal(input.full_youth_apa,null);assert.equal(input.apa_currency.requires_review,true);assert.equal(input.apa_currency.baseline_apa_sha256,f.bundle.binding.apa);assert.equal(input.athlete.actorId,f.owner.id);
 assert.equal((await f.box()).attempts.filter(a=>a.status==='delivered').length,1);assert.equal(s.currentApa,null);assert.equal(s.apaDraft,null);await reportsUnchanged(f);assert.equal(digest(s.plan),digest(f.original.plan));assert.equal(digest(s.learning),digest(f.original.learning));
});
test('valid separate publication overrides stale persisted true currency at next Start',async()=>{
 const f=await fixture({transportHook:(request,_options,packet)=>packet.contract==='athlete_academy_current_apa_composition_packet_v1'?deltaResponse(packet):defaultResponse(request,packet)});
 const id=await sourceMessage(f),change=await confirm(f,id);await f.action({action:'update_apa',confirmation_id:change.id,expected_version:0});
 const d=(await f.raw()).apaDraft;assert.ok(d,(await f.raw()).pendingAttempt?.errorCode);assert.equal((await f.raw()).currentApa,null);
 await f.action({action:'publish_apa',id:d.id,hash:d.hash,expected_version:d.expectedVersion,artifact_hash:d.previewRecord.artifact.artifact_sha256,confirmation_id:d.confirmedChange.id,source_id:d.source_id});
 assert.equal((await f.raw()).currentApa.version,1);await f.patch(f.key,s=>{s.apaNeedsReview=true;});await f.action({action:'start'});
 const s=await f.raw();assert.equal(s.status,'active',s.pendingAttempt?.errorCode);assert.equal(s.sessionStartMap.apa_needs_review,false);assert.equal(s.apaNeedsReview,false);
 const input=f.calls.find(c=>c.kind==='OPENING').packet;assert.notEqual(input.full_youth_apa,null);assert.equal(input.apa_currency.requires_review,false);assert.equal(input.apa_currency.version,1);await reportsUnchanged(f);
});
test('own saved statements and corrections append RSL; explicit retraction suppresses stale APA without changing original reports',async()=>{
 const f=await fixture();await f.action({action:'start'});await f.action({action:'message',text:'I prefer quiet practice.'});
 let s=await f.raw(),message=s.messages.findLast(m=>m.role==='user');await f.action({action:'confirm_memory',source_message_id:message.id});
 s=await f.raw();const statement=s.rslEvents.find(e=>e.event_type==='ATHLETE_STATEMENT');assert.ok(statement);
 await f.action({action:'message',text:'Correction: I now prefer a brief partner reminder.'});message=(await f.raw()).messages.findLast(m=>m.role==='user');
 await f.action({action:'confirm_memory',source_message_id:message.id,target_event_id:statement.event_id});
 s=await f.raw();assert.ok(s.rslEvents.some(e=>e.event_type==='CORRECTION'));assert.equal(s.currentApa,null);
 await f.action({action:'message',text:'What have I told you?'});const input=f.calls.at(-1).packet;assert.equal(input.full_youth_apa,null);assert.equal(input.apa_currency.requires_review,true);
 assert.ok(input.governed_personal_memory.items.some(item=>JSON.stringify(item).includes('brief partner')));assert.ok(!input.governed_personal_memory.items.some(item=>JSON.stringify(item).includes('quiet practice')));
 await f.action({action:'forget',id:f.original.learning[0].id});s=await f.raw();assert.ok(s.rslEvents.some(e=>e.event_type==='RETRACTION'));const n=s.rslEvents.length;
 await f.action({action:'forget',id:f.original.learning[1].id});s=await f.raw();assert.equal(s.rslEvents.length,n);assert.ok(s.events.some(e=>e.type==='owned_saved_preference_removed'&&e.no_prior_rsl_event_invented));assert.equal(s.learning.length,0);
 assert.equal(digest(s.plan),digest(f.original.plan));assert.equal(s.currentApa,null);assert.equal(s.apaDraft,null);await reportsUnchanged(f);
});
test('memory confirmation rejects foreign, captured, non-athlete and spoofed sources without dispatch or writes',async t=>{
 for(const mode of ['foreign','captured','coach','spoof','target-learning'])await t.test(mode,async()=>{
  const f=await fixture(),id=await sourceMessage(f);
  await f.patch(f.key,s=>{const m=s.messages.find(m=>m.id===id);if(mode==='foreign')m.actorId='foreign';if(mode==='captured')m.capture={source:'coach'};if(mode==='coach')m.speaker='coach';});
  const cmd={action:'confirm_memory',source_message_id:id,...(mode==='spoof'?{actorId:f.owner.id}:{}),...(mode==='target-learning'?{target_event_id:'not-an-active-statement'}:{})};
  const before=digest(await f.raw());await assert.rejects(f.action(cmd),/ATHLETE_FACT_SOURCE_REQUIRED|COACH_ACTOR_SPOOF_DENIED|ATHLETE_RSL_TARGET_NOT_ACTIVE/u);assert.equal(digest(await f.raw()),before);assert.equal(f.calls.length,0);await reportsUnchanged(f);
 });
});
test('legacy closing without visual, ledger or start map refreshes honestly without Finish deadlock',async()=>{
 const f=await fixture();await f.patch(f.key,s=>{s.status='review';s.closing={id:'88888888-8888-4888-8888-888888888888',summary:'Old discussion only.',learning:[]};delete s.sessionId;delete s.sessionStartMap;delete s.rslEvents;delete s.rslLedgerContract;s.visuals=[];});
 assert.equal((await f.service.state(f.owner,{mm:f.mm})).state.closing_reveal_ready,false);await assert.rejects(f.action({action:'finish',remember:[]}),/CLOSING_REVIEW_REFRESH_REQUIRED/u);assert.equal(f.calls.length,0);
 await f.action({action:'close'});const s=await f.raw();assert.equal(s.status,'review',s.pendingAttempt?.errorCode);
 const object=s.visuals.at(-1).plan.blocks.flatMap(b=>b.objects).find(o=>o.id==='athlete-map-change');assert.match(object.statement,/before-and-after comparison is unavailable/iu);assert.equal(object.title,'Your map at this closing');
 assert.equal((await f.service.state(f.owner,{mm:f.mm})).state.closing_reveal_ready,true);await f.action({action:'finish',remember:[]});assert.equal((await f.raw()).status,'closed');assert.equal(f.calls.length,2);await reportsUnchanged(f);
});
test('closingReady refuses foreign actor, relationship scope and non-main plan version',async t=>{
 for(const mode of ['actor','relationship','version'])await t.test(mode,async()=>{
  const f=await fixture();await f.action({action:'start'});await f.action({action:'close'});
  await f.patch(f.key,s=>{const p=s.visuals.at(-1).plan;if(mode==='actor')p.stateBinding.actorId='foreign';if(mode==='relationship')p.stateBinding.relationshipScopeHash='0'.repeat(64);if(mode==='version')p.planVersion='demo-visual-v1';});
  assert.equal((await f.service.state(f.owner,{mm:f.mm})).state.closing_reveal_ready,false);const before=digest(await f.raw());
  await assert.rejects(f.action({action:'finish',remember:[]}),/CLOSING_REVIEW_REFRESH_REQUIRED/u);assert.equal(digest(await f.raw()),before);assert.equal(f.calls.length,4);
 });
});
test('actual BOS feedback enters CHAT only as feedback; original reports, RSL and APA remain unchanged',async()=>{
 const f=await fixture();await f.action({action:'start'});const before=await f.raw(),ledger=digest(before.rslEvents||[]);
 await f.action({action:'feedback',section:'portrait',choice:'fits',comment:'Fictional self-report only.',report_hash:f.bundle.binding.bos});
 let s=await f.raw();assert.equal(digest(s.rslEvents||[]),ledger);assert.equal(s.apaConfirmedChanges?.length||0,0);assert.equal(s.currentApa,null);assert.equal(s.apaDraft,null);await reportsUnchanged(f);
 await f.action({action:'message',text:'Let us discuss what I noticed.'});const input=f.calls.at(-1).packet;
 assert.equal(input.bos_validation_feedback.entries.length,1);assert.equal(input.bos_validation_feedback.entries[0].choice,'fits');
 s=await f.raw();assert.equal(digest(s.rslEvents||[]),ledger);assert.equal(s.apaConfirmedChanges?.length||0,0);assert.equal(s.currentApa,null);await reportsUnchanged(f);
});
async function refreshCanonicalPair(f,{applyRefresh=true}={}) {
 const oldBos=await f.repo.read(f.reportKeys[0]),oldApa=await f.repo.read(f.reportKeys[1]);
 const b=clone(oldBos),a=clone(oldApa);
 b.artifact.reading.portrait.headline+=' (new independently saved fictional reading)';
 delete b.artifact.artifact_sha256;b.artifact.artifact_sha256=hash(b.artifact);
 a.artifact.bos_sha256=hash(b.artifact);a.artifact.identity.reading_sha256=hash(b.artifact);
 delete a.artifact.artifact_sha256;a.artifact.artifact_sha256=hash(a.artifact);
 const bosVersion='99999999-9999-4999-8999-999999999999',apaVersion='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
 const bk='report:'+f.mm+':bos:'+bosVersion,ak='report:'+f.mm+':apa:'+apaVersion,dk='dossier:'+f.mm;
 await f.repo.transact([bk,ak,dk],snapshot=>{
  const d=snapshot[dk];d.reports.bos={currentVersionId:bosVersion,artifactHash:b.artifact.artifact_sha256};
  d.reports.apa={currentVersionId:apaVersion,artifactHash:a.artifact.artifact_sha256,bosVersionId:bosVersion};d.revision++;
  return {writes:{[bk]:b,[ak]:a,[dk]:d},result:true};
 });
 f.refreshedReports={keys:[bk,ak],hash:digest([b,a])};
 if(applyRefresh)await f.action({action:'refresh_sources',confirm:true});
 return f.service.bundle(f.owner,{mm:f.mm});
}
test('legacy saved learning removal and removal after explicit source refresh retain honest history until later explicit publication',async t=>{
 for(const refresh of [false,true])await t.test(refresh?'source-refresh-removal':'unknown-legacy-removal',async()=>{
  const f=await fixture({transportHook:(request,_options,packet)=>packet.contract==='athlete_academy_current_apa_composition_packet_v1'?deltaResponse(packet):defaultResponse(request,packet)});
  if(refresh)await refreshCanonicalPair(f);
  const firstSource=await sourceMessage(f),first=await confirm(f,firstSource);
  await f.action({action:'update_apa',confirmation_id:first.id,expected_version:0});
  const firstDraft=(await f.raw()).apaDraft;assert.ok(firstDraft);
  await f.action({action:'publish_apa',id:firstDraft.id,hash:firstDraft.hash,expected_version:0,artifact_hash:firstDraft.previewRecord.artifact.artifact_sha256,confirmation_id:first.id,source_id:firstDraft.source_id});
  const id=refresh?f.original.learning[0].id:f.original.learning[1].id;
  await f.action({action:'forget',id});
  let s=await f.raw();assert.ok(!s.learning.some(item=>item.id===id));assert.equal(s.apaReviewRequirements.length,1);assert.equal(s.rslEvents?.filter(e=>e.event_type==='RETRACTION').length||0,0);
  assert.ok(s.events.some(e=>e.type==='owned_saved_preference_removed'&&e.no_prior_rsl_event_invented===true));
  assert.equal((await f.service.state(f.owner,{mm:f.mm})).state.apaNeedsReview,true);assert.equal(f.calls.length,1);
  const source=await sourceMessage(f,undefined,'cccccccc-cccc-4ccc-8ccc-cccccccccccc');
  await f.action({action:'confirm_fact',source_message_id:source,reason:'I reviewed this later saved source after removal.',kind:'correction',supersedes:[firstDraft.source_id]});
  const c=(await f.raw()).apaConfirmedChanges.at(-1);
  await f.action({action:'update_apa',confirmation_id:c.id,expected_version:1});
  const d=(await f.raw()).apaDraft;assert.ok(d,JSON.stringify([...f.values.entries()].filter(([k])=>k.includes(':coach-apa-evidence:')&&k.endsWith(':failure')).map(([,v])=>{const e=JSON.parse(v);return {code:e.code,stage:e.stage,rules:e.validation_errors};})));
  assert.equal((await f.raw()).apaReviewRequirements.length,1);
  await f.action({action:'publish_apa',id:d.id,hash:d.hash,expected_version:d.expectedVersion,artifact_hash:d.previewRecord.artifact.artifact_sha256,confirmation_id:d.confirmedChange.id,source_id:d.source_id});
  s=await f.raw();assert.equal(s.apaReviewRequirements.length,0);assert.equal((await f.service.state(f.owner,{mm:f.mm})).state.apaNeedsReview,false);
  assert.equal(s.currentApa.version,2);assert.equal(digest(s.plan),digest(refresh?{...f.original.plan,sourceBinding:f.bundle.binding}:f.original.plan));await reportsUnchanged(f);
  if(refresh)assert.equal(digest(await Promise.all(f.refreshedReports.keys.map(key=>f.repo.read(key)))),f.refreshedReports.hash);
 });
});
test('account, participation and report races before dispatch and after complete visual keep note undelivered',async t=>{
 for(const stage of ['before-dispatch','after-visual'])for(const mode of ['session','participation','report'])await t.test(stage+'-'+mode,async()=>{
  let f,changed=false;
  const change=async()=>{
   changed=true;await f.patch(mode==='session'?'account:'+f.owner.id:'dossier:'+f.mm,d=>{
    if(mode==='session')d.sessionVersion++;if(mode==='participation')d.participation.athleteAccepted=false;if(mode==='report')d.reports.apa.artifactHash='0'.repeat(64);});
  };
  f=await fixture({transportHook:async(request,_options,packet)=>{
   const result=defaultResponse(request,packet);if(stage==='after-visual'&&Array.isArray(request.input)&&!changed)await change();return result;
  }});
  await f.ready();
  if(stage==='before-dispatch')f.redis.afterEval=async({keys})=>{
   if(!changed&&keys.some(key=>key.includes(':coach-evidence:')&&key.endsWith(':request')))await change();
  };
  await assert.rejects(f.action({action:'start'}),/SESSION_EXPIRED|PARTICIPATION|COACH_SOURCES_CHANGED/u);
  f.redis.afterEval=null;
  const s=await f.raw();assert.equal(s.status,'unknown');assert.equal(s.visuals?.length||0,0);assert.equal(f.calls.length,stage==='before-dispatch'?0:2);
  assert.equal((await f.box()).attempts.some(attempt=>attempt.status==='delivered'),false);await reportsUnchanged(f);
 });
});
test('note admission rejects old full APA packet if a saved owner-reviewed correction becomes pending before dispatch',async()=>{
 const f=await fixture();await f.ready();const message=await sourceMessage(f);
 let changed=false;
 f.redis.afterEval=({keys,values})=>{
  if(changed||!keys.some(key=>key.includes(':coach-evidence:')&&key.endsWith(':request')))return;
  changed=true;const key=f.repo.prefix+':'+f.key,s=JSON.parse(values.get(key));
  s.apaConfirmedChanges=[{id:'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',source_message_id:message,actorId:f.owner.id,mm:f.mm,kind:'reality',supersedes:[],confirmed:true,confirmed_by:'athlete',confirmed_at:new Date(f.now()).toISOString(),reason:'Reviewed concurrently in this isolated fictional CAS fixture.',source_id:'APA:ACADEMY:'+f.owner.id+':bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'}];
  values.set(key,JSON.stringify(s));
 };
 await f.action({action:'start'});f.redis.afterEval=null;
 const s=await f.raw();assert.equal(changed,true);assert.equal(s.status,'unknown');assert.equal(f.calls.length,0);assert.equal(s.visuals?.length||0,0);
 assert.equal((await f.box()).attempts[0].status,'reserved');assert.equal((await f.box()).attempts.some(attempt=>attempt.status==='delivered'),false);await reportsUnchanged(f);
});
 test('applied final CAS with lost acknowledgment is read back without new dispatch or duplicate delivered note',async()=>{
 const f=await fixture();await f.ready();let lost=false;
 f.redis.afterEval=({keys,next})=>{
  const i=keys.findIndex(key=>key.endsWith(':'+f.key));if(i<0||!next[i])return;
  const state=JSON.parse(next[i]);
  if(!lost&&state.status==='active'&&!state.pendingAttempt&&state.visuals?.length){lost=true;throw Error('OFFLINE_APPLIED_FINAL_ACK_LOST');}
 };
 const request=await f.command({action:'start'});
 await assert.rejects(f.service.action(f.owner,request),/STORAGE_OUTCOME_UNKNOWN/u);f.redis.afterEval=null;
 assert.equal(lost,true);assert.equal(f.calls.length,2);const state=await f.raw(),box=await f.box();
 assert.equal(state.status,'active');assert.equal(state.pendingAttempt,undefined);assert.equal(box.attempts.filter(a=>a.status==='delivered').length,1);
 const stateHash=digest(state),boxHash=digest(box);
 await cold(f).state(f.owner,{mm:f.mm});
 await cold(f).action(f.owner,request);
 assert.equal(digest(await f.raw()),stateHash);assert.equal(digest(await f.box()),boxHash);assert.equal(f.calls.length,2);await f.originalsUnchanged();
});
 function configured(f,config) {return createCoachingService({repo:f.repo,config,academy:f.academy,notes:f.notesService,transport:f.transport,now:f.now});}
async function currentPublished(f) {
 const message=await sourceMessage(f),change=await confirm(f,message);
 await f.action({action:'update_apa',confirmation_id:change.id,expected_version:0});
 const d=(await f.raw()).apaDraft;assert.ok(d,(await f.raw()).pendingAttempt?.errorCode);
 const publish=await f.command({action:'publish_apa',id:d.id,hash:d.hash,expected_version:0,artifact_hash:d.previewRecord.artifact.artifact_sha256,confirmation_id:change.id,source_id:d.source_id});
 await f.service.action(f.owner,publish);return publish;
}
const mutationKinds=['start','message','close','view','draft','approve','discard','remember','forget','finish','continue','reset','share_draft','revoke_share','confirm_memory','confirm_fact','update_apa','publish_apa','discard_apa','recover','abandon_response','refresh_sources','feedback'];
test('upgrade to explicit operator write hold preserves evolved current APA, plan and RSL; all Consulting mutations deny without calls or writes',async()=>{
 const f=await fixture({transportHook:(request,_options,packet)=>packet.contract==='athlete_academy_current_apa_composition_packet_v1'?deltaResponse(packet):defaultResponse(request,packet)});
 await currentPublished(f);await f.action({action:'start'});await f.action({action:'message',text:'A short reminder helps.'});
 const own=(await f.raw()).messages.findLast(m=>m.role==='user');await f.action({action:'confirm_memory',source_message_id:own.id});
 const snapshot=JSON.stringify(await f.raw()),calls=f.calls.length,held=configured(f,{...f.config,coachingWriteHold:true});
 const read=(await held.state(f.owner,{mm:f.mm})).state;
 assert.equal(read.coaching_write_hold.reason,'OPERATOR_READ_HOLD');assert.equal(read.continuity.current_version,1);assert.equal(read.capabilities.currentApa,true);
 assert.equal(digest(read.plan),digest((await f.raw()).plan));assert.equal(digest(read.rslEvents),digest((await f.raw()).rslEvents));
 assert.equal(JSON.stringify(await f.raw()),snapshot);
 for(const action of mutationKinds){
  await assert.rejects(held.action(f.owner,await f.command({action,text:'No write permitted.',confirm:true})));
  assert.equal(JSON.stringify(await f.raw()),snapshot,action);assert.equal(f.calls.length,calls,action);
 }
 await cold(f).action(f.owner,await f.command({action:'message',text:'The compatible upgraded build is restored.'}));assert.equal((await f.raw()).status,'active');assert.equal(f.calls.length,calls+1);await reportsUnchanged(f);
});
test('feature downgrade is compatible read-only, not legacy writable; restore retains source-bound current APA, plan, RSL and visuals',async()=>{
 const f=await fixture({transportHook:(request,_options,packet)=>packet.contract==='athlete_academy_current_apa_composition_packet_v1'?deltaResponse(packet):defaultResponse(request,packet)});
 await currentPublished(f);await f.action({action:'start'});
 const snapshot=JSON.stringify(await f.raw()),calls=f.calls.length,held=configured(f,{...f.config,currentApaEnabled:false,flagshipEnabled:false});
 const read=(await held.state(f.owner,{mm:f.mm})).state;
 assert.equal(read.coaching_write_hold.reason,'FLAGSHIP_STATE_REQUIRES_COMPATIBLE_BUILD');assert.equal(read.continuity.current_version,1);assert.equal(read.continuity.current.artifact.artifact_sha256,(await f.raw()).currentApa.artifact.artifact_sha256);
 assert.equal(digest(read.plan),digest(f.original.plan));assert.equal(read.visuals.length,1);assert.equal(read.capabilities.currentApa,true);assert.equal(JSON.stringify(await f.raw()),snapshot);
 for(const action of mutationKinds){await assert.rejects(held.action(f.owner,await f.command({action,confirm:true,text:'No downgraded mutation.'})));assert.equal(JSON.stringify(await f.raw()),snapshot,action);assert.equal(f.calls.length,calls,action);}
 const restored=(await cold(f).state(f.owner,{mm:f.mm})).state;assert.equal(restored.coaching_write_hold,undefined);assert.equal(restored.flagship_enabled,true);assert.equal(restored.continuity.current_version,1);assert.equal(JSON.stringify(await f.raw()),snapshot);
 await f.action({action:'close'});assert.equal((await f.raw()).status,'review');assert.equal(f.calls.length,calls+2);await reportsUnchanged(f);
});
test('held expired pending attempt/evidence are byte-preserved, then upgraded exact recovery makes no provider replay',async()=>{
 const f=await fixture(),release=loseFinalCommit(f);
 await assert.rejects(f.action({action:'start'}),/STORAGE_OUTCOME_UNKNOWN/u);release();f.advance(420001);
 const before=JSON.stringify(await f.raw()),evidence=digest([...f.values.entries()].filter(([key])=>key.includes(':coach-evidence:')||key.includes(':coach-visual-evidence:')));
 const held=configured(f,{...f.config,coachingWriteHold:true});
 assert.equal((await held.state(f.owner,{mm:f.mm})).state.status,'working');assert.equal(JSON.stringify(await f.raw()),before);
 await assert.rejects(held.action(f.owner,await f.command({action:'recover'})),/COACHING_COMPATIBILITY_READ_ONLY/u);assert.equal(JSON.stringify(await f.raw()),before);assert.equal(f.calls.length,2);
 assert.equal(digest([...f.values.entries()].filter(([key])=>key.includes(':coach-evidence:')||key.includes(':coach-visual-evidence:'))),evidence);
 await cold(f).state(f.owner,{mm:f.mm});assert.equal((await f.raw()).status,'unknown');
 await cold(f).action(f.owner,await f.command({action:'recover'}));assert.equal((await f.raw()).status,'active');assert.equal(f.calls.length,2);await f.originalsUnchanged();
});
test('compatible held source-stale read is historical and cannot refresh or mutate the preserved original binding',async()=>{
 const f=await fixture();await f.action({action:'start'});await refreshCanonicalPair(f,{applyRefresh:false});
 const before=JSON.stringify(await f.raw()),calls=f.calls.length,held=configured(f,{...f.config,flagshipEnabled:false,currentApaEnabled:false});
 const read=(await held.state(f.owner,{mm:f.mm})).state;
 assert.equal(read.coaching_write_hold.active,true);assert.equal(read.sourceUpdateAvailable,true);assert.equal(read.continuity.stale,true);assert.equal(read.continuity.current,null);assert.equal(read.apaNeedsReview,true);assert.equal(JSON.stringify(await f.raw()),before);
 await assert.rejects(held.action(f.owner,await f.command({action:'refresh_sources',confirm:true})),/COACHING_COMPATIBILITY_READ_ONLY/u);assert.equal(JSON.stringify(await f.raw()),before);assert.equal(f.calls.length,calls);await reportsUnchanged(f);
});
 test('actual CAS prior conflict before accepted claim retries only local transaction and dispatches each admitted stage once',async()=>{
 const f=await fixture();let conflicted=false;
 f.redis.beforeEval=({keys,next,values})=>{
  const index=keys.findIndex(key=>key.endsWith(':'+f.key));if(conflicted||index<0||!next[index])return;
  const state=JSON.parse(next[index]);if(state.status!=='working'||!state.pendingAttempt)return;
  assert.equal(f.calls.length,0);conflicted=true;
  const key=f.repo.prefix+':dossier:'+f.mm,d=JSON.parse(values.get(key));d.revision++;values.set(key,JSON.stringify(d));
 };
 await f.action({action:'start'});f.redis.beforeEval=null;
 assert.equal(conflicted,true);assert.equal((await f.raw()).status,'active');assert.equal(f.calls.length,2);assert.equal((await f.raw()).visuals.length,1);await reportsUnchanged(f);
});
 function assertPublicCoachingDto(state) {
 for(const v of state.visuals||[]){assert.equal(Object.hasOwn(v,'receipt'),false);assert.equal(Object.hasOwn(v.plan,'providerReceipt'),false);}
 if(state.pendingAttempt?.flagship)assert.deepEqual(Object.keys(state.pendingAttempt.flagship).sort(),['contract','event']);
}
test('actual operator hold, downgrade and source-stale GET redact private pending and visual metadata without touching stored evidence',async()=>{
 let failChat=false;
 const f=await fixture({transportHook:(request,_options,packet)=>{
  if(packet.contract==='athlete_academy_current_apa_composition_packet_v1')return deltaResponse(packet);
  if(!Array.isArray(request.input)&&packet.task==='CHAT'&&failChat)throw Error('OFFLINE_CHAT_UNKNOWN');
  return defaultResponse(request,packet);
 }});
 await currentPublished(f);await f.action({action:'start'});failChat=true;await f.action({action:'message',text:'Keep my saved context.'});
 const stored=await f.raw();assert.equal(stored.status,'unknown');assert.ok(stored.pendingAttempt.flagship.reservedIdentity);assert.ok(stored.pendingAttempt.flagship.coachRequestHash);
 assert.ok(stored.visuals[0].receipt);assert.ok(stored.visuals[0].plan.providerReceipt);
 for(const config of [{...f.config,coachingWriteHold:true},{...f.config,currentApaEnabled:false,flagshipEnabled:false}]){
  const snapshot=JSON.stringify(await f.raw()),all=digest([...f.values.entries()]),calls=f.calls.length;
  const read=(await configured(f,config).state(f.owner,{mm:f.mm})).state;
  assertPublicCoachingDto(read);assert.equal(read.coaching_write_hold.active,true);assert.equal(read.pendingAttempt.flagship.contract,stored.pendingAttempt.flagship.contract);assert.equal(read.visuals.length,1);
  assert.equal(JSON.stringify(await f.raw()),snapshot);assert.equal(digest([...f.values.entries()]),all);assert.equal(f.calls.length,calls);
 }
 await refreshCanonicalPair(f,{applyRefresh:false});
 const snapshot=JSON.stringify(await f.raw()),all=digest([...f.values.entries()]),calls=f.calls.length;
 const stale=(await configured(f,{...f.config,currentApaEnabled:false,flagshipEnabled:false}).state(f.owner,{mm:f.mm})).state;
 assertPublicCoachingDto(stale);assert.equal(stale.sourceUpdateAvailable,true);assert.equal(stale.continuity.stale,true);
 assert.equal(JSON.stringify(await f.raw()),snapshot);assert.equal(digest([...f.values.entries()]),all);assert.equal(f.calls.length,calls);await reportsUnchanged(f);
});
test('exact cached APA publication acknowledgment under downgraded flagship uses redacted held DTO without writes or dispatch',async()=>{
 let failChat=false;
 const f=await fixture({transportHook:(request,_options,packet)=>{
  if(packet.contract==='athlete_academy_current_apa_composition_packet_v1')return deltaResponse(packet);
  if(!Array.isArray(request.input)&&packet.task==='CHAT'&&failChat)throw Error('OFFLINE_CHAT_UNKNOWN');
  return defaultResponse(request,packet);
 }});
 const publish=await currentPublished(f);await f.action({action:'start'});failChat=true;await f.action({action:'message',text:'Keep the saved attempt.'});
 const before=JSON.stringify(await f.raw()),all=digest([...f.values.entries()]),calls=f.calls.length;
 const result=await configured(f,{...f.config,currentApaEnabled:true,flagshipEnabled:false}).action(f.owner,publish);
 assert.equal(result.state.coaching_write_hold.active,true);assertPublicCoachingDto(result.state);
 assert.equal(result.state.continuity.current_version,1);assert.equal(JSON.stringify(await f.raw()),before);assert.equal(digest([...f.values.entries()]),all);assert.equal(f.calls.length,calls);await reportsUnchanged(f);
});
