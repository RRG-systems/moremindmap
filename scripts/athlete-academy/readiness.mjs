// Print binding presence and policy checks only. Never print binding values.
import process from 'node:process';
const e=process.env;
const checks={
  frontend_build_activation:e.VITE_ATHLETE_ACADEMY_V1_ENABLED==='true',
  api_activation:e.ATHLETE_ACADEMY_ENABLED==='1',
  exact_https_origin:(()=>{try{const u=new URL(e.ATHLETE_ACADEMY_ORIGIN);return u.protocol==='https:'&&u.origin===e.ATHLETE_ACADEMY_ORIGIN&&!u.username&&!u.password;}catch{return false;}})(),
  tls_redis:(e.ATHLETE_ACADEMY_REDIS_URL||e.REDIS_URL||'').startsWith('rediss://'),
  tls_ca:/-----BEGIN CERTIFICATE-----/.test(e.ATHLETE_ACADEMY_REDIS_CA_PEM||''),
  canonical_namespace:!e.ATHLETE_ACADEMY_NAMESPACE||e.ATHLETE_ACADEMY_NAMESPACE==='more:athlete-academy:{v1}',
  local_flags_absent:e.ATHLETE_ACADEMY_LOCAL_PREVIEW!=='1'&&e.ATHLETE_ACADEMY_SYNTHETIC_PREVIEW!=='1',
  institution_code_hash:/^[a-f0-9]{64}$/.test(e.ATHLETE_ACADEMY_BEYOND_TODAY_CODE_SHA256||''),
  generation_binding:e.ATHLETE_ACADEMY_PROVIDER_ENABLED==='1'&&Boolean(e.OPENAI_API_KEY),
  email_binding:e.ATHLETE_ACADEMY_MAIL_ENABLED==='1'&&Boolean(e.RESEND_API_KEY&&e.ATHLETE_ACADEMY_MAIL_FROM),
  participation_version:Boolean(e.ATHLETE_ACADEMY_REVIEWED_POLICY_VERSION),
  youth_activation:e.ATHLETE_ACADEMY_REAL_YOUTH_ENABLED==='1',
  worker_binding:e.ATHLETE_ACADEMY_WORKER_ENABLED==='1'&&(e.ATHLETE_ACADEMY_WORKER_SECRET||e.CRON_SECRET||'').length>=32,
};
console.log(JSON.stringify({configurationReady:Object.values(checks).every(Boolean),checks,proves:'Configuration presence only; hosted storage, mail, scheduler, browser and synthetic acceptance are separate.'},null,2));
if(!Object.values(checks).every(Boolean))process.exitCode=1;
