// Export only the two explicitly fictional local acceptance subjects, never a hosted namespace.
import fs from 'node:fs/promises';
import path from 'node:path';
import Redis from 'ioredis';
import {createRedisRepository,digest,requireValue} from '../../server/athleteAcademyV1/repository.js';
const redis=new Redis('redis://127.0.0.1:6394',{maxRetriesPerRequest:0,enableOfflineQueue:false});
await new Promise((resolve,reject)=>{redis.once('ready',resolve);redis.once('error',reject);});
const repo=createRedisRepository({redis,prefix:'more:athlete-academy:{test-founder-review-v1}'}),registry=[];
try{
 for(const email of ['alex-review@test.invalid','dana-review@test.invalid']){
  const ref=await repo.read('email:'+digest(email)),account=ref?await repo.read('account:'+ref.id):null;
  requireValue(account&&account.email===email,'SYNTHETIC_ACCOUNT_REQUIRED');
  const dossier=await repo.read('dossier:'+account.mm);requireValue(dossier?.synthetic===true,'SYNTHETIC_ACCOUNT_REQUIRED');
  const dir=path.join('../evidence/synthetic-runs',account.mm);await fs.mkdir(dir,{recursive:true,mode:0o700});
  const write=(name,body)=>fs.writeFile(path.join(dir,name),JSON.stringify(body,null,2),{mode:0o600});
  await write('dossier.json',dossier);
  const reports={};
  for(const service of ['bos','apa']){
   const pointer=dossier.reports[service];if(!pointer)continue;
   const report=await repo.read(`report:${account.mm}:${service}:${pointer.currentVersionId}`);
   requireValue(report?.artifact?.synthetic===true,'SYNTHETIC_REPORT_REQUIRED');
   await write(service+'.json',{artifact:report.artifact,source:report.input.subject||report.input.source,versionId:pointer.currentVersionId});
   reports[service]={versionId:pointer.currentVersionId,artifactHash:pointer.artifactHash,bosVersionId:pointer.bosVersionId};
  }
  const coach=await repo.read(`coach:${account.mm}`);if(coach)await write('coach-latest.json',coach);
  const jobs=[];
  for(const summary of dossier.jobs){const j=await repo.read(`job:${summary.jobId}`);jobs.push({...summary,repairOf:j.repairOf||null,repairJobId:j.repairJobId||null,receipts:Object.entries(j.records).map(([stage,r])=>({stage,responseId:r.response_id,model:r.model,usage:r.usage,requestHash:r.request_sha256,outputHash:r.output_sha256}))});}
  await write('job-ledger.json',jobs);
  registry.push({synthetic:true,name:dossier.person.name,mm:account.mm,email,age:dossier.person.age,sport:dossier.person.sport,participation:dossier.participation.status,guardianAccepted:Boolean(dossier.participation.guardianId),reports,coach:coach?{status:coach.status,sourceBinding:coach.sourceBinding,messageCount:coach.messages.length,acceptedPlan:coach.plan?.title||null,confirmedPreferences:coach.learning?.length||0}:null,jobs:jobs.map(({receipts,...j})=>({...j,providerCalls:receipts.length}))});
 }
 await fs.writeFile('../evidence/SYNTHETIC_REGISTRY_FINAL.json',JSON.stringify({exportedAt:new Date().toISOString(),subjects:registry},null,2),{mode:0o600});
 console.log(JSON.stringify(registry.map(x=>({name:x.name,mm:x.mm,reports:Object.keys(x.reports),coach:x.coach?.status})),null,2));
}finally{await redis.quit();}
