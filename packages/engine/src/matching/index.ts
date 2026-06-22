import type { MusicBrainzClient } from '../metadata-providers/musicbrainz/client.js'
import type { DiscogsClient } from '../metadata-providers/discogs/client.js'
import type { ScannedFolder } from '../scanner/types.js'
import { aggregateFolderTags } from './aggregate.js'
import { scoreMBRelease, scoreDiscogsResult, computeConfidence } from './score.js'
import type { MatchResult, ReleaseCandidate } from './types.js'

export interface MatchOptions {
  mbClient: MusicBrainzClient
  discogsClient?: DiscogsClient
  // How many candidates to fetch from each provider.
  limit?: number
  // Optional medium preference (e.g. "Digital Media", "Vinyl", "CD").
  // Biases candidate scoring toward releases with a matching medium and
  // is included in the MusicBrainz Lucene query. Does not override the
  // medium written to release.yaml — that always comes from the API.
  preferredMedium?: string
}

// Matches a scanned folder to a release in MusicBrainz and/or Discogs.
// Returns all candidates sorted by score, plus an overall confidence level.
// When confidence is 'high', the caller can write a release.yaml automatically.
// When 'low', the candidates should be shown to the user to pick from.
// When 'none', fingerprinting or manual entry is needed.
export async function matchFolder(
  folder: ScannedFolder,
  options: MatchOptions,
): Promise<MatchResult> {
  const { mbClient, discogsClient, limit = 5, preferredMedium } = options
  const tags = aggregateFolderTags(folder)
  const candidates: ReleaseCandidate[] = []

  // If we have no usable signals at all, skip the API calls entirely.
  const hasAnyTag = tags.album || tags.artist || tags.barcode || tags.catalogNumber
  if (!hasAnyTag) {
    return { folder, confidence: 'none', candidates: [] }
  }

  // Query MusicBrainz.
  try {
    const mbResults = await mbClient.searchReleases(
      {
        title: tags.album,
        artist: tags.artist,
        barcode: tags.barcode,
        catalogNumber: tags.catalogNumber,
        label: tags.label,
        format: preferredMedium,
      },
      limit,
    )
    for (const release of mbResults.releases) {
      candidates.push(scoreMBRelease(release, tags, preferredMedium))
    }
  } catch (err) {
    // A single provider failing shouldn't abort the whole match.
    console.warn('MusicBrainz search failed:', (err as Error).message)
  }

  // Query Discogs if a client was provided.
  if (discogsClient) {
    try {
      const dResults = await discogsClient.searchReleases(
        {
          title: tags.album,
          artist: tags.artist,
          barcode: tags.barcode,
          catalogNumber: tags.catalogNumber,
          label: tags.label,
          year: tags.year,
        },
        limit,
      )
      for (const result of dResults.results) {
        candidates.push(scoreDiscogsResult(result, tags, preferredMedium))
      }
    } catch (err) {
      console.warn('Discogs search failed:', (err as Error).message)
    }
  }

  candidates.sort((a, b) => b.score - a.score)
  const confidence = computeConfidence(candidates)

  return { folder, confidence, candidates }
}

export { aggregateFolderTags } from './aggregate.js'
export { buildReleaseFromMBID, buildReleaseFromDiscogsId, buildStubRelease } from './build-release.js'
export type { MatchResult, ReleaseCandidate, MatchConfidence, AggregatedTags } from './types.js'
