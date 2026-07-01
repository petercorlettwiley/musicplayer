import type { MBRelease } from '../metadata-providers/musicbrainz/types.js'
import type { DiscogsSearchResult } from '../metadata-providers/discogs/types.js'
import type { AggregatedTags, ReleaseCandidate } from './types.js'

function normalizeStr(s: string | undefined | null): string {
  return (s ?? '').toLowerCase().trim()
}

// Scores a MusicBrainz search result against the folder's aggregated tags.
// Starts from the MB API's own relevance score and adjusts based on signals
// we have that MB can't know about (track count, exact catalog number, etc.).
// If preferredMedium is set (e.g. "Digital Media"), candidates that match get
// a boost and those that don't get a penalty.
export function scoreMBRelease(release: MBRelease, tags: AggregatedTags, preferredMedium?: string): ReleaseCandidate {
  let score = release.score ?? 50

  const labelInfo = release['label-info']?.[0]
  const candidateCatno = labelInfo?.['catalog-number']
  const candidateTrackCount = release.media?.reduce((n, m) => n + (m['track-count'] ?? 0), 0)
  const candidateYear = release.date ? parseInt(release.date, 10) : null
  const candidateMedium = release.media?.[0]?.format ?? null

  // Barcode is the most reliable signal — if it matches exactly, boost heavily.
  if (tags.barcode && release.barcode && tags.barcode === release.barcode) {
    score = Math.max(score, 92)
  }

  // Catalog number match is also very reliable for physical releases.
  if (tags.catalogNumber && candidateCatno) {
    if (normalizeStr(tags.catalogNumber) === normalizeStr(candidateCatno)) {
      score = Math.min(100, score + 15)
    }
  }

  // Track count agreement is a good sanity check.
  if (candidateTrackCount !== undefined && candidateTrackCount > 0) {
    if (candidateTrackCount === tags.trackCount) score = Math.min(100, score + 8)
    else score = Math.max(0, score - 12)
  }

  // Year match gives a smaller boost.
  if (tags.year && candidateYear && tags.year === candidateYear) {
    score = Math.min(100, score + 5)
  }

  // When the user has specified an expected medium, reward candidates that match
  // and penalize those that don't. This is the primary way to disambiguate between
  // e.g. the vinyl and digital releases of the same album.
  if (preferredMedium && candidateMedium) {
    if (normalizeStr(candidateMedium).includes(normalizeStr(preferredMedium)) ||
        normalizeStr(preferredMedium).includes(normalizeStr(candidateMedium))) {
      score = Math.min(100, score + 15)
    } else {
      score = Math.max(0, score - 15)
    }
  }

  const artistCredit = release['artist-credit']?.map(c => c.name).join('') ?? null

  return {
    provider: 'musicbrainz',
    externalId: release.id,
    score: Math.round(score),
    title: release.title,
    artist: artistCredit,
    year: candidateYear,
    label: labelInfo?.label?.name ?? null,
    catalogNumber: candidateCatno ?? null,
    medium: candidateMedium,
    country: release.country ?? null,
    trackCount: candidateTrackCount ?? null,
  }
}

// Scores a Discogs search result against the folder's aggregated tags.
// Discogs doesn't give us a relevance score, so we build one from scratch.
// Starts slightly higher than the MB base because Discogs data is preferred
// for version/format details, genres, and styles.
export function scoreDiscogsResult(result: DiscogsSearchResult, tags: AggregatedTags, preferredMedium?: string): ReleaseCandidate {
  let score = 58  // base score — higher than MB's 50 to favor Discogs when close

  // Barcode match — highest confidence signal.
  if (tags.barcode && result.barcode?.includes(tags.barcode)) {
    score = Math.max(score, 90)
  }

  // Catalog number match.
  if (tags.catalogNumber && result.catno) {
    if (normalizeStr(tags.catalogNumber) === normalizeStr(result.catno)) {
      score = Math.min(100, score + 20)
    }
  }

  // Year match.
  const candidateYear = result.year ? parseInt(result.year, 10) : null
  if (tags.year && candidateYear && tags.year === candidateYear) {
    score = Math.min(100, score + 8)
  }

  // Label match gives a small boost.
  if (tags.label && result.label?.some(l => normalizeStr(l) === normalizeStr(tags.label))) {
    score = Math.min(100, score + 5)
  }

  // Medium preference — same logic as the MB scorer.
  const candidateMedium = result.format?.[0] ?? null
  if (preferredMedium && candidateMedium) {
    if (normalizeStr(candidateMedium).includes(normalizeStr(preferredMedium)) ||
        normalizeStr(preferredMedium).includes(normalizeStr(candidateMedium))) {
      score = Math.min(100, score + 15)
    } else {
      score = Math.max(0, score - 15)
    }
  }

  return {
    provider: 'discogs',
    externalId: String(result.id),
    score: Math.round(score),
    title: result.title.split(' - ').slice(1).join(' - ') || result.title,
    artist: result.title.includes(' - ') ? result.title.split(' - ')[0] : null,
    year: candidateYear,
    label: result.label?.[0] ?? null,
    catalogNumber: result.catno ?? null,
    medium: candidateMedium,
    country: result.country ?? null,
    trackCount: null,  // not available in search results
  }
}

// Determines overall confidence from the sorted candidate list.
export function computeConfidence(candidates: ReleaseCandidate[]): 'high' | 'low' | 'none' {
  if (candidates.length === 0) return 'none'
  const top = candidates[0].score
  if (top >= 80) return 'high'
  if (top >= 45) return 'low'
  return 'none'
}
