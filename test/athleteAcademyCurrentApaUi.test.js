import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import {APA_BOXES,apaDraftKey,continuityView,eligibleApaMessages,selectableApaSources,pendingApaChanges,coachActionOperation,continuityFailureIsKnownNoOp,
 confirmApaCommand,prepareApaCommand,publishApaCommand,discardApaCommand,recordApaBoxReview,apaReadingLabel} from '../src/athleteAcademyV1/coach/currentApaUi.js';
import {confirmationReadingScope,project} from '../src/athleteAcademyV1/apa/projection.js';

const contract='athlete_academy_current_apa_v1',actorId='account-fictional-owner',mm='MM-OFFLINE-UI';
const canonical=value=>Array.isArray(value)?value.map(canonical):value!==null&&typeof value==='object'
 ?Object.fromEntries(Object.keys(value).sort().map(key=>[key,canonical(value[key])])):value;
const hash=value=>createHash('sha256').update(JSON.stringify(canonical(value))).digest('hex');
const clone=value=>structuredClone(value);
const uuid=n=>`${String(n).padStart(8,'0')}-1111-4111-8111-111111111111`;
const domainIds=['sport','training','mindset','school'],roles=['current_course','emerging_future','better_future','bold_future','downside_future'];
const baseline={mm,identity:{mm,name:'Fictional Owner',sport:'Fictional sport'},artifact_sha256:'a'.repeat(64),
 confirmation:{confirmed:true,assessment_date:'2026-09-01',priority:'Saved original priority',review_date:'2026-09-08',horizon_date:'2026-10-01',
  goals:Object.fromEntries(domainIds.map(id=>[id,'Saved '+id+' goal']))},
 sources:[{id:'CONFIRM',source:'Athlete confirmation',text:'Immutable original CONFIRM words.'},
  {id:'A01',source:'Athlete',text:'Original athlete answer.',question:'Original question'}],
 bos_sources:[],existing_plan:null,move:null,
 report:{headline:'Original heading',opening:'Original opening',connection:'Original connection',main_obstacle:'Original obstacle',what_we_dont_know:['An original uncertainty'],
  domains:domainIds.map(id=>({id,refs:['CONFIRM'],bos_refs:[],detail:'Saved detail',bos_connection:'Saved connection',unknowns:[]})),
  futures:roles.map(role=>({role,headline:'Saved '+role,details:'Saved possibility',refs:['CONFIRM'],bos_refs:[]})),candidates:[],coach_view:{summary:'No imported coach authority.'}}};
const bundle={binding:{actorId,mm,bos:'b'.repeat(64),apa:baseline.artifact_sha256},person:{mm,name:'Fictional Owner'},bos:{artifact_sha256:'b'.repeat(64)},apa:baseline};
const plan={id:'accepted-separately',title:'Unchanged agreed plan',steps:[{action:'My separate step',owner:'athlete'}],review:'Separately agreed'};
const values={priority:'My reviewed priority',review_date:'2026-10-06',horizon_date:'2026-12-01'};
function publication(prior=null,n=1){
 const id=uuid(n),messageId=uuid(n+100),sourceId='server-returned-opaque-source-'+n;
 const change={id,source_message_id:messageId,source_id:sourceId,actorId,mm,kind:'reality',supersedes:[],confirmed:true,
  confirmed_by:'athlete',confirmed_at:'2026-09-27T08:00:00.000Z',reason:'My own explicit review reason.'};
 const a=clone(prior?.artifact||baseline);
 Object.assign(a,{actorId,current_apa_contract:contract,current_apa_version:n,baseline_artifact_sha256:baseline.artifact_sha256,bos_sha256:bundle.bos.artifact_sha256});
 Object.assign(a.confirmation,values);
 a.sources.push({id:sourceId,actorId,mm,source:'Athlete-confirmed coaching update',source_message_id:messageId,
  text:'My reviewed priority and exact dates.',epistemic:'ATHLETE_CONFIRMED',supersedes:[]});
 a.narrative_provenance={contract:'athlete_current_apa_narrative_provenance_v2',fields:Object.entries(values).map(([field,value])=>({
  field:'confirmation.'+field,status:'SOURCE_BOUND',value_sha256:hash(value),refs:[sourceId],source_id:sourceId,source_message_id:messageId,version:n}))};
 delete a.artifact_sha256;a.artifact_sha256=hash(a);
 const unsigned={version:n,actorId,mm,prior_hash:prior?.receipts.at(-1).receipt_hash||baseline.artifact_sha256,
  content_hash:a.artifact_sha256,change_id:id,source_id:sourceId,source_message_id:messageId,reason:change.reason,at:change.confirmed_at,
  supersedes:[],material_paths:['confirmation.priority'],narrative_changes:[]};
 const receipt={...unsigned,receipt_hash:hash(unsigned)};
 return {change,message:{id:messageId,actorId,role:'user',speaker:'athlete',text:'My authored priority and dates.'},
  record:{contract,binding:clone(bundle.binding),version:n,artifact:a,receipts:[...(prior?.receipts||[]),receipt]}};
}
function stateWithDraft(){
 const first=publication(),next=publication(first.record,2);
 const draft={id:uuid(220),hash:'d'.repeat(64),expectedVersion:1,confirmedChange:next.change,
  source_id:next.change.source_id,previewRecord:next.record};
 return {mm,revision:7,status:'active',sourceBinding:clone(bundle.binding),plan:clone(plan),messages:[first.message,next.message],
  capabilities:{currentApa:true},continuity:{contract,binding:clone(bundle.binding),original:clone(baseline),current:first.record,draft,
   changes:[first.change,next.change],current_version:1,stale:false}};
}
const allReviewed=draft=>({key:apaDraftKey(draft),boxes:[...APA_BOXES]});

