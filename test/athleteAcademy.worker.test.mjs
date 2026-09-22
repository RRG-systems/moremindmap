import test from 'node:test';
import assert from 'node:assert/strict';
import {createScheduledHandler} from '../server/athleteAcademyV1/scheduled.js';
import {workerAuthorized} from '../server/athleteAcademyV1/worker.js';
import {readFile} from 'node:fs/promises';
const secret='synthetic-cron-test-secret-1234567890';
const env={ATHLETE_ACADEMY_WORKER_ENABLED:'1',CRON_SECRET:secret};
function fakeRuntime({mailEnabled=true,deliver=async()=>{throw Error('must not send');},advance=async()=>({job:{status:'ready'}})}={}){
 const records={'queue:mail':{ids:['pending-mail']},'queue:assessments':{jobs:['ready-job']},'job:ready-job':{ownerId:'athlete',status:'ready'},'account:athlete':{id:'athlete',verified:true}};
 return {config:{mailEnabled},repo:{read:async key=>records[key]},deliver,academy:{getJob:async()=>({job:{status:'ready'}}),advance}};
}
async function invoke(runtime,lane){const out={};await createScheduledHandler({env,getRuntime:()=>runtime,lane})({method:'GET',headers:{authorization:'Bearer '+secret}},{setHeader(){},status(code){out.status=code;return this;},json(body){out.body=body;}});return out;}
test('native cron authentication requires a strong CRON_SECRET and gives it precedence',()=>{
 const fallback='synthetic-fallback-secret-1234567890',cron='synthetic-native-cron-secret-123456789';
 assert.doesNotThrow(()=>workerAuthorized({ATHLETE_ACADEMY_WORKER_ENABLED:'1',CRON_SECRET:cron},`Bearer ${cron}`));
 assert.throws(()=>workerAuthorized({ATHLETE_ACADEMY_WORKER_ENABLED:'1'},undefined),/WORKER_AUTH_REQUIRED/);
 assert.throws(()=>workerAuthorized({ATHLETE_ACADEMY_WORKER_ENABLED:'1',CRON_SECRET:'too-short'},'Bearer too-short'),/WORKER_AUTH_REQUIRED/);
 assert.throws(()=>workerAuthorized({ATHLETE_ACADEMY_WORKER_ENABLED:'1',CRON_SECRET:cron},'Bearer wrong'),/WORKER_AUTH_REQUIRED/);
 const both={ATHLETE_ACADEMY_WORKER_ENABLED:'1',CRON_SECRET:cron,ATHLETE_ACADEMY_WORKER_SECRET:fallback};
 assert.doesNotThrow(()=>workerAuthorized(both,`Bearer ${cron}`));
 assert.throws(()=>workerAuthorized(both,`Bearer ${fallback}`),/WORKER_AUTH_REQUIRED/);
 assert.throws(()=>workerAuthorized({...both,CRON_SECRET:''},`Bearer ${fallback}`),/WORKER_AUTH_REQUIRED/);
});
test('Vercel declares two separate one-minute Academy cron paths',async()=>{
 const config=JSON.parse(await readFile(new URL('../vercel.json',import.meta.url),'utf8'));
 assert.deepEqual(config.crons,[
  {path:'/api/athlete/academy-worker',schedule:'* * * * *'},
  {path:'/api/athlete/academy-mail-worker',schedule:'* * * * *'},
 ]);
 assert.equal(new Set(config.crons.map(cron=>cron.path)).size,2);
});
test('paused mail with pending outbox cannot block an independently requested assessment',async()=>{
 let calls=0;const runtime=fakeRuntime({mailEnabled:false,advance:async()=>{calls++;return {job:{status:'ready'}};}});
 assert.deepEqual((await invoke(runtime,'mail')).body,{ok:true,processed:0,paused:true});
 assert.equal((await invoke(runtime,'assessments')).body.advanced,1);assert.equal(calls,1);
});
test('assessment starts and completes while mail delivery is still unresolved',async()=>{
 let releaseMail,mailStarted,assessmentStarted=false,mailFinished=false;
 const started=new Promise(resolve=>{mailStarted=resolve;});const mailGate=new Promise(resolve=>{releaseMail=resolve;});
 const runtime=fakeRuntime({deliver:async()=>{mailStarted();await mailGate;mailFinished=true;return {status:'sent'};},advance:async()=>{assessmentStarted=true;return {job:{status:'completed'}};}});
 const mail=invoke(runtime,'mail');await started;
 const assessment=await invoke(runtime,'assessments');assert.equal(assessment.status,200);assert.equal(assessment.body.status,'completed');assert.equal(assessmentStarted,true);assert.equal(mailFinished,false);
 releaseMail();assert.equal((await mail).body.processed,1);
});
