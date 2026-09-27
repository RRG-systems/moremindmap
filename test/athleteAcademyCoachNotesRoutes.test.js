import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import {createAcademyHandler} from '../server/athleteAcademyV1/handler.js';
import {createCoachNotesService} from '../server/athleteAcademyV1/coaching/coachNotes.js';
import {COACH_NOTES_POLICY_VERSION,noteCommand} from '../server/athleteAcademyV1/coaching/coachNotesPolicy.js';
import {requireValue} from '../server/athleteAcademyV1/repository.js';
import {coachNoteOperation,coachNoteFailureKnownNoWrite,coachNoteOutcomeAcknowledged,coachNoteOperationAcknowledged} from '../src/athleteAcademyV1/coach/coachNotesActions.js';

const origin='https://fictional-academy.test.invalid';
const uuid=n=>`${String(n).padStart(8,'0')}-1111-4111-8111-111111111111`;
const owner={id:'fictional-owner',mm:'MM-FICTIONAL-OWNER',verified:true,sessionVersion:1,displayName:'Fictional Owner',role:'athlete'};
const recipient={id:'fictional-recipient',mm:'MM-FICTIONAL-RECIPIENT',verified:true,sessionVersion:1,displayName:'Fictional Recipient',role:'athlete'};
const fields={
 invite:['requestId','mm','recipient_email','purpose','policy_version','next_opening_context','expires_at'],
 accept:['requestId','mm','grant_id','grant_version','terms_hash','policy_version','accepted'],
 revoke:['requestId','mm','grant_id','grant_version'],
 append:['requestId','mm','grant_id','grant_version','text','reviewed'],
 review:['requestId','mm','note_id','content_sha256','grant_version'],
};
function fixture({enabled=true,policy=COACH_NOTES_POLICY_VERSION,notesPresent=true,academyEnabled=true}={}){
 const calls=[],writes=[];
 const sessions={
  'fictional-owner-session':{csrf:'fictional-owner-form',account:owner},
  'fictional-recipient-session':{csrf:'fictional-recipient-form',account:recipient},
  'fictional-unverified-session':{csrf:'fictional-unverified-form',account:{...recipient,verified:false}},
  'fictional-anonymous-session':{csrf:'fictional-anonymous-form',account:null},
 };
 const assigned={mm:owner.mm,athlete_name:'Fictional Owner',grant_id:uuid(1),grant_version:2,
  purpose:'observation-only',policy_version:COACH_NOTES_POLICY_VERSION,
  next_opening_context:'attributed-unverified-next-opening-only',expires_at:'2026-10-01T12:00:00.000Z',terms_hash:'a'.repeat(64)};
 const receipt={id:uuid(2),mm:owner.mm,grant_id:uuid(1),content_sha256:'b'.repeat(64),
  created_at:'2026-09-27T12:00:00.000Z',review_status:'reviewed-send',reviewed_by:recipient.id,
  reviewed_at:'2026-09-27T12:00:00.000Z',owner_acknowledged:false,status:'queued',attempt_id:null,
  dispatched_at:null,completed_at:null};
 const record=(name,account,body)=>calls.push({name,actor:account?.id,body:structuredClone(body??{})});
 const auth={
  async session(raw){calls.push({name:'auth.session'});return sessions[raw]||null;},
  async limited(){calls.push({name:'auth.limited'});},
  async createSession(){return {raw:'fictional-anonymous-session',session:sessions['fictional-anonymous-session']};},
 };
 const forbidden=name=>async(a,b)=>{record(name,a,b);throw Object.assign(Error('NOT_FOUND'),{code:'NOT_FOUND',status:404});};
 const academy={
  async getDossier(a,b){record('academy.getDossier',a,b);requireValue(b.mm===a.mm,'NOT_FOUND',404);
   return {dossier:{mm:a.mm,person:{name:a.displayName}}};},
  getReport:forbidden('academy.getReport'),
 };
 const coaching={bundle:forbidden('coaching.bundle'),state:forbidden('coaching.state'),action:forbidden('coaching.action')};
 const notes={
  async ownerNotes(a,b){record('notes.ownerNotes',a,b);noteCommand(b,['mm']);
   requireValue(a.id===owner.id&&b.mm===owner.mm,'NOT_FOUND',404);
   return {notes:[{id:uuid(2),mm:owner.mm,author_id:recipient.id,text:'Fictional owner-authorized observation.'}],grants:[],reviews:[],delivery:[receipt]};},
  async roster(a){record('notes.roster',a);return {assigned:a.id===recipient.id?[assigned]:[]};},
  async invitations(a){record('notes.invitations',a);return {invitations:a.id===recipient.id?[{...assigned,grant_id:uuid(3),grant_version:1}]:[]};},
  async receipts(a){record('notes.receipts',a);return {receipts:a.id===recipient.id?[receipt]:[]};},
 };
 for(const [kind,allowed] of Object.entries(fields))notes[kind]=async(a,b)=>{
  record('notes.'+kind,a,b);noteCommand(b,allowed);
  requireValue(b.mm===owner.mm,'COACH_NOTE_SCOPE_INVALID');
  requireValue(['invite','revoke','review'].includes(kind)?a.id===owner.id:a.id===recipient.id,'NOT_FOUND',404);
  writes.push({kind,actor:a.id,body:structuredClone(b)});
  return {acknowledged:true,reviewed_by:a.id};
 };
 const config={enabled:academyEnabled,origin,allowedOrigins:new Set([origin]),allowInsecureLocalhost:false,
  cohort:{minimumAge:18},coachNotesEnabled:enabled,coachNotesPolicyVersion:policy,
  providerEnabled:false,mailEnabled:false,syntheticPreview:true,realYouthEnabled:false};
 const outcomeValues=new Map([[`account:${owner.id}`,structuredClone(owner)],[`account:${recipient.id}`,structuredClone(recipient)]]);
 const outcomeTransactions=[];
 const outcomeService=createCoachNotesService({config,
  academy:{mutate(){throw Error('UNEXPECTED_OUTCOME_MUTATION');},participant(){throw Error('UNEXPECTED_PARTICIPANT_READ');}},
  repo:{async read(key){return structuredClone(outcomeValues.get(key));},async transact(keys,derive){
   const snapshot=Object.fromEntries(keys.map(key=>[key,structuredClone(outcomeValues.get(key))]));
   const decision=derive(snapshot);outcomeTransactions.push({keys:[...keys],writes:structuredClone(decision.writes)});
   for(const [key,value] of Object.entries(decision.writes)){writes.push({kind:'outcome',key});outcomeValues.set(key,structuredClone(value));}
   return structuredClone(decision.result);
  }}});
 notes.outcome=async(a,b)=>{record('notes.outcome',a,b);return outcomeService.outcome(a,b);};
 function seedOutcome(actor,query){
  const receipt={contract:'athlete_coach_note_operation_v1',actor_id:actor.id,mm:query.mm,
   request_id:query.request_id,signature_sha256:query.signature_sha256,kind:query.kind};
  outcomeValues.set(`operation:${actor.id}:${query.request_id}`,{signature:query.signature_sha256,
   result:{operation_receipt:receipt,text:'DO-NOT-RETURN fictional note text',recipient_email:'do-not-return@test.invalid'}});
 }
 const handler=createAcademyHandler({config,auth,academy,coaching,notes:notesPresent?notes:null,
  deliver:async()=>{throw Error('UNEXPECTED_MAIL');}});
 async function request({method='POST',body={},session='fictional-owner-session',headers={}}={}){
  const out={status:200,headers:{}};
  const res={setHeader(k,v){out.headers[k]=v;},status(value){out.status=value;return this;},json(value){out.body=value;return out;}};
  await handler({method,body,headers:{origin,'sec-fetch-site':'same-origin','content-type':'application/json',
   cookie:`more_athlete_academy=${session}`,'x-csrf-token':sessions[session]?.csrf,...headers},socket:{remoteAddress:'fictional-offline'}},res);
  return out;
 }
 return {request,calls,writes,assigned,receipt,outcomeValues,outcomeTransactions,seedOutcome};
}
const serviceCalls=f=>f.calls.filter(c=>c.name.startsWith('notes.'));
const otherReads=f=>f.calls.filter(c=>c.name.startsWith('academy.')||c.name.startsWith('coaching.'));
const outcomeQuery=(change={})=>({mm:owner.mm,request_id:uuid(30),signature_sha256:'c'.repeat(64),kind:'coach_notes_append',...change});
const pendingMetadata=query=>({request_id:query.request_id,signature_sha256:query.signature_sha256,kind:query.kind,target_mm:query.mm});

