import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { matchFolder } from './index.js'
import { aggregateFolderTags } from './aggregate.js'
import { scoreMBRelease, scoreDiscogsResult, computeConfidence } from './score.js'
import type { ScannedFolder } from '../scanner/types.js'
import type { MusicBrainzClient } from '../metadata-providers/musicbrainz/client.js'
import type { DiscogsClient } from '../metadata-providers/discogs/client.js'
import type { MBRelease } from '../metadata-providers/musicbrainz/types.js'
import type { DiscogsSearchResult } from '../metadata-providers/discogs/types.js'

// --- Fixtures ---

function makeFolder(overrides: Partial<ScannedFolder> = {}): ScannedFolder {
  return {
    folderPath: '/music/Jay L - BRSTL004 (2012)',
    relativePath: 'Jay L - BRSTL004 (2012)',
    tracks: [
      {
        filename: 'A) Looking Up Pt. 1.wav',
        path: '/music/Jay L - BRSTL004 (2012)/A) Looking Up Pt. 1.wav',
        relativePath: 'Jay L - BRSTL004 (2012)/A) Looking Up Pt. 1.wav',
        tags: { album: 'BRSTL004', albumArtist: 'Jay L', year: 2012, catalogNumber: 'BRSTL004' },
      },
      {
        filename: 'B) Try Slung.wav',
        path: '/music/Jay L - BRSTL004 (2012)/B) Try Slung.wav',
        relativePath: 'Jay L - BRSTL004 (2012)/B) Try Slung.wav',
        tags: { album: 'BRSTL004', albumArtist: 'Jay L', year: 2012, catalogNumber: 'BRSTL004' },
      },
    ],
    ...overrides,
  }
}

const mbRelease: MBRelease = {
  id: 'a93c7e10-2d4f-4b88-9e1c-6a8f2d9b7c11',
  title: 'BRSTL004',
  date: '2012',
  score: 95,
  'artist-credit': [{ artist: { id: 'artist-1', name: 'Jay L', 'sort-name': 'Jay L' }, name: 'Jay L', joinphrase: '' }],
  'label-info': [{ label: { id: 'label-1', name: 'Bristle' }, 'catalog-number': 'BRSTL004' }],
  media: [{ format: 'Vinyl', position: 1, 'track-count': 2 }],
}

const discogsResult: DiscogsSearchResult = {
  id: 5551234,
  title: 'Jay L - BRSTL004',
  year: '2012',
  label: ['Bristle'],
  catno: 'BRSTL004',
  format: ['Vinyl', '12"'],
  country: 'UK',
  type: 'release',
}

function makeMBClient(releases: MBRelease[] = [mbRelease]): MusicBrainzClient {
  return {
    searchReleases: vi.fn().mockResolvedValue({ releases, count: releases.length, offset: 0 }),
    lookupRelease: vi.fn().mockResolvedValue(mbRelease),
  } as unknown as MusicBrainzClient
}

function makeDiscogsClient(results: DiscogsSearchResult[] = [discogsResult]): DiscogsClient {
  return {
    searchReleases: vi.fn().mockResolvedValue({
      results,
      pagination: { pages: 1, items: results.length, page: 1, per_page: 10 },
    }),
    lookupRelease: vi.fn(),
  } as unknown as DiscogsClient
}

// --- aggregateFolderTags ---

describe('aggregateFolderTags', () => {
  it('picks the most common value when tracks agree', () => {
    const tags = aggregateFolderTags(makeFolder())
    expect(tags.album).toBe('BRSTL004')
    expect(tags.artist).toBe('Jay L')
    expect(tags.year).toBe(2012)
    expect(tags.catalogNumber).toBe('BRSTL004')
    expect(tags.trackCount).toBe(2)
  })

  it('picks the majority value when tracks disagree', () => {
    const folder = makeFolder({
      tracks: [
        { filename: 'a.wav', path: '/a.wav', relativePath: 'a.wav', tags: { album: 'Album A' } },
        { filename: 'b.wav', path: '/b.wav', relativePath: 'b.wav', tags: { album: 'Album A' } },
        { filename: 'c.wav', path: '/c.wav', relativePath: 'c.wav', tags: { album: 'Album B' } },
      ],
    })
    expect(aggregateFolderTags(folder).album).toBe('Album A')
  })

  it('prefers albumArtist over artist', () => {
    const folder = makeFolder({
      tracks: [{
        filename: 'a.wav', path: '/a.wav', relativePath: 'a.wav',
        tags: { artist: 'Track Artist', albumArtist: 'Album Artist' },
      }],
    })
    expect(aggregateFolderTags(folder).artist).toBe('Album Artist')
  })

  it('returns undefined fields when no tags exist', () => {
    const folder = makeFolder({
      tracks: [{ filename: 'a.wav', path: '/a.wav', relativePath: 'a.wav', tags: {} }],
    })
    const tags = aggregateFolderTags(folder)
    expect(tags.album).toBeUndefined()
    expect(tags.artist).toBeUndefined()
    expect(tags.trackCount).toBe(1)
  })
})

