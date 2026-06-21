import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import type { ByteRange, FileEntry, FileStat, FileSystemProvider } from './types.js'

// Implements FileSystemProvider for files on the local disk.
export class LocalFileSystemProvider implements FileSystemProvider {
  // Returns all files and subdirectories inside a given directory.
  async list(dirPath: string): Promise<FileEntry[]> {
    const entries = await fs.readdir(dirPath, { withFileTypes: true })
    return entries.map(entry => ({
      name: entry.name,
      path: path.join(dirPath, entry.name),
      isDirectory: entry.isDirectory(),
    }))
  }

  // Returns the size and last-modified time of a file.
  async stat(filePath: string): Promise<FileStat> {
    const stats = await fs.stat(filePath)
    return { size: stats.size, modifiedAt: stats.mtime }
  }

  // Reads a file's bytes, either in full or just the portion specified by range.
  // Range reads use a file descriptor to avoid loading the whole file into memory.
  async readBytes(filePath: string, range?: ByteRange): Promise<Buffer> {
    if (!range) {
      return fs.readFile(filePath)
    }
    const fd = await fs.open(filePath, 'r')
    try {
      const length = range.end - range.start
      const buffer = Buffer.alloc(length)
      await fd.read(buffer, 0, length, range.start)
      return buffer
    } finally {
      await fd.close()
    }
  }
}
