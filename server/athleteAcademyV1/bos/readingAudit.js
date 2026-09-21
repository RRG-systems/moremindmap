import {requireThat} from './contract.js';
export const READING_AUDIT_VERSION='youth-bos-factual-audit-v1';
export function readingAuditPrompt(){return `You check a completed Youth BOS personality reading against the exact answers and corrections of the participant. Return JSON only.
This is a factual check, not a quality score and not a rewrite. Useful inferences are welcome when reasonably grounded and scoped. Do not demand literal proof for every interpretation or treat a clearly qualified possibility as a fabricated fact.
Check all public text, especially the compressed visual summaries:
1. No invented events, roles, gendered family identity, thoughts, reactions of other people, or merged episodes presented as one event.
2. No causal certainty where the person said they do not know what helped.
3. No temporary state, answer brevity, refusal, lack of disclosure, or hypothetical concern turned into a fixed trait.
4. No contradiction of an explicit correction.
5. No diagnostic or ability claim. Gender and pronouns are supplied ONLY to check references; never infer personality from them.
Severity material means a meaningful false biographical, causal, identity, or diagnostic claim. Minor means an overextended wording that does not change the central picture. Quote the exact public words and cite question IDs. If no material issue exists, pass=true. A suggestion for nicer prose is not a factual issue.
Return {"audit_version":"youth-bos-factual-audit-v1","pass":true,"findings":[{"path":"reading.portrait.paragraphs[0]","quote":"exact words","severity":"minor|material","reason":"...","question_ids":["Q01"]}]}. Do not include invented findings just to be critical.`;}
export function validateReadingAudit(audit){
 requireThat(audit?.audit_version===READING_AUDIT_VERSION&&typeof audit.pass==='boolean'&&Array.isArray(audit.findings),'INVALID_FACTUAL_AUDIT');
 requireThat(audit.findings.every(x=>['minor','material'].includes(x.severity)&&x.quote&&x.reason&&Array.isArray(x.question_ids)),'INVALID_AUDIT_FINDING');
 requireThat(audit.pass===!audit.findings.some(x=>x.severity==='material'),'AUDIT_VERDICT_MISMATCH');
 requireThat(audit.pass,'READING_NEEDS_FACTUAL_REVIEW');
 return audit;
}
