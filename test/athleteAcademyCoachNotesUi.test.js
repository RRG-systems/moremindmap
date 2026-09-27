import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import {digest} from '../server/athleteAcademyV1/repository.js';
import {noteTerms,validateNoteGrant,immutableObservation,emptyNoteBox,ownNoteReceipts} from '../server/athleteAcademyV1/coaching/coachNotesPolicy.js';
import {coachNotesView,coachNotesGrantKey,coachNoteDraftKey,coachNoteReceiptLabel,
 inviteCoachNotesCommand,acceptCoachNotesCommand,revokeCoachNotesCommand,appendCoachNoteCommand,
 COACH_NOTES_UI_CONTRACT,COACH_NOTES_POLICY_VERSION,COACH_NOTES_PURPOSE,COACH_NOTES_OPENING_CONTEXT}
 from '../src/athleteAcademyV1/coach/coachNotesUi.js';

const now=Date.parse('2026-09-27T12:00:00.000Z'),mm='MM-FICTIONAL-NOTE-UI';
const owner={id:'fictional-owner',verified:true,displayName:'Fictional Athlete'};
const recipient={id:'fictional-recipient',verified:true,displayName:'Fictional Observer'};
const uuid=n=>`${String(n).padStart(8,'0')}-1111-4111-8111-111111111111`;
const clone=value=>structuredClone(value);
const context=(mode='owner',extra={})=>({mode,actorId:mode==='owner'?owner.id:recipient.id,mm:mode==='owner'?mm:null,now,...extra});
function fixture({pending=false,revoked=false,reviewed=false,status='queued'}={}){
 const terms=noteTerms({id:uuid(1),mm,owner_id:owner.id,recipient_id:recipient.id,purpose:COACH_NOTES_PURPOSE,
  policy_version:COACH_NOTES_POLICY_VERSION,next_opening_context:COACH_NOTES_OPENING_CONTEXT,
  created_at:'2026-09-25T12:00:00.000Z',expires_at:'2026-10-05T12:00:00.000Z'});
 const grant={terms,terms_hash:digest(terms),version:pending?1:2,status:pending?'pending':'active',
  accepted:pending?null:{recipient_id:recipient.id,terms_hash:digest(terms),at:'2026-09-26T12:00:00.000Z'},revoked:null};
 validateNoteGrant(grant);
 const box=emptyNoteBox(mm,owner.id);box.grants.push(grant);
 let note=null;
 if(!pending){
  note=immutableObservation({id:uuid(2),mm,grant,author:recipient,
   text:'A fictional observation from the selected practice.',reviewed:true,at:'2026-09-27T10:00:00.000Z'});box.notes.push(note);
  if(reviewed){const body={note_id:note.id,owner_id:owner.id,content_sha256:note.content_sha256,
   grant_version:note.grant_version,reviewed_at:'2026-09-27T11:00:00.000Z',reviewed:true};box.reviews.push({...body,review_sha256:digest(body)});}
  if(status!=='queued')box.attempts.push({reservation:{note_ids:[note.id],attempt_id:uuid(3)},status,
   dispatched_at:['dispatched','delivered'].includes(status)?'2026-09-27T11:30:00.000Z':null,
   completed_at:status==='delivered'?'2026-09-27T11:31:00.000Z':null});
 }
 if(revoked){grant.status='revoked';grant.version++;grant.revoked={owner_id:owner.id,at:'2026-09-27T11:45:00.000Z'};validateNoteGrant(grant);}
 const row={mm,athlete_name:'Fictional Athlete',grant_id:grant.terms.id,grant_version:grant.version,
  purpose:grant.terms.purpose,policy_version:grant.terms.policy_version,expires_at:grant.terms.expires_at,
  terms_hash:grant.terms_hash,next_opening_context:grant.terms.next_opening_context};
 const shared={contract:COACH_NOTES_UI_CONTRACT,policy_version:COACH_NOTES_POLICY_VERSION,
  capabilities:{coachNotes:true},notes:[],grants:[],reviews:[],delivery:[],assigned:[],invitations:[],receipts:[]};
 return {grant,note,box,row,
  owner:{...clone(shared),actor_id:owner.id,mode:'owner',mm,notes:clone(box.notes),grants:clone(box.grants),
   reviews:clone(box.reviews),delivery:ownNoteReceipts(box,recipient.id)},
  recipient:{...clone(shared),actor_id:recipient.id,mode:'recipient',mm:null,
   assigned:!pending&&!revoked?[row]:[],invitations:pending&&!revoked?[row]:[],receipts:ownNoteReceipts(box,recipient.id)}};
}
const view=(envelope,mode='owner',extra={})=>coachNotesView(envelope,context(mode,extra));
const sendInput=(row,text='My observation.')=>({text,reviewed:true,reviewedKey:coachNoteDraftKey(row,text)});

