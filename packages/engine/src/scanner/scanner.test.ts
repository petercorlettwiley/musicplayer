import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import * as fs from 'node:fs/promises'
import * as os from 'node:os'
import * as path from 'node:path'
import { LocalFileSystemProvider } from '../filesystem/local.js'
import { scanLibrarySource } from './index.js'

let tmpDir: string
let provider: LocalFileSystemProvider

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'musicplayer-scanner-test-'))
  provider = new LocalFileSystemProvider()
})

afterEach(async () => {
  await fs.rm(tmpDir, { recursive: true, force: true })
})

// A minimal valid WAV file (44 bytes, 0 samples) that music-metadata can parse.
function makeMinimalWav(): Buffer {
  const buf = Buffer.alloc(44)
  buf.write('RIFF', 0, 'ascii')
  buf.writeUInt32LE(36, 4)
  buf.write('WAVE', 8, 'ascii')
  buf.write('fmt ', 12, 'ascii')
  buf.writeUInt32LE(16, 16)
  buf.writeUInt16LE(1, 20)
  buf.writeUInt16LE(1, 22)
  buf.writeUInt32LE(44100, 24)
  buf.writeUInt32LE(88200, 28)
  buf.writeUInt16LE(2, 32)
  buf.writeUInt16LE(16, 34)
  buf.write('data', 36, 'ascii')
  buf.writeUInt32LE(0, 40)
  return buf
}

async function makeAudioFile(dir: string, filename: string): Promise<void> {
  await fs.writeFile(path.join(dir, filename), makeMinimalWav())
}

describe('scanLibrarySource', () => {
  it('finds release folders and groups their audio files', async () => {
    const albumDir = path.join(tmpDir, 'Jay L - BRSTL004 (2012)')
    await fs.mkdir(albumDir)
    await makeAudioFile(albumDir, 'A) Looking Up Pt. 1.wav')
    await makeAudioFile(albumDir, 'B) Try Slung.wav')

    const results = await scanLibrarySource(provider, tmpDir)

    expect(results).toHaveLength(1)
    expect(results[0].relativePath).toBe('Jay L - BRSTL004 (2012)')
    expect(results[0].tracks).toHaveLength(2)
  })

  it('sorts tracks alphabetically by filename within a folder', async () => {
    const albumDir = path.join(tmpDir, 'Some Album')
    await fs.mkdir(albumDir)
    await makeAudioFile(albumDir, '02 - Second.wav')
    await makeAudioFile(albumDir, '01 - First.wav')
    await makeAudioFile(albumDir, '03 - Third.wav')

    const results = await scanLibrarySource(provider, tmpDir)
    const filenames = results[0].tracks.map(t => t.filename)

    expect(filenames).toEqual(['01 - First.wav', '02 - Second.wav', '03 - Third.wav'])
  })

  it('handles multiple release folders', async () => {
    for (const name of ['Album A', 'Album B', 'Album C']) {
      const dir = path.join(tmpDir, name)
      await fs.mkdir(dir)
      await makeAudioFile(dir, 'track.wav')
    }

    const results = await scanLibrarySource(provider, tmpDir)
    expect(results).toHaveLength(3)
  })

  it('skips folders that contain no audio files', async () => {
    const emptyDir = path.join(tmpDir, 'Not An Album')
    await fs.mkdir(emptyDir)
    await fs.writeFile(path.join(emptyDir, 'readme.txt'), 'not audio')

    const results = await scanLibrarySource(provider, tmpDir)
    expect(results).toHaveLength(0)
  })

  it('ignores files at the root level (not in a subfolder)', async () => {
    await makeAudioFile(tmpDir, 'stray-file.wav')
    const albumDir = path.join(tmpDir, 'Real Album')
    await fs.mkdir(albumDir)
    await makeAudioFile(albumDir, 'track.wav')

    const results = await scanLibrarySource(provider, tmpDir)
    expect(results).toHaveLength(1)
    expect(results[0].relativePath).toBe('Real Album')
  })

  it('only picks up recognized audio extensions and ignores other files', async () => {
    const albumDir = path.join(tmpDir, 'Mixed Folder')
    await fs.mkdir(albumDir)
    await makeAudioFile(albumDir, 'side-a.wav')
    await makeAudioFile(albumDir, 'side-b.wav')
    await fs.writeFile(path.join(albumDir, 'cover.jpg'), '')
    await fs.writeFile(path.join(albumDir, 'info.txt'), '')

    const results = await scanLibrarySource(provider, tmpDir)
    const filenames = results[0].tracks.map(t => t.filename)
    expect(filenames).toEqual(['side-a.wav', 'side-b.wav'])
  })

  it('includes the correct relative paths on tracks', async () => {
    const albumDir = path.join(tmpDir, 'My Album')
    await fs.mkdir(albumDir)
    await makeAudioFile(albumDir, 'track.wav')

    const results = await scanLibrarySource(provider, tmpDir)
    expect(results[0].tracks[0].relativePath).toBe(path.join('My Album', 'track.wav'))
  })

  it('returns an EmbeddedTags object for each track', async () => {
    const albumDir = path.join(tmpDir, 'Album')
    await fs.mkdir(albumDir)
    await makeAudioFile(albumDir, 'track.wav')

    const results = await scanLibrarySource(provider, tmpDir)
    const tags = results[0].tracks[0].tags
    expect(tags).toBeDefined()
    expect(typeof tags).toBe('object')
  })
})
