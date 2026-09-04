export class BlindDemoRedis {
  constructor() { this.values = new Map(); this.lists = new Map(); }
  async get(key) { return this.values.get(key) ?? null; }
  async getdel(key) { const value = this.values.get(key) ?? null; this.values.delete(key); return value; }
  async set(key, value, ...args) {
    if (args.includes('NX') && this.values.has(key)) return null;
    if (args.includes('XX') && !this.values.has(key)) return null;
    this.values.set(key, String(value)); return 'OK';
  }
  async del(key) { return this.values.delete(key) ? 1 : 0; }
  async incr(key) { const n = Number(this.values.get(key) || 0) + 1; this.values.set(key, String(n)); return n; }
  async expire() { return 1; }
  async lpush(key, value) { const values = this.lists.get(key) || []; values.unshift(value); this.lists.set(key, values); return values.length; }
  async ltrim(key, start, end) { this.lists.set(key, (this.lists.get(key) || []).slice(start, end + 1)); return 'OK'; }
  async lrange(key, start, end) { return (this.lists.get(key) || []).slice(start, end + 1); }
  async eval(_script, count, ...parts) {
    const keys = parts.slice(0, count), args = parts.slice(count);
    if (count === 1) { if (this.values.get(keys[0]) !== args[0]) return 0; this.values.delete(keys[0]); return 1; }
    if (count === 3) { if (this.values.get(keys[0]) !== args[0]) return 0; const old = this.values.get(keys[1]); if (old) this.values.set(keys[2], old); this.values.set(keys[1], args[1]); return 1; }
    throw Error('Unsupported synthetic Redis operation');
  }
}
