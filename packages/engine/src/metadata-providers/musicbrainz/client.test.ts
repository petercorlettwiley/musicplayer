import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { MusicBrainzClient } from './client.js'
import { ApiCache } from '../cache/index.js'

// Replaces the global fetch with a mock that returns the given payload.
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
  releases: [
    {
      id: 'a93c7e10-2d4f-4b88-9e1c-6a8f2d9b7c11',
      title: 'BRSTL004',
      date: '2012',
      score: 95,
      'artist-credit': [{ artist: { id: 'artist-1', name: 'Jay L', 'sort-name': 'Jay L' }, name: 'Jay L', joinphrase: '' }],
      'label-info': [{ label: { id: 'label-1', name: 'Bristle' }, 'catalog-number': 'BRSTL004' }],
      media: [{ format: 'Vinyl', position: 1, 'track-count': 2 }],
    },
  ],
  count: 1,
  offset: 0,
}

describe('MusicBrainzClient.searchReleases', () => {
  it('builds a Lucene query from title and artist', async () => {
    mockFetch(fakeSearchResponse)
    const client = new MusicBrainzClient({ requestsPerSecond: Infinity })
    await client.searchReleases({ title: 'BRSTL004', artist: 'Jay L' })

    const calledUrl = (fetch as ReturnType<typeof vi.fn>).mock.calls[0][0] as string
    expect(calledUrl).toContain('release%3A%22BRSTL004%22')
    expect(calledUrl).toContain('artist%3A%22Jay%20L%22')
    expect(calledUrl).toContain('fmt=json')
  })

  it('includes barcode in the query when provided', async () => {
    mockFetch(fakeSearchResponse)
    const client = new MusicBrainzClient({ requestsPerSecond: Infinity })
    await client.searchReleases({ barcode: '1234567890123' })

    const calledUrl = (fetch as ReturnType<typeof vi.fn>).mock.calls[0][0] as string
    expect(calledUrl).toContain('barcode%3A1234567890123')
  })

  it('returns the parsed response', async () => {
    mockFetch(fakeSearchResponse)
    const client = new MusicBrainzClient({ requestsPerSecond: Infinity })
    const result = await client.searchReleases({ title: 'BRSTL004' })

    expect(result.count).toBe(1)
    expect(result.releases[0].title).toBe('BRSTL004')
    expect(result.releases[0].score).toBe(95)
  })

  it('returns a cached result without hitting the network a second time', async () => {
    mockFetch(fakeSearchResponse)
    const client = new MusicBrainzClient({ requestsPerSecond: Infinity })
    await client.searchReleases({ title: 'BRSTL004' })
    await client.searchReleases({ title: 'BRSTL004' })

    expect((fetch as ReturnType<typeof vi.fn>).mock.calls).toHaveLength(1)
  })

  it('throws on a non-2xx response', async () => {
    mockFetch({}, 503)
    const client = new MusicBrainzClient({ requestsPerSecond: Infinity })
    await expect(client.searchReleases({ title: 'test' })).rejects.toThrow('503')
  })

  it('sends the required User-Agent header', async () => {
    mockFetch(fakeSearchResponse)
    const client = new MusicBrainzClient({ requestsPerSecond: Infinity })
    await client.searchReleases({ title: 'test' })

    const calledHeaders = (fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].headers as Record<string, string>
    expect(calledHeaders['User-Agent']).toContain('musicplayer')
  })
})

describe('MusicBrainzClient.lookupRelease', () => {
  it('calls the correct lookup URL with inc parameters', async () => {
    mockFetch(fakeSearchResponse.releases[0])
    const client = new MusicBrainzClient({ requestsPerSecond: Infinity })
    await client.lookupRelease('a93c7e10-2d4f-4b88-9e1c-6a8f2d9b7c11')

    const calledUrl = (fetch as ReturnType<typeof vi.fn>).mock.calls[0][0] as string
    expect(calledUrl).toContain('/release/a93c7e10-2d4f-4b88-9e1c-6a8f2d9b7c11')
    expect(calledUrl).toContain('recordings')
    expect(calledUrl).toContain('labels')
  })

  it('can share a cache with searchReleases', async () => {
    mockFetch(fakeSearchResponse.releases[0])
    const cache = new ApiCache()
    const client = new MusicBrainzClient({ cache, requestsPerSecond: Infinity })
    await client.lookupRelease('a93c7e10-2d4f-4b88-9e1c-6a8f2d9b7c11')
    await client.lookupRelease('a93c7e10-2d4f-4b88-9e1c-6a8f2d9b7c11')

    expect((fetch as ReturnType<typeof vi.fn>).mock.calls).toHaveLength(1)
  })
})
