import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import * as fs from 'node:fs/promises'
import * as os from 'node:os'
import * as path from 'node:path'
import { LocalFileSystemProvider } from './local.js'

let tmpDir: string
let provider: LocalFileSystemProvider

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'musicplayer-fs-test-'))
  provider = new LocalFileSystemProvider()
})

afterEach(async () => {
  await fs.rm(tmpDir, { recursive: true, force: true })
})

describe('LocalFileSystemProvider.list', () => {
  it('returns files and subdirectories with correct isDirectory flag', async () => {
    await fs.writeFile(path.join(tmpDir, 'file.txt'), 'hello')
    await fs.mkdir(path.join(tmpDir, 'subdir'))

    const entries = await provider.list(tmpDir)
    const file = entries.find(e => e.name === 'file.txt')
    const dir = entries.find(e => e.name === 'subdir')

    expect(file?.isDirectory).toBe(false)
    expect(dir?.isDirectory).toBe(true)
  })

  it('returns full absolute paths', async () => {
    await fs.writeFile(path.join(tmpDir, 'song.flac'), '')
    const entries = await provider.list(tmpDir)
    expect(entries[0].path).toBe(path.join(tmpDir, 'song.flac'))
  })

  it('returns an empty array for an empty directory', async () => {
    const entries = await provider.list(tmpDir)
    expect(entries).toHaveLength(0)
  })
})

describe('LocalFileSystemProvider.stat', () => {
  it('returns the correct file size', async () => {
    const content = 'hello world'
    await fs.writeFile(path.join(tmpDir, 'file.txt'), content)
    const stats = await provider.stat(path.join(tmpDir, 'file.txt'))
    expect(stats.size).toBe(Buffer.byteLength(content))
  })

  it('returns a valid modifiedAt date', async () => {
    await fs.writeFile(path.join(tmpDir, 'file.txt'), '')
    const stats = await provider.stat(path.join(tmpDir, 'file.txt'))
    expect(stats.modifiedAt).toBeInstanceOf(Date)
    expect(stats.modifiedAt.getTime()).toBeGreaterThan(0)
  })
})

describe('LocalFileSystemProvider.readBytes', () => {
  it('reads the full file when no range is given', async () => {
    await fs.writeFile(path.join(tmpDir, 'file.txt'), 'hello world')
    const bytes = await provider.readBytes(path.join(tmpDir, 'file.txt'))
    expect(bytes.toString('utf-8')).toBe('hello world')
  })

  it('reads only the requested byte range', async () => {
    await fs.writeFile(path.join(tmpDir, 'file.txt'), 'hello world')
    const bytes = await provider.readBytes(path.join(tmpDir, 'file.txt'), { start: 6, end: 11 })
    expect(bytes.toString('utf-8')).toBe('world')
  })

  it('returns a Buffer', async () => {
    await fs.writeFile(path.join(tmpDir, 'file.bin'), Buffer.from([0x01, 0x02, 0x03]))
    const bytes = await provider.readBytes(path.join(tmpDir, 'file.bin'))
    expect(Buffer.isBuffer(bytes)).toBe(true)
    expect([...bytes]).toEqual([0x01, 0x02, 0x03])
  })
})
