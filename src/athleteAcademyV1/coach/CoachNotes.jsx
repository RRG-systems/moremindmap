import React,{useState} from 'react';
import {coachNotesView,coachNotesGrantKey,coachNoteReviewKey,coachNoteDraftKey,coachNoteReceiptLabel,
 inviteCoachNotesCommand,acceptCoachNotesCommand,revokeCoachNotesCommand,appendCoachNoteCommand,
 COACH_NOTES_BOUNDARY} from './coachNotesUi.js';

function Invitation({row,view,blocked,run}){
 const [accepted,setAccepted]=useState(false);
 return <article className="plan-card"><h3>Observation-only invitation · {row.athlete_name||row.mm}</h3>
  <p>Scope: {row.mm}. Expires: {row.expires_at}. Policy: {row.policy_version}.</p>
  <p>You may review and send attributed observations for this athlete only. Your exact reviewed sends may reach their next Start My Session input once, as unverified observations. This gives no access to their BOS, APA, reports, private conversation or plan, and no authority to change them. They may revoke access.</p>
  <label className="check-label"><input type="checkbox" checked={accepted} disabled={blocked}
   onChange={event=>setAccepted(event.target.checked)}/><span>I accept these observation-only terms for this exact MM scope.</span></label>
  <button type="button" disabled={blocked||!accepted} onClick={()=>run(()=>acceptCoachNotesCommand(view,row.grant_id,
   {accepted,termsKey:coachNotesGrantKey(row)}))}>Accept this scoped invitation</button></article>;
}
function Observation({row,view,blocked,run}){
 const [text,setText]=useState(''),[reviewedKey,setReviewedKey]=useState('');
 const exactKey=coachNoteDraftKey(row,text),reviewed=reviewedKey===exactKey;
 return <article className="plan-card"><h3>{row.athlete_name||row.mm}</h3><p>Assigned observation-only scope: {row.mm}. Expires: {row.expires_at}.</p>
  <form onSubmit={event=>{event.preventDefault();run(()=>appendCoachNoteCommand(view,row.grant_id,{text,reviewed,reviewedKey}),()=>{setText('');setReviewedKey('');});}}>
   <label>Your observation<textarea required maxLength={10000} value={text} disabled={blocked}
    onChange={event=>{setText(event.target.value);setReviewedKey('');}}/></label>
   <p>{COACH_NOTES_BOUNDARY} Your authenticated account supplies the author; you cannot write as the athlete or another coach.</p>
   <label className="check-label"><input type="checkbox" checked={reviewed} disabled={blocked||!text.trim()}
    onChange={event=>setReviewedKey(event.target.checked?exactKey:'')}/><span>I reviewed this exact note for this selected athlete. Send it once to their next eligible Start My Session input as my attributed unverified observation, not an instruction to alter their assessment or plan.</span></label>
   <button type="submit" disabled={blocked||!reviewed||!text.trim()}>Send this exact reviewed observation</button>
  </form></article>;
}
function OwnerGrant({grant,view,blocked,run}){
 const [confirmed,setConfirmed]=useState(false);
 return <article><h3>Recipient account · {grant.terms.recipient_id}</h3><p>{grant.status} · {grant.terms.mm} · Expires {grant.terms.expires_at}</p>
  {grant.status!=='revoked'&&<><label className="check-label"><input type="checkbox" checked={confirmed} disabled={blocked}
   onChange={event=>setConfirmed(event.target.checked)}/><span>Revoke this exact observation-only assignment. No saved report is deleted.</span></label>
   <button type="button" disabled={blocked||!confirmed} onClick={()=>run(()=>revokeCoachNotesCommand(view,grant.terms.id,
    {confirmed,termsKey:coachNotesGrantKey(grant)}))}>Revoke this assignment</button></>}</article>;
}
function OwnerNote({note,view}){
 const receipt=view.delivery.find(r=>r.id===note.id);
 return <article className="plan-card"><span className="eyebrow">ATTRIBUTED OBSERVATION · NOT AN ATHLETE-CONFIRMED FACT</span>
  <h3>{note.author_name}</h3><p>{note.created_at} · {note.mm}</p><blockquote>{note.text}</blockquote>
  <p>Reviewed and sent by {note.author_name} · {note.reviewed_at}</p>
  <p>{note.interpretation}</p><p role="status">{coachNoteReceiptLabel(receipt)}</p>
  <p>{receipt.owner_acknowledged?'Your optional acknowledgment is recorded.':'No per-note athlete approval is required. You can acknowledge or dispute an observation in your own conversation if you choose; its claims are not automatically confirmed.'}</p>
 </article>;
}
function Owner({view,blocked,run}){
 const [email,setEmail]=useState(''),[expires,setExpires]=useState(''),[confirmed,setConfirmed]=useState(false);
 return <><details><summary>Invite an existing verified recipient</summary><form onSubmit={event=>{
  event.preventDefault();run(()=>inviteCoachNotesCommand(view,{recipient_email:email,
   expires_at:expires?new Date(expires).toISOString():'',confirmed}),()=>{setEmail('');setExpires('');setConfirmed(false);});
 }}><p>Use the exact email of an existing verified account. This does not create an account, send email, share reports or grant access to your conversation.</p>
  <label>Recipient email<input required type="email" autoComplete="off" value={email} disabled={blocked} onChange={event=>setEmail(event.target.value)}/></label>
  <label>Expires at (your local time, within 30 days)<input required type="datetime-local" value={expires} disabled={blocked} onChange={event=>setExpires(event.target.value)}/></label>
  <label className="check-label"><input type="checkbox" checked={confirmed} disabled={blocked} onChange={event=>setConfirmed(event.target.checked)}/><span>I permit this exact recipient’s reviewed sends for my MM scope to reach my next eligible Start My Session input once as attributed unverified observations. They must explicitly accept. No report or plan changes automatically.</span></label>
  <button type="submit" disabled={blocked||!confirmed}>Prepare this scoped invitation</button></form></details>
  <h3>Your assignments</h3>{view.grants.length?view.grants.map(g=><OwnerGrant key={coachNotesGrantKey(g)} grant={g} view={view} blocked={blocked} run={run}/>):<p>No observation-only assignments.</p>}
  <h3>Your attributed coach observations</h3>{view.notes.length?view.notes.map(n=><OwnerNote key={coachNoteReviewKey(n)} note={n} view={view}/>):<p>No coach observations have been sent.</p>}</>;
}
export default function CoachNotes({envelope,actorId,mm=null,mode,disabled=false,actionError='',onAction}){
 const [error,setError]=useState(''),[pending,setPending]=useState(false),[notice,setNotice]=useState('');
 const view=coachNotesView(envelope,{actorId,mm,mode,disabled});
 if(!view.enabled)return null;
 if(!view.verified)return <section className="plan-card" aria-label="Scoped observations unavailable"><h2>Scoped observations</h2><p role="alert">{view.error}</p></section>;
 const blocked=pending||!view.actionAllowed||typeof onAction!=='function';
 async function run(makeCommand,onKnownSuccess){
  if(blocked)return;
  setError('');setNotice('');setPending(true);
  try{
   const result=await onAction(makeCommand());
   if(result===undefined||result===null||result===false)setNotice('Acknowledgment is unconfirmed. Your entry is preserved. Reload the saved note view before attempting another change.');
   else {onKnownSuccess?.();setNotice('The saved observation state was acknowledged. Check its current receipt below.');}
  }catch(cause){setError(cause.message||'The observation change could not be confirmed. Your entry is preserved.');}
  finally{setPending(false);}
 }
 return <section className="plan-card" aria-label={mode==='owner'?'Your attributed coach observations':'Your assigned observation-only notes'}>
  <span className="eyebrow">SCOPED COACH OBSERVATIONS</span><h2>{mode==='owner'?'Your coach observations. Your relationship permission.':'Your assigned observations.'}</h2>
  <p>The coach reviews and sends each exact note. Under an active accepted assignment, it may reach only the selected athlete’s next Start My Session input once as an attributed unverified observation. Nothing here automatically changes a BOS, APA, learning record or plan.</p>
  {(error||actionError)&&<p role="alert">{error||actionError}</p>}{notice&&<p role="status">{notice}</p>}
  {!view.actionAllowed&&<p role="alert">Changes are paused while this saved view is unresolved or out of date.</p>}
  {mode==='owner'?<Owner key={`${actorId}:${mm}`} view={view} blocked={blocked} run={run}/>:<>
   <h3>Invitations to review</h3>{view.invitations.length?view.invitations.map(row=><Invitation key={coachNotesGrantKey(row)} row={row} view={view} blocked={blocked} run={run}/>):<p>No pending scoped invitations.</p>}
   <h3>Your assigned athletes</h3>{view.assigned.length?view.assigned.map(row=><Observation key={coachNotesGrantKey(row)} row={row} view={view} blocked={blocked} run={run}/>):<p>No active observation-only assignments.</p>}
   <h3>Your own metadata receipts</h3>{view.receipts.length?<ul>{view.receipts.map(r=><li key={r.id}>{r.mm} · {r.created_at} · {coachNoteReceiptLabel(r)}</li>)}</ul>:<p>No saved observation receipts.</p>}
  </>}
 </section>;
}