test('feature requires explicit server capability and valid returned envelope, never a local artifact',()=>{
 const state=stateWithDraft();delete state.capabilities;
 assert.equal(continuityView(bundle,state).enabled,false);
 state.capabilities={currentApa:'true'};assert.equal(continuityView(bundle,state).enabled,false);
 state.capabilities.currentApa=true;delete state.continuity;
 assert.equal(continuityView(bundle,state).verified,false);
 assert.throws(()=>prepareApaCommand(bundle,state,uuid(2)),/could not be verified/);
});
test('main current, proposed and original readings survive reload with accepted plan distinct',()=>{
 const state=stateWithDraft(),before=clone(bundle);
 for(const saved of [state,JSON.parse(JSON.stringify(state))]){
  const current=continuityView(bundle,saved),preview=continuityView(bundle,saved,{reading:'preview'}),original=continuityView(bundle,saved,{reading:'original'});
  assert.equal(current.verified,true);assert.equal(current.actionAllowed,true);assert.equal(current.version,1);
  assert.equal(preview.version,2);assert.equal(preview.showPreview,true);assert.match(apaReadingLabel(preview),/not current/);
  assert.equal(original.artifact.confirmation.priority,baseline.confirmation.priority);assert.equal(original.version,0);
  assert.deepEqual(current.acceptedPlan,plan);assert.deepEqual(preview.acceptedPlan,plan);
 }
 assert.deepEqual(bundle,before);
});
test('owner/MM/source/currentversion/record or receipt mismatch fails closed',()=>{
 const mutations=[s=>{s.continuity.binding.actorId='other';},s=>{s.mm='other';},s=>{s.sourceBinding.bos='c'.repeat(64);},
  s=>{s.continuity.current_version=0;},s=>{s.continuity.current.artifact.confirmation.priority='tampered';},
  s=>{s.continuity.current.receipts[0].source_id='wrong';},s=>{s.continuity.original.sources[0].text='rewritten';},
  s=>{s.continuity.draft.confirmedChange.actorId='other';},s=>{s.continuity.draft.source_id='invented';},
  s=>{s.continuity.draft.expectedVersion=0;},s=>{s.continuity.contract='athlete_current_apa_v1';}];
 for(const mutate of mutations){const s=stateWithDraft();mutate(s);const v=continuityView(bundle,s);assert.equal(v.verified,false);assert.equal(v.actionAllowed,false);assert.equal(v.stale,true);}
});
test('pending/unknown/stale/source-change/working states never produce a mutation command',()=>{
 for(const update of [{pendingAttempt:{id:'pending'}},{status:'unknown'},{status:'working'},{sourceUpdateAvailable:true}]){
  const s=Object.assign(stateWithDraft(),update);assert.equal(continuityView(bundle,s).actionAllowed,false);
  assert.throws(()=>publishApaCommand(bundle,s,{review:allReviewed(s.continuity.draft),confirmedTiming:true}));
 }
 const s=stateWithDraft();s.continuity.stale=true;assert.equal(continuityView(bundle,s).actionAllowed,false);
 assert.match(apaReadingLabel(continuityView(bundle,s)),/currency unconfirmed/);
});
test('only saved same-account authored athlete messages are selectable, never coach/capture',()=>{
 const s=stateWithDraft(),original=s.messages.at(-1);
 s.messages.push({...original,id:'coach',speaker:'coach'},{...original,id:'capture',capture:{}},
  {...original,id:'other-owner',actorId:'other'},{...original,id:'other-mm',mm:'another'},
  {...original,id:'assistant',role:'assistant'},{...original,id:'blank',text:' '});
 assert.deepEqual(eligibleApaMessages(bundle,s).map(m=>m.id),[uuid(102),uuid(101)]);
 assert.throws(()=>confirmApaCommand(bundle,s,{source_message_id:'coach',reason:'Review',kind:'reality'}));
});
test('confirmation is explicit, typed and source-bound; corrected source must remain active',()=>{
 const s=stateWithDraft();const input={source_message_id:uuid(102),reason:'  My reason  ',kind:'reality'};
 assert.deepEqual(confirmApaCommand(bundle,s,input),{action:'confirm_fact',source_message_id:uuid(102),reason:'My reason',kind:'reality',supersedes:[]});
 assert.equal(confirmApaCommand(bundle,s,{...input,kind:'correction',supersedes:['CONFIRM']}).supersedes[0],'CONFIRM');
 for(const change of [{kind:'statement'},{reason:' '},{kind:'correction',supersedes:[]},{supersedes:['CONFIRM']},
  {kind:'correction',supersedes:['unrecognized']},{kind:'correction',supersedes:['CONFIRM','CONFIRM']}])assert.throws(()=>confirmApaCommand(bundle,s,{...input,...change}));
 const view=continuityView(bundle,s);view.current=clone(view.current);view.current.sources.at(-1).supersedes=['A01'];
 assert.ok(!selectableApaSources(view).some(source=>source.id==='A01'));
});
test('preparation consumes only an existing eligible unpublished confirmation, without publication',()=>{
 const s=stateWithDraft();assert.deepEqual(pendingApaChanges(bundle,s).map(change=>change.id),[uuid(2)]);
 assert.deepEqual(prepareApaCommand(bundle,s,uuid(2)),{action:'update_apa',confirmation_id:uuid(2),expected_version:1});
 assert.throws(()=>prepareApaCommand(bundle,s,uuid(1)));assert.throws(()=>prepareApaCommand(bundle,s,'invented'));
 assert.equal(s.continuity.current.version,1);assert.equal(s.plan.title,plan.title);
});
test('publication requires exact draft, all five real frame-box receipts and separate timing review',()=>{
 const s=stateWithDraft(),d=s.continuity.draft,frame={},origin='http://offline.invalid';let review=null;
 for(const box of APA_BOXES)review=recordApaBoxReview(review,{origin,source:frame,data:{contract:'athlete-academy-apa-box',mm,
  reading:'preview',box,draft_id:d.id,artifact_hash:d.previewRecord.artifact.artifact_sha256}},{origin,frame,mm,draft:d});
 assert.deepEqual(review,allReviewed(d));
 const command=publishApaCommand(bundle,s,{review,confirmedTiming:true});
 assert.deepEqual(command,{action:'publish_apa',id:d.id,hash:d.hash,expected_version:1,artifact_hash:d.previewRecord.artifact.artifact_sha256,
  confirmation_id:d.confirmedChange.id,source_id:d.source_id});
 assert.equal(Object.hasOwn(command,'actor'),false);assert.equal(Object.hasOwn(command,'speaker'),false);
 assert.throws(()=>publishApaCommand(bundle,s,{review,confirmedTiming:false}));
 assert.throws(()=>publishApaCommand(bundle,s,{review:{...review,boxes:APA_BOXES.slice(0,4)},confirmedTiming:true}));
 assert.throws(()=>publishApaCommand(bundle,s,{review:{...review,key:'old-draft'},confirmedTiming:true}));
 assert.deepEqual(discardApaCommand(bundle,s),{action:'discard_apa',id:d.id,hash:d.hash});
});
test('frame review receipts reject foreign origin/window/MM/reading/draft/artifact and invalid boxes',()=>{
 const d=stateWithDraft().continuity.draft,frame={},origin='http://offline.invalid',base={origin,source:frame,data:{
  contract:'athlete-academy-apa-box',mm,reading:'preview',box:'where',draft_id:d.id,artifact_hash:d.previewRecord.artifact.artifact_sha256}};
 for(const event of [{...base,origin:'https://foreign.invalid'},{...base,source:{}},
  ...[{mm:'other'},{reading:'current'},{draft_id:'old'},{artifact_hash:'e'.repeat(64)},{box:'account'}].map(change=>({...base,data:{...base.data,...change}}))])
  assert.equal(recordApaBoxReview(null,event,{origin,frame,mm,draft:d}),null);
});
test('new draft never inherits five-box review from an earlier proposal',()=>{
 const old=stateWithDraft().continuity.draft,next=clone(old);next.id=uuid(221);const frame={},origin='http://offline.invalid';
 const review=recordApaBoxReview(allReviewed(old),{origin,source:frame,data:{contract:'athlete-academy-apa-box',mm,reading:'preview',box:'evidence',
  draft_id:next.id,artifact_hash:next.previewRecord.artifact.artifact_sha256}},{origin,frame,mm,draft:next});
 assert.deepEqual(review,{key:apaDraftKey(next),boxes:['evidence']});
});
test('priority and exact dates require typed active provenance; original and stale are historical',()=>{
 const s=stateWithDraft(),v=continuityView(bundle,s),a=v.artifact;
 assert.deepEqual(confirmationReadingScope(a,{version:1}).statuses,{priority:'current',review_date:'current',horizon_date:'current'});
 for(const flags of [{showOriginal:true},{stale:true},{needsReview:true}])assert.equal(confirmationReadingScope(a,{version:1,...flags}).statuses.priority,'historical');
 assert.equal(confirmationReadingScope(a,{version:1,showPreview:true}).statuses.priority,'proposed');
 const legacy=clone(a);legacy.narrative_provenance.contract='athlete_current_apa_narrative_provenance_v1';
 assert.equal(confirmationReadingScope(legacy,{version:1}).statuses.review_date,'historical');
 const forged=clone(a);forged.confirmation.review_date='2027-01-01';assert.equal(confirmationReadingScope(forged,{version:1}).statuses.review_date,'historical');
 const model=project(a,{version:1,acceptedPlan:plan,receipt:v.receipt,stale:true});
 assert.match(model.objects.version.display_payload.title,/currency unconfirmed/);
 assert.ok(model.layer0.cards.find(card=>card.id==='futures').description.includes(values.horizon_date));
 assert.equal(model.layer0.cards.find(card=>card.id==='plan').value,plan.title);
});
test('confirmed unpublished athlete source marks prior reading historical without blocking preparation',()=>{
 const s=stateWithDraft(),view=continuityView(bundle,s);
 assert.equal(view.needsReview,true);assert.equal(view.stale,false);assert.equal(view.actionAllowed,true);
 assert.match(apaReadingLabel(view),/Previous APA.*review needed/);
 assert.equal(prepareApaCommand(bundle,s,uuid(2)).action,'update_apa');
 assert.equal(confirmationReadingScope(view.artifact,{version:view.version,needsReview:view.needsReview}).statuses.priority,'historical');
 const preview=continuityView(bundle,s,{reading:'preview'});assert.match(apaReadingLabel(preview),/not current/);
 assert.equal(confirmationReadingScope(preview.artifact,{version:preview.version,showPreview:true,needsReview:preview.needsReview}).statuses.priority,'proposed');
 const original=continuityView(bundle,s,{reading:'original'});assert.equal(original.artifact.confirmation.priority,baseline.confirmation.priority);
 const published=clone(s);published.continuity.current=published.continuity.draft.previewRecord;
 published.continuity.current_version=2;published.continuity.draft=null;
 assert.equal(continuityView(bundle,published).needsReview,false);
});
test('version number alone never makes baseline-uncited priority a reviewed current field',()=>{
 const s=stateWithDraft(),a=clone(s.continuity.current.artifact);
 a.narrative_provenance.fields.find(field=>field.field==='confirmation.priority').status='BASELINE_UNCITED_AT_FIELD_LEVEL';
 const scope=confirmationReadingScope(a,{version:1});assert.equal(scope.statuses.priority,'historical');
 assert.match(scope.priorityLabel,/Historical priority/);assert.equal(scope.statuses.review_date,'current');
 const unknown=clone(a);delete unknown.narrative_provenance;assert.equal(confirmationReadingScope(unknown,{version:4}).statuses.priority,'historical');
});
test('mutable priorities/dates/goals cannot rewrite preserved original CONFIRM source words',()=>{
 const s=stateWithDraft(),a=clone(s.continuity.current.artifact);
 a.confirmation.goals.school='Mutable new goal';const model=project(a,{version:1});
 const confirm=model.objects.sources.drawer_payload[0].items.find(line=>line.startsWith('Athlete confirmation:'));
 assert.equal(confirm,'Athlete confirmation: '+baseline.sources[0].text);
 assert.ok(!confirm.includes(values.priority));assert.ok(!confirm.includes('Mutable new goal'));
});
test('uncertain continuity acknowledgement preserves exact intent/request/revision across view changes',()=>{
 const s=stateWithDraft(),commands=[confirmApaCommand(bundle,s,{source_message_id:uuid(102),reason:'My reason',kind:'reality'}),
  prepareApaCommand(bundle,s,uuid(2)),publishApaCommand(bundle,s,{review:allReviewed(s.continuity.draft),confirmedTiming:true}),discardApaCommand(bundle,s)];
 for(const body of commands){
  const first=coachActionOperation({slug:mm,body,view:'home',revision:7,requestId:'original-request'});
  const retried=coachActionOperation({slug:mm,body:clone(body),view:'sport',revision:8,prior:first,requestId:'must-not-be-used'});
  assert.equal(retried.operation,first.operation);assert.equal(retried.signature,first.signature);
  assert.equal(retried.operation.requestId,'original-request');assert.equal(retried.operation.revision,7);
  assert.equal(Object.hasOwn(retried.operation,'view'),false);
  const other=coachActionOperation({slug:'other-mm',body,view:'sport',revision:8,prior:first,requestId:'different-owner-intent'});
  assert.notEqual(other.signature,first.signature);
 }
 const body={action:'confirm_fact',source_message_id:uuid(102),reason:'Original',kind:'correction',supersedes:['CONFIRM']};
 const captured=coachActionOperation({slug:mm,body,view:'home',revision:7,requestId:'captured'});
 body.supersedes.push('A01');assert.deepEqual(captured.operation.supersedes,['CONFIRM']);
 const original=coachActionOperation({slug:mm,body:{action:'message',text:'One message'},view:'home',revision:7,requestId:'legacy'});
 const changed=coachActionOperation({slug:mm,body:{action:'message',text:'One message'},view:'sport',revision:8,prior:original,requestId:'legacy-new'});
 assert.notEqual(changed.signature,original.signature);assert.equal(changed.operation.view,'sport');
});
test('only known server no-op conflicts clear pending continuity intent, never network/unknown',()=>{
 for(const action of ['confirm_fact','update_apa','publish_apa','discard_apa']){
  assert.equal(continuityFailureIsKnownNoOp(action,{code:'STATE_CHANGED_RELOAD'}),true);
  assert.equal(continuityFailureIsKnownNoOp(action,{code:'REQUEST_ID_CONFLICT'}),true);
  for(const error of [new Error('Network unavailable'),{code:'STORAGE_OUTCOME_UNKNOWN'},{code:'SERVICE_UNAVAILABLE'},
   {code:'SESSION_EXPIRED'},{message:'STATE_CHANGED_RELOAD'}])assert.equal(continuityFailureIsKnownNoOp(action,error),false);
 }
 assert.equal(continuityFailureIsKnownNoOp('message',{code:'STATE_CHANGED_RELOAD'}),false);
});
test('main wiring preserves account/MM/original routes and transport strips client roles',()=>{
 const source=name=>readFileSync(new URL('../src/athleteAcademyV1/'+name,import.meta.url),'utf8');
 const app=source('coach/App.jsx'),transport=source('coach/transport.js'),page=source('apa/main.jsx'),reports=source('coach/Reports.jsx');
 assert.match(app,/coachActionOperation\(\{slug,body,view,revision:s.revision,prior:pendingAction.current/);
 assert.match(app,/if\(continuityFailureIsKnownNoOp\(body.action,e\)\)pendingAction.current=null/);
 assert.match(app,/<ApaContinuity bundle=\{b\} state=\{s\}/);
 assert.match(transport,/speaker:_SPEAKER,actor:_ACTOR/);
 assert.match(page,/call\('get_report',\{service:'apa',mm\}\)/);
 assert.match(page,/window.parent.location.pathname==='\/athlete\/workspace\/coach.html'/);
 assert.match(reports,/\/athlete\/workspace\/apa.html\?mm=/);
 assert.doesNotMatch(app,/Speaking as|Restart demo|Choose athlete|athlete-consulting-tool/);
 assert.doesNotMatch(source('coach/currentApaUi.js'),/APA:CURRENT:|APA:ACADEMY:|nia|sofia|leadership/i);
 assert.match(source('apa/ReportPage.jsx'),/confirmationScope\.priorityLabel/);
 assert.match(source('apa/ReportPage.jsx'),/historical=\{needsReview\|\|stale\}/);
 assert.match(app,/priorityScope\.priorityLabel/);
 assert.match(app,/apaSuggestionAvailable=.*!apaView\.needsReview/);
 assert.match(page,/needsReview:selected.needsReview/);
});
