import React,{useState} from 'react';
import {APA_BOXES,apaDraftKey,continuityView,eligibleApaMessages,selectableApaSources,
 pendingApaChanges,confirmApaCommand,prepareApaCommand,publishApaCommand,discardApaCommand} from './currentApaUi.js';

function DraftDecision({bundle,state,view,review,disabled,onAction,onRead}){
 const [confirmedTiming,setConfirmedTiming]=useState(false),[error,setError]=useState('');
 const d=view.draft,a=d.previewRecord.artifact;
 const visited=review?.key===apaDraftKey(d)?review.boxes:[];
 async function decide(publish){
  try{setError('');await onAction(publish?publishApaCommand(bundle,state,{review,confirmedTiming}):discardApaCommand(bundle,state));}
  catch(cause){setError(cause.message);}
 }
 return <section aria-label="Decide on the proposed APA" className="plan-card draft">
  <span className="status">PROPOSED APA · NOT CURRENT</span><h3>Review this exact version before publishing.</h3>
  <p>The proposal does not change your current APA or agreed plan. Your original assessment and source words stay saved.</p>
  <dl><dt>Proposed priority</dt><dd>{a.confirmation.priority}</dd>
   <dt>Proposed review date</dt><dd>{a.confirmation.review_date}</dd>
   <dt>Proposed planning horizon</dt><dd>{a.confirmation.horizon_date}</dd></dl>
  <p>Read all five boxes in YOUR SPORT, including the evidence and before-and-after wording. Reviewed: {visited.length} of {APA_BOXES.length}.</p>
  <button type="button" onClick={()=>onRead('preview')}>Read the full proposed APA →</button>
  <label className="check-label"><input type="checkbox" disabled={disabled} checked={confirmedTiming}
   onChange={event=>setConfirmedTiming(event.target.checked)}/><span>I reviewed this exact proposed priority, review date, planning horizon and source evidence.</span></label>
  {(error||!view.actionAllowed)&&<p role="alert">{error||'Publication is paused while the saved state is unresolved or its currency cannot be confirmed.'}</p>}
  <div className="actions"><button type="button" className="primary"
   disabled={disabled||!confirmedTiming||!APA_BOXES.every(box=>visited.includes(box))}
   onClick={()=>decide(true)}>Publish this exact APA version</button>
   <button type="button" disabled={disabled} onClick={()=>decide(false)}>Discard this APA proposal</button></div>
  <p className="muted">This publishes only the reviewed APA. It does not accept, replace or change your plan.</p>
 </section>;
}

export default function ApaContinuity({bundle,state,disabled=false,actionError='',review,onAction,onRead}){
 const [messageId,setMessageId]=useState(''),[reason,setReason]=useState(''),[kind,setKind]=useState('reality');
 const [supersedes,setSupersedes]=useState(''),[confirmationId,setConfirmationId]=useState(''),[error,setError]=useState('');
 const view=continuityView(bundle,state);
 if(!view.enabled)return null;
 if(!view.verified)return <section className="closing-card" aria-label="APA review unavailable"><h2>Your original APA is preserved.</h2><p role="alert">{view.error}</p></section>;
 const messages=eligibleApaMessages(bundle,state),sources=selectableApaSources(view),changes=pendingApaChanges(bundle,state);
 const selected=messages.find(message=>message.id===messageId),blocked=disabled||!view.actionAllowed;
 async function confirm(event){
  event.preventDefault();
  try{
   setError('');
   const body=confirmApaCommand(bundle,state,{source_message_id:messageId,reason,kind,
    supersedes:kind==='correction'?[supersedes]:[]});
   const result=await onAction(body);
   const saved=result&&pendingApaChanges(bundle,result).find(change=>change.source_message_id===messageId
    &&change.reason===body.reason&&change.kind===kind);
   if(saved)setConfirmationId(saved.id);
  }catch(cause){setError(cause.message);}
 }
 async function prepare(){
  try{setError('');const result=await onAction(prepareApaCommand(bundle,state,confirmationId));
   if(result&&continuityView(bundle,result).draft)onRead('preview');
  }catch(cause){setError(cause.message);}
 }
 return <section className="plan-card" aria-label="Your reviewed APA updates">
  <span className="eyebrow">YOUR UNDERSTANDING, OVER TIME</span><h2>Your current priority and timing are your choice.</h2>
  <p>Use your own saved words to describe what changed. Confirm the source, ask for a proposal, then review and publish it separately. Nothing changes automatically.</p>
  <div className="actions"><button type="button" onClick={()=>onRead('current')}>Read the saved APA</button>
   <button type="button" onClick={()=>onRead('original')}>Original assessment and evidence</button></div>
  {view.stale&&<p role="alert">This is a last-verified reading. Changes are paused until the saved state is current and the unresolved attempt is reviewed.</p>}
  {!view.stale&&view.needsReview&&<p role="status">A confirmed athlete update is awaiting review. The earlier APA is historical until you prepare, review and explicitly publish an update. Your original and agreed plan remain saved.</p>}
  {(error||actionError)&&<p role="alert">{error||actionError}</p>}
  <details><summary>Confirm a source and prepare an APA update</summary><form onSubmit={confirm}>
   <h3>1. Confirm your source</h3><p>For a priority or timing change, state the exact priority and dates in your own conversation message first. Coach notes and captured observations cannot be selected here.</p>
   <label>Your saved message<select value={messageId} disabled={blocked} onChange={event=>setMessageId(event.target.value)}>
    <option value="">Choose your own message</option>{messages.map(message=><option key={message.id} value={message.id}>{message.text.slice(0,140)}</option>)}</select></label>
   {selected&&<blockquote>{selected.text}</blockquote>}
   <label>Kind of change<select value={kind} disabled={blocked} onChange={event=>{setKind(event.target.value);setSupersedes('');}}>
    <option value="reality">Current reality</option><option value="correction">Correction to an earlier athlete source</option></select></label>
   {kind==='correction'&&<label>Earlier source being corrected<select value={supersedes} disabled={blocked} onChange={event=>setSupersedes(event.target.value)}>
    <option value="">Choose the exact earlier source</option>{sources.map(source=><option key={source.id} value={source.id}>{source.question||source.text?.slice(0,140)||source.id}</option>)}</select></label>}
   <label>Why should your APA be reviewed?<textarea required maxLength={1000} value={reason} disabled={blocked} onChange={event=>setReason(event.target.value)}/></label>
   <button type="submit" disabled={blocked||!selected||!reason.trim()||(kind==='correction'&&!supersedes)}>Confirm my own source</button>
  </form>
  <section aria-label="Prepare an APA proposal"><h3>2. Prepare a proposal from a confirmed source</h3>
   <label>Confirmed athlete detail<select value={confirmationId} disabled={blocked} onChange={event=>setConfirmationId(event.target.value)}>
    <option value="">Choose a confirmed detail</option>{changes.map(change=><option key={change.id} value={change.id}>{change.reason}</option>)}</select></label>
   <button type="button" disabled={blocked||!changes.some(change=>change.id===confirmationId)} onClick={prepare}>Prepare an APA proposal for my review</button>
   {state.pendingTask==='APA_UPDATE'&&<p role="status">MORE is preparing your APA review. Your original, current reading and agreed plan remain unchanged.</p>}
  </section></details>
  {view.draft&&<DraftDecision key={apaDraftKey(view.draft)} bundle={bundle} state={state} view={view}
   review={review} disabled={blocked} onAction={onAction} onRead={onRead}/>}
 </section>;
}
