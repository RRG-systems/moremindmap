import {sha256Text} from '../../lib/canonicalSha256.js';

export const COACH_NOTES_UI_CONTRACT='athlete_academy_coach_notes_ui_v1';
export const COACH_NOTES_POLICY_VERSION='athlete-observation-notes-private-review-v1';
export const COACH_NOTES_PURPOSE='observation-only';
export const COACH_NOTES_OPENING_CONTEXT='attributed-unverified-next-opening-only';
export const COACH_NOTES_BOUNDARY='Attributed unverified observation; no BOS, APA, learning or plan authority.';
const object=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const id=x=>typeof x==='string'&&/^[A-Za-z0-9_-]{1,120}$/u.test(x);
const uuid=x=>typeof x==='string'&&/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/iu.test(x);
const digest=x=>typeof x==='string'&&/^[a-f0-9]{64}$/u.test(x);
const iso=x=>typeof x==='string'&&Number.isFinite(Date.parse(x))&&new Date(x).toISOString()===x;
// This notes contract uses repository.digest's serialized insertion order,
// not the separately governed current-APA canonical hash contract.
const hash=x=>sha256Text(typeof x==='string'?x:JSON.stringify(x));
const fail=()=>{throw Error('The scoped observation view could not be verified. Reload before making a change.');};
const demand=x=>{if(!x)fail();};
const unique=(rows,key)=>new Set(rows.map(key)).size===rows.length;
const fresh=(expires,now)=>Date.parse(expires)>now;

