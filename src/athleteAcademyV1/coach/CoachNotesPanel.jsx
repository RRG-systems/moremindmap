import React,{useEffect,useRef,useState} from 'react';
import {call} from '../transport.js';
import CoachNotes from './CoachNotes.jsx';
import {coachNoteOperation,coachNoteFailureMayClearJournal,coachNoteOperationAcknowledged,coachNoteOutcomeAcknowledged} from './coachNotesActions.js';
import {readPending,savePending,clearPending} from './coachNotesJournal.js';

// Uses the existing authenticated academy endpoint, never an athlete report or
// coaching bundle for a recipient. Unknown acknowledgments require an explicit
// same-request check; normal render/refresh never repeats a mutation.
export default function CoachNotesPanel({actorId,mode,mm=null,disabled=false}){
 const [envelope,setEnvelope]=useState(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[unknown,setUnknown]=useState(false),[journalReady,setJournalReady]=useState(false);
 const pending=useRef(null),mounted=useRef(false);
 const scope={actorId,mode,mm};
 useEffect(()=>{let alive=true;mounted.current=true;
  function restore(){try{const metadata=readPending(globalThis.localStorage,{actorId,mode,mm});
   if(metadata&&pending.current?.metadata?.request_id!==metadata.request_id)pending.current={metadata};
   if(!metadata)pending.current=null;setUnknown(Boolean(metadata));setJournalReady(true);
  }catch(e){setJournalReady(false);setUnknown(true);setError(e.message);}}
  restore();window.addEventListener('storage',restore);call('coach_notes_view',{mode,...(mode==='owner'?{mm}:{})})
  .then(result=>{if(alive)setEnvelope(result.coachNotes);}).catch(e=>{if(alive)setError(e.message);});
  return()=>{alive=false;mounted.current=false;window.removeEventListener('storage',restore);};},[actorId,mm,mode]);
 async function refresh(){const result=await call('coach_notes_view',{mode,...(mode==='owner'?{mm}:{})});if(mounted.current)setEnvelope(result.coachNotes);return result;}
 async function perform(body){
  if(busy||disabled||!journalReady)return false;
  if(pending.current&&!pending.current.operation)throw Error('Check the saved action acknowledgment before making another change.');
  const priorUncertainty=Boolean(pending.current);
  const selected=coachNoteOperation(body,pending.current,crypto.randomUUID());
  setBusy(true);setError('');let result;
  try{
   const metadata=await savePending(globalThis.localStorage,scope,selected.operation);
   pending.current={...selected,metadata};setUnknown(true);
   const {action,...operation}=selected.operation;result=await call(action,operation);
   coachNoteOperationAcknowledged(result.operation_receipt,metadata,actorId);
   await clearPending(globalThis.localStorage,scope,metadata.request_id);
   pending.current=null;setUnknown(false);setEnvelope(null);
  }catch(e){
   try{if(coachNoteFailureMayClearJournal(e,priorUncertainty)&&pending.current?.metadata){await clearPending(globalThis.localStorage,scope,pending.current.metadata.request_id);pending.current=null;setUnknown(false);}
    else{const metadata=readPending(globalThis.localStorage,scope);if(metadata&&!pending.current?.operation)pending.current={metadata};setUnknown(Boolean(metadata));}}
   catch{setJournalReady(false);setUnknown(true);}
   setError(e.message);throw e;
  }finally{setBusy(false);}
  try{await refresh();}catch(e){setError(`Your action was acknowledged, but the saved view could not be refreshed. ${e.message}`);}
  return result;
 }
 async function checkOutcome(){
  const metadata=pending.current?.metadata;if(!metadata||busy||disabled)return;
  setBusy(true);setError('');
  try{const result=await call('coach_notes_outcome',{mm:metadata.target_mm,request_id:metadata.request_id,signature_sha256:metadata.signature_sha256,kind:metadata.kind});
   if(coachNoteOutcomeAcknowledged(result.noteOutcome,metadata,actorId)){await clearPending(globalThis.localStorage,scope,metadata.request_id);pending.current=null;setUnknown(false);await refresh();}
   else setError('No exact acknowledgment is available yet. This action remains held; do not send a replacement.');
  }catch(e){setError(e.message);}finally{setBusy(false);}
 }
 return <section aria-label="Scoped coach observations">
  {!envelope&&<p role="status">{error||'Checking saved coach observations…'}</p>}
  {unknown&&<section role="alert"><p>The acknowledgment is uncertain. Your exact action is held; no new note action or automatic resend is permitted.</p>
   <button disabled={busy||disabled} onClick={()=>refresh().catch(e=>setError(e.message))}>Read saved status</button>
   <button disabled={busy||disabled||!pending.current?.metadata} onClick={checkOutcome}>Check this exact acknowledgment</button>
   {pending.current?.operation&&<button disabled={busy||disabled||!journalReady} onClick={()=>perform(JSON.parse(pending.current.signature)).catch(()=>{})}>Check this same saved action</button>}
  </section>}
  {envelope&&<CoachNotes envelope={envelope} actorId={actorId} mode={mode} mm={mm}
   disabled={disabled||busy||unknown||!journalReady} actionError={error} onAction={perform}/>}
  {!unknown&&<button disabled={busy||disabled} onClick={()=>refresh().catch(e=>setError(e.message))}>Refresh saved observations</button>}
 </section>;
}
