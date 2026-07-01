import type { ScannedFolder } from '../scanner/types.js'

// How confident we are that the top candidate is the right release.
// 'high' means we can write the release.yaml automatically.
// 'low' means candidates exist but need a human to pick one.
// 'none' means we found nothing useful — needs fingerprinting or manual entry.
export type MatchConfidence = 'high' | 'low' | 'none'

// One release candidate returned by MusicBrainz or Discogs, with our computed score.
export interface ReleaseCandidate {
  provider: 'musicbrainz' | 'discogs'
  externalId: string   // MBID or Discogs numeric ID as a string
  score: number        // 0–100, our confidence this is the right release
  title: string
  artist: string | null
  year: number | null
  label: string | null
  catalogNumber: string | null
  medium: string | null
  country: string | null
  trackCount: number | null
}

// The result of trying to match one scanned folder to a release.
export interface MatchResult {
  folder: ScannedFolder
  confidence: MatchConfidence
  // Sorted highest-score first. Empty when confidence is 'none'.
  candidates: ReleaseCandidate[]
}

// Folder-level signals derived from all the embedded tags across the folder's tracks.
// These are what we query the APIs with and score candidates against.
export interface AggregatedTags {
  album?: string
  artist?: string
  year?: number
  label?: string
  catalogNumber?: string
  barcode?: string
  trackCount: number
}
