import {sha256Text} from '../../lib/canonicalSha256.js';

export const CONTINUITY_CONTRACT='athlete_academy_current_apa_v1';
export const APA_BOXES=['where','futures','move','plan','evidence'];
export const APA_ACTIONS=new Set(['confirm_fact','update_apa','publish_apa','discard_apa']);
export function coachActionOperation({slug,body,view,revision,prior,requestId}){
 const continuity=APA_ACTIONS.has(body.action)||body.action==='confirm_memory';
 const signature=JSON.stringify(continuity?{slug,body,speaker:'athlete'}:{slug,body,view,speaker:'athlete'});
 const operation=prior?.signature===signature?prior.operation:{...(continuity?structuredClone(body):body),
  revision,requestId,...(continuity?{}:{view}),speaker:'athlete'};
 return {signature,operation};
}
export function continuityFailureIsKnownNoOp(action,error){
 return APA_ACTIONS.has(action)&&['STATE_CHANGED_RELOAD','REQUEST_ID_CONFLICT'].includes(error?.code);
}
const object=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const canonical=value=>Array.isArray(value)?value.map(canonical):object(value)
 ?Object.fromEntries(Object.keys(value).sort().map(key=>[key,canonical(value[key])])):value;
const hash=value=>sha256Text(JSON.stringify(canonical(value)));
const same=(a,b)=>a===undefined||b===undefined?a===b:hash(a)===hash(b);
const digest=value=>typeof value==='string'&&/^[a-f0-9]{64}$/u.test(value);
const own=(value,bundle)=>value?.actorId===bundle?.binding?.actorId&&value?.mm===bundle?.person?.mm;
const fail=()=>{throw Error('The APA review could not be verified. Refresh your saved work before choosing again.');};

function recordValid(record,bundle){
 if(!object(record)||record.contract!==CONTINUITY_CONTRACT||!same(record.binding,bundle.binding)
  ||!Number.isSafeInteger(record.version)||record.version<1||!Array.isArray(record.receipts)
  ||record.receipts.length!==record.version)return false;
 const a=record.artifact;
 if(!own(a,bundle)||a.current_apa_contract!==CONTINUITY_CONTRACT
  ||a.current_apa_version!==record.version||a.baseline_artifact_sha256!==bundle.apa.artifact_sha256
  ||a.bos_sha256!==bundle.bos.artifact_sha256||!digest(a.artifact_sha256))return false;
 const {artifact_sha256,...body}=a;
 if(hash(body)!==artifact_sha256)return false;
 let prior=bundle.apa.artifact_sha256;
 for(const [index,receipt] of record.receipts.entries()){
  if(!object(receipt))return false;
  const {receipt_hash,...unsigned}=receipt;
  const source=a.sources?.find(item=>item.id===receipt.source_id);
  if(!own(receipt,bundle)||!own(source,bundle)||receipt.version!==index+1
   ||receipt.prior_hash!==prior||!digest(receipt_hash)||hash(unsigned)!==receipt_hash
   ||source.source_message_id!==receipt.source_message_id)return false;
  prior=receipt_hash;
 }
 return record.receipts.at(-1).content_hash===artifact_sha256;
}

// UI verification is not authorization: the server still owns account/session,
// participation, source fences, revision CAS and idempotent publication.
export function continuityView(bundle,state,{reading='current'}={}){
 const fallback={enabled:false,verified:false,actionAllowed:false,artifact:bundle?.apa,
  original:bundle?.apa,current:bundle?.apa,version:0,receipt:null,draft:null,changes:[],
  acceptedPlan:state?.plan||null,showOriginal:true,showPreview:false,stale:false,needsReview:false,error:''};
 if(state?.capabilities?.currentApa!==true)return fallback;
 try{
  const c=state.continuity;
  if(!object(c)||c.contract!==CONTINUITY_CONTRACT||!object(bundle?.binding)
   ||state.mm!==bundle.person.mm||!Number.isSafeInteger(state.revision)
   ||!same(c.binding,bundle.binding)||!same(state.sourceBinding,bundle.binding)
   ||!same(c.original,bundle.apa)||!Number.isSafeInteger(c.current_version)
   ||c.current_version<0||typeof c.stale!=='boolean'||!Array.isArray(c.changes)
   ||!(c.current===null||recordValid(c.current,bundle))
   ||c.current_version!==(c.current?.version||0))fail();
  const d=c.draft;
  if(d!==null){
   const change=d?.confirmedChange,receipt=d?.previewRecord?.receipts?.at(-1);
   if(!object(d)||typeof d.id!=='string'||!digest(d.hash)
    ||d.expectedVersion!==c.current_version||!recordValid(d.previewRecord,bundle)
    ||d.previewRecord.version!==c.current_version+1||!own(change,bundle)
    ||change.confirmed!==true||change.confirmed_by!=='athlete'
    ||!c.changes.some(item=>item.id===change.id&&own(item,bundle)
      &&item.source_message_id===change.source_message_id&&item.source_id===d.source_id)
    ||receipt.change_id!==change.id||receipt.source_message_id!==change.source_message_id
    ||receipt.source_id!==d.source_id
    ||(c.current&&d.previewRecord.receipts.at(-2)?.receipt_hash!==c.current.receipts.at(-1).receipt_hash))fail();
  }
  const showOriginal=reading==='original',showPreview=reading==='preview'&&Boolean(d);
  const selected=showPreview?d.previewRecord:c.current;
  const publishedSources=new Set((c.current?.artifact||c.original).sources.map(source=>source.id));
  const authoredMessages=new Set(eligibleApaMessages(bundle,state).map(message=>message.id));
  const needsReview=state.apaNeedsReview===true||c.changes.some(change=>own(change,bundle)&&change.confirmed===true
   &&change.confirmed_by==='athlete'&&authoredMessages.has(change.source_message_id)
   &&typeof change.source_id==='string'&&!publishedSources.has(change.source_id));
  const stale=c.stale||state.sourceUpdateAvailable===true||state.status==='unknown'||Boolean(state.pendingAttempt);
  return {enabled:true,verified:true,actionAllowed:!stale&&!['working','unknown'].includes(state.status)
    &&!state.pendingAttempt&&!state.sourceUpdateAvailable&&state.coaching_write_hold?.active!==true,
   artifact:showOriginal?c.original:selected?.artifact||c.original,original:c.original,
   current:c.current?.artifact||c.original,version:showOriginal?0:selected?.version||0,
   receipt:showOriginal?null:selected?.receipts.at(-1)||null,draft:d,changes:c.changes,
   currentVersion:c.current_version,acceptedPlan:state.plan||null,showOriginal,showPreview,stale,needsReview,error:''};
 }catch{return {...fallback,enabled:true,stale:true,error:'The latest APA review could not be verified. Your original reading remains saved.'};}
}

