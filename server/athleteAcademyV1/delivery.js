import { randomUUID } from 'node:crypto';
import { requireValue } from './repository.js';
export function renderMail(m,origin){
 const routes={verify_email:'verify',reset_password:'reset',guardian_invite:'guardian'};
 requireValue(routes[m.kind]&&/^[a-f0-9]{64}$/.test(m.token),'MAIL_PAYLOAD_INVALID');
 const link=`${origin}/athlete/workspace/index.html#${routes[m.kind]}?token=${m.token}`;
 const title={verify_email:'Confirm your MORE Athlete email',reset_password:'Reset your MORE Athlete password',guardian_invite:'Review a MORE Athlete guardian invitation'}[m.kind];
 return {subject:title,text:`${title}\n\n${link}\n\nThis private, single-use link expires at ${new Date(m.expiresAt).toISOString()}. If you did not expect it, you can ignore this email.`};
}
export function createDelivery({repo,config,transport,now=Date.now}){return async id=>{
 if(!id)return null;
 requireValue(config.mailEnabled&&transport,'EMAIL_SERVICE_UNAVAILABLE',503);
 const key=`mail:${id}`,attempt=randomUUID(),qk='queue:mail',pqk='queue:mail:paused-youth';
 const queued=await repo.read(key);
 // A queued guardian message from an earlier flag-on runtime remains durable,
 // but the adult-only runtime must not send or consume it.
 if(queued?.kind==='guardian_invite'&&!config.realYouthEnabled)return repo.transact([key,qk,pqk],s=>{const q=s[qk]||{ids:[]},paused=s[pqk]||{ids:[]};return {writes:{[qk]:{ids:q.ids.filter(x=>x!==id)},[pqk]:{ids:[...new Set([...paused.ids,id])]}},result:{status:'paused'}};});
 const claimed=await repo.transact([key,qk],s=>{
  const m=s[key],q=s[qk]||{ids:[]};
  const close=status=>({writes:{...(m?{[key]:{...m,status}}:{}),[qk]:{ids:q.ids.filter(x=>x!==id)}},result:{status}});
  if(!m)return close('missing');
  if(m.status==='sending'&&m.lease<now())return close('unknown');
  if(m.status==='sending')return {writes:{},result:{status:'sending'}};
  if(m.status!=='pending')return close(m.status);
  if(m.expiresAt<=now())return close('expired');
  m.status='sending';m.attempt=attempt;m.lease=now()+60000;m.attempts++;
  return {writes:{[key]:m},result:{status:'claimed',item:m}};
 });
 if(claimed.status!=='claimed')return claimed;
 let outcome;
 try{outcome=await transport({...claimed.item,...renderMail(claimed.item,config.origin)});}catch{outcome={status:'unknown'};}
 if(!['sent','rejected','unknown'].includes(outcome?.status))outcome={status:'unknown'};
 return repo.transact([key,qk],s=>{
  const m=s[key];if(m.attempt!==attempt)return {writes:{},result:{status:'unknown'}};
  m.status=outcome.status;m.receipt=outcome.receipt||null;if(m.status==='sent')m.token=null;
  return {writes:{[key]:m,[qk]:{ids:(s[qk]?.ids||[]).filter(x=>x!==id)}},result:{status:m.status}};
 });
};}
export async function runMailQueue(runtime){
 if(!runtime.config.mailEnabled)return {processed:0,paused:true};
 if(runtime.config.realYouthEnabled)await runtime.repo.transact(['queue:mail','queue:mail:paused-youth'],s=>{const active=s['queue:mail']||{ids:[]},paused=s['queue:mail:paused-youth']||{ids:[]};return {writes:paused.ids.length?{'queue:mail':{ids:[...new Set([...active.ids,...paused.ids])]},'queue:mail:paused-youth':{ids:[]}}:{},result:true};});
 const queue=await runtime.repo.read('queue:mail');let processed=0,pausedCount=0;
 // Paused guardian records do not consume the 20-message delivery budget. Scan
 // the bounded durable queue so eligible verification/recovery mail behind them
 // cannot be starved; each paused ID is atomically moved out of the active queue.
 for(const id of (queue?.ids||[])){if(processed>=20)break;const result=await runtime.deliver(id);if(result?.status==='paused')pausedCount++;else processed++;}
 return {processed,...(pausedCount?{paused:true,pausedCount}:{})};
}
export function resendTransport({key,from,fetchImpl=fetch}){return async m=>{requireValue(key&&from,'EMAIL_SERVICE_UNAVAILABLE',503);const r=await fetchImpl('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json','Idempotency-Key':m.id},body:JSON.stringify({from,to:[m.email],subject:m.subject,text:m.text}),signal:AbortSignal.timeout(20000)});const body=await r.json().catch(()=>null);return r.ok&&body?.id?{status:'sent',receipt:body.id}:{status:r.status>=400&&r.status<500?'rejected':'unknown'};};}
