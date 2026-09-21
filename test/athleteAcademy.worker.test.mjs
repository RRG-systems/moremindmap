import test from 'node:test';
import assert from 'node:assert/strict';
import {createScheduledHandler} from '../server/athleteAcademyV1/scheduled.js';
const secret='synthetic-worker-test-secret-123456789';
const env={ATHLETE_ACADEMY_WORKER_ENABLED:'1',ATHLETE_ACADEMY_WORKER_SECRET:secret};
function fakeRuntime({mailEnabled=true,deliver=async()=>{throw Error('must not send');},advance=async()=>({job:{status:'ready'}})}={}){
 const records={'queue:mail':{ids:['pending-mail']},'queue:assessments':{jobs:['ready-job']},'job:ready-job':{ownerId:'athlete',status:'ready'},'account:athlete':{id:'athlete',verified:true}};
 return {config:{mailEnabled},repo:{read:async key=>records[key]},deliver,academy:{getJob:async()=>({job:{status:'ready'}}),advance}};
}
async function invoke(runtime,lane){const out={};await createScheduledHandler({env,getRuntime:()=>runtime,lane})({method:'GET',headers:{authorization:'Bearer '+secret}},{setHeader(){},status(code){out.status=code;return this;},json(body){out.body=body;}});return out;}
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
