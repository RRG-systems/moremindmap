import {runMailQueue} from '../server/athleteAcademyV1/delivery.js';
import test from 'node:test';import assert from 'node:assert/strict';import {randomUUID} from 'node:crypto';import Redis from 'ioredis';
import {createAcademyRuntime} from '../server/athleteAcademyV1/runtime.js';import {digest} from '../server/athleteAcademyV1/repository.js';
const redis=new Redis('redis://127.0.0.1:6394',{maxRetriesPerRequest:0,enableOfflineQueue:false});await new Promise((r,j)=>{redis.once('ready',r);redis.once('error',j);});
const env={ATHLETE_ACADEMY_ENABLED:'1',ATHLETE_ACADEMY_ORIGIN:'http://127.0.0.1:5321',ATHLETE_ACADEMY_LOCAL_PREVIEW:'1',ATHLETE_ACADEMY_SYNTHETIC_PREVIEW:'1',ATHLETE_ACADEMY_MAIL_ENABLED:'1',ATHLETE_ACADEMY_NAMESPACE:`more:athlete-academy:{test-${randomUUID()}}`,ATHLETE_ACADEMY_BEYOND_TODAY_CODE_SHA256:digest('darrendemo1')};
const pending=[];
const mailbox=[],r=createAcademyRuntime({env,redis,mailTransport:async m=>{mailbox.push(m);return {status:'sent',receipt:'test-only'};}});
async function http({method='GET',body={},headers={}}={},runtime=r){const out={status:200,headers:{}};const res={setHeader(k,v){out.headers[k]=v;},status(c){out.status=c;return this;},json(b){out.body=b;return out;}};await runtime.handler({method,body,headers:{origin:env.ATHLETE_ACADEMY_ORIGIN,'sec-fetch-site':'same-origin','content-type':'application/json',...headers},socket:{remoteAddress:'127.0.0.1'}},res,{defer:p=>pending.push(p)});return out;}
let cookie,csrf,mm;
test('public directory has no account, MM, roster or code; private responses are no-store',async()=>{const x=await http();cookie=x.headers['Set-Cookie'].split(';')[0];csrf=x.body.csrfToken;assert.equal(x.status,200);assert.equal(x.body.account,null);assert.deepEqual(x.body.athletes,[]);assert.equal(x.body.institutions.length,2);assert.equal(JSON.stringify(x.body).includes('darrendemo1'),false);assert.equal(x.headers['Cache-Control'],'no-store, private');assert.match(x.headers['Set-Cookie'],/HttpOnly; SameSite=Strict/);});
test('cross-origin, missing CSRF and forged MM requests are denied',async()=>{const b={action:'check_institution_code',institutionId:'beyond-today-sports-institute',code:'darrendemo1'};assert.equal((await http({method:'POST',body:b,headers:{cookie,'x-csrf-token':csrf,origin:'https://attacker.invalid'}})).status,403);assert.equal((await http({method:'POST',body:b,headers:{cookie}})).status,403);assert.equal((await http({method:'POST',body:{action:'get_report',service:'bos',mm:'MM-20260921-DEADBEEF'},headers:{cookie,'x-csrf-token':csrf}})).status,401);});
test('signup sends no password, verification token or private mail payload back to browser',async()=>{const x=await http({method:'POST',headers:{cookie,'x-csrf-token':csrf},body:{action:'signup',email:'browser@test.invalid',password:'Fictional-browser-password',displayName:'Browser Test',dateOfBirth:'2000-01-01',sport:'Soccer',region:'US-CA',institutionId:'beyond-today-sports-institute',institutionCode:'darrendemo1'}});assert.equal(x.status,200);assert.equal(x.body.delivery,undefined);await Promise.all(pending.splice(0));assert.equal(mailbox.length,1);assert.equal(JSON.stringify(x.body).includes(mailbox[0].token),false);assert.equal(x.body.mailId,undefined);await r.auth.verifyEmail(mailbox[0].token);});
test('sign-in rotates session and binds the dossier to the authenticated account',async()=>{const x=await http({method:'POST',headers:{cookie,'x-csrf-token':csrf},body:{action:'login',email:'browser@test.invalid',password:'Fictional-browser-password'}});assert.equal(x.status,200);const previous=cookie;cookie=x.headers['Set-Cookie'].split(';')[0];csrf=x.body.csrfToken;mm=x.body.account.mm;assert.notEqual(cookie,previous);const d=await http({method:'POST',headers:{cookie,'x-csrf-token':csrf},body:{action:'get_dossier',requestId:randomUUID(),mm}});assert.equal(d.status,200);assert.equal(d.body.dossier.mm,mm);assert.equal(d.body.dossier.ownerId,undefined);assert.equal(d.body.dossier.events,undefined);assert.equal(JSON.stringify(d.body).includes('password'),false);});
test('disabled deployment flag fails closed before any account action',async()=>{const disabled=createAcademyRuntime({env:{...env,ATHLETE_ACADEMY_ENABLED:'0'},redis});let code,body;await disabled.handler({method:'GET',headers:{}},{setHeader(){},status(c){code=c;return this;},json(b){body=b;}});assert.equal(code,503);assert.equal(body.error.code,'ATHLETE_ACADEMY_NOT_ACTIVE');});
test('logout makes the old private session unusable',async()=>{assert.equal((await http({method:'POST',headers:{cookie,'x-csrf-token':csrf},body:{action:'logout'}})).status,200);assert.equal((await http({method:'POST',headers:{cookie,'x-csrf-token':csrf},body:{action:'get_dossier',mm}})).status,403);});
test('public recovery and duplicate signup have the same response for known and unknown addresses',async()=>{
 const boot=await http(),headers={cookie:boot.headers['Set-Cookie'].split(';')[0],'x-csrf-token':boot.body.csrfToken};
 for(const action of ['request_email_verification','request_password_reset']){
  const known=await http({method:'POST',headers,body:{action,email:'browser@test.invalid'}}),unknown=await http({method:'POST',headers,body:{action,email:'absent@test.invalid'}});
  assert.equal(known.status,unknown.status);assert.deepEqual(known.body,unknown.body);assert.equal(known.body.delivery,undefined);
 }
 const existing=await http({method:'POST',headers,body:{action:'signup',email:'browser@test.invalid',password:'Fictional-browser-password',displayName:'Browser Test',dateOfBirth:'2000-01-01',sport:'Soccer',region:'US-CA'}});
 assert.equal(existing.status,200);assert.deepEqual(existing.body,{ok:true,verificationRequired:true});
});
test('public acknowledgements never wait for a matching email provider; outbox survives interruption',async()=>{
 let release;const transportGate=new Promise(resolve=>{release=resolve;});let calls=0;
 const isolated=createAcademyRuntime({env:{...env,ATHLETE_ACADEMY_NAMESPACE:`more:athlete-academy:{test-${randomUUID()}}`},redis,mailTransport:async()=>{calls++;await transportGate;return {status:'rejected'};}});
 const signup=await isolated.auth.signup({email:'timing@test.invalid',password:'Fictional-browser-password',displayName:'Timing Check',dateOfBirth:'2000-01-01',sport:'Soccer',region:'US-CA'});
 const boot=await http({},isolated),headers={cookie:boot.headers['Set-Cookie'].split(';')[0],'x-csrf-token':boot.body.csrfToken};
 let timer;const sentinel=new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('HTTP waited for remote delivery')),1500);});
 try{
  const known=await Promise.race([http({method:'POST',headers,body:{action:'request_password_reset',email:'timing@test.invalid'}},isolated),sentinel]);
  const unknown=await http({method:'POST',headers,body:{action:'request_password_reset',email:'missing@test.invalid'}},isolated);
  assert.deepEqual(known.body,unknown.body);assert.equal(known.status,200);
  assert.ok((await isolated.repo.read('queue:mail')).ids.includes(signup.mailId),'pending registration is durable before dispatch');
 }finally{clearTimeout(timer);release();await Promise.all(pending.splice(0));}
 await runMailQueue(isolated);assert.equal((await isolated.repo.read('queue:mail')).ids.length,0);const before=calls;await runMailQueue(isolated);assert.equal(calls,before,'terminal rejection is never automatically resent');
});
test.after(async()=>redis.quit());
