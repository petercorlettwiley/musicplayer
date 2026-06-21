// Embedded audio tags read from a file's headers — fields sourced directly from ID3,
// Vorbis, MP4, or other format-specific tag containers. All fields are optional since
// real-world files vary wildly in what metadata they carry.
export interface EmbeddedTags {
  title?: string
  artist?: string
  albumArtist?: string
  album?: string
  year?: number
  trackNumber?: string
  discNumber?: string
  genres?: string[]
  label?: string
  catalogNumber?: string
  releaseCountry?: string
  barcode?: string
  comment?: string
  musicbrainzRecordingId?: string
  musicbrainzAlbumId?: string
  musicbrainzArtistId?: string
  musicbrainzReleaseGroupId?: string
}

// One audio file found in a release folder, with its embedded tags already read.
export interface ScannedTrack {
  filename: string
  path: string
  relativePath: string
  tags: EmbeddedTags
}

// One folder found directly under audio_root — treated as a single release candidate.
// Only folders that contain at least one audio file are included.
export interface ScannedFolder {
  folderPath: string
  relativePath: string
  tracks: ScannedTrack[]
}