test('coach notes default off, require exact policy/envelope and cannot infer authority from account or URL',()=>{
 for(const capability of [undefined,false,'true']){
  const f=fixture();f.owner.capabilities={coachNotes:capability};const v=view(f.owner);
  assert.equal(v.enabled,false);assert.equal(v.actionAllowed,false);
  assert.throws(()=>inviteCoachNotesCommand(v,{recipient_email:'observer@test.invalid',expires_at:'2026-10-01T12:00:00.000Z',confirmed:true}));
 }
 for(const mutate of [e=>{e.contract='demo-notes';},e=>{e.policy_version='other';},e=>{e.actor_id='another-owner';},
  e=>{e.mm='another-mm';},e=>{e.mode='recipient';},e=>{delete e.delivery;}]){
  const f=fixture();mutate(f.owner);assert.equal(view(f.owner).verified,false);
 }
 const f=fixture();assert.equal(view(f.recipient,'recipient',{mm}).verified,false);
 assert.equal(view(f.recipient,'recipient',{actorId:owner.id}).verified,false);
});
test('real policy observations and own metadata survive JSON reload without changing author or original data',()=>{
 const f=fixture(),before=clone(f);
 for(const e of [f.owner,JSON.parse(JSON.stringify(f.owner))]){
  const v=view(e);assert.equal(v.verified,true);assert.equal(v.actionAllowed,true);
  assert.equal(v.notes[0].author_id,recipient.id);assert.equal(v.notes[0].text,f.note.text);
 }
 assert.equal(view(f.recipient,'recipient').verified,true);assert.deepEqual(f,before);
});
test('recipient acceptance requires explicit review of the exact server-returned pending scope',()=>{
 const f=fixture({pending:true}),v=view(f.recipient,'recipient');
 const expected={action:'coach_notes_accept',mm,grant_id:f.row.grant_id,grant_version:1,
  terms_hash:f.row.terms_hash,policy_version:COACH_NOTES_POLICY_VERSION,accepted:true};
 assert.deepEqual(acceptCoachNotesCommand(v,f.row.grant_id,{accepted:true,termsKey:coachNotesGrantKey(f.row)}),expected);
 for(const options of [{accepted:false,termsKey:coachNotesGrantKey(f.row)},{accepted:true,termsKey:'another-scope'}])
  assert.throws(()=>acceptCoachNotesCommand(v,f.row.grant_id,options));
 assert.throws(()=>acceptCoachNotesCommand(v,uuid(99),{accepted:true,termsKey:coachNotesGrantKey(f.row)}));
 assert.throws(()=>appendCoachNoteCommand(v,f.row.grant_id,sendInput(f.row)));
});
test('owner invitation uses the exact approved existing email and canonical bounded expiry, never authorship',()=>{
 const f=fixture(),v=view(f.owner),input={recipient_email:' Observer@Test.invalid ',expires_at:'2026-10-01T12:00:00.000Z',confirmed:true};
 const command=inviteCoachNotesCommand(v,{...input,actor:'spoof',author_id:'spoof',speaker:'coach'});
 assert.deepEqual(command,{action:'coach_notes_invite',mm,recipient_email:'observer@test.invalid',purpose:COACH_NOTES_PURPOSE,
  policy_version:COACH_NOTES_POLICY_VERSION,expires_at:input.expires_at,next_opening_context:true});
 for(const update of [{confirmed:false},{recipient_email:'invalid'},{expires_at:'2026-09-27T11:00:00.000Z'},
  {expires_at:'2026-11-01T12:00:00.000Z'},{expires_at:'2026-10-01'}])assert.throws(()=>inviteCoachNotesCommand(v,{...input,...update}));
 assert.throws(()=>inviteCoachNotesCommand(view(f.recipient,'recipient'),input));
});
test('recipient submits only their selected active observation scope, with no actor/author/speaker command fields',()=>{
 const f=fixture(),v=view(f.recipient,'recipient');
 const command=appendCoachNoteCommand(v,f.row.grant_id,{...sendInput(f.row,'  My observation.  '),author_id:owner.id,actor:owner.id,speaker:'athlete'});
 assert.deepEqual(command,{action:'coach_notes_append',mm,grant_id:f.row.grant_id,grant_version:2,text:'My observation.',reviewed:true});
 for(const options of [{...sendInput(f.row),reviewed:false},sendInput(f.row,' '),sendInput(f.row,'x'.repeat(10001))])
  assert.throws(()=>appendCoachNoteCommand(v,f.row.grant_id,options));
 assert.throws(()=>appendCoachNoteCommand(v,uuid(99),sendInput(f.row)));
 assert.throws(()=>appendCoachNoteCommand(view(f.owner),f.row.grant_id,sendInput(f.row)));
});
test('coach must review the exact text and scoped terms before sending, with no mandatory athlete note approval',()=>{
 const f=fixture(),v=view(f.recipient,'recipient'),input=sendInput(f.row);
 assert.throws(()=>appendCoachNoteCommand(v,f.row.grant_id,{...input,reviewed:false}));
 assert.throws(()=>appendCoachNoteCommand(v,f.row.grant_id,{...input,reviewedKey:'another-note'}));
 assert.throws(()=>appendCoachNoteCommand(v,f.row.grant_id,{...input,text:'Changed after review'}));
 f.recipient.assigned[0].terms_hash='e'.repeat(64);
 assert.throws(()=>appendCoachNoteCommand(view(f.recipient,'recipient'),f.row.grant_id,input));
 const ownerView=view(f.owner);assert.equal(ownerView.verified,true);assert.equal(ownerView.reviews.length,0);
 assert.equal(ownerView.delivery[0].review_status,'reviewed-send');assert.equal(ownerView.delivery[0].owner_acknowledged,false);
 assert.equal(ownerView.notes[0].reviewed_by,recipient.id);
});
test('tampered actor, MM, author, text, original terms, hashes, version or review receipts fail closed',()=>{
 const changes=[e=>{e.notes[0].mm='another-mm';},e=>{e.notes[0].author_id=owner.id;},e=>{e.notes[0].text='changed';},
  e=>{e.notes[0].content_sha256='a'.repeat(64);},e=>{e.grants[0].terms.owner_id='another-owner';},
  e=>{e.grants[0].terms.recipient_id='another-recipient';},e=>{e.grants[0].terms_hash='b'.repeat(64);},
  e=>{e.notes[0].grant_version=1;},e=>{e.delivery[0].content_sha256='c'.repeat(64);},
  e=>{e.notes[0].reviewed_by=owner.id;},e=>{e.delivery[0].review_status='unreviewed';},
  e=>{e.delivery[0].owner_acknowledged=true;},e=>{e.delivery.push(clone(e.delivery[0]));}];
 for(const mutate of changes){const f=fixture();mutate(f.owner);assert.equal(view(f.owner).verified,false);}
 const f=fixture({reviewed:true});f.owner.reviews[0].owner_id='another-owner';assert.equal(view(f.owner).verified,false);
});
test('even rehashed immutable notes cannot cross author/MM scope or skip coach-reviewed send',()=>{
 for(const field of ['author_id','mm','reviewed']){
  const f=fixture();f.owner.notes[0][field]=field==='reviewed'?false:'another';
  const {content_sha256:_hash,...body}=f.owner.notes[0];f.owner.notes[0].content_sha256=digest(body);
  f.owner.delivery[0].content_sha256=f.owner.notes[0].content_sha256;
  assert.equal(view(f.owner).verified,false);
 }
 const f=fixture();f.owner.grants[0].terms.next_opening_context='another-onward-use';
 f.owner.grants[0].terms_hash=digest(f.owner.grants[0].terms);
 assert.equal(view(f.owner).verified,false);
});
test('revocation preserves historical reviewed-send metadata but removes submission eligibility',()=>{
 const f=fixture({revoked:true});assert.equal(view(f.owner).verified,true);assert.equal(view(f.recipient,'recipient').verified,true);
 assert.equal(f.recipient.receipts.length,1);assert.equal(f.recipient.assigned.length,0);
 assert.throws(()=>appendCoachNoteCommand(view(f.recipient,'recipient'),f.row.grant_id,sendInput(f.row)));
 assert.throws(()=>revokeCoachNotesCommand(view(f.owner),f.grant.terms.id,{confirmed:true,termsKey:coachNotesGrantKey(f.grant)}));
});
test('owner may explicitly revoke pending or expired assignments without deleting saved evidence',()=>{
 for(const f of [fixture(),fixture({pending:true})]){
  const v=view(f.owner),before=clone(f);
  assert.deepEqual(revokeCoachNotesCommand(v,f.grant.terms.id,{confirmed:true,termsKey:coachNotesGrantKey(f.grant)}),
   {action:'coach_notes_revoke',mm,grant_id:f.grant.terms.id,grant_version:f.grant.version});
  assert.throws(()=>revokeCoachNotesCommand(v,f.grant.terms.id,{confirmed:false,termsKey:coachNotesGrantKey(f.grant)}));
  assert.deepEqual(f,before);
 }
 const f=fixture(),v=view(f.owner,'owner',{now:Date.parse('2026-10-06T12:00:00.000Z')});
 assert.equal(revokeCoachNotesCommand(v,f.grant.terms.id,{confirmed:true,termsKey:coachNotesGrantKey(f.grant)}).action,'coach_notes_revoke');
});
test('expired or changed terms cannot be accepted or submitted and cannot carry a prior checkbox',()=>{
 const f=fixture({pending:true}),expired=view(f.recipient,'recipient',{now:Date.parse('2026-10-06T12:00:00.000Z')});
 assert.throws(()=>acceptCoachNotesCommand(expired,f.row.grant_id,{accepted:true,termsKey:coachNotesGrantKey(f.row)}));
 const active=fixture();assert.throws(()=>appendCoachNoteCommand(view(active.recipient,'recipient',{now:Date.parse('2026-10-06T12:00:00.000Z')}),active.row.grant_id,sendInput(active.row)));
 const reviewedTermsKey=coachNotesGrantKey(f.row);
 f.recipient.invitations[0].terms_hash='f'.repeat(64);
 assert.throws(()=>acceptCoachNotesCommand(view(f.recipient,'recipient'),f.row.grant_id,{accepted:true,termsKey:reviewedTermsKey}));
});
test('stale, pending, unknown, disabled or wrong capability states stop all mutation before dispatch',()=>{
 for(const extra of [{stale:true},{pending:true},{unknown:true},{status:'working'},{status:'unknown'}]){
  const f=fixture();Object.assign(f.recipient,extra);const v=view(f.recipient,'recipient');assert.equal(v.actionAllowed,false);
  assert.throws(()=>appendCoachNoteCommand(v,f.row.grant_id,sendInput(f.row)));
 }
 const f=fixture();assert.throws(()=>appendCoachNoteCommand(view(f.recipient,'recipient',{disabled:true}),f.row.grant_id,sendInput(f.row)));
});
test('recipient envelope rejects note text, report fields in roster, other-owner grants or metadata disguised as source content',()=>{
 for(const mutate of [e=>{e.notes=[fixture().note];},e=>{e.grants=[fixture().grant];},e=>{e.assigned[0].report={private:'not allowed'};},
  e=>{e.receipts[0].text='not metadata';},e=>{e.assigned[0].grant_version=1;},e=>{e.assigned.push(clone(e.assigned[0]));}]){
  const f=fixture();mutate(f.recipient);assert.equal(view(f.recipient,'recipient').verified,false);
 }
});
test('reserved, dispatched, completed and pre-dispatch abandoned receipts remain distinct and never imply automatic retry',()=>{
 for(const status of ['queued','reserved','dispatched','delivered','abandoned_before_dispatch']){
  const f=fixture({status});assert.equal(view(f.owner).verified,true);assert.equal(view(f.recipient,'recipient').verified,true);
  assert.equal(f.owner.reviews.length,0);assert.equal(f.recipient.receipts[0].owner_acknowledged,false);
  const label=coachNoteReceiptLabel(f.recipient.receipts[0]);
  if(status==='queued')assert.match(label,/Coach reviewed and sent; not yet delivered.*not an athlete per-note approval/u);
  if(status==='reserved')assert.match(label,/not yet dispatched/u);
  if(status==='dispatched')assert.match(label,/completion unconfirmed.*Not eligible for automatic resend/u);
  if(status==='delivered')assert.match(label,/Delivered once.*completed/u);
  if(status==='abandoned_before_dispatch')assert.match(label,/abandoned before dispatch.*not sent.*active assignment/u);
 }
 const acknowledged=fixture({reviewed:true});assert.equal(view(acknowledged.owner).verified,true);
 assert.equal(acknowledged.owner.delivery[0].owner_acknowledged,true);
 assert.equal(acknowledged.owner.delivery[0].status,'queued');
});
test('abandoned-before-dispatch receipt survives reload but cannot disguise a dispatch or completed response',()=>{
 const f=fixture({status:'abandoned_before_dispatch'});
 assert.equal(view(JSON.parse(JSON.stringify(f.owner))).verified,true);
 assert.equal(view(JSON.parse(JSON.stringify(f.recipient)),'recipient').verified,true);
 assert.equal(f.recipient.receipts[0].attempt_id,uuid(3));
 assert.equal(f.recipient.receipts[0].dispatched_at,null);assert.equal(f.recipient.receipts[0].completed_at,null);
 for(const change of [{attempt_id:null},{dispatched_at:'2026-09-27T11:30:00.000Z'},
  {completed_at:'2026-09-27T11:31:00.000Z'},{status:'abandoned_after_dispatch'}]){
  const bad=fixture({status:'abandoned_before_dispatch'});
  Object.assign(bad.owner.delivery[0],change);Object.assign(bad.recipient.receipts[0],change);
  assert.equal(view(bad.owner).verified,false);assert.equal(view(bad.recipient,'recipient').verified,false);
 }
});
test('component is injected-only, preserves unknown acknowledgments and has no report route or automatic product mutation',()=>{
 const source=readFileSync(new URL('../src/athleteAcademyV1/coach/CoachNotes.jsx',import.meta.url),'utf8');
 assert.doesNotMatch(source,/\b(fetch|bootstrap|workspaceLink|location|localStorage|sessionStorage)\s*\(/u);
 assert.doesNotMatch(source,/action\s*:\s*['"](?:start|update_apa|publish_apa|approve|message|learn)/u);
 assert.doesNotMatch(source,/href=|<iframe|dangerouslySetInnerHTML/u);
 assert.match(source,/Acknowledgment is unconfirmed\. Your entry is preserved/u);
 assert.match(source,/else \{onKnownSuccess\?\.\(\)/u);
 assert.match(source,/key=\{coachNotesGrantKey\(row\)\}/u);
 assert.match(source,/key=\{coachNoteReviewKey\(n\)\}/u);
 assert.match(source,/authenticated account supplies the author/u);
 assert.doesNotMatch(source,/reviewCoachNoteCommand|Allow this exact note|must review each exact note|I will review each note/u);
 assert.match(source,/onChange=\{event=>\{setText\(event.target.value\);setReviewedKey\(''\);\}\}/u);
 assert.match(source,/No per-note athlete approval is required/u);
});
