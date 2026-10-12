/**
 * Tiny in-memory helpers for the city API: an LRU with TTL (Places responses,
 * so a repeated query never costs a second call on a warm instance) and a
 * fixed-window per-key rate limiter (per IP, keeps a runaway client from
 * spending the Places budget). Per serverless instance — good enough for light
 * protection; the DB is the durable cache.
 */

export class LruCache<V> {
  private map = new Map<string, { v: V, exp: number }>()
  constructor(private max = 500, private ttlMs = 24 * 60 * 60 * 1000, private now = () => Date.now()) {}

  get(key: string): V | undefined {
    const e = this.map.get(key)
    if (!e) return undefined
    if (e.exp < this.now()) { this.map.delete(key); return undefined }
    this.map.delete(key)
    this.map.set(key, e)
    return e.v
  }

  set(key: string, v: V) {
    this.map.delete(key)
    this.map.set(key, { v, exp: this.now() + this.ttlMs })
    while (this.map.size > this.max) this.map.delete(this.map.keys().next().value!)
  }

  delete(key: string) { this.map.delete(key) }
  clear() { this.map.clear() }
  get size() { return this.map.size }
}

export class RateLimiter {
  private hits = new Map<string, { n: number, reset: number }>()
  constructor(private limit: number, private windowMs = 60_000, private now = () => Date.now()) {}

  /** true = allowed (and counted). */
  take(key: string): boolean {
    const t = this.now()
    let e = this.hits.get(key)
    if (!e || e.reset <= t) {
      e = { n: 0, reset: t + this.windowMs }
      this.hits.set(key, e)
      if (this.hits.size > 10_000) for (const [k, v] of this.hits) if (v.reset <= t) this.hits.delete(k)
    }
    if (e.n >= this.limit) return false
    e.n++
    return true
  }
}
