// Presentation-only wording. Canonical report bytes, source references and selection stay unchanged.
export function displayMove(move){
 if(!move)return move;
 const readable=value=>{
  if(typeof value!=='string')return value;
  const text=value.replace(/^SELECTED PROPOSAL, NOT ATHLETE-AGREED:\s*/i,'')
   .replace(/; do not run M[1-9]\./g,'; try one approach at a time.')
   .replace(/\bM[1-9]\b/g,id=>id===move.candidate_id?'this suggestion':'the alternative suggestion')
   .replace(/\bTRY\b/g,'try').replace(/\bCHECK\b/g,'Review');
  return text?text[0].toUpperCase()+text.slice(1):text;
 };
 const copy={...move};
 for(const key of ['action','why','when','who','action_signal','progress_signal','review','stop_or_change','bos_fit'])copy[key]=readable(move[key]);
 if(move.review_schedule)copy.review_schedule={...move.review_schedule,setup_check:readable(move.review_schedule.setup_check),progress_check:readable(move.review_schedule.progress_check)};
 return copy;
}
