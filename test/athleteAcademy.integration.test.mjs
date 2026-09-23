import test from 'node:test';
import {runAssessmentQueue,workerAuthorized} from '../server/athleteAcademyV1/worker.js';
import {runMailQueue} from '../server/athleteAcademyV1/delivery.js';
import {createCoachingService} from '../server/athleteAcademyV1/coaching/service.js';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import Redis from 'ioredis';
import {createAcademyRuntime} from '../server/athleteAcademyV1/runtime.js';
import {digest,createRedisRepository} from '../server/athleteAcademyV1/repository.js';
import {QUESTIONS,QUESTIONNAIRE_VERSION} from '../server/athleteAcademyV1/bos/questions.js';
const fixture=JSON.parse(await readFile(new URL('../server/athleteConsultingV2/fixtures/sofia.json',import.meta.url)));
// Structural replay only: this legacy fixture includes a coach reference.
// The new pilot has no coach testimony, so test prose is never quality evidence.
const apaReplay=JSON.parse(JSON.stringify(fixture.apa.report).replace(/COACH[123]/g,'A15'));
apaReplay.coach_view.status='pending';
const redis=new Redis('redis://127.0.0.1:6394',{maxRetriesPerRequest:0,enableOfflineQueue:false});await new Promise((res,rej)=>{redis.once('ready',res);redis.once('error',rej);});
let clock=Date.parse('2026-09-21T18:00:00Z');const mailbox=[],requests=[];let interrupted=false;
async function* replay(request){requests.push(request);const input=JSON.parse(request.input.split('\n').slice(1).join('\n'));let output;
 if(input.packet){output=input.report?fixture.apa.audit:apaReplay;}
 else if(request.instructions.includes('factual check, not a quality'))output={audit_version:'youth-bos-factual-audit-v1',pass:true,findings:[]};
 else if(request.instructions.includes('final author speaking DIRECTLY'))output=fixture.bos.reading;
 else if(!input.evidence)output=fixture.bos.evidence;
 else if(!input.domains)output=fixture.bos.domains;
 else output=fixture.bos.synthesis;
 yield {type:'response.completed',response:{id:'fixture-replay-not-provider',status:'completed',model:'gpt-5.6-sol',output_text:JSON.stringify(output),usage:{total_tokens:0}}};
 if(interrupted)throw Error('synthetic-stream-interruption-after-terminal');
}
const env={ATHLETE_ACADEMY_ENABLED:'1',ATHLETE_ACADEMY_ORIGIN:'http://127.0.0.1:5321',ATHLETE_ACADEMY_LOCAL_PREVIEW:'1',ATHLETE_ACADEMY_SYNTHETIC_PREVIEW:'1',ATHLETE_ACADEMY_PROVIDER_ENABLED:'1',ATHLETE_ACADEMY_MAIL_ENABLED:'1',ATHLETE_ACADEMY_REAL_YOUTH_ENABLED:'1',ATHLETE_ACADEMY_NAMESPACE:`more:athlete-academy:{test-${randomUUID()}}`,ATHLETE_ACADEMY_BEYOND_TODAY_CODE_SHA256:digest('darrendemo1')};
const rt=createAcademyRuntime({env,redis,now:()=>clock,assessmentTransport:replay,coachTransport:async request=>({id:'injected-coach',status:'completed',model:'gpt-5.6-sol',output_text:JSON.stringify({reply:'Your care for people and your own space both matter. What feels most useful to talk about today?',plan:null,plan_change:'none',retire_draft:false,learning:[],recap:''})}),mailTransport:async item=>{mailbox.push(item);return {status:'sent',receipt:'local-injected-mailbox'};}});
const req=extra=>({requestId:randomUUID(),...extra});
async function account(email,dateOfBirth='2007-02-04'){const signup=await rt.auth.signup({email,password:'Synthetic-only-password-2026',displayName:email.split('@')[0],dateOfBirth,region:'US-CA',sport:'Soccer',institutionId:'beyond-today-sports-institute',institutionCode:'darrendemo1'});const item=await rt.repo.read(`mail:${signup.mailId}`);await rt.auth.verifyEmail(item.token);const login=await rt.auth.login({email,password:'Synthetic-only-password-2026'});return {...login.session.account,session:login.raw};}
let adult,other,youth,guardian;
test('real Redis account, verified enrollment and canonical MM survive runtime reload',async()=>{adult=await account('first@test.invalid');other=await account('second@test.invalid');assert.notEqual(adult.mm,other.mm);const d=await rt.academy.dossier(adult);assert.equal(d.synthetic,true);assert.equal(d.entitlements.bos,true);assert.equal((await createRedisRepository({redis,prefix:env.ATHLETE_ACADEMY_NAMESPACE}).read(`account:${adult.id}`)).mm,adult.mm);await assert.rejects(()=>rt.academy.getDossier(other,{mm:adult.mm}),/NOT_FOUND/);await assert.rejects(()=>rt.auth.signup({email:'young@test.invalid',displayName:'Young tester',dateOfBirth:'2010-01-01',region:'US-CA',sport:'Soccer',password:'long-password-example'}),/PILOT_CALIFORNIA_17_PLUS/);});
test('adult-only mode admits 18, rejects 17, and preserves existing youth reads and safety controls without processing',async()=>{
 const namespace=`more:athlete-academy:{test-${randomUUID()}}`,enabled=createAcademyRuntime({env:{...env,ATHLETE_ACADEMY_NAMESPACE:namespace},redis,now:()=>clock,assessmentTransport:replay,coachTransport:async()=>{},mailTransport:async()=>({status:'sent'})});
 async function create(runtime,email,dateOfBirth){const signup=await runtime.auth.signup({email,password:'Synthetic-only-password-2026',displayName:email.split('@')[0],dateOfBirth,region:'US-CA',sport:'Soccer',institutionId:'beyond-today-sports-institute',institutionCode:'darrendemo1'}),message=await runtime.repo.read(`mail:${signup.mailId}`),verificationToken=message.token;await runtime.deliver(signup.mailId);await runtime.auth.verifyEmail(verificationToken);return (await runtime.auth.login({email,password:'Synthetic-only-password-2026'})).session.account;}
 const existingYouth=await create(enabled,'preserved-youth@test.invalid','2009-09-21'),existingGuardian=await create(enabled,'preserved-guardian@test.invalid','1980-01-01');
 await enabled.academy.acceptParticipation(existingYouth,req({accepted:true,policyVersion:'candidate-review-v1'}));
 const firstInvite=await enabled.academy.inviteGuardian(existingYouth,req({email:existingGuardian.email})),firstMail=await enabled.repo.read(`mail:${firstInvite.mailId}`);
 const firstGuardianToken=firstMail.token;await enabled.deliver(firstInvite.mailId);await enabled.academy.acceptGuardian(existingGuardian,req({token:firstGuardianToken,accepted:true,policyVersion:'candidate-review-v1'}));
 enabled.academy.participant(await enabled.academy.dossier(existingYouth),existingYouth,'bos');
 const pendingInvite=await enabled.academy.inviteGuardian(existingYouth,req({email:existingGuardian.email})),pendingMail=await enabled.repo.read(`mail:${pendingInvite.mailId}`),version=randomUUID(),reportBody={mm:existingYouth.mm,reading:{preserved:true}},artifact={...reportBody,artifact_sha256:digest(reportBody)},dk=`dossier:${existingYouth.mm}`;
 const deferredSignup=await enabled.auth.signup({email:'deferred-youth@test.invalid',password:'Synthetic-only-password-2026',displayName:'Deferred Youth',dateOfBirth:'2009-09-21',region:'US-CA',sport:'Soccer',institutionId:'beyond-today-sports-institute',institutionCode:'darrendemo1'}),deferredMail=await enabled.repo.read(`mail:${deferredSignup.mailId}`),deferredToken=deferredMail.token;await enabled.deliver(deferredSignup.mailId);
 await enabled.repo.putImmutable(`report:${existingYouth.mm}:bos:${version}`,{artifact,input:{subject:{mm:existingYouth.mm}},createdAt:clock});
 const expiredJob={jobId:randomUUID(),ownerId:existingYouth.id,mm:existingYouth.mm,service:'bos',status:'running',stage:'evidence',records:{},inputRevision:0,attempt:randomUUID(),lease:clock-1},jk=`job:${expiredJob.jobId}`;
 await enabled.repo.transact([dk,jk],s=>{s[dk].reports.bos={currentVersionId:version,artifactHash:artifact.artifact_sha256};s[dk].jobs.push({jobId:expiredJob.jobId,mm:existingYouth.mm,service:'bos',status:'running',stage:'evidence',completedStages:0,totalStages:5,inputRevision:0,canAdvance:false,errorCode:null});s[dk].revision++;return {writes:{[dk]:s[dk],[jk]:expiredJob},result:true};});
 let adultOnlyMailCalls=0;const disabled=createAcademyRuntime({env:{...env,ATHLETE_ACADEMY_NAMESPACE:namespace,ATHLETE_ACADEMY_REAL_YOUTH_ENABLED:'0'},redis,now:()=>clock,assessmentTransport:replay,coachTransport:async()=>{},mailTransport:async()=>{adultOnlyMailCalls++;return {status:'sent'};}});
 assert.equal(disabled.config.cohort.minimumAge,18);assert.equal(disabled.config.cohort.guardianRequiredUnder,null);
 const pausedMail=await runMailQueue(disabled);assert.deepEqual(pausedMail,{processed:0,paused:true,pausedCount:1});assert.equal(adultOnlyMailCalls,0);const stillQueued=await disabled.repo.read(`mail:${pendingInvite.mailId}`);assert.equal(stillQueued.status,'pending');assert.equal(stillQueued.token,pendingMail.token);
 await disabled.auth.verifyEmail(deferredToken);const deferredRef=await disabled.repo.read(`email:${digest('deferred-youth@test.invalid')}`),deferredSaved=await disabled.repo.read(`account:${deferredRef.id}`),deferredDossier=await disabled.repo.read(`dossier:${deferredSaved.mm}`);assert.equal(deferredSaved.verified,true);assert.ok(deferredSaved.pendingMembership);assert.deepEqual(deferredDossier.memberships,[]);assert.deepEqual(deferredDossier.entitlements,{bos:false,apa:false,coach:false});
 await assert.rejects(()=>disabled.auth.signup({email:'seventeen@test.invalid',password:'Synthetic-only-password-2026',displayName:'Seventeen',dateOfBirth:'2009-09-21',region:'US-CA',sport:'Soccer'}),/PILOT_CALIFORNIA_18_PLUS/);
 const admitted=await disabled.auth.signup({email:'eighteen@test.invalid',password:'Synthetic-only-password-2026',displayName:'Eighteen',dateOfBirth:'2008-09-21',region:'US-CA',sport:'Soccer'});assert.equal(admitted.verificationRequired,true);
 const readable=(await disabled.academy.getDossier(existingYouth,{mm:existingYouth.mm})).dossier;assert.equal(readable.mm,existingYouth.mm);assert.equal(readable.jobs.find(j=>j.jobId===expiredJob.jobId).canAbandon,true);
 assert.equal((await disabled.academy.getReport(existingYouth,{mm:existingYouth.mm,service:'bos'})).artifact.reading.preserved,true);
 const before=await disabled.academy.dossier(existingYouth);
 await assert.rejects(()=>disabled.auth.redeem(existingYouth,{institutionId:'beyond-today-sports-institute',institutionCode:'darrendemo1'}),/YOUTH_ENROLLMENT_NOT_ACTIVE/);
 await assert.rejects(()=>disabled.academy.acceptParticipation(existingYouth,req({accepted:true,policyVersion:'candidate-review-v1'})),/YOUTH_ENROLLMENT_NOT_ACTIVE/);
 await assert.rejects(()=>disabled.academy.inviteGuardian(existingYouth,req({email:existingGuardian.email})),/YOUTH_ENROLLMENT_NOT_ACTIVE/);
 await assert.rejects(()=>disabled.academy.guardianPreview(existingGuardian,{token:pendingMail.token}),/YOUTH_ENROLLMENT_NOT_ACTIVE/);
 await assert.rejects(()=>disabled.academy.acceptGuardian(existingGuardian,req({token:pendingMail.token,accepted:true,policyVersion:'candidate-review-v1'})),/YOUTH_ENROLLMENT_NOT_ACTIVE/);
 await assert.rejects(()=>disabled.academy.saveIntake(existingYouth,req({mm:existingYouth.mm,revision:before.revision,service:'bos',answers:[{question_id:'Q01',text:'A preserved answer',skipped:false}]})),/YOUTH_ENROLLMENT_NOT_ACTIVE/);
 await assert.rejects(()=>disabled.coaching.bundle(existingYouth,{mm:existingYouth.mm}),/YOUTH_ENROLLMENT_NOT_ACTIVE/);
 assert.deepEqual(await disabled.academy.dossier(existingYouth),before,'denied adult-only operations do not rewrite youth data');
 const abandoned=await disabled.academy.abandon(existingYouth,req({jobId:expiredJob.jobId,confirmAbandon:true}));assert.equal(abandoned.job.status,'abandoned');assert.equal(abandoned.noProviderCall,true);
 await disabled.academy.withdraw(existingGuardian,req({mm:existingYouth.mm}));
 assert.equal((await disabled.academy.dossier(existingYouth)).participation.status,'withdrawn');
 assert.equal((await disabled.academy.getReport(existingYouth,{mm:existingYouth.mm,service:'bos'})).artifact.reading.preserved,true);
});
test('adult-only mail worker quarantines guardian mail without starving eligible account mail',async()=>{
 const namespace=`more:athlete-academy:{test-${randomUUID()}}`,base={...env,ATHLETE_ACADEMY_NAMESPACE:namespace,ATHLETE_ACADEMY_REAL_YOUTH_ENABLED:'0'},sent=[],disabled=createAcademyRuntime({env:base,redis,now:()=>clock,mailTransport:async item=>{sent.push(item.kind);return {status:'sent',receipt:'synthetic-mail-receipt'};}}),guardianIds=Array.from({length:20},()=>randomUUID()),eligibleId=randomUUID(),all=[...guardianIds,eligibleId],keys=[...all.map(id=>`mail:${id}`),'queue:mail'];
 await disabled.repo.transact(keys,()=>({writes:Object.fromEntries([...guardianIds.map(id=>[`mail:${id}`,{id,email:'guardian@test.invalid',kind:'guardian_invite',token:'a'.repeat(64),status:'pending',attempts:0,createdAt:clock,expiresAt:clock+86400000}]),[`mail:${eligibleId}`,{id:eligibleId,email:'adult@test.invalid',kind:'verify_email',token:'b'.repeat(64),status:'pending',attempts:0,createdAt:clock,expiresAt:clock+86400000}],['queue:mail',{ids:all}]]),result:true}));
 const held=await runMailQueue(disabled);assert.deepEqual(held,{processed:1,paused:true,pausedCount:20});assert.deepEqual(sent,['verify_email']);assert.deepEqual((await disabled.repo.read('queue:mail')).ids,[]);assert.equal((await disabled.repo.read('queue:mail:paused-youth')).ids.length,20);for(const id of guardianIds){const mail=await disabled.repo.read(`mail:${id}`);assert.equal(mail.status,'pending');assert.equal(mail.token,'a'.repeat(64));}
 const resumed=[],enabled=createAcademyRuntime({env:{...base,ATHLETE_ACADEMY_REAL_YOUTH_ENABLED:'1'},redis,now:()=>clock,mailTransport:async item=>{resumed.push(item.kind);return {status:'sent',receipt:'synthetic-mail-receipt'};}}),released=await runMailQueue(enabled);assert.deepEqual(released,{processed:20});assert.equal(resumed.filter(kind=>kind==='guardian_invite').length,20);assert.deepEqual((await enabled.repo.read('queue:mail:paused-youth')).ids,[]);
});
test('single-use verification; code never grants report authority',async()=>{const r=await rt.auth.signup({email:'unverified@test.invalid',password:'Synthetic-only-password-2026',displayName:'Unverified',dateOfBirth:'2000-01-01',sport:'Soccer',region:'US-CA'});const m=await rt.repo.read(`mail:${r.mailId}`);await assert.rejects(()=>rt.auth.login({email:m.email,password:'Synthetic-only-password-2026'}),/VERIFY_EMAIL_FIRST/);await rt.auth.verifyEmail(m.token);await assert.rejects(()=>rt.auth.verifyEmail(m.token),/LINK_EXPIRED_OR_USED/);await assert.rejects(()=>rt.auth.redeem(adult,{institutionId:'horizon-academy',institutionCode:'darrendemo1'}),/INSTITUTION_CODE_INVALID/);});
test('17 year old is blocked until own assent and separate verified guardian acceptance',async()=>{youth=await account('youth@test.invalid','2009-01-02');guardian=await account('guardian@test.invalid','1982-01-01');await rt.academy.acceptParticipation(youth,req({accepted:true,policyVersion:'candidate-review-v1'}));const d=await rt.academy.dossier(youth);await assert.rejects(()=>rt.academy.saveIntake(youth,req({mm:youth.mm,revision:d.revision,service:'bos',answers:[{question_id:'Q01',text:'A real answer',skipped:false}]})),/GUARDIAN_REQUIRED/);const invite=await rt.academy.inviteGuardian(youth,req({email:guardian.email}));const mail=await rt.repo.read(`mail:${invite.mailId}`);await assert.rejects(()=>rt.academy.guardianPreview(other,{token:mail.token}),/GUARDIAN_INVITATION_INVALID/);await rt.academy.acceptGuardian(guardian,req({token:mail.token,accepted:true,policyVersion:'candidate-review-v1'}));assert.equal((await rt.academy.dossier(youth)).participation.status,'authorized');await assert.rejects(()=>rt.academy.getDossier(guardian,{mm:youth.mm}),/NOT_FOUND/);});
test('draft saves are idempotent, require current revision and isolate people',async()=>{await rt.academy.acceptParticipation(adult,req({accepted:true,policyVersion:'candidate-review-v1'}));const d=await rt.academy.dossier(adult),body=req({mm:adult.mm,service:'bos',revision:d.revision,answers:fixture.bos_source.answers.map(a=>({...a,skipped:false}))});const [x,y]=await Promise.all([rt.academy.saveIntake(adult,body),rt.academy.saveIntake(adult,body)]);assert.equal(x.dossier.revision,y.dossier.revision);await assert.rejects(()=>rt.academy.saveIntake(adult,{...body,requestId:randomUUID()}),/STATE_CHANGED_RELOAD/);await assert.rejects(()=>rt.academy.saveIntake(other,{...body,requestId:randomUUID()}),/NOT_FOUND/);});
test('five BOS stages save before dispatch and publish exact locked questionnaire with complete reader',async()=>{const d=await rt.academy.dossier(adult);let j=(await rt.academy.startAssessment(adult,req({mm:adult.mm,service:'bos',inputRevision:d.intake.bos.revision}))).job;let first;for(let i=0;i<5;i++){const body=req({jobId:j.jobId});if(i===0)first=body;j=(await rt.academy.advance(adult,body)).job;assert.equal(j.status,i===4?'completed':'ready',j.errorCode||'');assert.equal(j.totalStages,5,'clean reading keeps the five-stage path');}const count=requests.length;await rt.academy.advance(adult,first);assert.equal(requests.length,count,'replay must never redispatch');const report=await rt.academy.getReport(adult,{mm:adult.mm,service:'bos'});assert.equal(report.source.questionnaire_version,QUESTIONNAIRE_VERSION);assert.equal(report.source.questions.length,20);assert.equal(report.artifact.reading.chapters.length,8);assert.equal(report.artifact.mm,adult.mm);assert.equal(report.artifact.synthetic,true);assert.equal(report.artifact.questionnaire_version,QUESTIONNAIRE_VERSION);await assert.rejects(()=>rt.academy.getReport(other,{mm:adult.mm,service:'bos'}),/NOT_FOUND/);});

