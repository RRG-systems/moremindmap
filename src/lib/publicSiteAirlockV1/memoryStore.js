export class MemoryPublicStore {
  constructor() {
    this.values = new Map();
    this.sets = new Map();
    this.effects = [];
  }

  async get(key) { return this.values.get(key) ?? null; }
  async set(key, value) { this.values.set(key, value); this.effects.push(['set', key]); return 'OK'; }
  async setExpiring(key, value, ttlSeconds) {
    this.values.set(key, value);
    this.effects.push(['setExpiring', key, ttlSeconds]);
    return 'OK';
  }
  async setNx(key, value) {
    if (this.values.has(key)) return false;
    this.values.set(key, value);
    this.effects.push(['setNx', key]);
    return true;
  }
  async del(key) { this.values.delete(key); this.effects.push(['del', key]); }
  async compareDel(key, expected) {
    if (this.values.get(key) !== expected) return 0;
    this.values.delete(key);
    this.effects.push(['compareDel', key]);
    return 1;
  }
  async sadd(key, value) {
    const set = this.sets.get(key) || new Set();
    const before = set.size;
    set.add(value);
    this.sets.set(key, set);
    if (set.size !== before) this.effects.push(['sadd', key]);
    return set.size !== before ? 1 : 0;
  }
  async smembers(key) { return [...(this.sets.get(key) || [])]; }
  async srem(key, value) {
    const set = this.sets.get(key);
    const removed = set?.delete(value) ? 1 : 0;
    if (removed) this.effects.push(['srem', key]);
    return removed;
  }
  async incr(key) {
    const next = Number(this.values.get(key) || 0) + 1;
    this.values.set(key, String(next));
    this.effects.push(['incr', key]);
    return next;
  }
  async expire() { return 1; }
  async commitComplimentaryRedemption({
    redemptionKey,
    grantKey,
    usageKey,
    profileIndexKey = '',
    redemptionId,
    grantId,
    maxUses,
    serializedGrant,
    serializedJournal,
  }) {
    const receipt = this.values.get(redemptionKey);
    const grant = this.values.get(grantKey);
    const usage = this.sets.get(usageKey) || new Set();
    const ownUse = usage.has(redemptionId);
    const indexed = !profileIndexKey || (this.sets.get(profileIndexKey) || new Set()).has(grantId);
    if (receipt !== undefined) {
      return receipt === serializedJournal
        && grant === serializedGrant
        && ownUse
        && indexed
        ? 'REPLAY'
        : 'CONFLICT';
    }
    if ((grant !== undefined && grant !== serializedGrant) || (ownUse && grant === undefined)) {
      return 'CONFLICT';
    }
    if (!ownUse && usage.size >= maxUses) return 'EXHAUSTED';

    const repairing = grant !== undefined || ownUse;
    this.values.set(grantKey, serializedGrant);
    usage.add(redemptionId);
    this.sets.set(usageKey, usage);
    if (profileIndexKey) {
      const profileIndex = this.sets.get(profileIndexKey) || new Set();
      profileIndex.add(grantId);
      this.sets.set(profileIndexKey, profileIndex);
    }
    this.values.set(redemptionKey, serializedJournal);
    this.effects.push(['commitComplimentaryRedemption', redemptionKey]);
    return repairing ? 'REPAIRED' : 'CREATED';
  }
  async claimProductExecution({ key, initialRecord, nowMs, leaseToken, leaseUntilMs }) {
    const raw = this.values.get(key);
    if (raw === undefined) {
      this.values.set(key, JSON.stringify(initialRecord));
      this.effects.push(['claimProductExecution', key]);
      return { code: 'ACQUIRED', record: structuredClone(initialRecord) };
    }
    let record;
    try { record = JSON.parse(raw); } catch { return { code: 'CONFLICT' }; }
    if (!record || typeof record !== 'object' || Array.isArray(record)
        || record.contract_version !== initialRecord.contract_version
        || record.product_key !== initialRecord.product_key
        || record.request_sha256 !== initialRecord.request_sha256
        || record.authority_type !== initialRecord.authority_type
        || record.authority_ref !== initialRecord.authority_ref) {
      return { code: 'CONFLICT' };
    }
    if (record.state === 'COMMITTED') return { code: 'REPLAY', record: structuredClone(record) };
    if (record.state !== 'CLAIMED') return { code: 'CONFLICT' };
    if (Number(record.lease_until_ms || 0) <= nowMs) {
      const recovered = {
        ...record,
        lease_token: leaseToken,
        lease_until_ms: leaseUntilMs,
        updated_at: initialRecord.updated_at,
      };
      this.values.set(key, JSON.stringify(recovered));
      this.effects.push(['claimProductExecutionRecovery', key]);
      return { code: 'ACQUIRED', record: structuredClone(recovered), recovered: true };
    }
    return { code: 'IN_PROGRESS', record: structuredClone(record) };
  }
  async commitProductExecution({ key, leaseToken, result, setValues = [], setMembers = [], updatedAt }) {
    let record;
    try { record = JSON.parse(this.values.get(key)); } catch { return { code: 'CONFLICT' }; }
    if (!record || typeof record !== 'object' || Array.isArray(record)) return { code: 'CONFLICT' };
    if (record.state === 'COMMITTED') return { code: 'REPLAY', record: structuredClone(record) };
    if (record.state !== 'CLAIMED' || record.lease_token !== leaseToken) return { code: 'LOST' };
    for (const entry of setValues) this.values.set(entry.key, entry.value);
    for (const entry of setMembers) {
      const set = this.sets.get(entry.key) || new Set();
      set.add(entry.value);
      this.sets.set(entry.key, set);
    }
    const committed = {
      ...record,
      state: 'COMMITTED',
      result: structuredClone(result),
      lease_token: null,
      lease_until_ms: 0,
      updated_at: updatedAt,
    };
    this.values.set(key, JSON.stringify(committed));
    this.effects.push(['commitProductExecution', key]);
    return { code: 'COMMITTED', record: structuredClone(committed) };
  }
  async releaseProductExecution({ key, leaseToken, updatedAt }) {
    let record;
    try { record = JSON.parse(this.values.get(key)); } catch { return 0; }
    if (record?.state !== 'CLAIMED' || record.lease_token !== leaseToken) return 0;
    const released = { ...record, lease_token: null, lease_until_ms: 0, updated_at: updatedAt };
    this.values.set(key, JSON.stringify(released));
    this.effects.push(['releaseProductExecution', key]);
    return 1;
  }
  snapshot() {
    return {
      values: Object.fromEntries(this.values),
      sets: Object.fromEntries([...this.sets].map(([key, value]) => [key, [...value]])),
      effects: [...this.effects],
    };
  }
}
