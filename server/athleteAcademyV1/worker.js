import { randomUUID, timingSafeEqual } from 'node:crypto';
import { Buffer } from 'node:buffer';
import { digest, requireValue } from './repository.js';

// A worker continues only an assessment already requested by its verified owner.
// Each stage still checks current participation, source versions and the durable claim.
export async function runAssessmentQueue(runtime) {
  const { repo, academy } = runtime;
  const queue = await repo.read('queue:assessments');
  let waiting = 0;
  for (const id of queue?.jobs || []) {
    const job = await repo.read(`job:${id}`);
    if (!job || ['completed', 'failed', 'abandoned'].includes(job.status)) continue;
    waiting++;
    const account = await repo.read(`account:${job.ownerId}`);
    if (!account?.verified) continue;
    try {
      const current = (await academy.getJob(account, { jobId: id })).job;
      if (current.status === 'ready') {
        const result = await academy.advance(account, { requestId: randomUUID(), jobId: id });
        return { advanced: 1, status: result.job.status };
      }
      if (current.status === 'unknown') {
        // Saved completed bytes may be recovered; an unknown provider call is never repeated.
        try {
          const result = await academy.reconcile(account, { requestId: randomUUID(), jobId: id });
          return { recovered: 1, status: result.job.status };
        } catch (e) {
          if (e.code !== 'RESULT_NOT_YET_RECOVERABLE') throw e;
        }
      }
    } catch (e) {
      if (['JOB_NOT_READY', 'ACADEMY_ACCESS_REQUIRED', 'PARTICIPATION_WITHDRAWN', 'PARTICIPATION_REVIEW_REQUIRED', 'GUARDIAN_REQUIRED', 'YOUTH_ENROLLMENT_NOT_ACTIVE', 'ACCOUNT_INACTIVE', 'PILOT_17_PLUS'].includes(e.code)) {
        const key=`queue-pause:${id}`;
        await repo.transact([key], s=>({writes:{[key]:{jobId:id,reason:e.code,firstSeen:s[key]?.firstSeen||Date.now(),lastSeen:Date.now()}},result:true}));
        continue;
      }
      if(e.code==='STAGES_COMPLETE'){
        const jk=`job:${id}`,dk=`dossier:${job.mm}`,qk='queue:assessments';
        await repo.transact([jk,dk,qk],s=>{
          const j=s[jk];if(j?.status!=='ready')return {writes:{},result:true};
          j.status='failed';j.errorCode='STAGES_COMPLETE_WITHOUT_PUBLICATION';
          const d=s[dk];d.jobs=d.jobs.map(x=>x.jobId===id?{...x,status:'failed',canAdvance:false,errorCode:j.errorCode}:x);d.revision++;
          return {writes:{[jk]:j,[dk]:d,[qk]:{jobs:(s[qk]?.jobs||[]).filter(x=>x!==id)}},result:true};
        });
        continue;
      }
      throw e;
    }
  }
  return { advanced: 0, waiting };
}
export function workerAuthorized(env, authorization) {
  // Native Vercel cron requests use CRON_SECRET. A legacy/private scheduler may
  // fall back only when CRON_SECRET is absent; an empty or invalid binding must
  // never silently downgrade to the fallback secret.
  const secret = env.CRON_SECRET === undefined ? env.ATHLETE_ACADEMY_WORKER_SECRET : env.CRON_SECRET;
  requireValue(typeof secret === 'string' && secret.length >= 32 && typeof authorization === 'string', 'WORKER_AUTH_REQUIRED', 401);
  requireValue(timingSafeEqual(Buffer.from(digest(authorization)), Buffer.from(digest(`Bearer ${secret}`))), 'WORKER_AUTH_REQUIRED', 401);
  requireValue(env.ATHLETE_ACADEMY_WORKER_ENABLED === '1', 'WORKER_NOT_ACTIVE', 503);
}
