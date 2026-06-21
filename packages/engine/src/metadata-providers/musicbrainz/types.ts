// Minimal types for the MusicBrainz JSON API responses — only the fields
// the engine actually uses. Full MB schema docs: https://musicbrainz.org/doc/MusicBrainz_API

export interface MBReleaseSearchResponse {
  releases: MBRelease[]
  count: number
  offset: number
}

export interface MBRelease {
  id: string
  title: string
  date?: string
  country?: string
  status?: string
  barcode?: string
  score?: number
  'release-group'?: { id: string; 'primary-type'?: string }
  'artist-credit'?: MBArtistCredit[]
  'label-info'?: MBLabelInfo[]
  media?: MBMedia[]
}

export interface MBArtistCredit {
  artist: { id: string; name: string; 'sort-name': string }
  name: string
  joinphrase?: string
}

export interface MBLabelInfo {
  label?: { id: string; name: string }
  'catalog-number'?: string
}

export interface MBMedia {
  format?: string
  position?: number
  'track-count'?: number
  tracks?: MBTrack[]
}

export interface MBTrack {
  id: string
  number: string
  title: string
  length?: number
  recording?: { id: string; title: string }
}