const unsupportedTrigger='You won the national title with your older brother.';
const alternativeUnsupportedTrigger='You won the regional title with your older sister.';
const auditFor=quote=>({audit_version:'youth-bos-factual-audit-v1',pass:false,findings:[{path:'reading.pressure_visual.trigger',quote,severity:'material',reason:'A synthetic title and family event are not in these answers.',question_ids:['Q01']}]});
const cleanAudit={audit_version:'youth-bos-factual-audit-v1',pass:true,findings:[]};
const providerInput=request=>JSON.parse(request.input.slice(request.input.indexOf('\n')+1));
async function syntheticMaterialAuditCase(correctedTrigger,secondAudit,firstAudit=auditFor(unsupportedTrigger)){
 const candidateReading=structuredClone(fixture.bos.reading);
 candidateReading.pressure_visual.trigger=unsupportedTrigger;
 const correction={correction_version:'youth-bos-reading-correction-v1',changes:[{path:'reading.pressure_visual.trigger',text:correctedTrigger}]};
 const outputs=[fixture.bos.evidence,fixture.bos.domains,fixture.bos.synthesis,candidateReading,firstAudit,correction,secondAudit];
 const sent=[],caseEnv={...env,ATHLETE_ACADEMY_NAMESPACE:`more:athlete-academy:{test-${randomUUID()}}`};
 const transport=async function*(request){const output=outputs[sent.length];sent.push(request);assert.ok(output,'no eighth provider dispatch');yield {type:'response.completed',response:{id:`synthetic-stage-${sent.length}`,status:'completed',model:'gpt-5.6-sol',output_text:JSON.stringify(output),usage:{total_tokens:0}}};};
 const runtime=createAcademyRuntime({env:caseEnv,redis,now:()=>clock,assessmentTransport:transport,coachTransport:async()=>{},mailTransport:async()=>({status:'sent'})});
 const email='material-bos@test.invalid',signup=await runtime.auth.signup({email,password:'Synthetic-only-password-2026',displayName:'Material test',dateOfBirth:'2000-01-01',region:'US-CA',sport:'Soccer',institutionId:'beyond-today-sports-institute',institutionCode:'darrendemo1'});
 const mail=await runtime.repo.read(`mail:${signup.mailId}`);await runtime.auth.verifyEmail(mail.token);
 const person=(await runtime.auth.login({email,password:'Synthetic-only-password-2026'})).session.account;
 await runtime.academy.acceptParticipation(person,req({accepted:true,policyVersion:'candidate-review-v1'}));
 let dossier=await runtime.academy.dossier(person);
 dossier=(await runtime.academy.saveIntake(person,req({service:'bos',revision:dossier.revision,answers:fixture.bos_source.answers.map(answer=>({...answer,skipped:false}))}))).dossier;
 const job=(await runtime.academy.startAssessment(person,req({service:'bos',inputRevision:dossier.intake.bos.revision}))).job;
 return {runtime,person,job,sent,candidateReading,correction};
}
async function reachFirstMaterialAudit({runtime,person,job}){
 let current=job,readingAttempt,auditBody;
 for(let i=0;i<5;i++){
  const body=req({jobId:job.jobId});if(i===4)auditBody=body;
  current=(await runtime.academy.advance(person,body)).job;
  if(i===3)readingAttempt=(await runtime.repo.read(`job:${job.jobId}`)).attempt;
  assert.equal(current.status,'ready',`stage ${i+1} must remain recoverable`);
 }
 assert.equal(current.completedStages,5);
 assert.equal(current.totalStages,7,'one material finding opens exactly one correction and re-audit');
 assert.equal(current.stage,'targeted-reading-correction');
 const saved=await runtime.repo.read(`job:${job.jobId}`),auditAttempt=saved.attempt;
 assert.equal(saved.records.audit.output.pass,false);
 assert.deepEqual(saved.records.audit.output.findings,auditFor(unsupportedTrigger).findings);
 const beforeReplay=await runtime.repo.read(`job:${job.jobId}`);
 await runtime.academy.advance(person,auditBody);
 assert.deepEqual(await runtime.repo.read(`job:${job.jobId}`),beforeReplay,'duplicate audit advance must not change the job');
 await assert.rejects(()=>runtime.academy.getReport(person,{service:'bos'}),/REPORT_NOT_READY/);
 const evidence=async attempt=>({terminal:await runtime.repo.read(`evidence:${job.jobId}:${attempt}:terminal`),result:await runtime.repo.read(`evidence:${job.jobId}:${attempt}:result`)});
 return {saved,readingAttempt,auditAttempt,readingEvidence:await evidence(readingAttempt),auditEvidence:await evidence(auditAttempt),evidence};
}
test('one material BOS audit corrects only its cited field, independently re-audits the full reading, and preserves original receipts',async()=>{
 const scenario=await syntheticMaterialAuditCase(fixture.bos.reading.pressure_visual.trigger,cleanAudit);
 const {runtime,person,job,sent,candidateReading,correction}=scenario;
 const first=await reachFirstMaterialAudit(scenario),jk=`job:${job.jobId}`;
 const correctionBody=req({jobId:job.jobId});
 let current=(await runtime.academy.advance(person,correctionBody)).job;
 assert.equal(current.status,'ready');assert.equal(current.completedStages,6);assert.equal(current.stage,'independent-correction-audit');
 assert.equal(current.totalStages,7);
 const afterCorrection=await runtime.repo.read(jk);
 assert.deepEqual(afterCorrection.records.reading,first.saved.records.reading);
 assert.deepEqual(afterCorrection.records.audit,first.saved.records.audit);
 assert.deepEqual(afterCorrection.records['targeted-reading-correction'].output,correction);
 await assert.rejects(()=>runtime.academy.getReport(person,{service:'bos'}),/REPORT_NOT_READY/);
 const beforeReplay=sent.length;
 await runtime.academy.advance(person,correctionBody);
 assert.equal(sent.length,beforeReplay,'duplicate correction advance cannot redispatch');
 await runtime.academy.advance(person,req({jobId:job.jobId}));
 const auditInput=providerInput(sent[6]);
 current=(await runtime.repo.read(jk));
 assert.equal(current.status,'completed',current.errorCode||'');
 assert.equal(Object.keys(current.records).length,7);
 assert.deepEqual(Object.keys(current.records),['evidence','domains','synthesis','reading','audit','targeted-reading-correction','independent-correction-audit']);
 assert.equal(auditInput.reading.chapters.length,8,'independent audit sees the whole corrected reading');
 assert.equal(auditInput.intake.answers.length,20,'independent audit sees the original complete intake');
 assert.equal(auditInput.reading.pressure_visual.trigger,fixture.bos.reading.pressure_visual.trigger);
 const report=await runtime.academy.getReport(person,{service:'bos'}),expectedReading=structuredClone(candidateReading);
 expectedReading.pressure_visual.trigger=fixture.bos.reading.pressure_visual.trigger;
 assert.deepEqual(report.artifact.reading,expectedReading,'only the cited field changes');
 assert.equal(report.artifact.receipts.length,7);
 assert.deepEqual(report.artifact.receipts.map(receipt=>receipt.stage),Object.keys(current.records));
 assert.deepEqual(current.records.reading,first.saved.records.reading);
 assert.deepEqual(current.records.audit,first.saved.records.audit);
 assert.deepEqual(await first.evidence(first.readingAttempt),first.readingEvidence);
 assert.deepEqual(await first.evidence(first.auditAttempt),first.auditEvidence);
 const before=sent.length;
 await runAssessmentQueue(runtime);
 await assert.rejects(()=>runtime.academy.reconcile(person,req({jobId:job.jobId})),/RECOVERY_NOT_REQUIRED/);
 await assert.rejects(()=>runtime.academy.advance(person,req({jobId:job.jobId})),/JOB_NOT_READY/);
 assert.equal(sent.length,before,'completed job cannot redispatch');
});
test('a second material BOS audit fails closed after seven saved stages with no report or retry loop',async()=>{
 const scenario=await syntheticMaterialAuditCase(alternativeUnsupportedTrigger,auditFor(alternativeUnsupportedTrigger));
 const {runtime,person,job,sent}=scenario,first=await reachFirstMaterialAudit(scenario),jk=`job:${job.jobId}`;
 let current=(await runtime.academy.advance(person,req({jobId:job.jobId}))).job;
 assert.equal(current.status,'ready');assert.equal(current.completedStages,6);
 current=(await runtime.academy.advance(person,req({jobId:job.jobId}))).job;
 assert.equal(current.status,'failed');assert.equal(current.errorCode,'READING_NEEDS_FACTUAL_REVIEW');
 assert.equal(current.completedStages,7);assert.equal(current.totalStages,7);
 const saved=await runtime.repo.read(jk),stageSevenAttempt=saved.attempt;
 assert.deepEqual(saved.records.reading,first.saved.records.reading);
 assert.deepEqual(saved.records.audit,first.saved.records.audit);
 assert.deepEqual(await first.evidence(first.readingAttempt),first.readingEvidence);
 assert.deepEqual(await first.evidence(first.auditAttempt),first.auditEvidence);
 assert.equal(saved.records['independent-correction-audit'].output.pass,false);
 assert.deepEqual(saved.records['independent-correction-audit'].output.findings,auditFor(alternativeUnsupportedTrigger).findings);
 assert.ok((await runtime.repo.read(`evidence:${job.jobId}:${stageSevenAttempt}:terminal`))?.output_text);
 assert.equal((await runtime.repo.read(`evidence:${job.jobId}:${stageSevenAttempt}:result`)).output.pass,false);
 assert.equal((await runtime.repo.read('queue:assessments')).jobs.includes(job.jobId),false);
 await assert.rejects(()=>runtime.academy.getReport(person,{service:'bos'}),/REPORT_NOT_READY/);
 const before=sent.length;
 await runAssessmentQueue(runtime);
 await assert.rejects(()=>runtime.academy.reconcile(person,req({jobId:job.jobId})),/RECOVERY_NOT_REQUIRED/);
 await assert.rejects(()=>runtime.academy.advance(person,req({jobId:job.jobId})),/JOB_NOT_READY/);
 assert.equal(sent.length,before,'second material finding cannot trigger another correction');
});
test('a material BOS audit with a quote absent from the cited field fails closed before correction',async()=>{
 const invalidAudit=auditFor('A fabricated quote absent from the public reading.');
 const {runtime,person,job,sent}=await syntheticMaterialAuditCase(fixture.bos.reading.pressure_visual.trigger,cleanAudit,invalidAudit);
 let current=job;
 for(let i=0;i<4;i++)current=(await runtime.academy.advance(person,req({jobId:job.jobId}))).job;
 assert.equal(current.status,'ready');assert.equal(current.completedStages,4);
 current=(await runtime.academy.advance(person,req({jobId:job.jobId}))).job;
 assert.equal(current.status,'failed');assert.equal(current.errorCode,'INVALID_AUDIT_FINDING');
 assert.equal(current.completedStages,4,'invalid audit cannot enter the bounded correction path');
 const saved=await runtime.repo.read(`job:${job.jobId}`),prefix=`evidence:${job.jobId}:${saved.attempt}`;
 assert.deepEqual(Object.keys(saved.records),['evidence','domains','synthesis','reading']);
 assert.deepEqual((await runtime.repo.read(`${prefix}:result`)).output,invalidAudit);
 assert.equal((await runtime.repo.read(`${prefix}:failure`)).code,'INVALID_AUDIT_FINDING');
 assert.equal((await runtime.repo.read('queue:assessments')).jobs.includes(job.jobId),false);
 await assert.rejects(()=>runtime.academy.getReport(person,{service:'bos'}),/REPORT_NOT_READY/);
 const before=sent.length;
 await runAssessmentQueue(runtime);
 await assert.rejects(()=>runtime.academy.advance(person,req({jobId:job.jobId})),/JOB_NOT_READY/);
 assert.equal(sent.length,before);
});
test('feedback is stored independently and cannot rewrite the BOS',async()=>{const before=await rt.academy.getReport(adult,{service:'bos'});await rt.academy.feedback(adult,req({section:'portrait',choice:'partly',comment:'Sometimes it is different.',report_hash:before.artifact.artifact_sha256}));const after=await rt.academy.getReport(adult,{service:'bos'});assert.equal(after.artifact.artifact_sha256,before.artifact.artifact_sha256);assert.equal((await rt.repo.read(`feedback:${adult.mm}`)).items.length,1);});
test('APA consumes the exact canonical BOS and publishes all five views with four confirmed areas',async()=>{let d=await rt.academy.dossier(adult);d=(await rt.academy.saveIntake(adult,req({service:'apa',revision:d.revision,answers:fixture.apa_source.answers.map(a=>({...a,skipped:false})),confirmation:fixture.apa_source.confirmation}))).dossier;let j=(await rt.academy.startAssessment(adult,req({service:'apa',inputRevision:d.intake.apa.revision}))).job;let count=0;while(j.canAdvance&&count++<4)j=(await rt.academy.advance(adult,req({jobId:j.jobId}))).job;assert.equal(j.status,'completed',j.errorCode||'');const report=await rt.academy.getReport(adult,{service:'apa'}),bos=await rt.academy.getReport(adult,{service:'bos'});assert.equal(report.artifact.bos_sha256,digest(bos.artifact));assert.deepEqual(report.artifact.report.domains.map(x=>x.id),['sport','training','mindset','school']);assert.equal(report.artifact.report.futures.length,5);assert.equal(report.artifact.mm,adult.mm);});
test('coaching carries the same source pair and rejects speaker impersonation and stale plan agreement',async()=>{const bundle=await rt.coaching.bundle(adult,{mm:adult.mm});assert.equal(bundle.person.mm,adult.mm);assert.equal(bundle.bos_source.questions[0].prompt,QUESTIONS[0].prompt);let state=(await rt.coaching.state(adult,{mm:adult.mm})).state;const b=req({mm:adult.mm,revision:state.revision,command:{action:'start'}});state=(await rt.coaching.action(adult,b)).state;assert.equal(state.status,'active');const before=state.messages.length;state=(await rt.coaching.action(adult,b)).state;assert.equal(state.messages.length,before);await assert.rejects(()=>rt.coaching.action(adult,req({mm:adult.mm,revision:state.revision,command:{action:'message',text:'This is coach test',speaker:'coach'}})),/COACH_ACTOR_SPOOF_DENIED/);const plan={title:'One manageable step',why:'My choice',steps:[{action:'Ask for a clear cue at practice.',when:'Tuesday',notice:'Whether it helps the next play',owner:'athlete'}],review:'Next week'};state=(await rt.coaching.action(adult,req({mm:adult.mm,revision:state.revision,command:{action:'draft',plan}}))).state;const prior=state.draft;state=(await rt.coaching.action(adult,req({mm:adult.mm,revision:state.revision,command:{action:'draft',plan:{...plan,title:'A changed proposal'}}}))).state;await assert.rejects(()=>rt.coaching.action(adult,req({mm:adult.mm,revision:state.revision,command:{action:'approve',id:prior.id,hash:prior.hash}})),/PLAN_CHANGED_REVIEW_LATEST/);state=(await rt.coaching.action(adult,req({mm:adult.mm,revision:state.revision,command:{action:'approve',id:state.draft.id,hash:state.draft.hash}}))).state;assert.equal(state.plan.title,'A changed proposal');assert.equal(state.draft,null);await assert.rejects(()=>rt.coaching.state(guardian,{mm:adult.mm}),/NOT_FOUND/);});
test('BOS feedback in coaching and standalone reading shares one durable original-report record',async()=>{
 const before=await rt.academy.getReport(adult,{service:'bos'});let s=(await rt.coaching.state(adult,{mm:adult.mm})).state;
 assert.equal(s.feedback.find(x=>x.section==='portrait').comment,'Sometimes it is different.');
 s=(await rt.coaching.action(adult,req({mm:adult.mm,revision:s.revision,command:{action:'feedback',section:'portrait',choice:'misses',comment:'A fictional exception added in coaching.',report_hash:before.artifact.artifact_sha256}}))).state;
 const after=await rt.academy.getReport(adult,{service:'bos'}),bundle=await rt.coaching.bundle(adult,{mm:adult.mm});
 assert.equal(after.feedback.portrait.comment,'A fictional exception added in coaching.');assert.equal(bundle.bos_feedback.portrait.choice,'misses');assert.equal(after.artifact.artifact_sha256,before.artifact.artifact_sha256);assert.equal(s.feedback.find(x=>x.section==='portrait').choice,'misses');
});
test('an interrupted response recovers saved terminal bytes without another provider call',async()=>{const person=await account('recover@test.invalid');await rt.academy.acceptParticipation(person,req({accepted:true,policyVersion:'candidate-review-v1'}));let d=await rt.academy.dossier(person);d=(await rt.academy.saveIntake(person,req({service:'bos',revision:d.revision,answers:fixture.bos_source.answers.map(a=>({...a,skipped:false}))}))).dossier;let job=(await rt.academy.startAssessment(person,req({service:'bos',inputRevision:d.intake.bos.revision}))).job;interrupted=true;job=(await rt.academy.advance(person,req({jobId:job.jobId}))).job;interrupted=false;assert.equal(job.status,'unknown');const before=requests.length;await assert.rejects(()=>rt.academy.advance(person,req({jobId:job.jobId})),/JOB_NOT_READY/);job=(await rt.academy.reconcile(person,req({jobId:job.jobId}))).job;assert.equal(job.status,'ready');assert.equal(job.completedStages,1);assert.equal(requests.length,before);});
test('password recovery consumes token and revokes every old session',async()=>{const request=await rt.auth.requestReset({email:other.email});const m=await rt.repo.read(`mail:${request.mailId}`);await rt.auth.resetPassword({token:m.token,password:'Another-synthetic-password'});assert.equal(await rt.auth.session(other.session),null);await assert.rejects(()=>rt.auth.resetPassword({token:m.token,password:'Another-synthetic-password'}),/LINK_EXPIRED_OR_USED/);await assert.rejects(()=>rt.academy.acceptParticipation(other,req({accepted:true,policyVersion:'candidate-review-v1'})),/SESSION_EXPIRED/);});
test('guardian withdrawal stops new youth processing, without deleting prior records',async()=>{await rt.academy.withdraw(guardian,req({mm:youth.mm}));const d=await rt.academy.dossier(youth);assert.equal(d.participation.status,'withdrawn');await assert.rejects(()=>rt.academy.saveIntake(youth,req({service:'bos',revision:d.revision,answers:[{question_id:'Q01',text:'A real answer',skipped:false}]})),/PARTICIPATION_WITHDRAWN/);});


