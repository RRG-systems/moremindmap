import process from 'node:process';
import {createAcademyRedis, awaitAcademyRedisReady} from '../../server/athleteAcademyV1/runtime.js';
import {workerAuthorized} from '../../server/athleteAcademyV1/worker.js';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  let redis;
  try {
    workerAuthorized(process.env, req.headers.authorization);
    if (req.method !== 'GET') return res.status(405).json({ok: false});
    redis = createAcademyRedis(process.env.ATHLETE_ACADEMY_REDIS_URL, {
      ca: process.env.ATHLETE_ACADEMY_REDIS_CA_PEM,
      lazyConnect: true,
    });
    await awaitAcademyRedisReady(redis);
    const prefix = process.env.ATHLETE_ACADEMY_NAMESPACE || 'more:athlete-academy:{v1}';
    let cursor = '0';
    const keys = [];
    do {
      const [next, batch] = await redis.scan(cursor, 'MATCH', `${prefix}:mail:*`, 'COUNT', 100);
      cursor = next;
      keys.push(...batch);
      if (keys.length > 100) throw Object.assign(new Error('DIAGNOSTIC_BOUND_EXCEEDED'), {code: 'DIAGNOSTIC_BOUND_EXCEEDED'});
    } while (cursor !== '0');
    const records = keys.length ? (await redis.mget(...keys)).map(value => JSON.parse(value)) : [];
    const queue = JSON.parse(await redis.get(`${prefix}:queue:mail`) || '{"ids":[]}');
    const byStatus = {};
    const byKind = {};
    let receiptPresent = 0;
    let sentTokensCleared = 0;
    for (const record of records) {
      byStatus[record.status] = (byStatus[record.status] || 0) + 1;
      byKind[record.kind] = (byKind[record.kind] || 0) + 1;
      if (record.receipt) receiptPresent++;
      if (record.status === 'sent' && record.token === null) sentTokensCleared++;
    }
    return res.status(200).json({ok: true, total: records.length, queued: queue.ids?.length || 0, byStatus, byKind, receiptPresent, sentTokensCleared});
  } catch (error) {
    const code = /^[A-Z0-9_]+$/.test(error?.code || error?.message || '') ? error.code || error.message : 'DIAGNOSTIC_UNAVAILABLE';
    return res.status(error?.status || 503).json({ok: false, error: code});
  } finally {
    redis?.disconnect();
  }
}
