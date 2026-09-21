import fs from 'node:fs/promises';
import Redis from 'ioredis';
import {createRedisRepository} from '../../server/athleteAcademyV1/repository.js';
const redis=new Redis('redis://127.0.0.1:6394',{maxRetriesPerRequest:0,enableOfflineQueue:false});await new Promise((r,j)=>{redis.once('ready',r);redis.once('error',j);});
const repo=createRedisRepository({redis,prefix:'more:athlete-academy:{test-founder-review-v1}'});
try{const id=process.argv[2];if(!/^[a-f0-9-]{36}$/.test(id||''))throw Error('JOB_REQUIRED');const job=await repo.read(`job:${id}`);if((job?.input?.subject?.synthetic??job?.input?.source?.synthetic)!==true)throw Error('SYNTHETIC_ONLY');await fs.writeFile('../evidence/inspect-job-'+id+'.json',JSON.stringify(job,null,2),{mode:0o600});const latest=await repo.read(`evidence:${id}:${job.attempt}:result`);await fs.writeFile('../evidence/inspect-result-'+id+'.json',JSON.stringify(latest,null,2),{mode:0o600});console.log(JSON.stringify({status:job.status,error:job.errorCode,records:Object.keys(job.records),audit:job.records['independent-source-audit']?.output,latest:latest?.output},null,2));}finally{await redis.quit();}