test('all older outstanding reset links expire after a successful reset',async()=>{
 const first=await rt.auth.requestReset({email:adult.email}),second=await rt.auth.requestReset({email:adult.email});
 const a=await rt.repo.read(`mail:${first.mailId}`),b=await rt.repo.read(`mail:${second.mailId}`);
 await rt.auth.resetPassword({token:b.token,password:'Renewed-synthetic-password'});
 await assert.rejects(()=>rt.auth.resetPassword({token:a.token,password:'Stale-token-password'}),/LINK_EXPIRED_OR_USED/);
 adult=(await rt.auth.login({email:adult.email,password:'Renewed-synthetic-password'})).session.account;
});
test('guardian withdrawal cannot be undone by athlete assent alone',async()=>{
 await rt.academy.acceptParticipation(youth,req({accepted:true,policyVersion:'candidate-review-v1'}));
 const d=await rt.academy.dossier(youth);assert.equal(d.participation.status,'guardian_required');assert.equal(d.participation.guardianId,null);
 assert.throws(()=>rt.academy.participant(d,youth,'bos'),/GUARDIAN_REQUIRED/);
 const listing=await rt.academy.guardians(guardian);assert.equal(listing.participants[0].active,false);
});
test('changed policy requires current athlete and separate guardian acceptance',async()=>{
 const next=createAcademyRuntime({env:{...env,ATHLETE_ACADEMY_REVIEWED_POLICY_VERSION:'policy-v2'},redis,now:()=>clock,assessmentTransport:replay,coachTransport:async()=>{},mailTransport:async()=>({status:'sent'})});
 const d=await next.academy.dossier(adult);assert.throws(()=>next.academy.participant(d,adult,'bos'),/PARTICIPATION_REVIEW_REQUIRED/);
 await next.academy.acceptParticipation(youth,req({accepted:true,policyVersion:'policy-v2'}));
 const dy=await next.academy.dossier(youth);assert.throws(()=>next.academy.participant(dy,youth,'bos'),/GUARDIAN_REQUIRED/);
 const invite=await next.academy.inviteGuardian(youth,req({email:guardian.email})),mail=await next.repo.read(`mail:${invite.mailId}`);
 await next.academy.acceptGuardian(guardian,req({token:mail.token,accepted:true,policyVersion:'policy-v2'}));
 next.academy.participant(await next.academy.dossier(youth),youth,'bos');
});

