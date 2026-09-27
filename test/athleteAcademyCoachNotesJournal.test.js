import assert from 'node:assert/strict';
import test from 'node:test';
import {digest} from '../server/athleteAcademyV1/repository.js';
import {COACH_NOTES_JOURNAL_CONTRACT,readPending,savePending,clearPending}
 from '../src/athleteAcademyV1/coach/coachNotesJournal.js';

const uuid=n=>`${String(n).padStart(8,'0')}-1111-4111-8111-111111111111`;
const scope={actorId:'fictional-recipient',mode:'recipient',mm:null};
const ownerScope={actorId:'fictional-owner',mode:'owner',mm:'MM-FICTIONAL-OWNER'};
const noteText='DO-NOT-PERSIST: fictional private observation, exact reviewed wording.';
const operation=(n=1,change={})=>({action:'coach_notes_append',mm:ownerScope.mm,grant_id:uuid(90),grant_version:2,
 text:noteText,reviewed:true,requestId:uuid(n),...change});
class MemoryStorage {
 values=new Map();writes=[];locks=new Map();
 getItem(key){return this.values.get(key)??null;}
 setItem(key,value){this.writes.push({key,value});this.values.set(key,value);}
 removeItem(key){this.values.delete(key);}
 async withLock(name,run){
  const before=this.locks.get(name)||Promise.resolve();let release;
  const barrier=new Promise(resolve=>{release=resolve;});this.locks.set(name,barrier);
  await before;try{return run();}finally{release();}
 }
}
const firstValue=storage=>JSON.parse([...storage.values.values()][0]);

