import { hashCanonicalJson } from '../hashing.js'; import { deepFreeze } from '../validation.js';
export const UI_SURFACES=Object.freeze(['BUSINESS_ENGINE','BUSINESS_ASSESSMENT_MAP','BOS_PROFILE','BA_VISUAL_DNA','FIVE_FUTURES','ONE_MOVE','EVIDENCE_COMPLETION','OUTCOME_REVIEW','CONFIDENCE_DETAIL','ADVANCED_EXPLANATION']);
export function buildUiExplanation(input){
  if(!input?.ui_context||!UI_SURFACES.includes(input.ui_context.surface))return deepFreeze({ok:false,code:'SUPPORTED_UI_CONTEXT_REQUIRED'});
  const scope=['tenant_id','business_id','profile_id'];if(scope.some(k=>!input[k]||input.ui_context[k]!==input[k]))return deepFreeze({ok:false,code:'UI_CONTEXT_SCOPE_MISMATCH'});
  const projection=input.projection;if(!projection)return deepFreeze({ok:false,code:'AUTHORITATIVE_PROJECTION_REQUIRED'});
  const subscriberEvidence=(projection.supporting_evidence||[]).filter(x=>x.privacy_classification!=='COACH_SESSION_PRIVATE').map(x=>x.evidence_id).sort();
  const conflicts=(projection.conflicting_evidence||[]).filter(x=>x.privacy_classification!=='COACH_SESSION_PRIVATE').map(x=>x.evidence_id).sort();
  const depth=['CONCISE','STANDARD','ADVANCED','AUDIT'].includes(input.depth)?input.depth:'STANDARD';
  const value={surface:input.ui_context.surface,target_ref:input.ui_context.target_ref||null,current_value:projection.current_value??null,previous_value:projection.previous_value??null,
    trend:projection.trend||'UNKNOWN',reason_for_change:projection.change_reason||'NO_MATERIAL_CHANGE',supporting_evidence_refs:subscriberEvidence,
    conflicting_evidence_refs:conflicts,evidence_gap_refs:[...(projection.evidence_gap_ids||[])].sort(),confidence:projection.confidence||null,
    probability:projection.probability??null,probability_calibration:projection.probability!=null?'DETERMINISTIC_REFERENCE_NOT_CALIBRATED':null,
    uncertainty:projection.uncertainty||'EXPLICIT',future_impacts:projection.future_impacts||[],one_move_impacts:projection.one_move_impacts||[],last_updated:projection.last_updated,
    explanation_trace_ref:projection.explanation_trace_ref,depth,safe_language_class:projection.probability!=null?'MODELED_UNCALIBRATED_NO_CAUSAL_CLAIM':'EVIDENCE_GROUNDED_NO_CAUSAL_CLAIM',
    private_content_excluded:true,audit_metadata:depth==='AUDIT'?{operation:projection.trace_operation||null,input_reference_count:subscriberEvidence.length}:null};
  return deepFreeze({ok:true,package:{...value,explanation_package_id:`explanation_${hashCanonicalJson(value).slice(0,20)}`},rendered:renderUiExplanation(value)});
}
export function renderUiExplanation(value){return deepFreeze({surface:value.surface,summary_codes:[value.trend,value.reason_for_change,value.safe_language_class],evidence_count:value.supporting_evidence_refs.length,gap_count:value.evidence_gap_refs.length,private_content_excluded:true});}