test('default-off and wrong policy omit note capability and reject every note route before service access',async()=>{
 for(const options of [{enabled:false},{enabled:true,policy:'unapproved-policy'}]){
  const f=fixture(options),boot=await f.request({method:'GET'});
  assert.equal(boot.status,200);assert.equal(Object.hasOwn(boot.body.capabilities,'coachNotes'),false);
  for(const action of ['coach_notes_view','coach_notes_outcome',...Object.keys(fields).map(k=>'coach_notes_'+k)]){
   const result=await f.request({body:{action,mode:'owner',mm:owner.mm,requestId:uuid(10)}});
   assert.equal(result.status,404);assert.equal(result.body.error.code,'COACH_NOTES_NOT_ACTIVE');
  }
  assert.deepEqual(serviceCalls(f),[]);assert.deepEqual(f.writes,[]);
 }
});
test('enabled bootstrap exposes only the authenticated account MM, never its assigned-athlete roster',async()=>{
 const f=fixture(),result=await f.request({method:'GET',session:'fictional-recipient-session'});
 assert.equal(result.status,200);assert.equal(result.body.capabilities.coachNotes,true);
 assert.deepEqual(result.body.athletes,[{mm:recipient.mm,name:recipient.displayName}]);
 assert.equal(JSON.stringify(result.body).includes(owner.mm),false);assert.deepEqual(serviceCalls(f),[]);
 assert.deepEqual(otherReads(f).map(c=>({name:c.name,mm:c.body.mm})),[{name:'academy.getDossier',mm:recipient.mm}]);
});
test('owner notes view reads only its own note service and binds the authenticated actor/MM',async()=>{
 const f=fixture(),result=await f.request({body:{action:'coach_notes_view',mode:'owner',mm:owner.mm,requestId:uuid(11)}});
 assert.equal(result.status,200);const view=result.body.coachNotes;
 assert.equal(view.contract,'athlete_academy_coach_notes_ui_v1');assert.equal(view.actor_id,owner.id);
 assert.equal(view.mode,'owner');assert.equal(view.mm,owner.mm);assert.equal(view.capabilities.coachNotes,true);
 assert.equal(view.notes.length,1);assert.deepEqual(view.assigned,[]);assert.deepEqual(view.invitations,[]);assert.deepEqual(view.receipts,[]);
 assert.deepEqual(serviceCalls(f).map(c=>({name:c.name,actor:c.actor,body:c.body})),
  [{name:'notes.ownerNotes',actor:owner.id,body:{mm:owner.mm}}]);
 assert.deepEqual(otherReads(f),[]);assert.deepEqual(f.writes,[]);
 assert.equal(result.headers['Cache-Control'],'no-store, private');assert.equal(result.headers['Vary'],'Cookie');
 assert.equal(result.headers['Referrer-Policy'],'no-referrer');assert.equal(result.headers['X-Content-Type-Options'],'nosniff');
});
test('recipient view reads only assigned rows, pending invitations and its own metadata receipts',async()=>{
 const f=fixture(),result=await f.request({session:'fictional-recipient-session',
  body:{action:'coach_notes_view',mode:'recipient',requestId:uuid(12)}});
 assert.equal(result.status,200);const view=result.body.coachNotes;
 assert.equal(view.actor_id,recipient.id);assert.equal(view.mm,null);assert.equal(view.mode,'recipient');
 assert.deepEqual(view.assigned,[f.assigned]);assert.equal(view.invitations.length,1);assert.deepEqual(view.receipts,[f.receipt]);
 for(const key of ['notes','grants','reviews','delivery'])assert.deepEqual(view[key],[]);
 assert.deepEqual(serviceCalls(f).map(c=>c.name).sort(),['notes.invitations','notes.receipts','notes.roster']);
 assert.ok(serviceCalls(f).every(c=>c.actor===recipient.id));assert.deepEqual(otherReads(f),[]);assert.deepEqual(f.writes,[]);
 const serialized=JSON.stringify(view);
 for(const text of ['Fictional owner-authorized observation.','reports','messages','currentApa','BOS'])assert.equal(serialized.includes(text),false);
});
test('authenticated outcome reads the exact own actor ledger and returns metadata only without writes or athlete reads',async()=>{
 for(const [actor,session,kind] of [[owner,'fictional-owner-session','coach_notes_invite'],[recipient,'fictional-recipient-session','coach_notes_append']]){
  const f=fixture(),query=outcomeQuery({kind});f.seedOutcome(actor,query);
  const before=structuredClone([...f.outcomeValues]);
  const result=await f.request({session,body:{action:'coach_notes_outcome',requestId:uuid(31),...query}});
  assert.equal(result.status,200);assert.deepEqual(result.body,{ok:true,noteOutcome:{contract:'athlete_coach_note_outcome_v1',
   actor_id:actor.id,...query,status:'acknowledged'}});
  assert.deepEqual(serviceCalls(f),[{name:'notes.outcome',actor:actor.id,body:query}]);
  assert.deepEqual(f.outcomeTransactions,[{keys:[`account:${actor.id}`,`operation:${actor.id}:${query.request_id}`],writes:{}}]);
  assert.deepEqual([...f.outcomeValues],before);assert.deepEqual(f.writes,[]);assert.deepEqual(otherReads(f),[]);
  for(const privateField of ['DO-NOT-RETURN','do-not-return@test.invalid','text','recipient_email','operation_receipt','grant_version'])
   assert.equal(JSON.stringify(result.body).includes(privateField),false);
  assert.equal(result.headers['Cache-Control'],'no-store, private');assert.equal(result.headers['Vary'],'Cookie');
 }
});
test('missing request or another authenticated actor stays unresolved without revealing another account receipt',async()=>{
 const f=fixture(),query=outcomeQuery();f.seedOutcome(owner,query);const before=structuredClone([...f.outcomeValues]);
 for(const [session,read,actor] of [['fictional-owner-session',{...query,request_id:uuid(32)},owner],['fictional-recipient-session',query,recipient]]){
  const result=await f.request({session,body:{action:'coach_notes_outcome',...read}});
  assert.equal(result.status,200);assert.equal(result.body.noteOutcome.status,'unresolved');assert.equal(result.body.noteOutcome.actor_id,actor.id);
  assert.equal(coachNoteOutcomeAcknowledged(result.body.noteOutcome,pendingMetadata(read),actor.id),false);
 }
 assert.deepEqual([...f.outcomeValues],before);assert.deepEqual(f.writes,[]);assert.deepEqual(otherReads(f),[]);
 assert.ok(f.outcomeTransactions.every(t=>Object.keys(t.writes).length===0));
});
test('outcome rejects wrong saved MM/hash/kind, malformed query, spoof fields and revoked session before any write',async()=>{
 const query=outcomeQuery();
 const cases=[
  [{mm:'MM-FICTIONAL-FOREIGN'},409,'COACH_NOTE_OUTCOME_MISMATCH'],
  [{signature_sha256:'d'.repeat(64)},409,'COACH_NOTE_OUTCOME_MISMATCH'],
  [{kind:'coach_notes_revoke'},409,'COACH_NOTE_OUTCOME_MISMATCH'],
  [{mm:null},422,'COACH_NOTE_SCOPE_INVALID'],
  [{request_id:'not-a-uuid'},422,'COACH_NOTE_COMMAND_INVALID'],
  [{signature_sha256:'C'.repeat(64)},422,'COACH_NOTE_COMMAND_INVALID'],
  [{kind:'append'},422,'COACH_NOTE_COMMAND_INVALID'],
  [{kind:'coach_state'},422,'COACH_NOTE_COMMAND_INVALID'],
  ...['actor_id','actorId','mode','role','text','recipient_email','reports'].map(key=>[{[key]:'claimed'},422,'COACH_NOTE_COMMAND_INVALID']),
 ];
 for(const [change,status,code] of cases){
  const f=fixture();f.seedOutcome(recipient,query);const before=structuredClone([...f.outcomeValues]);
  const result=await f.request({session:'fictional-recipient-session',body:{action:'coach_notes_outcome',...query,...change}});
  assert.equal(result.status,status);assert.equal(result.body.error.code,code);assert.equal(result.body.noteOutcome,undefined);
  assert.deepEqual([...f.outcomeValues],before);assert.deepEqual(f.writes,[]);assert.deepEqual(otherReads(f),[]);
 }
 const revoked=fixture();revoked.seedOutcome(recipient,query);revoked.outcomeValues.set(`account:${recipient.id}`,{...recipient,sessionVersion:2});
 const result=await revoked.request({session:'fictional-recipient-session',body:{action:'coach_notes_outcome',...query}});
 assert.equal(result.status,401);assert.equal(result.body.error.code,'SESSION_EXPIRED');assert.deepEqual(revoked.writes,[]);
});
test('request mode is not authority: recipient cannot read owner notes or reports through an assigned MM',async()=>{
 const f=fixture();
 const denied=await f.request({session:'fictional-recipient-session',body:{action:'coach_notes_view',mode:'owner',mm:owner.mm}});
 assert.equal(denied.status,404);assert.equal(denied.body.error.code,'NOT_FOUND');assert.equal(denied.body.coachNotes,undefined);
 assert.deepEqual(otherReads(f),[]);
 const foreign=await f.request({body:{action:'coach_notes_view',mode:'owner',mm:'MM-FICTIONAL-FOREIGN'}});
 assert.equal(foreign.status,404);assert.equal(foreign.body.coachNotes,undefined);
 for(const action of ['coach_bundle','coach_state','get_report','get_dossier']){
  const result=await f.request({session:'fictional-recipient-session',body:{action,mm:owner.mm,service:'apa'}});
  assert.equal(result.status,404);assert.equal(result.body.error.code,'NOT_FOUND');
 }
 assert.deepEqual(f.writes,[]);
});
test('recipient read forbids explicit MM selection and arbitrary actor/role/authority fields',async()=>{
 for(const extra of [{mm:owner.mm},{actorId:owner.id},{actor_id:owner.id},{role:'coach'},{reports:true},{purpose:'report-read'}]){
  const f=fixture(),result=await f.request({session:'fictional-recipient-session',body:{action:'coach_notes_view',mode:'recipient',...extra}});
  assert.equal(result.status,422);assert.equal(result.body.error.code,'COACH_NOTE_COMMAND_INVALID');
  assert.deepEqual(serviceCalls(f),[]);assert.deepEqual(otherReads(f),[]);assert.deepEqual(f.writes,[]);
 }
});
test('handler forwards only the exact mutation envelope and services reject extra/spoof fields before writes',async()=>{
 const commands={
  invite:{mm:owner.mm,recipient_email:'fictional@test.invalid',purpose:'observation-only',policy_version:COACH_NOTES_POLICY_VERSION,next_opening_context:true,expires_at:'2026-10-01T12:00:00.000Z'},
  accept:{mm:owner.mm,grant_id:uuid(1),grant_version:1,terms_hash:'a'.repeat(64),policy_version:COACH_NOTES_POLICY_VERSION,accepted:true},
  revoke:{mm:owner.mm,grant_id:uuid(1),grant_version:2},
  append:{mm:owner.mm,grant_id:uuid(1),grant_version:2,text:'Fictional reviewed observation.',reviewed:true},
  review:{mm:owner.mm,note_id:uuid(2),content_sha256:'b'.repeat(64),grant_version:2},
 };
 for(const [kind,command] of Object.entries(commands)){
  const session=['invite','revoke','review'].includes(kind)?'fictional-owner-session':'fictional-recipient-session';
  const f=fixture(),body={action:'coach_notes_'+kind,requestId:uuid(13),...command};
  const result=await f.request({session,body});assert.equal(result.status,200);
  assert.deepEqual(f.writes,[{kind,actor:session==='fictional-owner-session'?owner.id:recipient.id,body:{requestId:uuid(13),...command}}]);
  assert.deepEqual(otherReads(f),[]);
  for(const key of ['actor','actorId','author_id','speaker','role','authority','coachActorId','mode','reports']){
   const negative=fixture(),bad=await negative.request({session,body:{...body,[key]:'claimed-authority'}});
   assert.equal(bad.status,422);assert.equal(bad.body.error.code,'COACH_NOTE_COMMAND_INVALID');
   assert.equal(serviceCalls(negative).length,1,'the service, not silent field stripping, rejects the spoof');
   assert.deepEqual(negative.writes,[]);
  }
 }
});
test('signed-in same-origin CSRF boundary remains before note reads or writes',async()=>{
 const cases=[
  {headers:{origin:'https://another-origin.test.invalid'},status:403,code:'SAME_ORIGIN_REQUIRED'},
  {headers:{'sec-fetch-site':'cross-site'},status:403,code:'SAME_ORIGIN_REQUIRED'},
  {headers:{'x-csrf-token':undefined},status:403,code:'SESSION_OR_FORM_EXPIRED'},
  {headers:{'x-csrf-token':'fictional-stale-form'},status:403,code:'SESSION_OR_FORM_EXPIRED'},
  {session:'fictional-missing-session',status:403,code:'SESSION_OR_FORM_EXPIRED'},
  {session:'fictional-anonymous-session',status:401,code:'SIGN_IN_REQUIRED'},
  {session:'fictional-unverified-session',status:401,code:'SIGN_IN_REQUIRED'},
  {headers:{'content-type':'text/plain'},status:415,code:'JSON_REQUIRED'},
 ];
 for(const options of cases){
  for(const body of [{action:'coach_notes_view',mode:'recipient'},{action:'coach_notes_outcome',...outcomeQuery()}]){
   const f=fixture(),result=await f.request({...options,body});
   assert.equal(result.status,options.status);assert.equal(result.body.error.code,options.code);
   assert.deepEqual(serviceCalls(f),[]);assert.deepEqual(otherReads(f),[]);assert.deepEqual(f.writes,[]);
  }
 }
 const f=fixture(),crossGet=await f.request({method:'GET',headers:{'sec-fetch-site':'cross-site'}});
 assert.equal(crossGet.status,403);assert.deepEqual(f.calls,[]);
});
test('missing note service, unsupported action, method and disabled Academy fail closed',async()=>{
 for(const [options,request,status,code] of [
  [{notesPresent:false},{body:{action:'coach_notes_view',mode:'owner',mm:owner.mm}},404,'COACH_NOTES_NOT_ACTIVE'],
  [{notesPresent:false},{body:{action:'coach_notes_outcome',...outcomeQuery()}},404,'COACH_NOTES_NOT_ACTIVE'],
  [{},{body:{action:'coach_notes_admin'}},404,'ACTION_NOT_FOUND'],
  [{},{method:'DELETE'},405,'METHOD_NOT_ALLOWED'],
  [{academyEnabled:false},{method:'GET'},503,'ATHLETE_ACADEMY_NOT_ACTIVE'],
 ]){
  const f=fixture(options),result=await f.request(request);assert.equal(result.status,status);assert.equal(result.body.error.code,code);
  assert.deepEqual(serviceCalls(f),[]);assert.deepEqual(f.writes,[]);
 }
});
test('stable note operation keeps exact body/request identity across manual checks and rejects another intent',()=>{
 const body={action:'coach_notes_append',mm:owner.mm,grant_id:uuid(1),grant_version:2,text:'Fictional observation.',reviewed:true},before=structuredClone(body);
 const held=coachNoteOperation(body,null,uuid(20));assert.deepEqual(held.operation,{...body,requestId:uuid(20)});
 assert.deepEqual(body,before);body.text='Changed after capture';assert.equal(held.operation.text,before.text);
 const replay=coachNoteOperation(JSON.parse(held.signature),held,uuid(21));assert.equal(replay,held);assert.equal(replay.operation.requestId,uuid(20));
 for(const change of [{mm:recipient.mm},{grant_id:uuid(9)},{grant_version:3},{text:'Another note'},{reviewed:false},{action:'coach_notes_revoke'}])
  assert.throws(()=>coachNoteOperation({...before,...change},held,uuid(22)),/Check the saved note action/u);
});
test('known no-write errors differ from genuinely uncertain acknowledgments and never broaden the held body',()=>{
 for(const code of ['COACH_NOTE_COMMAND_INVALID','COACH_NOTES_NOT_ACTIVE','COACH_NOTE_GRANT_UNAVAILABLE',
  'COACH_NOTE_REVIEWED_SEND_REQUIRED','COACH_NOTE_INVITATION_REVIEW_REQUIRED',
  'SESSION_EXPIRED','SESSION_OR_FORM_EXPIRED','SIGN_IN_REQUIRED','SAME_ORIGIN_REQUIRED'])
  assert.equal(coachNoteFailureKnownNoWrite({code}),true);
 for(const error of [undefined,Error('Network interrupted'),{code:'STORAGE_OUTCOME_UNKNOWN'},{code:'SERVICE_UNAVAILABLE'},{code:'UNKNOWN_PROVIDER_STATE'},{status:503}])
  assert.equal(coachNoteFailureKnownNoWrite(error),false);
 const body={action:'coach_notes_revoke',mm:owner.mm,grant_id:uuid(1),grant_version:2},held=coachNoteOperation(body,null,uuid(23));
 assert.equal(coachNoteOperation(body,held,uuid(24)),held);
 assert.throws(()=>coachNoteOperation({...body,grant_version:3},held,uuid(25)));
});
test('normal and read-only acknowledgments require exact actor/MM/request/hash/full-kind receipts before releasing a hold',()=>{
 const query=outcomeQuery(),pending=pendingMetadata(query);
 const receipt={contract:'athlete_coach_note_operation_v1',actor_id:recipient.id,...query};
 const acknowledged={...receipt,contract:'athlete_coach_note_outcome_v1',status:'acknowledged'};
 assert.equal(coachNoteOperationAcknowledged(receipt,pending,recipient.id),true);
 assert.equal(coachNoteOutcomeAcknowledged(acknowledged,pending,recipient.id),true);
 assert.equal(coachNoteOutcomeAcknowledged({...acknowledged,status:'unresolved'},pending,recipient.id),false);
 for(const change of [{actor_id:owner.id},{mm:recipient.mm},{request_id:uuid(99)},
  {signature_sha256:'e'.repeat(64)},{kind:'append'},{kind:'coach_notes_revoke'},{text:'not metadata'}]){
  assert.throws(()=>coachNoteOperationAcknowledged({...receipt,...change},pending,recipient.id),/could not be verified/u);
  assert.throws(()=>coachNoteOutcomeAcknowledged({...acknowledged,...change},pending,recipient.id),/could not be verified/u);
 }
 for(const missing of [undefined,null,{},[]]){
  assert.throws(()=>coachNoteOperationAcknowledged(missing,pending,recipient.id));
  assert.throws(()=>coachNoteOutcomeAcknowledged(missing,pending,recipient.id));
 }
 assert.throws(()=>coachNoteOperationAcknowledged({...receipt,contract:'other'},pending,recipient.id));
 assert.throws(()=>coachNoteOutcomeAcknowledged({...acknowledged,status:'complete'},pending,recipient.id));
 assert.equal(coachNoteFailureKnownNoWrite(Error('The exact saved action acknowledgment could not be verified.')),false);
});
test('existing App destinations keep owner/recipient scope separate and held panels mounted across navigation',()=>{
 const ownerSource=readFileSync(new URL('../src/athleteAcademyV1/coach/App.jsx',import.meta.url),'utf8');
 const homeSource=readFileSync(new URL('../src/athleteAcademyV1/App.jsx',import.meta.url),'utf8');
 const ownerSlot=ownerSource.match(/<div hidden=\{view!=='home'\}>[^]*?<\/div>/u)?.[0];
 const recipientSlot=homeSource.match(/<div hidden=\{page!=='home'\}>[^]*?<\/div>/u)?.[0];
 assert.ok(ownerSlot);assert.ok(recipientSlot);
 assert.match(ownerSlot,/s\.capabilities\?\.coachNotes&&<CoachNotesPanel/u);
 assert.match(ownerSlot,/<CoachNotesPanel[^>]*actorId=\{b\.binding\.actorId\} mode="owner" mm=\{slug\}/u);
 assert.match(recipientSlot,/session\?\.account&&session\.capabilities\.coachNotes&&<CoachNotesPanel/u);
 const recipientPanel=recipientSlot.match(/<CoachNotesPanel[^>]*mode="recipient"[^>]*\/?>/u)?.[0];
 assert.ok(recipientPanel);assert.doesNotMatch(recipientPanel,/\bmm=/u);
 assert.match(recipientPanel,/actorId=\{session\.account\.id\}/u);
});
test('Panel mount/render/refresh are read-only; uncertain replay requires explicit same-action click',()=>{
 const source=readFileSync(new URL('../src/athleteAcademyV1/coach/CoachNotesPanel.jsx',import.meta.url),'utf8');
 const effect=source.slice(source.indexOf('useEffect(()=>'),source.indexOf('},[actorId,mm,mode]);')+25);
 assert.match(effect,/call\('coach_notes_view'/u);assert.doesNotMatch(effect,/perform\(|coach_notes_(?:invite|accept|append|revoke|review)/u);
 const refresh=source.slice(source.indexOf('async function refresh'),source.indexOf('async function perform'));
 assert.match(refresh,/call\('coach_notes_view'/u);assert.doesNotMatch(refresh,/pending\.current=null|setUnknown\(false\)|perform\(/u);
 assert.equal((source.match(/await call\(action,operation\)/gu)||[]).length,1);
 assert.match(source,/onClick=\{\(\)=>perform\(JSON\.parse\(pending\.current\.signature\)\)/u);
 assert.match(source,/disabled=\{disabled\|\|busy\|\|unknown\|\|!journalReady\}/u);
 assert.match(source,/coachNoteOperation\(body,pending\.current,crypto\.randomUUID\(\)\)/u);
 assert.doesNotMatch(source,/setInterval|setTimeout|coach_bundle|coach_state|get_report|get_dossier|workspaceLink|\.then\(.*perform\(/u);
});
test('Panel journals before dispatch, verifies before clear, and reload-restored metadata can only check read-only outcome',()=>{
 const source=readFileSync(new URL('../src/athleteAcademyV1/coach/CoachNotesPanel.jsx',import.meta.url),'utf8');
 assert.match(source,/import \{readPending,savePending,clearPending\} from '\.\/coachNotesJournal\.js'/u);
 const restore=source.slice(source.indexOf('function restore()'),source.indexOf('restore();window.addEventListener'));
 assert.match(restore,/readPending\(globalThis\.localStorage,\{actorId,mode,mm\}\)/u);
 assert.match(restore,/pending\.current=\{metadata\}/u);
 assert.doesNotMatch(restore,/crypto\.randomUUID|savePending|clearPending|call\(|perform\(|JSON\.parse|operation\s*:/u);
 const perform=source.slice(source.indexOf('async function perform'),source.indexOf('async function checkOutcome'));
 const save=perform.indexOf('await savePending('),dispatch=perform.indexOf('await call(action,operation)'),verify=perform.indexOf('coachNoteOperationAcknowledged('),clear=perform.indexOf('await clearPending(');
 assert.ok(save>=0&&save<dispatch&&dispatch<verify&&verify<clear);
 assert.match(perform,/pending\.current&&!pending\.current\.operation\)throw Error/u);
 assert.match(perform,/coachNoteOperationAcknowledged\(result\.operation_receipt,metadata,actorId\)/u);
 assert.match(perform,/if\(coachNoteFailureKnownNoWrite\(e\)&&pending\.current\?\.metadata\)/u);
 const check=source.slice(source.indexOf('async function checkOutcome'),source.indexOf('return <section'));
 assert.match(check,/call\('coach_notes_outcome',\{mm:metadata\.target_mm,request_id:metadata\.request_id,signature_sha256:metadata\.signature_sha256,kind:metadata\.kind\}\)/u);
 assert.ok(check.indexOf('coachNoteOutcomeAcknowledged(')<check.indexOf('await clearPending('));
 assert.match(check,/else setError\('No exact acknowledgment is available yet\. This action remains held; do not send a replacement\.'/u);
 assert.doesNotMatch(check,/savePending|perform\(|crypto\.randomUUID|call\(action|coach_notes_(?:invite|accept|append|revoke|review)/u);
 assert.match(source,/onClick=\{checkOutcome\}/u);
 assert.match(source,/pending\.current\?\.operation&&<button[^]*?perform\(JSON\.parse\(pending\.current\.signature\)\)/u);
});