function grantRow(grant){
 return {mm:grant.terms.mm,grant_id:grant.terms.id,grant_version:grant.version,
  purpose:grant.terms.purpose,policy_version:grant.terms.policy_version,
  expires_at:grant.terms.expires_at,terms_hash:grant.terms_hash,next_opening_context:grant.terms.next_opening_context};
}
function verifyRow(row){
 demand(object(row)&&id(row.mm)&&uuid(row.grant_id)&&Number.isSafeInteger(row.grant_version)
  &&row.grant_version>=1&&row.purpose===COACH_NOTES_PURPOSE
  &&row.policy_version===COACH_NOTES_POLICY_VERSION&&row.next_opening_context===COACH_NOTES_OPENING_CONTEXT&&iso(row.expires_at)&&digest(row.terms_hash));
 demand(Object.keys(row).every(key=>['mm','athlete_name','grant_id','grant_version','purpose','policy_version','expires_at','terms_hash','next_opening_context'].includes(key)));
 demand(row.athlete_name===undefined||typeof row.athlete_name==='string'&&row.athlete_name.trim().length>0);
}
function verifyGrant(grant,ownerId,mm){
 const t=grant?.terms;
 demand(object(grant)&&object(t)&&Object.keys(grant).length===6&&Object.keys(t).length===9
  &&uuid(t.id)&&t.mm===mm&&t.owner_id===ownerId&&id(t.recipient_id)&&t.recipient_id!==ownerId
  &&t.purpose===COACH_NOTES_PURPOSE&&t.policy_version===COACH_NOTES_POLICY_VERSION&&t.next_opening_context===COACH_NOTES_OPENING_CONTEXT
  &&iso(t.created_at)&&iso(t.expires_at)&&Date.parse(t.expires_at)>Date.parse(t.created_at)
  &&Date.parse(t.expires_at)-Date.parse(t.created_at)<=30*86400000
  &&digest(grant.terms_hash)&&hash(t)===grant.terms_hash);
 demand(grant.status==='pending'&&grant.version===1&&grant.accepted===null&&grant.revoked===null
  ||grant.status==='active'&&grant.version===2&&object(grant.accepted)&&grant.revoked===null
  ||grant.status==='revoked'&&grant.version===(grant.accepted?3:2)&&object(grant.revoked));
 if(grant.accepted)demand(Object.keys(grant.accepted).length===3
  &&grant.accepted.recipient_id===t.recipient_id&&grant.accepted.terms_hash===grant.terms_hash
  &&iso(grant.accepted.at)&&Date.parse(grant.accepted.at)>=Date.parse(t.created_at)
  &&Date.parse(grant.accepted.at)<Date.parse(t.expires_at));
 if(grant.revoked)demand(Object.keys(grant.revoked).length===2&&grant.revoked.owner_id===ownerId
  &&iso(grant.revoked.at)&&Date.parse(grant.revoked.at)>=Date.parse(t.created_at));
}
function verifyNote(note,grants,mm){
 demand(object(note));
 const {content_sha256,...body}=note,g=grants.find(item=>item.terms.id===note.grant_id);
 demand(g&&Object.keys(body).length===16&&body.contract==='athlete_coach_observation_v1'
  &&uuid(note.id)&&note.mm===mm&&note.author_id===g.terms.recipient_id
  &&note.grant_version===2&&note.grant_version<=g.version&&note.terms_hash===g.terms_hash
  &&note.purpose===COACH_NOTES_PURPOSE&&note.policy_version===COACH_NOTES_POLICY_VERSION
  &&typeof note.author_name==='string'&&note.author_name.trim().length>0&&note.author_name.length<=100
  &&typeof note.text==='string'&&note.text.trim().length>0&&note.text.length<=10000
  &&iso(note.created_at)&&Date.parse(note.created_at)>=Date.parse(g.terms.created_at)
  &&Date.parse(note.created_at)<Date.parse(g.terms.expires_at)
  &&note.reviewed===true&&note.reviewed_by===note.author_id&&note.reviewed_at===note.created_at
  &&note.interpretation===COACH_NOTES_BOUNDARY&&digest(content_sha256)&&hash(body)===content_sha256);
}
function verifyReceipt(receipt){
 demand(object(receipt)&&Object.keys(receipt).length===13&&uuid(receipt.id)&&id(receipt.mm)&&uuid(receipt.grant_id)
  &&digest(receipt.content_sha256)&&iso(receipt.created_at)
  &&receipt.review_status==='reviewed-send'&&id(receipt.reviewed_by)&&iso(receipt.reviewed_at)
  &&receipt.reviewed_at===receipt.created_at&&typeof receipt.owner_acknowledged==='boolean'
  &&['queued','reserved','dispatched','delivered','abandoned_before_dispatch'].includes(receipt.status));
 demand(receipt.status==='queued'?receipt.attempt_id===null:uuid(receipt.attempt_id));
 demand(['queued','reserved','abandoned_before_dispatch'].includes(receipt.status)?receipt.dispatched_at===null:iso(receipt.dispatched_at));
 demand(receipt.status==='delivered'?iso(receipt.completed_at):receipt.completed_at===null);
 if(receipt.dispatched_at)demand(Date.parse(receipt.dispatched_at)>=Date.parse(receipt.created_at));
 if(receipt.completed_at)demand(Date.parse(receipt.completed_at)>=Date.parse(receipt.dispatched_at));
}
export function coachNotesGrantKey(row){
 const r=row?.terms?grantRow(row):row;
 return r?`${r.mm}:${r.grant_id}:${r.grant_version}:${r.terms_hash}:${r.expires_at}:${r.next_opening_context}`:'';
}
export const coachNoteReviewKey=note=>note?`${note.mm}:${note.id}:${note.content_sha256}:${note.grant_version}`:'';
export const coachNoteDraftKey=(row,text)=>row&&typeof text==='string'?hash({scope:coachNotesGrantKey(row),text:text.trim()}):'';
export function coachNoteReceiptLabel(receipt){
 if(receipt.status==='delivered')return 'Delivered once to the session input; response completed.';
 if(receipt.status==='dispatched')return 'Sent once to the session input; response completion unconfirmed. Not eligible for automatic resend.';
 if(receipt.status==='reserved')return 'Reserved for a session; not yet dispatched.';
 if(receipt.status==='abandoned_before_dispatch')return 'The prior session was abandoned before dispatch. This note was not sent; the next eligible opening still requires an active assignment.';
 return 'Coach reviewed and sent; not yet delivered. Delivery requires an active assignment and the next eligible opening, not an athlete per-note approval.';
}

