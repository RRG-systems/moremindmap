import process from 'node:process';
import Redis from 'ioredis';
import OpenAI from 'openai';
import {academyConfig} from './config.js';
import {createRedisRepository,requireValue} from './repository.js';
import {createAuth} from './auth.js';
import {createAcademyService} from './service.js';
import {createCoachingService} from './coaching/service.js';
import {createDelivery,resendTransport} from './delivery.js';
import {createAcademyHandler} from './handler.js';
export function createAcademyRuntime({env,redis,assessmentTransport,coachTransport,mailTransport,now=Date.now}){
 const config=academyConfig(env),repo=createRedisRepository({redis,prefix:env.ATHLETE_ACADEMY_NAMESPACE||undefined});
 // Credentials are server bindings only. No CLI lookup, broad env export or browser key.
 let client;const ai=()=>{requireValue(env.OPENAI_API_KEY,'GENERATION_NOT_CONFIGURED',503);return client||=new OpenAI({apiKey:env.OPENAI_API_KEY,maxRetries:0,timeout:720000});};
 const transport=assessmentTransport|| (config.providerEnabled&&env.OPENAI_API_KEY?request=>ai().responses.create(request,{maxRetries:0,signal:AbortSignal.timeout(720000)}):null);
 const coach=coachTransport||(config.providerEnabled&&env.OPENAI_API_KEY?(request,options)=>ai().responses.create(request,{...options,maxRetries:0}):null);
 const mailKey=env.RESEND_API_KEY||env.MOREMINDMAP_SERVER_ONLY_PROFILE_OWNERSHIP_RESEND_API_KEY;
 const mailFrom=env.ATHLETE_ACADEMY_MAIL_FROM||env.PUBLIC_PROFILE_OWNERSHIP_EMAIL_FROM;
 const mail=mailTransport||(config.mailEnabled&&mailKey&&mailFrom?resendTransport({key:mailKey,from:mailFrom}):null);
 config.providerEnabled=Boolean(config.providerEnabled&&transport&&coach);config.mailEnabled=Boolean(config.mailEnabled&&mail);
 const auth=createAuth({repo,config,now}),academy=createAcademyService({repo,config,auth,transport,now}),coaching=createCoachingService({repo,config,academy,transport:coach,now}),deliver=createDelivery({repo,config,transport:mail,now});
 return {repo,config,auth,academy,coaching,deliver,ready:()=>awaitAcademyRedisReady(redis),handler:createAcademyHandler({config,auth,academy,coaching,deliver})};
}
export function createAcademyRedis(url,{ca,lazyConnect=false}={}){const parsed=new URL(url);let tls;if(parsed.protocol==='rediss:'){requireValue(typeof ca==='string'&&ca.includes('-----BEGIN CERTIFICATE-----'),'TLS_CA_REQUIRED',503);tls={ca};}const redis=new Redis(url,{maxRetriesPerRequest:0,enableOfflineQueue:false,lazyConnect,autoResendUnfulfilledCommands:false,retryStrategy:attempt=>Math.min(100*attempt,2000),...(tls?{tls}:{})});redis.on('error',()=>{});return redis;}
export async function awaitAcademyRedisReady(redis,{timeoutMs=15000}={}){
 if(redis?.status==='ready')return;
 requireValue(redis&&typeof redis.once==='function','ACADEMY_STORAGE_REQUIRED',503);
 let timeout;
 try{
  await Promise.race([
   redis.status==='wait'&&typeof redis.connect==='function'?redis.connect():new Promise((resolve,reject)=>{redis.once('ready',resolve);redis.once('error',reject);redis.once('end',()=>reject(Error('REDIS_ENDED')));} ),
   new Promise((_,reject)=>{timeout=setTimeout(()=>reject(Error('REDIS_READY_TIMEOUT')),timeoutMs);}),
  ]);
  requireValue(redis.status==='ready','SERVICE_UNAVAILABLE',503);
 }catch{throw Object.assign(new Error('SERVICE_UNAVAILABLE'),{code:'SERVICE_UNAVAILABLE',status:503});}
 finally{clearTimeout(timeout);}
}
let runtime;
export function getAcademyRuntime(env=process.env){if(runtime)return runtime;requireValue(env.ATHLETE_ACADEMY_ENABLED==='1','ATHLETE_ACADEMY_NOT_ACTIVE',503);const url=env.ATHLETE_ACADEMY_REDIS_URL||env.REDIS_URL;requireValue(url,'ACADEMY_STORAGE_REQUIRED',503);const parsed=new URL(url);requireValue(parsed.protocol==='rediss:'||(env.ATHLETE_ACADEMY_LOCAL_PREVIEW==='1'&&['127.0.0.1','localhost'].includes(parsed.hostname)),'TLS_STORAGE_REQUIRED',503);const redis=createAcademyRedis(url,{ca:env.ATHLETE_ACADEMY_REDIS_CA_PEM,lazyConnect:true});runtime=createAcademyRuntime({env,redis});return runtime;}