export function eligibleApaMessages(bundle,state){
 return (state?.messages||[]).filter(message=>message.role==='user'&&message.speaker==='athlete'
  &&message.actorId===bundle?.binding?.actorId&&(!Object.hasOwn(message,'mm')||message.mm===bundle.person.mm)
  &&!message.capture&&typeof message.text==='string'&&message.text.trim()).slice().reverse();
}
export function selectableApaSources(view){
 const inactive=new Set((view?.current?.sources||[]).flatMap(source=>source.supersedes||[]));
 return (view?.current?.sources||[]).filter(source=>['Athlete','Athlete confirmation','Athlete-confirmed coaching update'].includes(source.source)
  &&typeof source.id==='string'&&!inactive.has(source.id));
}
export function pendingApaChanges(bundle,state){
 const view=continuityView(bundle,state),sources=new Set((view.current?.sources||[]).map(source=>source.id));
 const eligible=new Set(eligibleApaMessages(bundle,state).map(message=>message.id));
 const active=new Set(selectableApaSources(view).map(source=>source.id));
 return view.verified?view.changes.filter(change=>own(change,bundle)&&change.confirmed===true
  &&change.confirmed_by==='athlete'&&eligible.has(change.source_message_id)
  &&typeof change.source_id==='string'&&!sources.has(change.source_id)
  &&Array.isArray(change.supersedes)&&change.supersedes.every(id=>active.has(id))):[];
}
function mutable(bundle,state){const view=continuityView(bundle,state);if(!view.actionAllowed)fail();return view;}
export function confirmApaCommand(bundle,state,{source_message_id,reason,kind,supersedes=[]}){
 const view=mutable(bundle,state),allowed=new Set(selectableApaSources(view).map(source=>source.id));
 if(!eligibleApaMessages(bundle,state).some(message=>message.id===source_message_id)
  ||typeof reason!=='string'||!reason.trim()||reason.length>1000
  ||!['reality','correction'].includes(kind)||!Array.isArray(supersedes)
  ||new Set(supersedes).size!==supersedes.length||supersedes.length>8
  ||(kind==='correction'?supersedes.length===0:supersedes.length!==0)
  ||!supersedes.every(id=>allowed.has(id)))fail();
 return {action:'confirm_fact',source_message_id,reason:reason.trim(),kind,supersedes:[...supersedes]};
}
export function prepareApaCommand(bundle,state,confirmation_id){
 const view=mutable(bundle,state);
 if(!pendingApaChanges(bundle,state).some(change=>change.id===confirmation_id))fail();
 return {action:'update_apa',confirmation_id,expected_version:view.currentVersion};
}
export const apaDraftKey=draft=>draft?`${draft.id}:${draft.hash}:${draft.previewRecord.artifact.artifact_sha256}`:'';
export function recordApaBoxReview(review,event,{origin,frame,mm,draft}){
 const d=event?.data,key=apaDraftKey(draft);
 if(!key||event.origin!==origin||event.source!==frame||d?.contract!=='athlete-academy-apa-box'
  ||d.mm!==mm||d.reading!=='preview'||d.draft_id!==draft.id
  ||d.artifact_hash!==draft.previewRecord.artifact.artifact_sha256||!APA_BOXES.includes(d.box))return review;
 return {key,boxes:[...new Set([...(review?.key===key?review.boxes:[]),d.box])]};
}
export function publishApaCommand(bundle,state,{review,confirmedTiming=false}){
 const view=mutable(bundle,state),d=view.draft,key=apaDraftKey(d);
 if(!d||!confirmedTiming||review?.key!==key||!APA_BOXES.every(box=>review.boxes?.includes(box)))fail();
 return {action:'publish_apa',id:d.id,hash:d.hash,expected_version:d.expectedVersion,
  artifact_hash:d.previewRecord.artifact.artifact_sha256,confirmation_id:d.confirmedChange.id,source_id:d.source_id};
}
export function discardApaCommand(bundle,state){const d=mutable(bundle,state).draft;if(!d)fail();return {action:'discard_apa',id:d.id,hash:d.hash};}
export function apaReadingLabel(view){
 return view.stale?'Last verified APA · currency unconfirmed':view.showOriginal?'Original saved APA'
  :view.showPreview?'Proposed APA · not current':view.needsReview?'Previous APA · review needed'
   :view.version>0?`Current APA · version ${view.version}`:'Original APA · no published update';
}
