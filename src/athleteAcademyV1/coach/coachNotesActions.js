// Stable exact-body request identity; an unknown acknowledgment never permits a
// different write or an automatic retry. The account's server scope remains authoritative.
export function coachNoteOperation(body,prior,requestId){
 const signature=JSON.stringify(body);
 if(prior&&prior.signature!==signature)throw Error('Check the saved note action before making another change.');
 return prior||{signature,operation:{...body,requestId}};
}
const knownNoWrite=new Set(['COACH_NOTE_COMMAND_INVALID','COACH_NOTES_NOT_ACTIVE','COACH_NOTE_GRANT_UNAVAILABLE','COACH_NOTE_SCOPE_INVALID','COACH_NOTE_TERMS_INVALID','COACH_NOTE_OBSERVATION_INVALID','COACH_NOTE_RECIPIENT_UNAVAILABLE','COACH_NOTE_REVIEWED_SEND_REQUIRED','COACH_NOTE_INVITATION_REVIEW_REQUIRED','SESSION_EXPIRED','SESSION_OR_FORM_EXPIRED','SIGN_IN_REQUIRED','SAME_ORIGIN_REQUIRED','ACTION_NOT_FOUND']);
export const coachNoteFailureKnownNoWrite=error=>knownNoWrite.has(error?.code);
// A gate rejection proves only this attempt did not write. It cannot settle an
// earlier ambiguous attempt with the same request identity.
export const coachNoteFailureMayClearJournal=(error,priorUncertainty)=>
 priorUncertainty===false&&coachNoteFailureKnownNoWrite(error);
export function coachNoteOperationAcknowledged(receipt,pending,actorId){
 if(!receipt||Object.keys(receipt).length!==6||receipt.contract!=='athlete_coach_note_operation_v1'
  ||receipt.actor_id!==actorId||receipt.mm!==pending.target_mm||receipt.request_id!==pending.request_id
  ||receipt.signature_sha256!==pending.signature_sha256||receipt.kind!==pending.kind)
  throw Error('The exact saved action acknowledgment could not be verified.');
 return true;
}
export function coachNoteOutcomeAcknowledged(outcome,pending,actorId){
 if(!outcome||Object.keys(outcome).length!==7||outcome.contract!=='athlete_coach_note_outcome_v1'
  ||outcome.actor_id!==actorId||outcome.mm!==pending.target_mm||outcome.request_id!==pending.request_id
  ||outcome.signature_sha256!==pending.signature_sha256||outcome.kind!==pending.kind
  ||!['acknowledged','unresolved'].includes(outcome.status))throw Error('The exact saved action acknowledgment could not be verified.');
 return outcome.status==='acknowledged';
}
