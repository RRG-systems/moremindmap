import {Buffer} from 'node:buffer';
import {createHash} from 'node:crypto';
import {DOMAINS,ROLES,QUESTIONS,VERSION} from './design.js';
import {GATE_IDS} from './schema.js';
import {SELECTION_DIMENSIONS} from '../../../src/lib/oneMoveV2/constants.js';
import {selectOneMoveCandidate} from '../../../src/lib/oneMoveV2/selection.js';
export const hash=x=>createHash('sha256').update(typeof x==='string'||Buffer.isBuffer(x)?x:JSON.stringify(x)).digest('hex');
export function requireThat(x,code){if(!x)throw new Error(code);}
export const words=s=>String(s).split(/\s+/).filter(Boolean).length;
export function validateIntake(s,registry,bosBytes){
 const r=registry.find(r=>r.mm===s.mm); requireThat(r&&typeof s.synthetic==='boolean'&&['private_participant','synthetic_test'].includes(s.record_kind),'PRIVATE_MM_REQUIRED');
 requireThat(hash(bosBytes)===r.reading_sha256,'BOS_BYTES_CHANGED'); const bos=JSON.parse(bosBytes);
 requireThat(bos.mm===s.mm&&bos.subject.name===r.name,'BOS_IDENTITY_MISMATCH');
 requireThat(s.answers?.length===20&&QUESTIONS.every((q,i)=>s.answers[i].id===q.id&&typeof s.answers[i].text==='string'&&s.answers[i].text.trim().length>=1&&s.answers[i].text.length<=5000),'COMPLETE_20_ANSWERS_REQUIRED');
 requireThat(DOMAINS.every(d=>typeof s.confirmation?.goals?.[d.id]==='string'&&s.confirmation.goals[d.id].trim()),'CONFIRM_FOUR_GOALS');
 requireThat(s.confirmation.priority?.trim()&&s.confirmation.confirmed===true,'ATHLETE_CONFIRMATION_REQUIRED');
 for(const k of ['assessment_date','horizon_date','review_date'])requireThat(/^\d{4}-\d{2}-\d{2}$/.test(s.confirmation[k])&&!Number.isNaN(Date.parse(s.confirmation[k]))&&new Date(s.confirmation[k]+'T12:00:00Z').toISOString().slice(0,10)===s.confirmation[k],'VALID_DATES_REQUIRED');
 requireThat(s.confirmation.review_date>s.confirmation.assessment_date&&s.confirmation.horizon_date>=s.confirmation.review_date,'REVIEW_MUST_BE_IN_WINDOW');
 requireThat(Array.isArray(s.coach)&&s.coach.length<=3&&s.coach.every((c,i)=>c.id===`COACH${i+1}`&&typeof c.text==='string'),'COACH_SOURCE_INVALID');
 return bos;
}
export function sourcePacket(s,bos,registry){
 const refs=[...s.answers.map(a=>({...a,source:'Athlete',question:QUESTIONS.find(q=>q.id===a.id).text})),...s.coach.map(c=>({...c,source:'Coach'})),{id:'CONFIRM',source:'Athlete confirmation',text:JSON.stringify(s.confirmation)}];
 const bos_sources=bos.reading.chapters.map(c=>({id:`BOS:${c.id}`,headline:c.headline,text:c.paragraphs.join('\n\n'),takeaway:c.takeaway,claim_ids:c.claim_ids}));
 bos_sources.push(...bos.reading.vectors.map(v=>({id:`BOS:${v.id}`,headline:`Your ${v.id.replaceAll('_',' ')} pattern`,text:[v.interpretation,v.helps,v.watch_for,v.context].join(' '),takeaway:v.interpretation,claim_ids:v.claim_ids})));
 bos_sources.unshift({id:'BOS:portrait',headline:bos.reading.portrait.headline,text:bos.reading.portrait.paragraphs.join('\n\n'),takeaway:'Full accepted personality portrait',claim_ids:bos.reading.portrait.claim_ids});
 return {version:VERSION,synthetic:s.synthetic,record_kind:s.record_kind,mm:s.mm,identity:registry.find(x=>x.mm===s.mm),confirmation:s.confirmation,sources:refs,bos_sources,full_accepted_bos:bos,existing_plan:s.existing_plan||null,source_sha256:hash(s)};
}
function checkRefs(ids,allowed,required=true){requireThat(Array.isArray(ids)&&(!required||ids.length>0)&&ids.every(x=>allowed.has(x)),'UNRESOLVED_SOURCE_REFERENCE');}
export function validateReport(r,p){
 const allowed=new Set(p.sources.map(x=>x.id)),bos=new Set(p.bos_sources.map(x=>x.id));
 const sources=(x,bosRequired=true)=>{checkRefs(x.refs,allowed);checkRefs(x.bos_refs,bos,bosRequired);};
 requireThat(r.domains?.length===4&&DOMAINS.every((d,i)=>r.domains[i].id===d.id),'FOUR_DISTINCT_DOMAINS_REQUIRED');
 for(const d of r.domains){sources(d);requireThat(d.goal===p.confirmation.goals[d.id],'ATHLETE_GOAL_CHANGED');requireThat([d.strength,d.gap,d.help,d.bos_connection,d.detail].every(x=>typeof x==='string'&&x.trim()),'DOMAIN_INCOMPLETE');requireThat(words([d.goal,d.strength,d.gap,d.help].join(' '))<=125,'FIRST_LAYER_TOO_LONG');}
 requireThat(r.futures?.length===5&&ROLES.every((id,i)=>r.futures[i].role===id),'FIVE_FUTURE_ROLES_REQUIRED');
 for(const f of r.futures){sources(f,false);requireThat([f.headline,f.what,f.conditions,f.first_sign].every(x=>x?.trim()),'FUTURE_INCOMPLETE');requireThat(words(f.headline)<=12,'FUTURE_HEADLINE_TOO_LONG');}
 requireThat(r.candidates?.length>=3&&r.candidates.length<=5&&new Set(r.candidates.map(c=>c.candidate_id)).size===r.candidates.length,'COMPARE_DISTINCT_MOVES');
 for(const c of r.candidates){sources(c);if(c.review_schedule)requireThat(c.review_schedule.purpose==='setup_check'&&c.review_schedule.setup_check?.trim()&&c.review_schedule.progress_check?.trim(),'EXPLICIT_REVIEW_STAGES_REQUIRED');requireThat(words(c.action)<=25,'MOVE_TOO_COMPLEX');requireThat(c.gates.length===5&&GATE_IDS.every(id=>c.gates.filter(g=>g.id===id).length===1),'FIVE_YOUTH_GATES_REQUIRED');c.gates.forEach(g=>checkRefs(g.refs,allowed));for(const d of SELECTION_DIMENSIONS)requireThat(Object.keys(d.levels).includes(c.selection_signals[d.dimension_id]),'INVALID_SELECTION_SIGNAL');}
 checkRefs(r.coach_view.refs,allowed,false); if(!p.sources.some(s=>s.source==='Coach'))requireThat(r.coach_view.status==='pending','INVENTED_COACH_RESPONSE');
 const raw=JSON.stringify(r);requireThat(!/\b\d+(?:\.\d+)?\s*%|guaranteed (?:to|success)|four-sequence|source-bound items|as an ai|vector topology|causal_foundation/i.test(raw),'CUSTOMER_LANGUAGE_OR_ODDS_FAILURE');
 requireThat(!/<script|javascript:/i.test(raw),'INVALID_CONTENT');
 return r;
}
export function selectMove(r){const eligible=r.candidates.filter(c=>c.gates.every(g=>g.pass));if(!eligible.length)return {status:'needs_confirmation',move:null,receipt:{selected_candidate_id:null,reason:'No candidate passed every youth gate.'}};const receipt=selectOneMoveCandidate(eligible);return {status:'proposed',move:eligible.find(c=>c.candidate_id===receipt.selected_candidate_id),receipt};}
// Computed by the same selector used at publication, never inferred from athlete goal confirmation.
export function candidateDisposition(r){
 const selection=selectMove(r),selected=selection.receipt.selected_candidate_id;
 return {selected_candidate_id:selected,athlete_agreement_status:'not_requested',relationship:'mutually_exclusive_alternatives_for_one_proposal',candidates:r.candidates.map(c=>({candidate_id:c.candidate_id,selection_status:!c.gates.every(g=>g.pass)?'rejected_internal':c.candidate_id===selected?'selected_proposal':'eligible_unselected',athlete_agreement_status:'not_requested'}))};
}
export function assemble(s,p,r,receipts,audit){validateReport(r,p);requireThat(audit.pass&&!audit.issues.some(x=>['blocker','material'].includes(x.severity)),'FACTUAL_AUDIT_NOT_CLEAR');const selection=selectMove(r);const body={version:VERSION,synthetic:s.synthetic,record_kind:s.record_kind,mm:s.mm,identity:p.identity,source_sha256:p.source_sha256,bos_sha256:p.identity.reading_sha256,confirmation:p.confirmation,sources:p.sources,bos_sources:p.bos_sources,existing_plan:p.existing_plan,report:r,...selection,audit,receipts,created_at:new Date().toISOString()};return {...body,artifact_sha256:hash(body)};}
export function verifyArtifact(a,s,bosBytes,registry){const {artifact_sha256,...body}=a;requireThat(hash(body)===artifact_sha256,'REPORT_TAMPERED');const bos=validateIntake(s,registry,bosBytes);requireThat(a.mm===s.mm&&a.source_sha256===hash(s)&&a.bos_sha256===hash(bosBytes),'STALE_OR_WRONG_PERSON');requireThat(a.version===VERSION&&a.synthetic===s.synthetic&&a.record_kind===s.record_kind,'WRONG_REPORT_VERSION');validateReport(a.report,sourcePacket(s,bos,registry));const selected=selectMove(a.report);requireThat(hash(selected)===hash({status:a.status,move:a.move,receipt:a.receipt}),'SELECTION_CHANGED');return a;}
