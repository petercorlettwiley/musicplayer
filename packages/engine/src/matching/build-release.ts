import { randomUUID } from 'node:crypto'
import type { MusicBrainzClient } from '../metadata-providers/musicbrainz/client.js'
import type { DiscogsClient } from '../metadata-providers/discogs/client.js'
import type { MBTrack } from '../metadata-providers/musicbrainz/types.js'
import type { Release, Track } from '../schema/release.js'
import type { ScannedFolder, ScannedTrack } from '../scanner/types.js'

// Tries to map a list of scanned audio files to a track listing from the API.
// First tries to match by embedded track number; falls back to alphabetical order.
function mapTracksToFiles(apiTracks: Array<{ position: string; title: string }>, scanned: ScannedTrack[]): Track[] {
  const sorted = [...scanned].sort((a, b) => a.filename.localeCompare(b.filename))

  return apiTracks.map((apiTrack, i) => {
    // Try to find a scanned file whose embedded track number matches this position.
    const byTagMatch = sorted.find(s => {
      const num = s.tags.trackNumber
      return num !== undefined && (num === apiTrack.position || num === String(i + 1))
    })
    const file = byTagMatch ?? sorted[i]

    return {
      track_id: randomUUID(),
      position: apiTrack.position,
      title: apiTrack.title,
      file: file?.filename ?? `track-${i + 1}`,
    }
  })
}

// Builds a stub Release when no API match was found. Uses whatever embedded tags
// exist as a best-effort starting point, leaving unknown fields as null.
export function buildStubRelease(folder: ScannedFolder, librarySourceId: string): Release {
  const firstTrackTags = folder.tracks[0]?.tags ?? {}
  const sorted = [...folder.tracks].sort((a, b) => a.filename.localeCompare(b.filename))

  return {
    id: randomUUID(),
    release_group_id: null,
    source: { library_source_id: librarySourceId, audio_path: folder.relativePath },
    artist: firstTrackTags.albumArtist ?? firstTrackTags.artist ?? null,
    title: firstTrackTags.album ?? folder.relativePath,
    year: firstTrackTags.year ?? null,
    label: firstTrackTags.label ?? null,
    catalog_number: firstTrackTags.catalogNumber ?? null,
    medium: null,
    source_format_note: null,
    date_added: new Date().toISOString(),
    tracks: sorted.map((t, i) => ({
      track_id: randomUUID(),
      position: t.tags.trackNumber ?? String(i + 1),
      title: t.tags.title ?? t.filename,
      file: t.filename,
    })),
  }
}

// Fetches the full MusicBrainz release (to get the track listing) and maps it to
// our Release schema, with actual filenames from the scanned folder.
export async function buildReleaseFromMBID(
  mbid: string,
  folder: ScannedFolder,
  librarySourceId: string,
  mbClient: MusicBrainzClient,
): Promise<Release> {
  const mb = await mbClient.lookupRelease(mbid)

  const labelInfo = mb['label-info']?.[0]
  const artistCredit = mb['artist-credit']?.map(c => c.name).join('') ?? null
  const year = mb.date ? parseInt(mb.date, 10) : null
  const releaseGroupFirstDate = mb['release-group']?.['first-release-date']
  const originalYear = releaseGroupFirstDate ? parseInt(releaseGroupFirstDate, 10) : null

  // Flatten all tracks across all media into one list.
  const apiTracks: Array<{ position: string; title: string }> =
    (mb.media ?? []).flatMap(media =>
      (media.tracks ?? []).map((t: MBTrack) => ({
        position: t.number,
        title: t.title,
      }))
    )

  const tracks = apiTracks.length > 0
    ? mapTracksToFiles(apiTracks, folder.tracks)
    : folder.tracks
        .sort((a, b) => a.filename.localeCompare(b.filename))
        .map((t, i) => ({
          track_id: randomUUID(),
          position: t.tags.trackNumber ?? String(i + 1),
          title: t.tags.title ?? t.filename,
          file: t.filename,
        }))

  const genres = mb.genres?.map(g => g.name)
  const normalYear = isNaN(year as number) ? null : year
  const normalOriginalYear = (originalYear && !isNaN(originalYear)) ? originalYear : null

  return {
    id: mb.id,
    release_group_id: mb['release-group']?.id ?? null,
    source: { library_source_id: librarySourceId, audio_path: folder.relativePath },
    artist: artistCredit,
    title: mb.title,
    year: normalYear,
    ...(normalOriginalYear !== null && normalOriginalYear !== normalYear ? { original_year: normalOriginalYear } : {}),
    label: labelInfo?.label?.name ?? null,
    catalog_number: labelInfo?.['catalog-number'] ?? null,
    medium: mb.media?.[0]?.format ?? null,
    source_format_note: null,
    ...(genres && genres.length > 0 ? { genres } : {}),
    date_added: new Date().toISOString(),
    tracks,
  }
}

// Fetches the full Discogs release and maps it to our Release schema.
// Also fetches the master release (if one exists) to get the original release year.
export async function buildReleaseFromDiscogsId(
  releaseId: number,
  folder: ScannedFolder,
  librarySourceId: string,
  discogsClient: DiscogsClient,
): Promise<Release> {
  const d = await discogsClient.lookupRelease(releaseId)

  // Look up the master to get the original release year, which may differ from
  // this specific pressing's year. Best-effort — don't fail if master lookup errors.
  let originalYear: number | null = null
  if (d.master_id) {
    try {
      const master = await discogsClient.lookupMaster(d.master_id)
      if (master.year && master.year !== d.year) {
        originalYear = master.year
      }
    } catch {
      // master lookup failed — leave original_year null
    }
  }

  const apiTracks = (d.tracklist ?? [])
    .filter(t => t.type_ === 'track')
    .map(t => ({ position: t.position, title: t.title }))

  const tracks = apiTracks.length > 0
    ? mapTracksToFiles(apiTracks, folder.tracks)
    : folder.tracks
        .sort((a, b) => a.filename.localeCompare(b.filename))
        .map((t, i) => ({
          track_id: randomUUID(),
          position: t.tags.trackNumber ?? String(i + 1),
          title: t.tags.title ?? t.filename,
          file: t.filename,
        }))

  return {
    id: `discogs-${d.id}`,
    release_group_id: null,
    source: { library_source_id: librarySourceId, audio_path: folder.relativePath },
    artist: d.artists?.map(a => a.name).join(', ') ?? null,
    title: d.title,
    year: d.year ?? null,
    ...(originalYear !== null ? { original_year: originalYear } : {}),
    label: d.labels?.[0]?.name ?? null,
    catalog_number: d.labels?.[0]?.catno ?? null,
    medium: d.formats?.[0]?.name ?? null,
    source_format_note: d.formats?.[0]?.descriptions?.join(', ') ?? null,
    ...(d.genres && d.genres.length > 0 ? { genres: d.genres } : {}),
    ...(d.styles && d.styles.length > 0 ? { styles: d.styles } : {}),
    date_added: new Date().toISOString(),
    tracks,
  }
}
