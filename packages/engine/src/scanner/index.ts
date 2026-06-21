import * as path from 'node:path'
import { parseBuffer } from 'music-metadata'
import type { FileSystemProvider } from '../filesystem/types.js'
import type { EmbeddedTags, ScannedFolder, ScannedTrack } from './types.js'

const AUDIO_EXTENSIONS = new Set(['.mp3', '.flac', '.wav', '.aiff', '.aif', '.m4a', '.alac', '.ogg', '.opus', '.wv'])

const MIME_BY_EXT: Record<string, string> = {
  '.mp3': 'audio/mpeg',
  '.flac': 'audio/flac',
  '.wav': 'audio/wav',
  '.aiff': 'audio/aiff',
  '.aif': 'audio/aiff',
  '.m4a': 'audio/mp4',
  '.alac': 'audio/mp4',
  '.ogg': 'audio/ogg',
  '.opus': 'audio/ogg',
  '.wv': 'audio/x-wavpack',
}

function isAudioFile(filename: string): boolean {
  return AUDIO_EXTENSIONS.has(path.extname(filename).toLowerCase())
}

// Reads the embedded tags from one audio file using the filesystem abstraction,
// so this works the same way for both local and remote (SFTP) sources.
export async function readEmbeddedTags(
  provider: FileSystemProvider,
  filePath: string,
): Promise<EmbeddedTags> {
  const ext = path.extname(filePath).toLowerCase()
  const mimeType = MIME_BY_EXT[ext] ?? 'audio/mpeg'
  const bytes = await provider.readBytes(filePath)
  const { common } = await parseBuffer(bytes, mimeType, { skipCovers: true, duration: false })
  return {
    title: common.title,
    artist: common.artist,
    albumArtist: common.albumartist,
    album: common.album,
    year: common.year,
    trackNumber: common.track.no != null ? String(common.track.no) : undefined,
    discNumber: common.disk.no != null ? String(common.disk.no) : undefined,
    genres: common.genre,
    label: common.label?.[0],
    catalogNumber: common.catalognumber?.[0],
    releaseCountry: common.releasecountry,
    barcode: common.barcode,
    comment: common.comment?.[0]?.text,
    musicbrainzRecordingId: common.musicbrainz_recordingid,
    musicbrainzAlbumId: common.musicbrainz_albumid,
    musicbrainzArtistId: common.musicbrainz_artistid?.[0],
    musicbrainzReleaseGroupId: common.musicbrainz_releasegroupid,
  }
}

// Scans one release folder and returns all audio files it contains with their tags.
async function scanFolder(
  provider: FileSystemProvider,
  folderPath: string,
  audioRoot: string,
): Promise<ScannedFolder> {
  const entries = await provider.list(folderPath)
  const tracks: ScannedTrack[] = []

  for (const entry of entries) {
    if (!entry.isDirectory && isAudioFile(entry.name)) {
      const tags = await readEmbeddedTags(provider, entry.path)
      tracks.push({
        filename: entry.name,
        path: entry.path,
        relativePath: path.relative(audioRoot, entry.path),
        tags,
      })
    }
  }

  tracks.sort((a, b) => a.filename.localeCompare(b.filename))

  return {
    folderPath,
    relativePath: path.relative(audioRoot, folderPath),
    tracks,
  }
}

// Walks audio_root one level deep. Each immediate subdirectory is treated as a release
// candidate. Folders with no audio files are skipped. Files at the root level are ignored.
export async function scanLibrarySource(
  provider: FileSystemProvider,
  audioRoot: string,
): Promise<ScannedFolder[]> {
  const topLevel = await provider.list(audioRoot)
  const results: ScannedFolder[] = []

  for (const entry of topLevel) {
    if (!entry.isDirectory) continue
    const folder = await scanFolder(provider, entry.path, audioRoot)
    if (folder.tracks.length > 0) {
      results.push(folder)
    }
  }

  return results
}
