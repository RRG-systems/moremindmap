import test from 'node:test';
import assert from 'node:assert/strict';

const response=(status,body)=>({ok:status>=200&&status<300,status,async json(){return body;}});

test('a stale forgot-password CSRF token is re-bootstrapped and retried exactly once',async t=>{
 const originalFetch=globalThis.fetch;
 const requests=[];
 const replies=[
  response(200,{ok:true,csrfToken:'csrf-old'}),
  response(403,{ok:false,error:{code:'SESSION_OR_FORM_EXPIRED'}}),
  response(200,{ok:true,csrfToken:'csrf-current'}),
  response(200,{ok:true,requested:true})
 ];
 globalThis.fetch=async (url,options={})=>{requests.push({url,options});return replies.shift();};
 t.after(()=>{globalThis.fetch=originalFetch;});
 const {call}=await import(`../src/athleteAcademyV1/transport.js?stale=${Date.now()}`);
 const result=await call('request_password_reset',{email:'fictional@test.invalid'});
 assert.equal(result.requested,true);
 assert.deepEqual(requests.map(x=>x.options.method||'GET'),['GET','POST','GET','POST']);
 assert.equal(requests[1].options.headers['X-CSRF-Token'],'csrf-old');
 assert.equal(requests[3].options.headers['X-CSRF-Token'],'csrf-current');
 const first=JSON.parse(requests[1].options.body),retry=JSON.parse(requests[3].options.body);
 assert.equal(retry.requestId,first.requestId,'the safe retry preserves request identity');
 assert.deepEqual(retry,first,'the safe retry preserves the exact request body');
 assert.equal(replies.length,0);
});

test('a repeated CSRF rejection is surfaced without a retry loop',async t=>{
 const originalFetch=globalThis.fetch;
 const requests=[];
 const replies=[
  response(200,{ok:true,csrfToken:'csrf-old'}),
  response(403,{ok:false,error:{code:'SESSION_OR_FORM_EXPIRED'}}),
  response(200,{ok:true,csrfToken:'csrf-current'}),
  response(403,{ok:false,error:{code:'SESSION_OR_FORM_EXPIRED'}})
 ];
 globalThis.fetch=async (url,options={})=>{requests.push({url,options});return replies.shift();};
 t.after(()=>{globalThis.fetch=originalFetch;});
 const {call}=await import(`../src/athleteAcademyV1/transport.js?bounded=${Date.now()}`);
 await assert.rejects(call('reset_password',{token:'fictional-token',password:'fictional-password'}),error=>error.code==='SESSION_OR_FORM_EXPIRED');
 assert.deepEqual(requests.map(x=>x.options.method||'GET'),['GET','POST','GET','POST']);
 assert.equal(replies.length,0);
});

test('protected actions are not replayed after the browser session changes',async t=>{
 const originalFetch=globalThis.fetch;
 const requests=[];
 const replies=[
  response(200,{ok:true,csrfToken:'csrf-old'}),
  response(403,{ok:false,error:{code:'SESSION_OR_FORM_EXPIRED'}})
 ];
 globalThis.fetch=async (url,options={})=>{requests.push({url,options});return replies.shift();};
 t.after(()=>{globalThis.fetch=originalFetch;});
 const {call}=await import(`../src/athleteAcademyV1/transport.js?protected=${Date.now()}`);
 await assert.rejects(call('accept_participation',{accepted:true,policyVersion:'candidate-review-v1'}),error=>error.code==='SESSION_OR_FORM_EXPIRED');
 assert.deepEqual(requests.map(x=>x.options.method||'GET'),['GET','POST']);
 assert.equal(replies.length,0);
});

test('unrelated API failures are not retried',async t=>{
 const originalFetch=globalThis.fetch;
 const requests=[];
 const replies=[
  response(200,{ok:true,csrfToken:'csrf-current'}),
  response(409,{ok:false,error:{code:'STATE_CHANGED_RELOAD'}})
 ];
 globalThis.fetch=async (url,options={})=>{requests.push({url,options});return replies.shift();};
 t.after(()=>{globalThis.fetch=originalFetch;});
 const {call}=await import(`../src/athleteAcademyV1/transport.js?unrelated=${Date.now()}`);
 await assert.rejects(call('save_intake',{mm:'MM-TEST',service:'bos',answers:[],revision:1}),error=>error.code==='STATE_CHANGED_RELOAD');
 assert.deepEqual(requests.map(x=>x.options.method||'GET'),['GET','POST']);
 assert.equal(replies.length,0);
});

test('network failures are surfaced without replay',async t=>{
 const originalFetch=globalThis.fetch;
 const requests=[];
 globalThis.fetch=async (url,options={})=>{requests.push({url,options});if(requests.length===1)return response(200,{ok:true,csrfToken:'csrf-current'});throw new TypeError('synthetic network interruption');};
 t.after(()=>{globalThis.fetch=originalFetch;});
 const {call}=await import(`../src/athleteAcademyV1/transport.js?network=${Date.now()}`);
 await assert.rejects(call('reset_password',{token:'fictional-token',password:'fictional-password'}),/synthetic network interruption/);
 assert.deepEqual(requests.map(x=>x.options.method||'GET'),['GET','POST']);
});
