import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {createAcademyService} from '../server/athleteAcademyV1/service.js';
import {createAcademyHandler} from '../server/athleteAcademyV1/handler.js';
import {buildSource,providerRequest,stageRequest} from '../server/athleteAcademyV1/assessment.js';
import {digest} from '../server/athleteAcademyV1/repository.js';

const fixture=JSON.parse(await readFile(new URL('../server/athleteConsultingV2/fixtures/sofia.json',import.meta.url)));
const now=Date.parse('2026-09-23T18:00:00Z');
const unsupportedTrigger='You won the national title with your older brother.';
const secondUnsupportedTrigger='You won the regional title with your older sister.';
const auditFor=quote=>({audit_version:'youth-bos-factual-audit-v1',pass:false,findings:[{
 path:'reading.pressure_visual.trigger',quote,severity:'material',
 reason:'The fictional title and family event are not in the supplied answers.',question_ids:['Q01'],
}]});
const cleanAudit={audit_version:'youth-bos-factual-audit-v1',pass:true,findings:[]};
const requestId=()=>randomUUID();
const candidateOnlyReadingLine='- Keep conditional examples distinct from current circumstances. Do not combine separate answers into one present-tense event or imply that an if/when condition is happening now unless the person said so.\n';

// A local transactional stand-in keeps this suite independent of Redis, mail and providers.
function memoryRepository(seed){
 const documents=new Map(Object.entries(seed).map(([key,value])=>[key,structuredClone(value)]));
 const read=async key=>structuredClone(documents.get(key)??null);
 const transact=async(keys,mutate)=>{
  assert.equal(new Set(keys).size,keys.length,'transaction keys are unique');
  const snapshot=Object.fromEntries(keys.map(key=>[key,structuredClone(documents.get(key)??null)]));
  const transaction=await mutate(snapshot);
  assert.ok(transaction?.writes&&Object.keys(transaction.writes).every(key=>keys.includes(key)),'writes stay within the transaction');
  for(const [key,value] of Object.entries(transaction.writes)){
   assert.notEqual(value,null,'recovery never deletes state');
   documents.set(key,structuredClone(value));
  }
  return structuredClone(transaction.result);
 };
 const putImmutable=async(key,value)=>transact([key],saved=>{
  if(saved[key]!==null){assert.equal(digest(saved[key]),digest(value),'immutable evidence bytes cannot change');return {writes:{},result:saved[key]};}
  return {writes:{[key]:value},result:value};
 });
 return {read,transact,putImmutable};
}

