// An optional byte range for partial file reads — used for streaming and range requests.
export interface ByteRange {
  start: number
  end: number
}

// A single entry returned by listing a directory.
export interface FileEntry {
  name: string
  path: string
  isDirectory: boolean
}

// Basic file metadata.
export interface FileStat {
  size: number
  modifiedAt: Date
}

// The core abstraction that decouples the rest of the engine from where files actually live.
// A local source and an SFTP source both satisfy this interface. Readonly sources get an
// implementation that simply has no write methods — the constraint is structural, not a flag check.
export interface FileSystemProvider {
  list(dirPath: string): Promise<FileEntry[]>
  stat(filePath: string): Promise<FileStat>
  readBytes(filePath: string, range?: ByteRange): Promise<Buffer>
}
