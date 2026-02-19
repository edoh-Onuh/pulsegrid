/* ============================================================
   In-memory cache with TTL
   ============================================================ */
class Cache {
  constructor() {
    this._store = new Map();
  }

  get(key) {
    const entry = this._store.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expires) {
      this._store.delete(key);
      return null;
    }
    return entry.value;
  }

  set(key, value, ttlMs = 3600000) {
    this._store.set(key, { value, expires: Date.now() + ttlMs });
    // Evict old entries every 100 writes
    if (this._store.size % 100 === 0) this._evict();
  }

  size() {
    return this._store.size;
  }

  _evict() {
    const now = Date.now();
    for (const [k, v] of this._store) {
      if (now > v.expires) this._store.delete(k);
    }
  }
}

module.exports = { cache: new Cache() };
