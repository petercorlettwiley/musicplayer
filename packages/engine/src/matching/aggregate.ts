import type { ScannedFolder } from '../scanner/types.js'
import type { AggregatedTags } from './types.js'

// Returns the most common non-null value in an array, or undefined if there are none.
function mode<T>(values: (T | undefined)[]): T | undefined {
  const counts = new Map<string, { value: T; count: number }>()
  for (const v of values) {
    if (v === undefined || v === null) continue
    const key = String(v)
    const entry = counts.get(key)
    if (entry) entry.count++
    else counts.set(key, { value: v, count: 1 })
  }
  let best: { value: T; count: number } | undefined
  for (const entry of counts.values()) {
    if (!best || entry.count > best.count) best = entry
  }
  return best?.value
}

// Condenses the per-track embedded tags from a scanned folder into a single set of
// signals we can query APIs with and score candidates against. For fields like album
// and artist (which should be the same across all tracks), we take the most common
// value to handle files where one track has a slightly different tag.
export function aggregateFolderTags(folder: ScannedFolder): AggregatedTags {
  const tags = folder.tracks.map(t => t.tags)

  return {
    album: mode(tags.map(t => t.album)),
    artist: mode(tags.map(t => t.albumArtist ?? t.artist)),
    year: mode(tags.map(t => t.year)),
    label: mode(tags.map(t => t.label)),
    catalogNumber: mode(tags.map(t => t.catalogNumber)),
    barcode: mode(tags.map(t => t.barcode)),
    trackCount: folder.tracks.length,
  }
}