export function coachNotesView(envelope,{actorId,mm=null,mode,disabled=false,now}={}){
 const context={actorId,mm,mode,disabled,...(now===undefined?{}:{now})};
 const inactive={enabled:false,verified:false,actionAllowed:false,notes:[],grants:[],assigned:[],invitations:[],receipts:[],delivery:[],reviews:[],context,envelope};
 if(envelope?.capabilities?.coachNotes!==true)return inactive;
 try{
  demand(object(envelope)&&envelope.contract===COACH_NOTES_UI_CONTRACT
   &&envelope.policy_version===COACH_NOTES_POLICY_VERSION&&id(actorId)&&envelope.actor_id===actorId
   &&['owner','recipient'].includes(mode)&&envelope.mode===mode
   &&(mode==='owner'?id(mm)&&envelope.mm===mm:mm===null&&envelope.mm===null));
  const at=now===undefined?Date.now():now;
  demand(Number.isFinite(at));
  const limits={notes:256,grants:16,reviews:256,delivery:256,assigned:32,invitations:32,receipts:32*256};
  for(const [key,limit] of Object.entries(limits))demand(Array.isArray(envelope[key])&&envelope[key].length<=limit);
  const e=structuredClone(envelope);
  demand(unique(e.grants,g=>g?.terms?.id)&&unique(e.notes,n=>n?.id)&&unique(e.reviews,r=>r?.note_id)
   &&unique(e.delivery,r=>r?.id)&&unique(e.receipts,r=>r?.id)
   &&unique(e.assigned,r=>r?.grant_id)&&unique(e.invitations,r=>r?.grant_id));
  if(mode==='owner'){
   demand(e.assigned.length===0&&e.invitations.length===0&&e.receipts.length===0);
   e.grants.forEach(g=>verifyGrant(g,actorId,mm));
   e.notes.forEach(n=>verifyNote(n,e.grants,mm));
   e.reviews.forEach(r=>{
    const n=e.notes.find(note=>note.id===r.note_id),{review_sha256,...body}=r;
    demand(n&&Object.keys(body).length===6&&r.owner_id===actorId&&r.content_sha256===n.content_sha256
     &&r.grant_version===n.grant_version&&r.reviewed===true&&iso(r.reviewed_at)
     &&Date.parse(r.reviewed_at)>=Date.parse(n.created_at)&&digest(review_sha256)&&hash(body)===review_sha256);
   });
   e.delivery.forEach(r=>{
    verifyReceipt(r);const n=e.notes.find(note=>note.id===r.id);
    demand(n&&r.mm===mm&&r.grant_id===n.grant_id&&r.content_sha256===n.content_sha256
     &&r.created_at===n.created_at&&r.reviewed_by===n.author_id&&r.reviewed_at===n.reviewed_at
     &&r.owner_acknowledged===e.reviews.some(review=>review.note_id===n.id));
   });
   demand(e.delivery.length===e.notes.length);
  }else{
   demand(e.notes.length===0&&e.grants.length===0&&e.reviews.length===0&&e.delivery.length===0);
   e.assigned.forEach(r=>{verifyRow(r);demand(r.grant_version===2);});
   e.invitations.forEach(r=>{verifyRow(r);demand(r.grant_version===1);});
   demand(!e.assigned.some(r=>e.invitations.some(i=>i.grant_id===r.grant_id)));
   e.receipts.forEach(r=>{verifyReceipt(r);demand(r.reviewed_by===actorId);});
  }
  const unresolved=e.stale===true||e.pending===true||e.unknown===true||['working','unknown'].includes(e.status);
  return {...e,context,envelope,enabled:true,verified:true,actionAllowed:!disabled&&!unresolved,now:at,error:''};
 }catch{
  return {...inactive,enabled:true,error:'The scoped observation view could not be verified. Notes are read-only until it is reloaded.'};
 }
}
function activeView(view,mode){
 const v=coachNotesView(view.envelope,view.context);
 demand(v.verified&&v.actionAllowed&&v.mode===mode);return v;
}
export function inviteCoachNotesCommand(view,{recipient_email,expires_at,confirmed=false}={}){
 const v=activeView(view,'owner'),email=typeof recipient_email==='string'?recipient_email.trim().toLowerCase():'';
 demand(confirmed===true&&email.length<=254&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(email)
  &&iso(expires_at)&&fresh(expires_at,v.now)&&Date.parse(expires_at)-v.now<=30*86400000);
 return {action:'coach_notes_invite',mm:v.mm,recipient_email:email,purpose:COACH_NOTES_PURPOSE,
  policy_version:COACH_NOTES_POLICY_VERSION,expires_at,next_opening_context:true};
}
export function acceptCoachNotesCommand(view,grantId,{accepted=false,termsKey}={}){
 const v=activeView(view,'recipient'),r=v.invitations.find(row=>row.grant_id===grantId);
 demand(r&&fresh(r.expires_at,v.now)&&accepted===true&&termsKey===coachNotesGrantKey(r));
 return {action:'coach_notes_accept',mm:r.mm,grant_id:r.grant_id,grant_version:r.grant_version,
  terms_hash:r.terms_hash,policy_version:COACH_NOTES_POLICY_VERSION,accepted:true};
}
export function appendCoachNoteCommand(view,grantId,{text,reviewed=false,reviewedKey}={}){
 const v=activeView(view,'recipient'),r=v.assigned.find(row=>row.grant_id===grantId);
 demand(r&&fresh(r.expires_at,v.now)&&reviewed===true&&typeof text==='string'&&text.trim().length>0&&text.length<=10000
  &&reviewedKey===coachNoteDraftKey(r,text));
 return {action:'coach_notes_append',mm:r.mm,grant_id:r.grant_id,grant_version:r.grant_version,text:text.trim(),reviewed:true};
}
export function revokeCoachNotesCommand(view,grantId,{confirmed=false,termsKey}={}){
 const v=activeView(view,'owner'),g=v.grants.find(item=>item.terms.id===grantId);
 demand(g&&g.status!=='revoked'&&confirmed===true&&termsKey===coachNotesGrantKey(g));
 return {action:'coach_notes_revoke',mm:v.mm,grant_id:g.terms.id,grant_version:g.version};
}
