// Synthetic, in-process Redis stand-in. No sockets, providers or file storage.
// Supported Lua branches mirror the production authority and Athlete stores.
export class FakeRedis {
  constructor({ now = () => Date.now() } = {}) {
    this.values = new Map();
    this.expiresAt = new Map();
    this.calls = [];
    this.evalCalls = [];
    this.clock = now;
    this.offset = 0;
    this.persistCalls = 0;
    this.failPersistAt = null;
  }
  now() { return Number(this.clock()) + this.offset; }
  advance(milliseconds) { this.offset += milliseconds; }
  clear() { this.values.clear(); this.expiresAt.clear(); this.calls.length = 0; this.evalCalls.length = 0; this.persistCalls = 0; this.failPersistAt = null; }
  _get(key) {
    if (this.expiresAt.has(key) && this.expiresAt.get(key) <= this.now()) {
      this.values.delete(key);
      this.expiresAt.delete(key);
    }
    return this.values.get(key) ?? null;
  }
  _set(key, value, args = []) {
    const options = args.map((arg) => typeof arg === 'string' ? arg.toUpperCase() : arg);
    const exists = this._get(key) !== null;
    if ((options.includes('NX') && exists) || (options.includes('XX') && !exists)) return null;
    this.values.set(key, String(value));
    if (!options.includes('KEEPTTL')) this.expiresAt.delete(key);
    const ex = options.indexOf('EX'), px = options.indexOf('PX');
    if (ex >= 0) this.expiresAt.set(key, this.now() + Number(args[ex + 1]) * 1000);
    if (px >= 0) this.expiresAt.set(key, this.now() + Number(args[px + 1]));
    return 'OK';
  }
  _delete(key) {
    const existed = this._get(key) !== null;
    this.values.delete(key); this.expiresAt.delete(key);
    return existed ? 1 : 0;
  }
  _expire(key, milliseconds) {
    if (this._get(key) === null) return 0;
    this.expiresAt.set(key, this.now() + Number(milliseconds));
    return 1;
  }
  async get(key) { this.calls.push(['get', key]); return this._get(key); }
  async getdel(key) { this.calls.push(['getdel', key]); const value = this._get(key); this._delete(key); return value; }
  async set(key, value, ...args) { this.calls.push(['set', key, ...args]); return this._set(key, value, args); }
  async del(...keys) { this.calls.push(['del', ...keys]); return keys.reduce((count, key) => count + this._delete(key), 0); }
  async exists(key) { return this._get(key) !== null ? 1 : 0; }
  async incr(key) { this.calls.push(['incr', key]); const next = Number(this._get(key) || 0) + 1; this.values.set(key, String(next)); return next; }
  async expire(key, seconds) { this.calls.push(['expire', key, seconds]); return this._expire(key, Number(seconds) * 1000); }
  async pexpire(key, milliseconds) { this.calls.push(['pexpire', key, milliseconds]); return this._expire(key, milliseconds); }
  async pttl(key) { if (this._get(key) === null) return -2; return this.expiresAt.has(key) ? this.expiresAt.get(key) - this.now() : -1; }
  async ttl(key) { const remaining = await this.pttl(key); return remaining < 0 ? remaining : Math.ceil(remaining / 1000); }
  async eval(script, keyCount, ...args) {
    const keys = args.slice(0, keyCount), argv = args.slice(keyCount);
    this.evalCalls.push({ script, keys, argv });
    // No await inside the branches: each script is atomic in this event loop.
    if (script.includes('ATHLETE_CONSULTING_V2_FENCED_PERSIST')) {
      this.persistCalls += 1;
      if (this.persistCalls === this.failPersistAt) throw new Error('SYNTHETIC_PERSIST_FAILURE');
      if (this._get(keys[0]) !== argv[0]) return 0;
      const prior = this._get(keys[1]);
      if ((prior || '') !== argv[2]) return -1;
      if (argv[3] === '1' && prior) {
        const backup = this._get(keys[2]);
        if (backup && backup !== prior) return -2;
        this._set(keys[2], prior, ['NX']);
      }
      this._set(keys[1], argv[1]);
      this._expire(keys[0], argv[4]);
      return 1;
    }
    if (script.includes("redis.call('INCR'")) {
      const count = Number(this._get(keys[0]) || 0) + 1;
      this.values.set(keys[0], String(count));
      if (count === 1) this._expire(keys[0], Number(argv[0]) * 1000);
      return count;
    }
    if (script.includes("redis.call('SET',KEYS[2],ARGV[2])")) {
      this.persistCalls += 1;
      if (this.persistCalls === this.failPersistAt) throw new Error('SYNTHETIC_PERSIST_FAILURE');
      if (this._get(keys[0]) !== argv[0]) return 0;
      const prior = this._get(keys[1]);
      if (argv[2] === '1' && prior) this._set(keys[2], prior, ['EX', argv[3]]);
      this._set(keys[1], argv[1]);
      this._expire(keys[0], argv[4]);
      return 1;
    }
    if (script.includes("redis.call('PEXPIRE'")) {
      return this._get(keys[0]) === argv[0] ? this._expire(keys[0], argv[1]) : 0;
    }
    if (script.includes("redis.call('DEL'")) {
      return this._get(keys[0]) === argv[0] ? this._delete(keys[0]) : 0;
    }
    throw new Error('UNEXPECTED_SYNTHETIC_REDIS_SCRIPT');
  }
  on() { return this; }
  async quit() { return 'OK'; }
  disconnect() {}
}
