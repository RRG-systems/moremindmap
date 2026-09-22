import test from 'node:test';
import {displayMove} from '../src/athleteAcademyV1/apa/display.js';
import {candidateDisposition,selectMove} from '../server/athleteAcademyV1/apa/contract.js';
import {stageRequest,APA_STAGES} from '../server/athleteAcademyV1/assessment.js';
import assert from 'node:assert/strict';
import {readdir,readFile,access} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {getAuthority} from '../server/athleteAcademyV1/bos/authority.js';
import {QUESTIONS as serverQuestions,QUESTIONNAIRE_VERSION} from '../server/athleteAcademyV1/bos/questions.js';
import {QUESTIONS as clientQuestions} from '../src/athleteAcademyV1/questions.js';
const root=fileURLToPath(new URL('../',import.meta.url));
async function files(dir){const rows=await readdir(dir,{withFileTypes:true});return (await Promise.all(rows.map(x=>x.isDirectory()?files(path.join(dir,x.name)):[path.join(dir,x.name)]))).flat();}
test('hosted Academy engines have no dependency on a local prototype worktree',async()=>{
 for(const file of await files(path.join(root,'server/athleteAcademyV1'))){
  if(!file.endsWith('.js'))continue;const code=await readFile(file,'utf8');
  for(const match of code.matchAll(/(?:from\s+|import\s*\()(['"])([^'"]+)\1/g)){
   const specifier=match[2];assert.ok(!specifier.startsWith('/')&&!specifier.startsWith('file:'),`${file}: absolute import ${specifier}`);
   if(specifier.startsWith('.')){const target=path.resolve(path.dirname(file),specifier);assert.ok(target.startsWith(root),`${file}: escaped repository`);await access(target);}
  }
 }
 const authority=getAuthority();assert.equal(authority.length,10);assert.ok(authority.every(x=>/^[a-f0-9]{64}$/.test(x.source_sha256)&&x.excerpts.length));
});
test('participant intake and report engine use the same locked twenty-question revision',()=>{
 assert.equal(QUESTIONNAIRE_VERSION,'youth-bos-v2.1.0');assert.equal(serverQuestions.length,20);assert.deepEqual(clientQuestions,serverQuestions);
});

test('successful password reset replaces the invalidated session before normal sign-in',async()=>{
 const app=await readFile(path.join(root,'src/athleteAcademyV1/App.jsx'),'utf8');
 assert.match(app,/async function refresh\(\).*else\{setD\(null\);setWards\(\[\]\);\}return s;/s);
 assert.match(app,/call\('reset_password',\{token:privateToken\.current,password\}\);privateToken\.current='';await refresh\(\);navigate\('login'\);/s);
});

test('APA audit sees the actual single-proposal selector and never invented athlete agreement',async()=>{
 const fixture=JSON.parse(await readFile(new URL('../server/athleteConsultingV2/fixtures/sofia.json',import.meta.url))),report=fixture.apa.report;
 const disposition=candidateDisposition(report),selection=selectMove(report);
 assert.equal(disposition.selected_candidate_id,selection.receipt.selected_candidate_id);
 assert.equal(disposition.candidates.filter(c=>c.selection_status==='selected_proposal').length,1);
 assert.ok(disposition.candidates.every(c=>c.athlete_agreement_status==='not_requested'));
 for(const c of report.candidates.filter(c=>c.gates.some(g=>!g.pass)))assert.equal(disposition.candidates.find(x=>x.candidate_id===c.candidate_id).selection_status,'rejected_internal');
 const first={pass:false,issues:[{severity:'material',problem:'First finding'}]},latest={pass:false,issues:[{severity:'material',problem:'Latest finding'}]};
 const records={[APA_STAGES[0]]:{output:report},[APA_STAGES[1]]:{output:first},[APA_STAGES[2]]:{output:report}};
 const input={packet:{},sourceAuditRepair:{report,findings:latest}};
 assert.deepEqual(stageRequest('apa',APA_STAGES[2],input,records).input.findings,latest);
 const audit=stageRequest('apa',APA_STAGES[3],input,records);
 assert.deepEqual(audit.input.previous_findings,latest);assert.deepEqual(audit.input.candidate_disposition,disposition);
});

test('APA reader translates internal labels without changing the saved move or its conditions',()=>{
 const move={candidate_id:'M2',when:'SELECTED PROPOSAL, NOT ATHLETE-AGREED: if you choose it, TRY at practice. CHECK on 2026-09-28; do not run M1.',action_signal:'Record whether you accepted M2.',refs:['A10'],gates:[{id:'agency',pass:true}]},before=JSON.stringify(move);
 const shown=displayMove(move);
 assert.equal(shown.when,'If you choose it, try at practice. Review on 2026-09-28; try one approach at a time.');
 assert.equal(shown.action_signal,'Record whether you accepted this suggestion.');
 assert.equal(JSON.stringify(move),before);assert.equal(shown.candidate_id,'M2');assert.deepEqual(shown.refs,move.refs);assert.deepEqual(shown.gates,move.gates);
});
