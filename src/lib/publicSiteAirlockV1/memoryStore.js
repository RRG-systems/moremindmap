export class MemoryPublicStore {
  constructor() {
    this.values = new Map();
    this.sets = new Map();
    this.effects = [];
  }

  async get(key) { return this.values.get(key) ?? null; }
  async set(key, value) { this.values.set(key, value); this.effects.push(['set', key]); return 'OK'; }
  async setNx(key, value) {
    if (this.values.has(key)) return false;
    this.values.set(key, value);
    this.effects.push(['setNx', key]);
    return true;
  }
  async del(key) { this.values.delete(key); this.effects.push(['del', key]); }
  async sadd(key, value) {
    const set = this.sets.get(key) || new Set();
    const before = set.size;
    set.add(value);
    this.sets.set(key, set);
    if (set.size !== before) this.effects.push(['sadd', key]);
    return set.size !== before ? 1 : 0;
  }
  async smembers(key) { return [...(this.sets.get(key) || [])]; }
  async incr(key) {
    const next = Number(this.values.get(key) || 0) + 1;
    this.values.set(key, String(next));
    this.effects.push(['incr', key]);
    return next;
  }
  async expire() { return 1; }
  snapshot() {
    return {
      values: Object.fromEntries(this.values),
      sets: Object.fromEntries([...this.sets].map(([key, value]) => [key, [...value]])),
      effects: [...this.effects],
    };
  }
}
