// A simple in-memory cache for API responses, so repeated lookups for the same
// release don't burn rate-limited quota. Entries expire after a configurable TTL
// and the cache evicts the oldest entry when it hits its max size.
export class ApiCache {
  private readonly store = new Map<string, { value: unknown; expiresAt: number }>()
  private readonly maxSize: number
  private readonly ttlMs: number

  constructor({ maxSize = 500, ttlMs = 3_600_000 } = {}) {
    this.maxSize = maxSize
    this.ttlMs = ttlMs
  }

  // Returns the cached value for a key, or undefined if missing or expired.
  get<T>(key: string): T | undefined {
    const entry = this.store.get(key)
    if (!entry) return undefined
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key)
      return undefined
    }
    return entry.value as T
  }

  // Stores a value under a key. If the cache is full, the oldest entry is evicted first.
  set(key: string, value: unknown): void {
    if (this.store.size >= this.maxSize) {
      const oldest = this.store.keys().next().value
      if (oldest !== undefined) this.store.delete(oldest)
    }
    this.store.set(key, { value, expiresAt: Date.now() + this.ttlMs })
  }

  // Wipes the entire cache — useful in tests.
  clear(): void {
    this.store.clear()
  }

  get size(): number {
    return this.store.size
  }
}