function savedReceipt(stage,output,requestHash){return {output,request_sha256:requestHash,output_sha256:digest(output),model:'gpt-5.6-sol',usage:{total_tokens:0},response_id:`accepted-${stage}`};}
async function failedAuditScenario({secondAudit=cleanAudit,originalError='READING_NEEDS_FACTUAL_REVIEW',missingAuditEvidence=false,recoveryBinding='correct'}={}){
 const owner={id:`owner-${randomUUID()}`,mm:'MM-20260923-0A1B2C3D',verified:true,sessionVersion:1};
 const outsider={...owner,id:`other-${randomUUID()}`};
 const dossier={mm:owner.mm,ownerId:owner.id,synthetic:false,archived:false,revision:7,
  person:{name:'Sofia Fixture',dateOfBirth:'2000-06-12',sport:'Soccer',pronouns:'she/her'},
  entitlements:{bos:true,apa:true,coach:true},participation:{status:'self_authorized',athleteAccepted:true,policyVersion:'candidate-review-v1'},
  intake:{bos:{revision:1,complete:true,answers:fixture.bos_source.answers.map(answer=>({...answer,skipped:false}))},apa:{revision:0,answers:[],complete:false}},
  reports:{bos:null,apa:null},jobs:[],events:[]};
 const input=buildSource({...dossier,person:{...dossier.person,age:26}},'bos');
 const reading=structuredClone(fixture.bos.reading);reading.pressure_visual.trigger=unsupportedTrigger;
 const records={};
 for(const [stage,output] of [['evidence',fixture.bos.evidence],['domains',fixture.bos.domains],['synthesis',fixture.bos.synthesis],['reading',reading]]){
  const request=providerRequest(stageRequest('bos',stage,input,records));
  if(stage==='reading'){
   assert.ok(request.instructions.includes(candidateOnlyReadingLine),'fixture knows the one candidate-only reading prompt line');
   request.instructions=request.instructions.replace(candidateOnlyReadingLine,'');
  }
  records[stage]=savedReceipt(stage,output,digest(request));
 }
 const auditRequest=providerRequest(stageRequest('bos','audit',input,records));
 const failedAudit=savedReceipt('audit',auditFor(unsupportedTrigger),digest(auditRequest));
 const jobId=randomUUID(),attempt=randomUUID(),job={jobId,ownerId:owner.id,mm:owner.mm,service:'bos',status:'failed',stage:'audit',errorCode:originalError,
  inputRevision:1,inputHash:digest(input),input,records,attempt,request:auditRequest,requestHash:digest(auditRequest),createdAt:now-3600000};
 dossier.jobs=[{jobId,mm:owner.mm,service:'bos',status:'failed',stage:'audit',completedStages:4,totalStages:5,inputRevision:1,canAdvance:false,errorCode:originalError}];
 const evidencePrefix=`evidence:${jobId}:${attempt}`;
 const terminal={id:failedAudit.response_id,status:'completed',model:'gpt-5.6-sol',output_text:JSON.stringify(failedAudit.output),usage:{total_tokens:0}};
 const seed={
  [`account:${owner.id}`]:{...owner},[`account:${outsider.id}`]:{...outsider},[`dossier:${owner.mm}`]:dossier,[`job:${jobId}`]:job,
  'queue:assessments':{jobs:[]},
  [`${evidencePrefix}:request`]:{request:auditRequest,createdAt:now-60000},
  [`${evidencePrefix}:terminal`]:terminal,
  [`${evidencePrefix}:failure`]:{code:originalError,status:'failed',at:now-30000},
 };
 if(!missingAuditEvidence)seed[`${evidencePrefix}:result`]=failedAudit;
 const repo=memoryRepository(seed),requests=[];
 const transport=async function*(request){
  const output=requests.length===0?{correction_version:'youth-bos-reading-correction-v1',changes:[{path:'reading.pressure_visual.trigger',text:secondAudit.pass?fixture.bos.reading.pressure_visual.trigger:secondUnsupportedTrigger}]}:secondAudit;
  requests.push(request);
  assert.ok(requests.length<=2,'no third provider call or rerun of accepted stages');
  yield {type:'response.completed',response:{id:`local-recovery-${requests.length}`,status:'completed',model:'gpt-5.6-sol',output_text:JSON.stringify(output),usage:{total_tokens:0}}};
 };
 const preservedBosRecoveryJobHash=recoveryBinding==='correct'?digest(jobId):recoveryBinding==='wrong'?digest('another-fictional-job'):null;
 const academy=createAcademyService({repo,config:{providerEnabled:true,syntheticPreview:false,realYouthEnabled:false,reviewedPolicyVersion:'candidate-review-v1',preservedBosRecoveryJobHash},
  auth:{event:(type,actor,detail)=>({type,actor,detail,at:now})},transport,now:()=>now});
 const originalJobBytes=JSON.stringify(await repo.read(`job:${jobId}`));
 const originalEvidenceBytes=Object.fromEntries(['request','terminal','result','failure'].map(part=>[part,JSON.stringify(seed[`${evidencePrefix}:${part}`]??null)]));
 const assertOriginalPreserved=async()=>{
  assert.equal(JSON.stringify(await repo.read(`job:${jobId}`)),originalJobBytes,'original failed job is byte-identical');
  for(const [part,bytes] of Object.entries(originalEvidenceBytes))assert.equal(JSON.stringify(await repo.read(`${evidencePrefix}:${part}`)),bytes,`original ${part} evidence is byte-identical`);
 };
 return {owner,outsider,dossier,repo,academy,requests,job,jobId,input,records,failedAudit,assertOriginalPreserved};
}