test('only scoped metadata is persisted; reload restores a hold without a replayable body or plaintext',async()=>{
 const storage=new MemoryStorage(),op=operation(),original=structuredClone(op);
 const saved=await savePending(storage,scope,op);
 assert.equal(saved.contract,COACH_NOTES_JOURNAL_CONTRACT);assert.equal(saved.request_id,op.requestId);
 assert.equal(saved.kind,'coach_notes_append');assert.equal(saved.target_mm,ownerScope.mm);
 assert.deepEqual(saved.scope,{actor_id:scope.actorId,mode:scope.mode,mm:null});
 assert.deepEqual(Object.keys(saved).sort(),['contract','scope','request_id','kind','target_mm','signature_sha256'].sort());
 for(const raw of storage.values.values()){
  assert.equal(raw.includes(noteText),false);assert.equal(raw.includes(op.grant_id),false);
  assert.equal(raw.includes('"operation"'),false);assert.equal(raw.includes('"text"'),false);
  assert.equal(raw.includes('"author"'),false);assert.equal(raw.includes('"requestId"'),false);
 }
 const reloaded=readPending(storage,scope);assert.deepEqual(reloaded,saved);
 assert.equal(reloaded.operation,undefined);assert.equal(reloaded.text,undefined);assert.equal(reloaded.recipient_email,undefined);
 assert.deepEqual(op,original);
});
test('server-command digest is exactly request-ID-first insertion order, salted by the random request ID',async()=>{
 const storage=new MemoryStorage(),op=operation(),{action:_action,requestId,...command}=op;
 const pending=await savePending(storage,scope,op);
 assert.equal(pending.signature_sha256,digest({requestId,...command}));
 assert.notEqual(pending.signature_sha256,digest(command));
 const other=new MemoryStorage(),next=await savePending(other,scope,operation(2));
 assert.notEqual(next.signature_sha256,pending.signature_sha256);
 const reordered={action:op.action,requestId:op.requestId,reviewed:true,text:op.text,grant_version:2,grant_id:op.grant_id,mm:op.mm};
 const different=await savePending(new MemoryStorage(),scope,reordered);
 assert.notEqual(different.signature_sha256,pending.signature_sha256,'the server contract is insertion-order JSON, not sorted canonical JSON');
});
test('invitation email is hashed only in memory and never persisted',async()=>{
 const storage=new MemoryStorage(),email='do-not-persist-private-email@test.invalid';
 const saved=await savePending(storage,ownerScope,{action:'coach_notes_invite',mm:ownerScope.mm,
  recipient_email:email,purpose:'observation-only',policy_version:'athlete-observation-notes-private-review-v1',
  next_opening_context:true,expires_at:'2026-10-01T12:00:00.000Z',requestId:uuid(3)});
 assert.equal(saved.kind,'coach_notes_invite');assert.equal([...storage.values.values()][0].includes(email),false);
 assert.equal([...storage.values.values()][0].includes('recipient_email'),false);
});
test('actor, mode and owner-MM journals remain separate without clearing another scope',async()=>{
 const storage=new MemoryStorage();await savePending(storage,scope,operation());
 const otherActor={...scope,actorId:'another-fictional-recipient'};assert.equal(readPending(storage,otherActor),null);
 const owner={actorId:scope.actorId,mode:'owner',mm:ownerScope.mm};assert.equal(readPending(storage,owner),null);
 await savePending(storage,owner,{action:'coach_notes_revoke',mm:owner.mm,grant_id:uuid(90),grant_version:2,requestId:uuid(4)});
 const otherMm={...owner,mm:'MM-ANOTHER-FICTIONAL'};assert.equal(readPending(storage,otherMm),null);
 assert.equal(await clearPending(storage,otherActor,uuid(1)),false);
 assert.equal(readPending(storage,scope).request_id,uuid(1));assert.equal(readPending(storage,owner).request_id,uuid(4));
});
test('unknown hold cannot be overwritten; only exact existing request/body may be recognized',async()=>{
 const storage=new MemoryStorage(),first=await savePending(storage,scope,operation());
 assert.deepEqual(await savePending(storage,scope,operation()),first);assert.equal(storage.writes.length,1);
 for(const op of [operation(2),operation(1,{text:'Different exact note'}),operation(1,{mm:'MM-ANOTHER-FICTIONAL'}),operation(1,{grant_version:3})])
  await assert.rejects(savePending(storage,scope,op),error=>error.code==='COACH_NOTE_PENDING_EXISTS');
 assert.deepEqual(readPending(storage,scope),first);assert.equal(storage.writes.length,1);
});
test('serialized latest-read lock admits exactly one competing new-tab operation',async()=>{
 const storage=new MemoryStorage();
 const results=await Promise.allSettled([savePending(storage,scope,operation(1)),savePending(storage,scope,operation(2))]);
 assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
 assert.equal(results.filter(r=>r.status==='rejected'&&r.reason.code==='COACH_NOTE_PENDING_EXISTS').length,1);
 assert.equal(storage.writes.length,1);assert.equal(readPending(storage,scope).request_id,uuid(1));
});
test('clear requires exact valid request ID and latest matching metadata under the same lock',async()=>{
 const storage=new MemoryStorage(),saved=await savePending(storage,scope,operation());
 await assert.rejects(clearPending(storage,scope,uuid(99)),error=>error.code==='COACH_NOTE_JOURNAL_REQUEST_MISMATCH');
 await assert.rejects(clearPending(storage,scope,'not-an-id'),error=>error.code==='COACH_NOTE_JOURNAL_REQUEST_INVALID');
 assert.deepEqual(readPending(storage,scope),saved);
 assert.equal(await clearPending(storage,scope,uuid(1)),true);assert.equal(readPending(storage,scope),null);
 assert.equal(await clearPending(storage,scope,uuid(1)),false);
});
test('malformed, cross-scope or content-bearing metadata fails closed and is never overwritten or cleared',async()=>{
 const corruptions=[()=>'not-json',raw=>JSON.stringify({...JSON.parse(raw),text:noteText}),
  raw=>JSON.stringify({...JSON.parse(raw),scope:{actor_id:'another-account',mode:'recipient',mm:null}}),
  raw=>JSON.stringify({...JSON.parse(raw),request_id:'bad-id'}),
  raw=>JSON.stringify({...JSON.parse(raw),kind:'coach_notes_revoke'}),
  raw=>JSON.stringify({...JSON.parse(raw),signature_sha256:'not-a-digest'}),
  raw=>JSON.stringify({...JSON.parse(raw),scope:{...JSON.parse(raw).scope,password:'do-not-log'}}),
  raw=>JSON.stringify({...JSON.parse(raw),target_mm:null})];
 for(const corrupt of corruptions){
  const storage=new MemoryStorage();await savePending(storage,scope,operation());
  const [key,value]=[...storage.values.entries()][0],raw=corrupt(value);storage.values.set(key,raw);
  assert.throws(()=>readPending(storage,scope),error=>error.code==='COACH_NOTE_JOURNAL_CORRUPT');
  await assert.rejects(savePending(storage,scope,operation(2)),error=>error.code==='COACH_NOTE_JOURNAL_CORRUPT');
  await assert.rejects(clearPending(storage,scope,uuid(1)),error=>error.code==='COACH_NOTE_JOURNAL_CORRUPT');
  assert.equal(storage.getItem(key),raw);assert.equal(storage.writes.length,1);
 }
});
test('invalid scope, unknown action, role mismatch, extra auth fields and incomplete commands never write',async()=>{
 const storage=new MemoryStorage();
 for(const bad of [{...scope,actorId:'email@test.invalid'},{...scope,mode:'coach'},{...scope,mm:'MM-NOT-NULL'},
  {...scope,password:'do-not-persist'},{actorId:'fictional-owner',mode:'owner',mm:null}]){
  assert.throws(()=>readPending(storage,bad));await assert.rejects(savePending(storage,bad,operation()));
 }
 for(const op of [operation(1,{action:'coach_action'}),operation(1,{action:'coach_notes_revoke'}),operation(1,{requestId:'not-a-uuid'}),
  operation(1,{password:'do-not-persist'}),operation(1,{actor_id:'claimed'}),operation(1,{text:{secret:'not-a-scalar'}})])
  await assert.rejects(savePending(storage,scope,op),error=>error.code==='COACH_NOTE_JOURNAL_OPERATION_INVALID');
 const missing=operation();delete missing.reviewed;await assert.rejects(savePending(storage,scope,missing));
 assert.equal(storage.values.size,0);assert.equal(storage.writes.length,0);
});
test('unavailable storage, missing/failed lock and unverifiable write fail closed before dispatch',async()=>{
 assert.throws(()=>readPending(null,scope),error=>error.code==='COACH_NOTE_JOURNAL_UNAVAILABLE');
 await assert.rejects(savePending(null,scope,operation()),error=>error.code==='COACH_NOTE_JOURNAL_UNAVAILABLE');
 const denied=new MemoryStorage();denied.getItem=()=>{throw Error('storage denied with private details');};
 assert.throws(()=>readPending(denied,scope),error=>error.code==='COACH_NOTE_JOURNAL_UNAVAILABLE'&&!error.message.includes('private details'));
 const quota=new MemoryStorage();quota.setItem=()=>{throw Error('quota details');};
 await assert.rejects(savePending(quota,scope,operation()),error=>error.code==='COACH_NOTE_JOURNAL_UNAVAILABLE');
 const failed=new MemoryStorage();failed.withLock=async()=>{throw Error('lock failed');};
 await assert.rejects(savePending(failed,scope,operation()),error=>error.code==='COACH_NOTE_JOURNAL_LOCK_UNAVAILABLE');
 const skipped=new MemoryStorage();skipped.withLock=async()=>null;
 await assert.rejects(savePending(skipped,scope,operation()),error=>error.code==='COACH_NOTE_JOURNAL_LOCK_UNAVAILABLE');
 const lost=new MemoryStorage();lost.setItem=()=>{};
 await assert.rejects(savePending(lost,scope,operation()),error=>error.code==='COACH_NOTE_JOURNAL_UNAVAILABLE');
 assert.equal(failed.writes.length,0);assert.equal(skipped.writes.length,0);assert.equal(lost.writes.length,0);
});
test('exact clear is verified; a blocked removal cannot silently unlock an uncertain request',async()=>{
 const storage=new MemoryStorage();await savePending(storage,scope,operation());
 storage.removeItem=()=>{};
 await assert.rejects(clearPending(storage,scope,uuid(1)),error=>error.code==='COACH_NOTE_JOURNAL_UNAVAILABLE');
 assert.equal(firstValue(storage).request_id,uuid(1));
});
test('native Web Locks are exclusive and scope-bound; absent or denied native locks never write',async()=>{
 const original=Object.getOwnPropertyDescriptor(globalThis,'navigator');
 const install=value=>Object.defineProperty(globalThis,'navigator',{configurable:true,value});
 try{
  install({});
  const absent=new MemoryStorage();absent.withLock=undefined;
  await assert.rejects(savePending(absent,scope,operation()),error=>error.code==='COACH_NOTE_JOURNAL_LOCK_UNAVAILABLE');
  assert.equal(absent.writes.length,0);
  const locks=[];
  install({locks:{async request(name,options,run){locks.push({name,options});return run({name});}}});
  const native=new MemoryStorage();native.withLock=undefined;
  await savePending(native,scope,operation());
  assert.equal(await clearPending(native,scope,uuid(1)),true);
  assert.equal(locks.length,2);assert.equal(locks[0].name,locks[1].name);
  assert.deepEqual(locks[0].options,{mode:'exclusive'});
  assert.equal(locks[0].name.includes(scope.actorId),false);
  await savePending(native,{...scope,actorId:'another-fictional-recipient'},operation(2));
  assert.notEqual(locks[2].name,locks[0].name);
  install({locks:{async request(_name,_options,run){return run(null);}}});
  const denied=new MemoryStorage();denied.withLock=undefined;
  await assert.rejects(savePending(denied,scope,operation()),error=>error.code==='COACH_NOTE_JOURNAL_LOCK_UNAVAILABLE');
  assert.equal(denied.writes.length,0);
 }finally{
  if(original)Object.defineProperty(globalThis,'navigator',original);
  else delete globalThis.navigator;
 }
});