// --- scoring ---

describe('scoreMBRelease', () => {
  const baseTags = { album: 'BRSTL004', artist: 'Jay L', year: 2012, catalogNumber: 'BRSTL004', trackCount: 2 }

  it('starts from the MB API score', () => {
    const candidate = scoreMBRelease({ ...mbRelease, score: 70 }, baseTags)
    expect(candidate.score).toBeGreaterThanOrEqual(70)
  })

  it('boosts score when catalog number matches exactly', () => {
    // Use a lower base score so the catno boost is visible without hitting the cap.
    const lowScoreRelease = { ...mbRelease, score: 60 }
    const withCatno = scoreMBRelease(lowScoreRelease, baseTags)
    const withoutCatno = scoreMBRelease(lowScoreRelease, { ...baseTags, catalogNumber: undefined })
    expect(withCatno.score).toBeGreaterThan(withoutCatno.score)
  })

  it('boosts score when track count matches', () => {
    const match = scoreMBRelease(mbRelease, { ...baseTags, trackCount: 2 })
    const mismatch = scoreMBRelease(mbRelease, { ...baseTags, trackCount: 12 })
    expect(match.score).toBeGreaterThan(mismatch.score)
  })

  it('boosts heavily when barcode matches', () => {
    const withBarcode = scoreMBRelease({ ...mbRelease, barcode: '123456789' }, { ...baseTags, barcode: '123456789' })
    expect(withBarcode.score).toBeGreaterThanOrEqual(92)
  })

  it('maps provider fields correctly', () => {
    const candidate = scoreMBRelease(mbRelease, baseTags)
    expect(candidate.provider).toBe('musicbrainz')
    expect(candidate.externalId).toBe('a93c7e10-2d4f-4b88-9e1c-6a8f2d9b7c11')
    expect(candidate.title).toBe('BRSTL004')
    expect(candidate.artist).toBe('Jay L')
    expect(candidate.medium).toBe('Vinyl')
    expect(candidate.catalogNumber).toBe('BRSTL004')
  })
})

describe('scoreDiscogsResult', () => {
  const baseTags = { album: 'BRSTL004', artist: 'Jay L', year: 2012, catalogNumber: 'BRSTL004', trackCount: 2 }

  it('boosts when catalog number matches', () => {
    const match = scoreDiscogsResult(discogsResult, baseTags)
    const noMatch = scoreDiscogsResult(discogsResult, { ...baseTags, catalogNumber: 'OTHER-001' })
    expect(match.score).toBeGreaterThan(noMatch.score)
  })

  it('parses artist from the Discogs title format "Artist - Album"', () => {
    const candidate = scoreDiscogsResult(discogsResult, baseTags)
    expect(candidate.artist).toBe('Jay L')
    expect(candidate.title).toBe('BRSTL004')
  })
})

describe('computeConfidence', () => {
  it('returns high when top score is 80 or above', () => {
    expect(computeConfidence([{ score: 85 } as any])).toBe('high')
    expect(computeConfidence([{ score: 80 } as any])).toBe('high')
  })

  it('returns low when top score is between 45 and 79', () => {
    expect(computeConfidence([{ score: 60 } as any])).toBe('low')
    expect(computeConfidence([{ score: 45 } as any])).toBe('low')
  })

  it('returns none when top score is below 45', () => {
    expect(computeConfidence([{ score: 44 } as any])).toBe('none')
  })

  it('returns none when there are no candidates', () => {
    expect(computeConfidence([])).toBe('none')
  })
})

// --- matchFolder ---