async function alterSavedAuditPacket(s,change){
 const jk=`job:${s.jobId}`,rk=`evidence:${s.jobId}:${s.job.attempt}:request`,ok=`evidence:${s.jobId}:${s.job.attempt}:result`;
 await s.repo.transact([jk,rk,ok],saved=>{
  const job=saved[jk],request=structuredClone(job.request),separator=request.input.indexOf('\n')+1;
  const packet=JSON.parse(request.input.slice(separator));change(packet);
  request.input=request.input.slice(0,separator)+JSON.stringify(packet);
  job.request=request;job.requestHash=digest(request);
  saved[rk].request=request;saved[ok].request_sha256=job.requestHash;
  return {writes:{[jk]:job,[rk]:saved[rk],[ok]:saved[ok]},result:true};
 });
}

test('one owner-bound child corrects only the cited field, re-audits independently, and preserves the original failed attempt',async()=>{
 const s=await failedAuditScenario();
 const beforeClaim=(await s.academy.getDossier(s.owner,{mm:s.owner.mm})).dossier;
 assert.equal(beforeClaim.jobs.find(j=>j.jobId===s.jobId).canRecover,true,'only the bound original offers owner recovery');
 assert.equal((await s.academy.getJob(s.owner,{jobId:s.jobId})).job.canRecover,true);
 const start={requestId:requestId(),jobId:s.jobId};
 const first=await s.academy.startPreservedBosRecovery(s.owner,start);
 const childId=first.job.jobId,childBefore=await s.repo.read(`job:${childId}`);
 assert.notEqual(childId,s.jobId);
 assert.equal(childBefore.recoveryOf,s.jobId);
 assert.equal(childBefore.inputHash,s.job.inputHash);
 assert.deepEqual(childBefore.input,s.input,'frozen answers and source are reused exactly');
 assert.deepEqual(Object.keys(childBefore.records),['evidence','domains','synthesis','reading','audit']);
 for(const stage of ['evidence','domains','synthesis','reading'])assert.deepEqual(childBefore.records[stage],s.records[stage]);
 assert.deepEqual(childBefore.records.audit,s.failedAudit,'failed factual audit is the preserved fifth receipt');
 assert.equal(first.job.stage,'targeted-reading-correction');
 const marker=await s.repo.read(`recovery:${s.jobId}`);
 assert.equal(marker.originalJobId,s.jobId);
 assert.equal(marker.childJobId,childId);
 assert.deepEqual((await s.repo.read('queue:assessments')).jobs,[childId]);
 const afterClaim=(await s.academy.getDossier(s.owner,{mm:s.owner.mm})).dossier;
 assert.equal(afterClaim.jobs.find(j=>j.jobId===s.jobId).canRecover,false,'one-time marker removes the original affordance');
 assert.equal((await s.academy.getJob(s.owner,{jobId:s.jobId})).job.canRecover,false,'the bookmarked original progress page also loses its affordance');
 await s.assertOriginalPreserved();
 const replay=await s.academy.startPreservedBosRecovery(s.owner,start);
 assert.deepEqual(replay,first,'same request ID is idempotent');
 await assert.rejects(()=>s.academy.startPreservedBosRecovery(s.owner,{requestId:requestId(),jobId:s.jobId}));
 let current=(await s.academy.advance(s.owner,{requestId:requestId(),jobId:childId})).job;
 assert.equal(current.status,'ready');assert.equal(current.stage,'independent-correction-audit');
 current=(await s.academy.advance(s.owner,{requestId:requestId(),jobId:childId})).job;
 assert.equal(current.status,'completed',current.errorCode||'');
 assert.equal(s.requests.length,2,'only correction and independent factual audit consume model calls');
 const report=await s.academy.getReport(s.owner,{service:'bos'}),expected=structuredClone(s.records.reading.output);
 expected.pressure_visual.trigger=fixture.bos.reading.pressure_visual.trigger;
 assert.deepEqual(report.artifact.reading,expected,'no uncited reading field changes');
 assert.deepEqual(report.artifact.receipts.map(r=>r.stage),['evidence','domains','synthesis','reading','audit','targeted-reading-correction','independent-correction-audit']);
 await s.assertOriginalPreserved();
});

