import { createIntelligenceEvent } from '../intelligenceEvent.js'; import { hashCanonicalJson } from '../hashing.js'; import { deepFreeze } from '../validation.js';
import { runDurableIntelligenceRuntime } from '../runtime/durableRuntime.js'; import { runFutureEngine } from '../runtime/futureEngine.js'; import { rankInterventionCandidates } from '../runtime/interventionRanking.js';
import { buildUiExplanation } from './explanations.js';
const scope=(x)=>`${x?.tenant_id}:${x?.business_id}:${x?.profile_id}`;
const semanticEventHash=(event)=>hashCanonicalJson(JSON.parse(JSON.stringify(event)));
export function materializeSubscriberEvent(candidate,input){
  if(scope(candidate)!==scope(input)||(candidate.subscription_id&&candidate.subscription_id!==input.subscription_id))return deepFreeze({ok:false,code:'CROSS_SCOPE_EVENT_DENIED'});
  const built=createIntelligenceEvent({...candidate,schema_version:'1.0.0',subscription_id:input.subscription_id,organization_id:input.organization_id||null,
    authority_type:'USER_EVIDENCE',truth_class:'OBSERVED_TRUTH',consent_scope:input.consent_scope||['assessment'],confidence:input.extraction_confidence||.8,
    source_actor:input.source_actor,source_artifact:{id:candidate.source_proposal_id,version:'1.0.0'},source_system:input.source_system,
    occurred_at:candidate.effective_at,observed_at:candidate.effective_at,expires_at:null,idempotency_key:`idem_${candidate.event_id}`,correlation_id:input.correlation_id,
    causation_event_id:null,provenance:input.provenance,created_by:input.source_actor});
  return deepFreeze({ok:built.validation.valid,event:built.event,errors:built.validation.errors});
}
export function appendConfirmedEvents(stored_events,candidates,input){
  if(!['CONFIRMED_AS_PROPOSED','CONFIRMED_WITH_EDITS'].includes(input.confirmation_status))return deepFreeze({ok:false,code:'CONFIRMED_EVIDENCE_ONLY'});
  const history=[...stored_events],results=[];for(const candidate of candidates){const made=materializeSubscriberEvent(candidate,input);if(!made.ok)return made;
    const existing=history.find(x=>x.event.event_id===made.event.event_id);if(existing){
      if(semanticEventHash(existing.event)!==semanticEventHash(made.event))return deepFreeze({ok:false,code:'IDENTITY_CONFLICT',event_id:made.event.event_id,existing_event_id:existing.event.event_id});
      results.push({event_id:made.event.event_id,status:'IDEMPOTENT_REPLAY'});continue;
    }
    const store_sequence=history.length+1,aggregate_sequence=history.filter(x=>x.aggregate_key===`${input.tenant_id}:BUSINESS:${input.business_id}`).length+1,aggregate_key=`${input.tenant_id}:BUSINESS:${input.business_id}`;
    const wrapper={event:made.event,aggregate_key,aggregate_sequence,store_sequence,stored_at:made.event.recorded_at};wrapper.envelope_hash=hashCanonicalJson({event:wrapper.event,aggregate_key,aggregate_sequence,store_sequence});history.push(wrapper);results.push({event_id:made.event.event_id,status:'APPENDED'});
  }return deepFreeze({ok:true,stored_events:history,append_results:results});
}
export function reviewCurrentOneMove({current_one_move,ranking,authority_conflict=false,evidence_materiality='MATERIAL'}){
  if(!current_one_move)return deepFreeze({disposition:ranking.selected?'CANDIDATE_REPLACEMENT_PROPOSED':'REVIEW_REQUIRED',replacement_candidate_id:ranking.selected?.intervention_id||null,authorization_changed:false});
  if(authority_conflict||ranking.receipt.human_review_required)return deepFreeze({disposition:'REVIEW_REQUIRED',current_one_move_id:current_one_move.one_move_id,authorization_changed:false});
  if(evidence_materiality==='NON_MATERIAL')return deepFreeze({disposition:'RETAINED_NO_CHANGE',current_one_move_id:current_one_move.one_move_id,authorization_changed:false});
  if(ranking.selected?.intervention_id===current_one_move.candidate_id)return deepFreeze({disposition:'STRONGER_OR_UPDATED_SUPPORT',current_one_move_id:current_one_move.one_move_id,authorization_changed:false});
  return deepFreeze({disposition:'CANDIDATE_REPLACEMENT_PROPOSED',current_one_move_id:current_one_move.one_move_id,replacement_candidate_id:ranking.selected?.intervention_id||null,authorization_changed:false});
}
export function runSubscriberIntelligenceCycle(input){
  if(!input?.as_of_at||!input.tenant_id||!input.business_id||!input.profile_id||input.scoped_inputs?.some(x=>scope(x)!==scope(input)))return deepFreeze({ok:false,phase:'SCOPE',code:'EXACT_SCOPE_REQUIRED'});
  const appended=appendConfirmedEvents(input.stored_events||[],input.confirmed_event_candidates||[],input);if(!appended.ok)return deepFreeze({ok:false,phase:'APPEND',failure:appended});
  const durable=runDurableIntelligenceRuntime({...input,stored_events:appended.stored_events});if(!durable.ok)return deepFreeze({ok:false,phase:'DURABLE',failure:durable.failure});
  const future=runFutureEngine({...input,business_engine_state_version:durable.business_engine_state_version,belief_state:durable.belief_state,current_future_set:input.current_future_set});if(!future.ok)return deepFreeze({ok:false,phase:'FUTURE',failure:future});
  const ranking=rankInterventionCandidates({candidates:input.intervention_candidates,tenant_id:input.tenant_id,authority_conflict:future.human_review_required});if(!ranking.ok)return deepFreeze({ok:false,phase:'RANKING',failure:ranking});
  const one_move_review=reviewCurrentOneMove({current_one_move:input.current_one_move,ranking,authority_conflict:future.human_review_required,evidence_materiality:input.evidence_materiality});
  const explanation=buildUiExplanation({...input,ui_context:{...input.ui_context,tenant_id:input.tenant_id,business_id:input.business_id,profile_id:input.profile_id},projection:{current_value:durable.business_engine_state.current_operating_state.current,previous_value:durable.business_engine_state.current_operating_state.previous,trend:'UPDATED',change_reason:durable.business_engine_state.change_reason,supporting_evidence:durable.evidence_ledger.evidence_entries.map(x=>({evidence_id:x.evidence_id,privacy_classification:x.privacy_classification})),conflicting_evidence:[],evidence_gap_ids:durable.evidence_gaps.map(x=>x.evidence_gap_id),confidence:durable.confidence_state,last_updated:input.as_of_at,explanation_trace_ref:durable.explanation_trace.explanation_trace_id,future_impacts:future.probability_changes,one_move_impacts:[one_move_review]}});
  const result={cycle_version:'subscriber-cycle-reference-v1',append_results:appended.append_results,stored_events:appended.stored_events,durable,future,ranking,one_move_review,explanation:explanation.package};return deepFreeze({ok:true,...result,cycle_hash:hashCanonicalJson(result)});
}
