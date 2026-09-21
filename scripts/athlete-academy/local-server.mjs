import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import Redis from 'ioredis';
import {fileURLToPath} from 'node:url';
import {createAcademyRuntime} from '../../server/athleteAcademyV1/runtime.js';
import {runMailQueue} from '../../server/athleteAcademyV1/delivery.js';
import {runAssessmentQueue} from '../../server/athleteAcademyV1/worker.js';
import {digest} from '../../server/athleteAcademyV1/repository.js';
const campaign=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../..');
const mailbox=path.join(campaign,'local-mailbox');await fs.mkdir(mailbox,{recursive:true,mode:0o700});
const redis=new Redis('redis://127.0.0.1:6394',{maxRetriesPerRequest:0,enableOfflineQueue:false});await new Promise((resolve,reject)=>{redis.once('ready',resolve);redis.once('error',reject);});
const env={ATHLETE_ACADEMY_ENABLED:'1',ATHLETE_ACADEMY_ORIGIN:'http://127.0.0.1:5321',ATHLETE_ACADEMY_LOCAL_PREVIEW:'1',ATHLETE_ACADEMY_SYNTHETIC_PREVIEW:'1',ATHLETE_ACADEMY_MAIL_ENABLED:'1',ATHLETE_ACADEMY_PROVIDER_ENABLED:process.env.ATHLETE_ACADEMY_PROVIDER_ENABLED||'0',OPENAI_API_KEY:process.env.OPENAI_API_KEY,ATHLETE_ACADEMY_NAMESPACE:'more:athlete-academy:{test-founder-review-v1}',ATHLETE_ACADEMY_BEYOND_TODAY_CODE_SHA256:digest('darrendemo1')};
const rt=createAcademyRuntime({env,redis,mailTransport:async item=>{if(!item.email.endsWith('@test.invalid'))throw Error('LOCAL_SYNTHETIC_EMAIL_REQUIRED');await fs.writeFile(path.join(mailbox,item.id+'.json'),JSON.stringify(item,null,2),{flag:'wx',mode:0o600});return {status:'sent',receipt:'local-review-mailbox-only'};}});
const server=http.createServer(async(req,res)=>{if(req.url?.split('?')[0]!=='/api/athlete/academy'){res.writeHead(404);return res.end();}let bytes=0,chunks=[];try{for await(const c of req){bytes+=c.length;if(bytes>200000){res.writeHead(413);return res.end();}chunks.push(c);}req.body=bytes?JSON.parse(Buffer.concat(chunks).toString()):{};}catch{res.writeHead(400);return res.end();}const response={setHeader:(k,v)=>res.setHeader(k,v),status(code){res.statusCode=code;return this;},json(body){res.setHeader('Content-Type','application/json');res.end(JSON.stringify(body));}};await rt.handler(req,response);});
server.listen(5322,'127.0.0.1',()=>console.log('Athlete candidate API ready on local port 5322. Mail is captured locally. Generation '+(env.ATHLETE_ACADEMY_PROVIDER_ENABLED==='1'?'configured':'not connected')+'.'));

if(process.env.ATHLETE_ACADEMY_LOCAL_WORKER==='1'){
 for(const [lane,run] of [['mail',runMailQueue],['assessments',runAssessmentQueue]]){
  let running=false;
  setInterval(async()=>{if(running)return;running=true;try{await run(rt);}catch(e){console.error(JSON.stringify({component:'local-worker',lane,code:/^[A-Z_]+$/.test(e.code||'')?e.code:'WORKER_UNAVAILABLE'}));}finally{running=false;}},10000).unref();
 }
}
