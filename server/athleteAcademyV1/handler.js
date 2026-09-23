import {requireValue} from './repository.js';
import {INSTITUTIONS,resolveInstitution} from './config.js';
import {publicAccount} from './auth.js';
const COOKIE='more_athlete_academy';
export function createAcademyHandler({config,auth,academy,coaching,deliver}){
 const cookie=raw=>`${COOKIE}=${raw}; Path=/api/athlete/academy; HttpOnly; SameSite=Strict; Max-Age=604800${config.allowInsecureLocalhost?'':'; Secure'}`;
 return async function handler(req,res,{defer=()=>{}}={}){
  res.setHeader('Cache-Control','no-store, private');res.setHeader('Vary','Cookie');res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','no-referrer');
  try{
   requireValue(config.enabled,'ATHLETE_ACADEMY_NOT_ACTIVE',503);requireValue(config.origin,'ACADEMY_ORIGIN_NOT_CONFIGURED',503);
   requireValue(['GET','POST'].includes(req.method),'METHOD_NOT_ALLOWED',405);
   const fetchSite=req.headers['sec-fetch-site'];requireValue(!fetchSite||['same-origin','none'].includes(fetchSite),'SAME_ORIGIN_REQUIRED',403);
   if(req.method==='POST')requireValue(config.allowedOrigins.has(req.headers.origin),'SAME_ORIGIN_REQUIRED',403);
   const raw=String(req.headers.cookie||'').split(';').map(x=>x.trim()).find(x=>x.startsWith(COOKIE+'='))?.slice(COOKIE.length+1);let s=await auth.session(raw);
   if(req.method==='GET'){
    if(!s){await auth.limited('bootstrap:'+String(req.headers['x-forwarded-for']||req.socket?.remoteAddress||'unknown').split(',')[0],100,3600000);const created=await auth.createSession();s=created.session;res.setHeader('Set-Cookie',cookie(created.raw));}
    let athletes=[];if(s.account){const {dossier}=await academy.getDossier(s.account,{mm:s.account.mm});athletes=[{mm:dossier.mm,name:dossier.person.name}];}
    return res.status(200).json({ok:true,csrfToken:s.csrf,account:publicAccount(s.account),athletes,institutions:INSTITUTIONS,cohort:config.cohort,policyVersion:config.reviewedPolicyVersion||'candidate-review-v1',capabilities:{generation:config.providerEnabled,email:config.mailEnabled,syntheticPreview:config.syntheticPreview,realYouth:config.realYouthEnabled}});
   }
   requireValue(s&&req.headers['x-csrf-token']===s.csrf,'SESSION_OR_FORM_EXPIRED',403);requireValue(String(req.headers['content-type']||'').includes('application/json'),'JSON_REQUIRED',415);
   const b=req.body;requireValue(b&&typeof b==='object'&&!Array.isArray(b)&&JSON.stringify(b).length<=200000,'REQUEST_INVALID',413);
   await auth.limited('request:'+String(req.headers['x-forwarded-for']||req.socket?.remoteAddress||'unknown').split(',')[0],300,60000);
   let result;const a=s.account;if(['signup','request_email_verification','request_password_reset'].includes(b.action))await auth.limited(`public-mail:${String(req.headers['x-forwarded-for']||req.socket?.remoteAddress||'unknown').split(',')[0]}`,20,3600000);
   if(b.action==='check_institution_code'){await auth.limited('code:'+String(req.socket?.remoteAddress||req.headers['x-forwarded-for']||'unknown'),20);resolveInstitution(config,b);result={institution:INSTITUTIONS[0]};}
   else if(b.action==='signup')result=await auth.signup(b);
   else if(b.action==='verify_email')result=await auth.verifyEmail(b.token);
   else if(b.action==='login'){const login=await auth.login(b);await auth.revokeSession(raw);res.setHeader('Set-Cookie',cookie(login.raw));result={account:publicAccount(login.session.account),csrfToken:login.session.csrf};}
   else if(b.action==='request_email_verification')result=await auth.requestVerification(b);
   else if(b.action==='request_password_reset')result=await auth.requestReset(b);
   else if(b.action==='reset_password')result=await auth.resetPassword(b);
   else {
    requireValue(a?.verified,'SIGN_IN_REQUIRED',401);
    if(b.action==='logout'){await auth.logout(raw);res.setHeader('Set-Cookie',`${COOKIE}=; Path=/api/athlete/academy; HttpOnly; SameSite=Strict; Max-Age=0${config.allowInsecureLocalhost?'':'; Secure'}`);result={signedOut:true};}
    else if(b.action==='redeem_institution')result=await auth.redeem(a,b);
    else {
     const actions={get_dossier:academy.getDossier,accept_participation:academy.acceptParticipation,invite_guardian:academy.inviteGuardian,guardian_invitation:academy.guardianPreview,accept_guardian:academy.acceptGuardian,withdraw_participation:academy.withdraw,guardian_dashboard:academy.guardians,save_intake:academy.saveIntake,get_report:academy.getReport,start_assessment:academy.startAssessment,get_job:academy.getJob,advance_assessment:academy.advance,reconcile_assessment:academy.reconcile,abandon_assessment:academy.abandon,start_preserved_bos_recovery:academy.startPreservedBosRecovery,bos_feedback:academy.feedback,coach_bundle:coaching.bundle,coach_state:coaching.state,coach_action:coaching.action};
     requireValue(Object.hasOwn(actions,b.action),'ACTION_NOT_FOUND',404);result=await actions[b.action](a,b);
    }
   }
   const publicMail=['signup','request_email_verification','request_password_reset'].includes(b.action);
   if(publicMail){const {mailId,...safe}=result;result=safe;defer(Promise.resolve().then(()=>mailId?deliver(mailId):null).catch(()=>null));}
   else if(result?.mailId){const {mailId,...safe}=result;defer(Promise.resolve().then(()=>deliver(mailId)).catch(()=>null));result={...safe,delivery:'pending'};}
   return res.status(200).json({ok:true,...result});
  }catch(e){const code=/^[A-Z0-9_]+$/.test(e.code||e.message||'')?e.code||e.message:'SERVICE_UNAVAILABLE';return res.status(e.status||(['SERVICE_UNAVAILABLE','STORAGE_OUTCOME_UNKNOWN'].includes(code)?503:422)).json({ok:false,error:{code,message:code},requestId:req.body?.requestId||null});}
 };
}