test('corrupt accepted stage or failed-audit provenance, missing stage, and expired owner session cannot claim a recovery child',async()=>{
 const cases=[
  ['accepted request hash changed',async s=>s.repo.transact([`job:${s.jobId}`],saved=>{const j=saved[`job:${s.jobId}`];j.records.evidence.request_sha256=digest('different accepted request');return {writes:{[`job:${s.jobId}`]:j},result:true};})],
  ['candidate reading request hash substituted for the legacy receipt',async s=>s.repo.transact([`job:${s.jobId}`],saved=>{const j=saved[`job:${s.jobId}`],prior={evidence:j.records.evidence,domains:j.records.domains,synthesis:j.records.synthesis};j.records.reading.request_sha256=digest(providerRequest(stageRequest('bos','reading',j.input,prior)));return {writes:{[`job:${s.jobId}`]:j},result:true};})],
  ['accepted output changed',async s=>s.repo.transact([`job:${s.jobId}`],saved=>{const j=saved[`job:${s.jobId}`];j.records.reading.output.pressure_visual.trigger='A replacement not in the original bytes.';return {writes:{[`job:${s.jobId}`]:j},result:true};})],
  ['accepted stage missing',async s=>s.repo.transact([`job:${s.jobId}`],saved=>{const j=saved[`job:${s.jobId}`];delete j.records.synthesis;return {writes:{[`job:${s.jobId}`]:j},result:true};})],
  ['audit packet answers changed despite coherent request hashes',async s=>alterSavedAuditPacket(s,packet=>{packet.intake.answers[0].text+=' Not in the frozen subject.';})],
  ['audit packet reading changed despite coherent request hashes',async s=>alterSavedAuditPacket(s,packet=>{packet.reading.pressure_visual.trigger=secondUnsupportedTrigger;})],
  ['audit output changed',async s=>s.repo.transact([`evidence:${s.jobId}:${s.job.attempt}:result`],saved=>{const key=`evidence:${s.jobId}:${s.job.attempt}:result`,r=saved[key];r.output.findings[0].quote='Not the saved quoted field';return {writes:{[key]:r},result:true};})],
  ['audit terminal output changed',async s=>s.repo.transact([`evidence:${s.jobId}:${s.job.attempt}:terminal`],saved=>{const key=`evidence:${s.jobId}:${s.job.attempt}:terminal`,r=saved[key];r.output_text=JSON.stringify({audit_version:'youth-bos-factual-audit-v1',pass:true,findings:[]});return {writes:{[key]:r},result:true};})],
  ['audit terminal response ID changed',async s=>s.repo.transact([`evidence:${s.jobId}:${s.job.attempt}:terminal`],saved=>{const key=`evidence:${s.jobId}:${s.job.attempt}:terminal`,r=saved[key];r.id='different-provider-response';return {writes:{[key]:r},result:true};})],
  ['audit failure status changed',async s=>s.repo.transact([`evidence:${s.jobId}:${s.job.attempt}:failure`],saved=>{const key=`evidence:${s.jobId}:${s.job.attempt}:failure`,r=saved[key];r.status='unknown';return {writes:{[key]:r},result:true};})],
  ['audit failure code changed',async s=>s.repo.transact([`evidence:${s.jobId}:${s.job.attempt}:failure`],saved=>{const key=`evidence:${s.jobId}:${s.job.attempt}:failure`,r=saved[key];r.code='PROVIDER_OUTPUT_INVALID';return {writes:{[key]:r},result:true};})],
  ['owner session expired',async s=>s.repo.transact([`account:${s.owner.id}`],saved=>{const a=saved[`account:${s.owner.id}`];a.sessionVersion++;return {writes:{[`account:${s.owner.id}`]:a},result:true};})],
 ];
 for(const [label,prepare] of cases){
  const s=await failedAuditScenario();await prepare(s);
  await assert.rejects(()=>s.academy.startPreservedBosRecovery(s.owner,{requestId:requestId(),jobId:s.jobId}),undefined,label);
  assert.equal(await s.repo.read(`recovery:${s.jobId}`),null,label);
  assert.equal(s.requests.length,0,label);
  assert.deepEqual((await s.repo.read('queue:assessments')).jobs,[],label);
 }
});

