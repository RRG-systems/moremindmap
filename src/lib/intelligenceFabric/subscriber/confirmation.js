import { hashCanonicalJson } from '../hashing.js'; import { deepFreeze } from '../validation.js';
export const CONFIRMATION_STATES=Object.freeze(['PROPOSED','CONFIRMED_AS_PROPOSED','CONFIRMED_WITH_EDITS','REJECTED','DEFERRED','UNCERTAIN','SUPERSEDED','EXPIRED']);
const scope=(x)=>`${x?.tenant_id}:${x?.business_id}:${x?.profile_id}`;
export function proposeStructuredExtraction(input){
  if(!input?.statement_ref||!input.raw_statement||!Array.isArray(input.extracted_fields)||!input.extracted_fields.length)return deepFreeze({ok:false,code:'EXTRACTION_INPUT_REQUIRED'});
  if(input.privacy_classification==='COACH_SESSION_PRIVATE')return deepFreeze({ok:false,code:'COACH_PRIVATE_EXTRACTION_DENIED'});
  if(input.extracted_fields.some(x=>!x.field||x.proposed_value===undefined||!x.source_ref||scope(x.canonical_target)!==scope(input)))return deepFreeze({ok:false,code:'INVALID_OR_CROSS_SCOPE_CANONICAL_TARGET'});
  const body={tenant_id:input.tenant_id,business_id:input.business_id,profile_id:input.profile_id,statement_ref:input.statement_ref,extracted_fields:input.extracted_fields,
    proposed_effective_at:input.proposed_effective_at,proposed_recorded_at:input.proposed_recorded_at,ambiguity:input.ambiguity||[],contradictions:input.contradictions||[],
    extraction_confidence:input.extraction_confidence??0,status:'PROPOSED',privacy_classification:input.privacy_classification||'TENANT_PRIVATE'};
  return deepFreeze({ok:true,proposal:{...body,proposal_id:`proposal_${hashCanonicalJson(body).slice(0,20)}`,proposal_hash:hashCanonicalJson(body)}});
}
export function decideExtraction(proposal,{decision,subscriber_edits=[],reason=null,decided_at}){
  if(!proposal||proposal.status!=='PROPOSED'||!CONFIRMATION_STATES.includes(decision)||decision==='PROPOSED')return deepFreeze({ok:false,code:'INVALID_CONFIRMATION_DECISION'});
  if(['CONFIRMED_AS_PROPOSED','CONFIRMED_WITH_EDITS'].includes(decision)&&(proposal.ambiguity.length||proposal.contradictions.length)&&decision!=='CONFIRMED_WITH_EDITS')return deepFreeze({ok:false,code:'AMBIGUITY_REQUIRES_EDIT_OR_NON_CONFIRMATION'});
  if(decision==='CONFIRMED_WITH_EDITS'&&!subscriber_edits.length)return deepFreeze({ok:false,code:'CONFIRMED_EDITS_REQUIRED'});
  const fields=decision==='CONFIRMED_WITH_EDITS'?proposal.extracted_fields.map(f=>{const edit=subscriber_edits.find(e=>e.field===f.field);return edit?{...f,original_proposed_value:f.proposed_value,proposed_value:edit.value,subscriber_edited:true}:f}):proposal.extracted_fields;
  const record={decision_id:`decision_${hashCanonicalJson({proposal_id:proposal.proposal_id,decision,subscriber_edits,decided_at}).slice(0,20)}`,proposal_id:proposal.proposal_id,status:decision,subscriber_edits,reason,decided_at,fields};
  return deepFreeze({ok:true,decision:record,canonical_event_eligible:['CONFIRMED_AS_PROPOSED','CONFIRMED_WITH_EDITS'].includes(decision)});
}
export function confirmedExtractionToEvents(proposal,decision,{correction_of_event_id=null,supersedes_event_id=null}={}){
  if(!decision?.canonical_event_eligible)return deepFreeze({ok:false,code:'CONFIRMED_DECISION_REQUIRED'});
  const events=decision.decision.fields.map((field,index)=>({event_id:`subscriber_event_${hashCanonicalJson({decision:decision.decision.decision_id,index,field}).slice(0,20)}`,event_type:correction_of_event_id?'EVIDENCE_CORRECTED':'KPI_EVIDENCE_RECORDED',
    tenant_id:proposal.tenant_id,business_id:proposal.business_id,profile_id:proposal.profile_id,effective_at:proposal.proposed_effective_at,recorded_at:proposal.proposed_recorded_at,
    payload:{metric_id:field.field,value:field.proposed_value,unit:field.unit||'COUNT',verification_method:'USER_ENTERED',verification_state:'USER_ATTESTED'},
    source_proposal_id:proposal.proposal_id,source_decision_id:decision.decision.decision_id,correction_of_event_id,supersedes_event_id,privacy_classification:proposal.privacy_classification}));
  return deepFreeze({ok:true,events});
}