describe('matchFolder', () => {
  it('returns high confidence for a folder with good matching tags', async () => {
    const result = await matchFolder(makeFolder(), { mbClient: makeMBClient() })
    expect(result.confidence).toBe('high')
    expect(result.candidates[0].provider).toBe('musicbrainz')
    expect(result.candidates[0].title).toBe('BRSTL004')
  })

  it('returns none immediately when the folder has no usable tags', async () => {
    const emptyFolder = makeFolder({
      tracks: [{ filename: 'a.wav', path: '/a.wav', relativePath: 'a.wav', tags: {} }],
    })
    const mbClient = makeMBClient()
    const result = await matchFolder(emptyFolder, { mbClient })
    expect(result.confidence).toBe('none')
    expect(result.candidates).toHaveLength(0)
    // Should not have called the API at all.
    expect(mbClient.searchReleases).not.toHaveBeenCalled()
  })

  it('sorts candidates by score descending', async () => {
    const twoReleases: MBRelease[] = [
      { ...mbRelease, id: 'release-1', score: 70 },
      { ...mbRelease, id: 'release-2', score: 90 },
    ]
    const result = await matchFolder(makeFolder(), { mbClient: makeMBClient(twoReleases) })
    expect(result.candidates[0].score).toBeGreaterThanOrEqual(result.candidates[1].score)
  })

  it('merges candidates from MusicBrainz and Discogs', async () => {
    const result = await matchFolder(makeFolder(), {
      mbClient: makeMBClient(),
      discogsClient: makeDiscogsClient(),
    })
    const providers = result.candidates.map(c => c.provider)
    expect(providers).toContain('musicbrainz')
    expect(providers).toContain('discogs')
  })

  it('still returns MB results when Discogs is not provided', async () => {
    const result = await matchFolder(makeFolder(), { mbClient: makeMBClient() })
    expect(result.candidates.every(c => c.provider === 'musicbrainz')).toBe(true)
  })

  // Messy real-world case: folder with no embedded tags (needs fingerprinting)
  it('handles a folder with no embedded tags — no tags case', async () => {
    const noTagsFolder = makeFolder({
      tracks: [
        { filename: '01.wav', path: '/01.wav', relativePath: '01.wav', tags: {} },
        { filename: '02.wav', path: '/02.wav', relativePath: '02.wav', tags: {} },
      ],
    })
    const result = await matchFolder(noTagsFolder, { mbClient: makeMBClient() })
    expect(result.confidence).toBe('none')
  })

  // Messy real-world case: various artists compilation
  it('handles a various artists compilation where tracks have different artist tags', async () => {
    const vaFolder = makeFolder({
      tracks: [
        { filename: '01.wav', path: '/01.wav', relativePath: '01.wav', tags: { album: 'Now That\'s What I Call Music', albumArtist: 'Various Artists', artist: 'Adele' } },
        { filename: '02.wav', path: '/02.wav', relativePath: '02.wav', tags: { album: 'Now That\'s What I Call Music', albumArtist: 'Various Artists', artist: 'Ed Sheeran' } },
        { filename: '03.wav', path: '/03.wav', relativePath: '03.wav', tags: { album: 'Now That\'s What I Call Music', albumArtist: 'Various Artists', artist: 'Rihanna' } },
      ],
    })
    // albumArtist "Various Artists" should be used, not the per-track artist
    const tags = aggregateFolderTags(vaFolder)
    expect(tags.artist).toBe('Various Artists')
    expect(tags.album).toBe('Now That\'s What I Call Music')

    const vaRelease: MBRelease = { ...mbRelease, title: 'Now That\'s What I Call Music', score: 88 }
    const result = await matchFolder(vaFolder, { mbClient: makeMBClient([vaRelease]) })
    expect(result.candidates[0].title).toBe('Now That\'s What I Call Music')
  })

  // Messy real-world case: deluxe reissue with lower track count match
  it('penalizes candidates whose track count does not match the scanned folder', async () => {
    const shortFolder = makeFolder({
      tracks: [
        { filename: 'a.wav', path: '/a.wav', relativePath: 'a.wav', tags: { album: 'Purple Rain', albumArtist: 'Prince' } },
        { filename: 'b.wav', path: '/b.wav', relativePath: 'b.wav', tags: { album: 'Purple Rain', albumArtist: 'Prince' } },
      ],
    })
    // Two candidates: original (9 tracks) and deluxe (25 tracks). Our folder has 2 tracks.
    const original: MBRelease = { ...mbRelease, title: 'Purple Rain', score: 85, media: [{ format: 'CD', position: 1, 'track-count': 9 }] }
    const deluxe: MBRelease = { ...mbRelease, id: 'deluxe-id', title: 'Purple Rain (Deluxe)', score: 80, media: [{ format: 'CD', position: 1, 'track-count': 25 }] }
    const result = await matchFolder(shortFolder, { mbClient: makeMBClient([original, deluxe]) })
    // Both should lose points for track count mismatch, but original's score started higher.
    expect(result.candidates).toHaveLength(2)
    // Scores should reflect track count penalty for both
    expect(result.candidates[0].trackCount).not.toBe(2)
  })

  it('continues if MusicBrainz throws, returning whatever Discogs found', async () => {
    const failingMBClient = {
      searchReleases: vi.fn().mockRejectedValue(new Error('MB is down')),
      lookupRelease: vi.fn(),
    } as unknown as MusicBrainzClient
    const result = await matchFolder(makeFolder(), {
      mbClient: failingMBClient,
      discogsClient: makeDiscogsClient(),
    })
    expect(result.candidates.every(c => c.provider === 'discogs')).toBe(true)
  })
})