test('a second material finding closes the child without publishing, rerunning or altering the failed source',async()=>{
 const s=await failedAuditScenario({secondAudit:auditFor(secondUnsupportedTrigger)});
 const child=(await s.academy.startPreservedBosRecovery(s.owner,{requestId:requestId(),jobId:s.jobId})).job;
 await s.academy.advance(s.owner,{requestId:requestId(),jobId:child.jobId});
 const final=(await s.academy.advance(s.owner,{requestId:requestId(),jobId:child.jobId})).job;
 assert.equal(final.status,'failed');assert.equal(final.errorCode,'READING_NEEDS_FACTUAL_REVIEW');
 await assert.rejects(()=>s.academy.getReport(s.owner,{service:'bos'}),/REPORT_NOT_READY/);
 await assert.rejects(()=>s.academy.advance(s.owner,{requestId:requestId(),jobId:child.jobId}),/JOB_NOT_READY/);
 assert.equal(s.requests.length,2);
 const ownerJobs=(await s.academy.getDossier(s.owner,{mm:s.owner.mm})).dossier.jobs;
 assert.equal(ownerJobs.find(j=>j.jobId===s.jobId).canRecover,false,'failed original cannot offer a second child');
 assert.equal(ownerJobs.find(j=>j.jobId===child.jobId).canRecover,false,'a failed correction child cannot offer another repair');
 await s.assertOriginalPreserved();
});

test('wrong owner, changed source, newer report or job, unsupported failure, and missing audit receipt all fail before provider dispatch',async()=>{
 const cases=[
  ['wrong owner',async s=>({actor:s.outsider})],
  ['changed answer',async s=>{await s.repo.transact([`dossier:${s.owner.mm}`],saved=>{const d=saved[`dossier:${s.owner.mm}`];d.intake.bos.answers[0].text+=' Changed after the failed attempt.';d.intake.bos.revision++;return {writes:{[`dossier:${s.owner.mm}`]:d},result:true};});}],
  ['newer BOS report',async s=>{await s.repo.transact([`dossier:${s.owner.mm}`],saved=>{const d=saved[`dossier:${s.owner.mm}`];d.reports.bos={currentVersionId:randomUUID(),artifactHash:'newer-report'};return {writes:{[`dossier:${s.owner.mm}`]:d},result:true};});}],
  ['newer BOS job',async s=>{await s.repo.transact([`dossier:${s.owner.mm}`],saved=>{const d=saved[`dossier:${s.owner.mm}`];d.jobs.push({jobId:randomUUID(),service:'bos',status:'completed',createdAt:now});return {writes:{[`dossier:${s.owner.mm}`]:d},result:true};});}],
 ];
 for(const [label,prepare] of cases){
  const s=await failedAuditScenario(),change=await prepare(s)||{};
  await assert.rejects(()=>s.academy.startPreservedBosRecovery(change.actor||s.owner,{requestId:requestId(),jobId:s.jobId}),undefined,label);
  assert.equal(s.requests.length,0,label);
  assert.equal(await s.repo.read(`recovery:${s.jobId}`),null,label);
  await s.assertOriginalPreserved();
 }
 for(const options of [{originalError:'PROVIDER_OUTPUT_INVALID'},{missingAuditEvidence:true},{recoveryBinding:'none'},{recoveryBinding:'wrong'}]){
  const s=await failedAuditScenario(options);
  if(options.recoveryBinding)assert.equal((await s.academy.getDossier(s.owner,{mm:s.owner.mm})).dossier.jobs.find(j=>j.jobId===s.jobId).canRecover,false);
  await assert.rejects(()=>s.academy.startPreservedBosRecovery(s.owner,{requestId:requestId(),jobId:s.jobId}));
  assert.equal(s.requests.length,0);
  assert.equal(await s.repo.read(`recovery:${s.jobId}`),null);
  await s.assertOriginalPreserved();
 }
});