const coachOutput={reply:'A saved response recovered exactly once.',plan:null,plan_change:'none',retire_draft:false,learning:[],recap:''};
const response=()=>({status:'completed',model:'gpt-5.6-sol',output_text:JSON.stringify(coachOutput)});
test('coach recovers saved response after receipt persistence failure with no new dispatch',async()=>{
 let calls=0;const injected={...rt.repo,putImmutable:async(k,v)=>{if(k.startsWith('coach-evidence:')&&k.endsWith(':receipt'))throw Error('injected storage failure');return rt.repo.putImmutable(k,v);}};
 const c=createCoachingService({repo:injected,config:rt.config,academy:rt.academy,now:()=>clock,transport:async()=>{calls++;return response();}});
 let state=(await c.state(adult,{mm:adult.mm})).state;const count=state.messages.filter(m=>m.role==='assistant').length;
 state=(await c.action(adult,req({mm:adult.mm,revision:state.revision,command:{action:'message',text:'A fictional recovery check.'}}))).state;
 assert.equal(state.status,'unknown');assert.equal(calls,1);
 state=(await c.action(adult,req({mm:adult.mm,revision:state.revision,command:{action:'recover'}}))).state;
 assert.equal(state.status,'active');assert.equal(calls,1);assert.equal(state.messages.filter(m=>m.role==='assistant').length,count+1);assert.equal(state.pendingAttempt,undefined);
});
test('coach unknown outcome can be explicitly set aside; late result cannot silently reappear',async()=>{
 let calls=0;const c=createCoachingService({repo:rt.repo,config:rt.config,academy:rt.academy,now:()=>clock,transport:async()=>{calls++;throw Error('connection lost');}});
 let state=(await c.state(adult,{mm:adult.mm})).state;
 state=(await c.action(adult,req({mm:adult.mm,revision:state.revision,command:{action:'message',text:'Saved even if response is unknown.'}}))).state;
 assert.equal(state.status,'unknown');const messages=state.messages.length;
 await assert.rejects(()=>c.action(adult,req({mm:adult.mm,revision:state.revision,command:{action:'recover'}})),/RESULT_NOT_YET_RECOVERABLE/);
 state=(await c.action(adult,req({mm:adult.mm,revision:state.revision,command:{action:'abandon_response',confirm:true}}))).state;
 assert.equal(calls,1);assert.equal(state.messages.length,messages);assert.equal(state.status,'active');assert.equal(state.pendingAttempt,undefined);assert.ok(state.events.some(e=>e.type==='coach_attempt_closed'));
});
test('new report pair requires explicit source transition and fences an in-flight old-pair reply',async()=>{
 const key=`dossier:${adult.mm}`;
 async function replaceApa(){const d=await rt.repo.read(key),prior=await rt.repo.read(`report:${adult.mm}:apa:${d.reports.apa.currentVersionId}`),id=randomUUID();const {artifact_sha256:_OLD,...body}=prior.artifact;body.generation_revision=id;const artifact={...body,artifact_sha256:digest(body)};await rt.repo.putImmutable(`report:${adult.mm}:apa:${id}`,{...prior,artifact});await rt.repo.transact([key],s=>{const next=s[key];next.reports.apa={...next.reports.apa,currentVersionId:id,artifactHash:artifact.artifact_sha256};return {writes:{[key]:next},result:true};});}
 const c=createCoachingService({repo:rt.repo,config:rt.config,academy:rt.academy,now:()=>clock,transport:async()=>{await replaceApa();return response();}});
 let state=(await c.state(adult,{mm:adult.mm})).state;const accepted=state.plan.hash,assistantCount=state.messages.filter(m=>m.role==='assistant').length;
 state=(await c.action(adult,req({mm:adult.mm,revision:state.revision,command:{action:'message',text:'Synthetic report-version race.'}}))).state;
 assert.equal(state.status,'unknown');assert.equal(state.messages.filter(m=>m.role==='assistant').length,assistantCount);assert.equal(state.pendingAttempt.errorCode,'COACH_SOURCES_CHANGED');
 state=(await c.state(adult,{mm:adult.mm})).state;assert.equal(state.sourceUpdateAvailable,true);
 state=(await c.action(adult,req({mm:adult.mm,revision:state.revision,command:{action:'abandon_response',confirm:true}}))).state;
 state=(await c.action(adult,req({mm:adult.mm,revision:state.revision,command:{action:'refresh_sources',confirm:true}}))).state;
 assert.equal(state.sourceUpdateAvailable,undefined);assert.equal(state.plan.hash,accepted);assert.ok(state.events.some(e=>e.type==='source_pair_changed'));
});
test('assessment with no terminal response can be closed without dispatch or data loss',async()=>{
 const person=await account('unknown@test.invalid');await rt.academy.acceptParticipation(person,req({accepted:true,policyVersion:'candidate-review-v1'}));let d=await rt.academy.dossier(person);
 d=(await rt.academy.saveIntake(person,req({service:'bos',revision:d.revision,answers:fixture.bos_source.answers.map(a=>({...a,skipped:false}))}))).dossier;
 const c=createAcademyRuntime({env,redis,now:()=>clock,assessmentTransport:async()=>{throw Error('not acknowledged');},coachTransport:async()=>{},mailTransport:async()=>({status:'sent'})});
 let job=(await c.academy.startAssessment(person,req({service:'bos',inputRevision:d.intake.bos.revision}))).job;
 job=(await c.academy.advance(person,req({jobId:job.jobId}))).job;assert.equal(job.status,'unknown');
 await assert.rejects(()=>c.academy.reconcile(person,req({jobId:job.jobId})),/RESULT_NOT_YET_RECOVERABLE/);
 job=(await c.academy.abandon(person,req({jobId:job.jobId,confirmAbandon:true}))).job;assert.equal(job.status,'abandoned');
 assert.equal((await c.academy.dossier(person)).intake.bos.answers.length,20);
});
test('saved failed terminal response reconciles to a closed failed stage, never permanent unknown',async()=>{
 const person=await account('terminal@test.invalid');await rt.academy.acceptParticipation(person,req({accepted:true,policyVersion:'candidate-review-v1'}));let d=await rt.academy.dossier(person);d=(await rt.academy.saveIntake(person,req({service:'bos',revision:d.revision,answers:fixture.bos_source.answers.map(a=>({...a,skipped:false}))}))).dossier;
 const c=createAcademyRuntime({env,redis,now:()=>clock,assessmentTransport:async function*(){yield {type:'response.failed',response:{status:'failed',model:'gpt-5.6-sol'}};throw Error('connection closed after failed terminal');},coachTransport:async()=>{},mailTransport:async()=>({status:'sent'})});
 let job=(await c.academy.startAssessment(person,req({service:'bos',inputRevision:d.intake.bos.revision}))).job;job=(await c.academy.advance(person,req({jobId:job.jobId}))).job;assert.equal(job.status,'unknown');job=(await c.academy.reconcile(person,req({jobId:job.jobId}))).job;assert.equal(job.status,'failed');assert.equal(job.errorCode,'PROVIDER_INCOMPLETE');
});
test('authenticated worker resumes a requested assessment without a browser and cannot bypass participation',async()=>{
 const person=await account('worker@test.invalid');await rt.academy.acceptParticipation(person,req({accepted:true,policyVersion:'candidate-review-v1'}));let d=await rt.academy.dossier(person);d=(await rt.academy.saveIntake(person,req({service:'bos',revision:d.revision,answers:fixture.bos_source.answers.map(a=>({...a,skipped:false}))}))).dossier;
 const job=(await rt.academy.startAssessment(person,req({service:'bos',inputRevision:d.intake.bos.revision}))).job;
 // Earlier intentionally paused jobs may also exist; each gets at most one stage per tick.
 for(let i=0;i<20;i++){await runAssessmentQueue(rt);if((await rt.repo.read(`job:${job.jobId}`)).status==='completed')break;}
 assert.equal((await rt.repo.read(`job:${job.jobId}`)).status,'completed');assert.ok((await rt.academy.getReport(person,{service:'bos'})).artifact.reading);
 assert.throws(()=>workerAuthorized({ATHLETE_ACADEMY_WORKER_ENABLED:'1'},undefined),/WORKER_AUTH_REQUIRED/);
 const secret='synthetic-worker-secret-only-123456789';assert.throws(()=>workerAuthorized({ATHLETE_ACADEMY_WORKER_SECRET:secret,ATHLETE_ACADEMY_WORKER_ENABLED:'1'},'Bearer wrong'),/WORKER_AUTH_REQUIRED/);
 workerAuthorized({ATHLETE_ACADEMY_WORKER_SECRET:secret,ATHLETE_ACADEMY_WORKER_ENABLED:'1'},'Bearer '+secret);
});
test('one inaccessible or malformed queued job cannot starve another participant',async()=>{
 async function begin(email){const a=await account(email);await rt.academy.acceptParticipation(a,req({accepted:true,policyVersion:'candidate-review-v1'}));let d=await rt.academy.dossier(a);d=(await rt.academy.saveIntake(a,req({service:'bos',revision:d.revision,answers:fixture.bos_source.answers.map(x=>({...x,skipped:false}))}))).dossier;const j=(await rt.academy.startAssessment(a,req({service:'bos',inputRevision:d.intake.bos.revision}))).job;return {a,j};}
 const denied=await begin('queue-denied@test.invalid'),good=await begin('queue-good@test.invalid');
 const dk=`dossier:${denied.a.mm}`,jk=`job:${denied.j.jobId}`,qk='queue:assessments';
 await rt.repo.transact([dk,qk],s=>{s[dk].entitlements.bos=false;return {writes:{[dk]:s[dk],[qk]:{jobs:[denied.j.jobId,good.j.jobId,...s[qk].jobs.filter(x=>![denied.j.jobId,good.j.jobId].includes(x))]}},result:true};});
 await runAssessmentQueue(rt);assert.equal(Object.keys((await rt.repo.read(`job:${good.j.jobId}`)).records).length,1);assert.equal((await rt.repo.read(`queue-pause:${denied.j.jobId}`)).reason,'ACADEMY_ACCESS_REQUIRED');
 const completed=(await rt.academy.dossier(adult)).jobs.find(j=>j.service==='bos'&&j.status==='completed'),records=(await rt.repo.read(`job:${completed.jobId}`)).records;
 await rt.repo.transact([dk,jk],s=>{s[dk].entitlements.bos=true;s[jk].records=records;return {writes:{[dk]:s[dk],[jk]:s[jk]},result:true};});
 await runAssessmentQueue(rt);assert.equal((await rt.repo.read(jk)).status,'failed');assert.equal(Object.keys((await rt.repo.read(`job:${good.j.jobId}`)).records).length,2);
});
test('assessment abandonment preserves the uncertainty of the actual interrupted attempt',async()=>{
 const a=await account('abandon-provenance@test.invalid'),dk=`dossier:${a.mm}`;
 for(const [status,records,expected] of [['unknown',{evidence:{output:{claims:[]}}},true],['failed',{},false]]){
  const id=randomUUID(),jk=`job:${id}`,j={jobId:id,ownerId:a.id,mm:a.mm,service:'bos',status,records,attempt:randomUUID(),stage:'domains',errorCode:expected?'GENERATION_OUTCOME_UNKNOWN':'PROVIDER_OUTPUT_INVALID'};
  await rt.repo.transact([dk,jk],s=>{s[dk].jobs.push(j);return {writes:{[dk]:s[dk],[jk]:j},result:true};});
  await rt.academy.abandon(a,req({jobId:id,confirmAbandon:true}));const saved=await rt.repo.read(jk);assert.equal(saved.abandonment.outcomeRemainsUnknown,expected);assert.equal(saved.abandonment.previousStatus,status);assert.ok(saved.abandonment.evidencePrefix.endsWith(j.attempt));
 }
});
test('bounded synthetic repair rejects completed stages, another active job, and a full queue',async()=>{
 const a=await account('repair-guards@test.invalid');await rt.academy.acceptParticipation(a,req({accepted:true,policyVersion:'candidate-review-v1'}));
 const dk=`dossier:${a.mm}`,id=randomUUID(),jk=`job:${id}`,attempt=randomUUID(),qk='queue:assessments';
 const j={jobId:id,ownerId:a.id,mm:a.mm,service:'apa',status:'failed',inputRevision:0,bosVersionId:'synthetic-bos-version',records:{'synthesis-futures-candidates':{},'independent-source-audit':{output:{pass:false,issues:[{severity:'material'}]}}},attempt,input:{source:{}},errorCode:'MOVE_TOO_COMPLEX'};
 await rt.repo.putImmutable(`evidence:${id}:${attempt}:result`,{output:{candidate:'original failed bytes'}});
 await rt.repo.transact([dk,jk],s=>{s[dk].reports.bos={currentVersionId:j.bosVersionId};s[dk].jobs=[{jobId:id,service:'apa',status:'failed'},{jobId:'active',service:'apa',status:'ready'}];return {writes:{[dk]:s[dk],[jk]:j},result:true};});
 await assert.rejects(()=>rt.academy.startSyntheticRepair(a,req({jobId:id,failureCode:j.errorCode})),/ASSESSMENT_ALREADY_IN_PROGRESS/);
 const queue=await rt.repo.read(qk);await rt.repo.transact([dk,qk],s=>{s[dk].jobs=s[dk].jobs.slice(0,1);return {writes:{[dk]:s[dk],[qk]:{jobs:Array.from({length:500},(_,i)=>'synthetic-'+i)}},result:true};});
 await assert.rejects(()=>rt.academy.startSyntheticRepair(a,req({jobId:id,failureCode:j.errorCode})),/GENERATION_QUEUE_BUSY/);
 await rt.repo.transact([qk,jk],s=>{s[jk].records['targeted-source-correction']={};s[jk].records['independent-correction-audit']={output:{pass:false,issues:[]}};return {writes:{[qk]:queue,[jk]:s[jk]},result:true};});
 await assert.rejects(()=>rt.academy.startSyntheticRepair(a,req({jobId:id,failureCode:j.errorCode})),/REPAIR_STAGE_NOT_ELIGIBLE/);
 await rt.repo.transact([jk],s=>{s[jk].errorCode='FACTUAL_AUDIT_NOT_CLEAR';s[jk].records['targeted-source-correction']={output:apaReplay};s[jk].records['independent-correction-audit']={output:{pass:false,issues:[{severity:'material',location:'current course',problem:'Unsupported subject baseline'}]}};return {writes:{[jk]:s[jk]},result:true};});
 await assert.rejects(()=>rt.academy.startSyntheticRepair(a,req({jobId:id,failureCode:'FACTUAL_AUDIT_NOT_CLEAR'})),/REPAIR_STAGE_NOT_ELIGIBLE/);
 const before=await rt.repo.read(jk),repair=(await rt.academy.startSyntheticRepair(a,req({jobId:id,failureCode:'FACTUAL_AUDIT_NOT_CLEAR',sourceAuditRepair:true}))).job,after=await rt.repo.read(jk),child=await rt.repo.read(`job:${repair.jobId}`);
 assert.equal(after.status,'failed');assert.deepEqual(after.records,before.records);assert.equal(child.repairOf,id);assert.equal(Object.keys(child.records).length,2);assert.deepEqual(child.input.source,before.input.source);assert.deepEqual(child.input.sourceAuditRepair.findings,before.records['independent-correction-audit'].output);
 await assert.rejects(()=>rt.academy.startSyntheticRepair(a,req({jobId:id,failureCode:'FACTUAL_AUDIT_NOT_CLEAR',sourceAuditRepair:true})),/BOUNDED_REPAIR_ALREADY_USED/);
});
test('withdrawal stops new coaching but owner can still read their original reports',async()=>{
 await rt.academy.withdraw(adult,req({mm:adult.mm}));assert.ok((await rt.academy.getReport(adult,{service:'bos'})).artifact.reading);await assert.rejects(()=>rt.coaching.bundle(adult,{mm:adult.mm}),/PARTICIPATION_WITHDRAWN/);
});
test.after(async()=>{await redis.quit();});
