import { describe, it, expect } from 'vitest'
import { ReleaseSchema } from './release.js'

const jayL: unknown = {
  id: 'a93c7e10-2d4f-4b88-9e1c-6a8f2d9b7c11',
  release_group_id: null,
  source: {
    library_source_id: 'remote-server-1',
    audio_path: 'Jay L - BRSTL004 (2012) - WAV 24bit 96khz [Vinyl]',
  },
  artist: 'Jay L',
  title: 'BRSTL004',
  year: 2012,
  label: null,
  catalog_number: 'BRSTL004',
  medium: 'Vinyl',
  source_format_note: 'WAV 24bit/96kHz digitized from vinyl',
  tracks: [
    { track_id: '4e2a1f90-aaaa-bbbb-cccc-dddddddddddd', position: 'A1', title: 'Looking Up Pt. 1', file: 'A) Looking Up Pt. 1.wav' },
    { track_id: '7b3c2e11-aaaa-bbbb-cccc-dddddddddddd', position: 'B1', title: 'Try Slung', file: 'B) Try Slung.wav' },
  ],
  artwork: [{ file: 'cover.jpg', type: 'front' }],
  tags: [{ tag_id: 'all-time-favorite' }],
}

describe('ReleaseSchema', () => {
  it('parses the full example from the writeup', () => {
    const result = ReleaseSchema.safeParse(jayL)
    expect(result.success).toBe(true)
    if (!result.success) return
    expect(result.data.id).toBe('a93c7e10-2d4f-4b88-9e1c-6a8f2d9b7c11')
    expect(result.data.year).toBe(2012)
    expect(result.data.tracks).toHaveLength(2)
    expect(result.data.tracks[0].position).toBe('A1')
  })

  it('accepts numeric track positions', () => {
    const release = {
      ...jayL as object,
      tracks: [
        { track_id: 'aaaaaaaa-0000-0000-0000-000000000001', position: '1', title: 'Track One', file: '01.flac' },
        { track_id: 'aaaaaaaa-0000-0000-0000-000000000002', position: '2', title: 'Track Two', file: '02.flac' },
      ],
    }
    expect(ReleaseSchema.safeParse(release).success).toBe(true)
  })

  it('accepts tags on individual tracks', () => {
    const release = {
      ...jayL as object,
      tracks: [
        {
          track_id: '4e2a1f90-aaaa-bbbb-cccc-dddddddddddd',
          position: 'A1',
          title: 'Looking Up Pt. 1',
          file: 'A) Looking Up Pt. 1.wav',
          tags: [
            { tag_id: 'catchy' },
            { tag_id: 'beach-time', metadata: { temperature: 80 } },
          ],
        },
      ],
    }
    expect(ReleaseSchema.safeParse(release).success).toBe(true)
  })

  it('rejects a release missing the required id field', () => {
    const { id: _id, ...withoutId } = jayL as Record<string, unknown>
    expect(ReleaseSchema.safeParse(withoutId).success).toBe(false)
  })

  it('rejects a release missing the required title field', () => {
    const { title: _title, ...withoutTitle } = jayL as Record<string, unknown>
    expect(ReleaseSchema.safeParse(withoutTitle).success).toBe(false)
  })

  it('rejects a non-integer year', () => {
    const release = { ...jayL as object, year: 'two thousand twelve' }
    expect(ReleaseSchema.safeParse(release).success).toBe(false)
  })

  it('accepts null for all nullable fields', () => {
    const minimal: unknown = {
      id: 'aaaaaaaa-0000-0000-0000-000000000001',
      release_group_id: null,
      source: { library_source_id: 'local', audio_path: 'Some Artist/Album' },
      artist: null,
      title: 'Unknown Album',
      year: null,
      label: null,
      catalog_number: null,
      medium: null,
      source_format_note: null,
      tracks: [],
    }
    expect(ReleaseSchema.safeParse(minimal).success).toBe(true)
  })

  it('accepts a release with genres', () => {
    const release = { ...jayL as object, genres: ['Electronic', 'House'] }
    const result = ReleaseSchema.safeParse(release)
    expect(result.success).toBe(true)
    if (!result.success) return
    expect(result.data.genres).toEqual(['Electronic', 'House'])
  })

  it('accepts a release with date_added', () => {
    const release = { ...jayL as object, date_added: '2015-03-14T12:00:00.000Z' }
    expect(ReleaseSchema.safeParse(release).success).toBe(true)
  })
})