test('the recovery HTTP action requires an authenticated owner session and matching CSRF before service dispatch',async()=>{
 const owner={id:'fictional-owner',mm:'MM-20260923-0A1B2C3D',verified:true},calls=[];
 const auth={session:async raw=>raw==='owner'?{csrf:'local-csrf',account:owner}:raw==='guest'?{csrf:'local-csrf',account:null}:null,limited:async()=>{}};
 const handler=createAcademyHandler({config:{enabled:true,origin:'https://preview.example',allowedOrigins:new Set(['https://preview.example'])},auth,
  academy:{startPreservedBosRecovery:async(actor,body)=>{calls.push({actor,body});return {job:{jobId:'fictional-child'}};}},coaching:{},deliver:async()=>{}});
 async function post(cookie,csrf){
  const body={action:'start_preserved_bos_recovery',requestId:requestId(),jobId:requestId()};
  const req={method:'POST',headers:{origin:'https://preview.example','sec-fetch-site':'same-origin','content-type':'application/json',cookie,'x-csrf-token':csrf},body};
  const out={},res={setHeader(){},status(code){out.status=code;return this;},json(value){out.body=value;return out;}};
  return {response:await handler(req,res),body};
 }
 assert.equal((await post('',null)).response.body.error.code,'SESSION_OR_FORM_EXPIRED');
 assert.equal((await post('more_athlete_academy=guest','local-csrf')).response.body.error.code,'SIGN_IN_REQUIRED');
 assert.equal((await post('more_athlete_academy=owner','wrong-csrf')).response.body.error.code,'SESSION_OR_FORM_EXPIRED');
 assert.equal(calls.length,0,'unauthenticated and CSRF-failed requests cannot start a child');
 const allowed=await post('more_athlete_academy=owner','local-csrf');
 assert.equal(allowed.response.status,200);
 assert.equal(allowed.response.body.job.jobId,'fictional-child');
 assert.equal(calls.length,1);
 assert.equal(calls[0].actor,owner);
 assert.deepEqual(calls[0].body,allowed.body);
});

test('owner progress UI offers the one-time continuation only for the gated original failed audit',async()=>{
 const app=await readFile(new URL('../src/athleteAcademyV1/App.jsx',import.meta.url),'utf8');
 assert.match(app,/const recoverable=job\.canRecover===true&&job\.service==='bos'&&job\.status==='failed'&&job\.errorCode==='READING_NEEDS_FACTUAL_REVIEW';/);
 assert.match(app,/\{recoverable&&<section className="panel"><h2>Continue this saved BOS<\/h2>.*?onClick=\{\(\)=>run\(onRecover\)\}/s);
 assert.match(app,/onRecover=\{async\(\)=>\{const child=\(await call\('start_preserved_bos_recovery',\{jobId:job\.jobId\}\)\)\.job;setJob\(child\);navigate\('progress\/'\+child\.jobId\);await refresh\(\);\}\}/);
 assert.match(app,/\{!recoverable&&\['failed','unknown','abandoned'\]\.includes\(job\.status\)/);
});
