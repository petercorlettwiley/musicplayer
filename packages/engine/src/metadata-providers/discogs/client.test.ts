import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { DiscogsClient } from './client.js'

function mockFetch(payload: unknown, status = 200): void {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? 'OK' : 'Error',
    json: async () => payload,
  }))
}

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn())
})

afterEach(() => {
  vi.unstubAllGlobals()
})

const fakeSearchResponse = {
  results: [
    {
      id: 5551234,
      title: 'Jay L - BRSTL004',
      year: '2012',
      label: ['Bristle'],
      catno: 'BRSTL004',
      format: ['Vinyl', '12"'],
      country: 'UK',
      type: 'release' as const,
    },
  ],
  pagination: { pages: 1, items: 1, page: 1, per_page: 10 },
}

const fakeRelease = {
  id: 5551234,
  title: 'BRSTL004',
  year: 2012,
  artists: [{ id: 1001, name: 'Jay L' }],
  labels: [{ id: 2001, name: 'Bristle', catno: 'BRSTL004' }],
  formats: [{ name: 'Vinyl', descriptions: ['12"'] }],
  country: 'UK',
  tracklist: [
    { position: 'A', title: 'Looking Up Pt. 1', type_: 'track' },
    { position: 'B', title: 'Try Slung', type_: 'track' },
  ],
}

describe('DiscogsClient.searchReleases', () => {
  it('builds a query URL from search params', async () => {
    mockFetch(fakeSearchResponse)
    const client = new DiscogsClient({ token: 'test-token', requestsPerSecond: Infinity })
    await client.searchReleases({ title: 'BRSTL004', artist: 'Jay L', format: 'Vinyl' })

    const calledUrl = (fetch as ReturnType<typeof vi.fn>).mock.calls[0][0] as string
    expect(calledUrl).toContain('title=BRSTL004')
    expect(calledUrl).toContain('artist=Jay+L')
    expect(calledUrl).toContain('format=Vinyl')
    expect(calledUrl).toContain('type=release')
  })

  it('sends the Authorization header with the token', async () => {
    mockFetch(fakeSearchResponse)
    const client = new DiscogsClient({ token: 'my-secret-token', requestsPerSecond: Infinity })
    await client.searchReleases({ title: 'test' })

    const calledHeaders = (fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].headers as Record<string, string>
    expect(calledHeaders['Authorization']).toBe('Discogs token=my-secret-token')
  })

  it('returns the parsed search results', async () => {
    mockFetch(fakeSearchResponse)
    const client = new DiscogsClient({ token: 'test-token', requestsPerSecond: Infinity })
    const result = await client.searchReleases({ title: 'BRSTL004' })

    expect(result.results).toHaveLength(1)
    expect(result.results[0].catno).toBe('BRSTL004')
    expect(result.results[0].label).toContain('Bristle')
  })

  it('caches results and avoids duplicate network calls', async () => {
    mockFetch(fakeSearchResponse)
    const client = new DiscogsClient({ token: 'test-token', requestsPerSecond: Infinity })
    await client.searchReleases({ title: 'BRSTL004' })
    await client.searchReleases({ title: 'BRSTL004' })

    expect((fetch as ReturnType<typeof vi.fn>).mock.calls).toHaveLength(1)
  })

  it('throws on a non-2xx response', async () => {
    mockFetch({}, 401)
    const client = new DiscogsClient({ token: 'bad-token', requestsPerSecond: Infinity })
    await expect(client.searchReleases({ title: 'test' })).rejects.toThrow('401')
  })
})

describe('DiscogsClient.lookupRelease', () => {
  it('calls the correct releases endpoint', async () => {
    mockFetch(fakeRelease)
    const client = new DiscogsClient({ token: 'test-token', requestsPerSecond: Infinity })
    await client.lookupRelease(5551234)

    const calledUrl = (fetch as ReturnType<typeof vi.fn>).mock.calls[0][0] as string
    expect(calledUrl).toContain('/releases/5551234')
  })

  it('returns the full release data', async () => {
    mockFetch(fakeRelease)
    const client = new DiscogsClient({ token: 'test-token', requestsPerSecond: Infinity })
    const release = await client.lookupRelease(5551234)

    expect(release.title).toBe('BRSTL004')
    expect(release.tracklist).toHaveLength(2)
    expect(release.labels?.[0].catno).toBe('BRSTL004')
  })
})
