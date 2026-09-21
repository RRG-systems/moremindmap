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
 const mail=mailTransport||(config.mailEnabled&&env.RESEND_API_KEY&&env.ATHLETE_ACADEMY_MAIL_FROM?resendTransport({key:env.RESEND_API_KEY,from:env.ATHLETE_ACADEMY_MAIL_FROM}):null);
 config.providerEnabled=Boolean(config.providerEnabled&&transport&&coach);config.mailEnabled=Boolean(config.mailEnabled&&mail);
 const auth=createAuth({repo,config,now}),academy=createAcademyService({repo,config,auth,transport,now}),coaching=createCoachingService({repo,config,academy,transport:coach,now}),deliver=createDelivery({repo,config,transport:mail,now});
 return {repo,config,auth,academy,coaching,deliver,handler:createAcademyHandler({config,auth,academy,coaching,deliver})};
}
export function createAcademyRedis(url){const redis=new Redis(url,{maxRetriesPerRequest:0,enableOfflineQueue:false,lazyConnect:false,autoResendUnfulfilledCommands:false,retryStrategy:attempt=>Math.min(100*attempt,2000)});redis.on('error',()=>{});return redis;}
let runtime;
export function getAcademyRuntime(env=process.env){if(runtime)return runtime;requireValue(env.ATHLETE_ACADEMY_ENABLED==='1','ATHLETE_ACADEMY_NOT_ACTIVE',503);const url=env.ATHLETE_ACADEMY_REDIS_URL||env.REDIS_URL;requireValue(url,'ACADEMY_STORAGE_REQUIRED',503);const parsed=new URL(url);requireValue(parsed.protocol==='rediss:'||(env.ATHLETE_ACADEMY_LOCAL_PREVIEW==='1'&&['127.0.0.1','localhost'].includes(parsed.hostname)),'TLS_STORAGE_REQUIRED',503);const redis=createAcademyRedis(url);runtime=createAcademyRuntime({env,redis});return runtime;}
