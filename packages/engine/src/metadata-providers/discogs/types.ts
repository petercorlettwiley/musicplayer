// Minimal types for the Discogs API responses — only the fields the engine uses.
// Discogs API docs: https://www.discogs.com/developers

export interface DiscogsSearchResponse {
  results: DiscogsSearchResult[]
  pagination: { pages: number; items: number; page: number; per_page: number }
}

export interface DiscogsSearchResult {
  id: number
  title: string
  year?: string
  label?: string[]
  catno?: string
  format?: string[]
  genre?: string[]
  style?: string[]
  country?: string
  barcode?: string[]
  thumb?: string
  type: 'release' | 'master'
}

export interface DiscogsRelease {
  id: number
  title: string
  year?: number
  artists?: Array<{ id: number; name: string }>
  labels?: Array<{ id: number; name: string; catno: string }>
  formats?: Array<{ name: string; qty?: string; descriptions?: string[] }>
  genres?: string[]
  styles?: string[]
  country?: string
  released?: string
  tracklist?: Array<{ position: string; title: string; duration?: string; type_: string }>
  images?: Array<{ type: string; uri: string; width: number; height: number }>
}
