import { describe, it, expect, vi, afterEach } from 'vitest'
import { ApiCache } from './index.js'

afterEach(() => {
  vi.useRealTimers()
})

describe('ApiCache', () => {
  it('returns undefined for a key that has never been set', () => {
    const cache = new ApiCache()
    expect(cache.get('missing')).toBeUndefined()
  })

  it('stores and retrieves a value', () => {
    const cache = new ApiCache()
    cache.set('key', { title: 'Purple Rain' })
    expect(cache.get('key')).toEqual({ title: 'Purple Rain' })
  })

  it('returns undefined for an expired entry', () => {
    vi.useFakeTimers()
    const cache = new ApiCache({ ttlMs: 1000 })
    cache.set('key', 'value')
    vi.advanceTimersByTime(1001)
    expect(cache.get('key')).toBeUndefined()
  })

  it('does not expire entries before the TTL elapses', () => {
    vi.useFakeTimers()
    const cache = new ApiCache({ ttlMs: 1000 })
    cache.set('key', 'value')
    vi.advanceTimersByTime(999)
    expect(cache.get('key')).toBe('value')
  })

  it('evicts the oldest entry when the cache is full', () => {
    const cache = new ApiCache({ maxSize: 3 })
    cache.set('a', 1)
    cache.set('b', 2)
    cache.set('c', 3)
    cache.set('d', 4)
    expect(cache.get('a')).toBeUndefined()
    expect(cache.get('b')).toBe(2)
    expect(cache.get('d')).toBe(4)
    expect(cache.size).toBe(3)
  })

  it('clears all entries', () => {
    const cache = new ApiCache()
    cache.set('a', 1)
    cache.set('b', 2)
    cache.clear()
    expect(cache.size).toBe(0)
    expect(cache.get('a')).toBeUndefined()
  })
})
