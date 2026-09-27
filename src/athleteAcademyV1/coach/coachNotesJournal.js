import {sha256Text} from '../../lib/canonicalSha256.js';

export const COACH_NOTES_JOURNAL_CONTRACT='athlete_academy_coach_notes_pending_v1';
const object=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const identity=x=>typeof x==='string'&&/^[A-Za-z0-9_-]{1,120}$/u.test(x);
const uuid=x=>typeof x==='string'&&/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/iu.test(x);
const digest=x=>typeof x==='string'&&/^[a-f0-9]{64}$/u.test(x);
const allowed={
 owner:['coach_notes_invite','coach_notes_revoke','coach_notes_review'],
 recipient:['coach_notes_accept','coach_notes_append'],
};
const commandFields={
 coach_notes_invite:['mm','recipient_email','purpose','policy_version','next_opening_context','expires_at'],
 coach_notes_accept:['mm','grant_id','grant_version','terms_hash','policy_version','accepted'],
 coach_notes_revoke:['mm','grant_id','grant_version'],
 coach_notes_append:['mm','grant_id','grant_version','text','reviewed'],
 coach_notes_review:['mm','note_id','content_sha256','grant_version'],
};
class JournalError extends Error {
 constructor(code){super(code);this.code=code;}
}
const fail=code=>{throw new JournalError(code);};
const demand=(value,code)=>{if(!value)fail(code);};
function normalizedScope(scope){
 demand(object(scope)&&Object.keys(scope).every(k=>['actorId','mode','mm'].includes(k))
  &&identity(scope.actorId)&&Object.hasOwn(allowed,scope.mode)
  &&(scope.mode==='owner'?identity(scope.mm):scope.mm===null),'COACH_NOTE_JOURNAL_SCOPE_INVALID');
 return {actor_id:scope.actorId,mode:scope.mode,mm:scope.mm};
}
const keyFor=scope=>'more:athlete-academy:coach-notes-pending:v1:'+sha256Text(JSON.stringify(scope));
function storageMethod(storage,name){
 demand(storage&&typeof storage[name]==='function','COACH_NOTE_JOURNAL_UNAVAILABLE');
 return (...args)=>{
  try{return storage[name](...args);}
  catch{fail('COACH_NOTE_JOURNAL_UNAVAILABLE');}
 };
}
function validateRecord(record,scope){
 demand(object(record)&&Object.keys(record).length===6&&record.contract===COACH_NOTES_JOURNAL_CONTRACT
  &&object(record.scope)&&Object.keys(record.scope).length===3
  &&record.scope.actor_id===scope.actor_id&&record.scope.mode===scope.mode&&record.scope.mm===scope.mm
  &&uuid(record.request_id)&&allowed[scope.mode].includes(record.kind)&&identity(record.target_mm)
  &&(scope.mode!=='owner'||record.target_mm===scope.mm)&&digest(record.signature_sha256),
 'COACH_NOTE_JOURNAL_CORRUPT');
 return Object.freeze({...record,scope:Object.freeze({...record.scope})});
}
function readAt(storage,scope){
 const raw=storageMethod(storage,'getItem')(keyFor(scope));
 if(raw===null)return null;
 demand(typeof raw==='string'&&raw.length>0&&raw.length<=2048,'COACH_NOTE_JOURNAL_CORRUPT');
 let record;try{record=JSON.parse(raw);}catch{fail('COACH_NOTE_JOURNAL_CORRUPT');}
 return validateRecord(record,scope);
}
export function readPending(storage,scope){return readAt(storage,normalizedScope(scope));}
function metadata(scope,operation){
 demand(object(operation)&&allowed[scope.mode].includes(operation.action)&&uuid(operation.requestId)
  &&identity(operation.mm)&&(scope.mode!=='owner'||operation.mm===scope.mm),'COACH_NOTE_JOURNAL_OPERATION_INVALID');
 const {action,requestId,...command}=operation,fields=commandFields[action];
 demand(Object.keys(command).length===fields.length&&Object.keys(command).every(k=>fields.includes(k))
  &&Object.values(command).every(v=>typeof v==='string'||typeof v==='boolean'||Number.isSafeInteger(v)),
 'COACH_NOTE_JOURNAL_OPERATION_INVALID');
 // This is the exact academy handler -> service command serialization:
 // requestId first, action omitted, command fields retain insertion order.
 // The random request ID salts the digest. Neither body nor plaintext is saved.
 let signature;try{signature=JSON.stringify({requestId,...command});}catch{fail('COACH_NOTE_JOURNAL_OPERATION_INVALID');}
 demand(signature.length<=200000,'COACH_NOTE_JOURNAL_OPERATION_INVALID');
 return {contract:COACH_NOTES_JOURNAL_CONTRACT,scope,request_id:requestId,kind:action,
  target_mm:command.mm,signature_sha256:sha256Text(signature)};
}
async function exclusively(storage,scope,operation){
 const name='more:athlete-academy:coach-notes-journal-lock:v1:'+sha256Text(JSON.stringify(scope));
 let entered=false,value;
 const run=()=>{
  demand(!entered,'COACH_NOTE_JOURNAL_LOCK_UNAVAILABLE');entered=true;value=operation();return value;
 };
 try{
  if(typeof storage?.withLock==='function')await storage.withLock(name,run);
  else if(typeof globalThis.navigator?.locks?.request==='function'){
   await globalThis.navigator.locks.request(name,{mode:'exclusive'},lock=>{
    demand(Boolean(lock),'COACH_NOTE_JOURNAL_LOCK_UNAVAILABLE');return run();
   });
  }else fail('COACH_NOTE_JOURNAL_LOCK_UNAVAILABLE');
  demand(entered,'COACH_NOTE_JOURNAL_LOCK_UNAVAILABLE');return value;
 }catch(error){
  if(error instanceof JournalError)throw error;
  fail('COACH_NOTE_JOURNAL_LOCK_UNAVAILABLE');
 }
}
export async function savePending(storage,scope,operation){
 const normalized=normalizedScope(scope),next=metadata(normalized,operation);
 const write=storageMethod(storage,'setItem');storageMethod(storage,'getItem');storageMethod(storage,'removeItem');
 return exclusively(storage,normalized,()=>{
  const existing=readAt(storage,normalized);
  if(existing){
   demand(existing.request_id===next.request_id&&existing.kind===next.kind&&existing.target_mm===next.target_mm
    &&existing.signature_sha256===next.signature_sha256,'COACH_NOTE_PENDING_EXISTS');
   return existing;
  }
  write(keyFor(normalized),JSON.stringify(next));
  const saved=readAt(storage,normalized);
  demand(saved&&saved.request_id===next.request_id&&saved.signature_sha256===next.signature_sha256
   &&saved.kind===next.kind&&saved.target_mm===next.target_mm,'COACH_NOTE_JOURNAL_UNAVAILABLE');
  return saved;
 });
}
export async function clearPending(storage,scope,requestId){
 const normalized=normalizedScope(scope);
 demand(uuid(requestId),'COACH_NOTE_JOURNAL_REQUEST_INVALID');
 const remove=storageMethod(storage,'removeItem');storageMethod(storage,'getItem');
 return exclusively(storage,normalized,()=>{
  const existing=readAt(storage,normalized);if(existing===null)return false;
  demand(existing.request_id===requestId,'COACH_NOTE_JOURNAL_REQUEST_MISMATCH');
  remove(keyFor(normalized));
  demand(readAt(storage,normalized)===null,'COACH_NOTE_JOURNAL_UNAVAILABLE');return true;
 });
}
