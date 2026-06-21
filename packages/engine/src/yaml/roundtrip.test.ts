import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import * as fs from 'node:fs/promises'
import * as os from 'node:os'
import * as path from 'node:path'
import { readYaml, writeYaml } from './index.js'
import { ReleaseSchema, type Release } from '../schema/release.js'
import { TagTaxonomySchema, type TagTaxonomy } from '../schema/tags.js'

let tmpDir: string

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'musicplayer-test-'))
})

afterEach(async () => {
  await fs.rm(tmpDir, { recursive: true, force: true })
})

const exampleRelease: Release = {
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

describe('YAML round-trip', () => {
  it('writes and reads back a Release with all fields intact', async () => {
    const filePath = path.join(tmpDir, 'release.yaml')
    await writeYaml(filePath, exampleRelease)
    const result = await readYaml(filePath, ReleaseSchema)
    expect(result).toEqual(exampleRelease)
  })

  it('writes and reads back a Release with null fields as null (not undefined)', async () => {
    const filePath = path.join(tmpDir, 'release.yaml')
    await writeYaml(filePath, exampleRelease)
    const result = await readYaml(filePath, ReleaseSchema)
    expect(result.label).toBeNull()
    expect(result.release_group_id).toBeNull()
    expect(result.year).toBe(2012)
  })

  it('creates intermediate directories when writing', async () => {
    const filePath = path.join(tmpDir, 'nested', 'deep', 'release.yaml')
    await writeYaml(filePath, exampleRelease)
    const exists = await fs.access(filePath).then(() => true).catch(() => false)
    expect(exists).toBe(true)
  })

  it('writes and reads back a TagTaxonomy', async () => {
    const taxonomy: TagTaxonomy = {
      tag_groups: [{ id: 'summer-music', name: 'Summer Music' }],
      tags: [
        {
          id: 'beach-time',
          name: 'Beach Time',
          group_id: 'summer-music',
          metadata_schema: [{ key: 'temperature', type: 'number', unit: '°F' }],
        },
        { id: 'catchy', name: 'Catchy', group_id: null, metadata_schema: [] },
      ],
    }
    const filePath = path.join(tmpDir, '_taxonomy', 'tags.yaml')
    await writeYaml(filePath, taxonomy)
    const result = await readYaml(filePath, TagTaxonomySchema)
    expect(result).toEqual(taxonomy)
  })

  it('throws a Zod validation error when reading a malformed file', async () => {
    const filePath = path.join(tmpDir, 'bad.yaml')
    await fs.writeFile(filePath, 'id: missing-required-fields\n', 'utf-8')
    await expect(readYaml(filePath, ReleaseSchema)).rejects.toThrow()
  })

  it('preserves an audio_path with odd characters unchanged', async () => {
    const release: Release = {
      ...exampleRelease,
      source: { library_source_id: 'nas', audio_path: 'Björk/Homogenic [24-96] (Japan TOCP-50219)' },
    }
    const filePath = path.join(tmpDir, 'release.yaml')
    await writeYaml(filePath, release)
    const result = await readYaml(filePath, ReleaseSchema)
    expect(result.source.audio_path).toBe('Björk/Homogenic [24-96] (Japan TOCP-50219)')
  })
})
