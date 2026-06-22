import { ApiCache } from '../cache/index.js'
import type { MBRelease, MBReleaseSearchResponse } from './types.js'

const BASE_URL = 'https://musicbrainz.org/ws/2'
// MusicBrainz requires a descriptive User-Agent header identifying your app.
const USER_AGENT = 'musicplayer/0.0.0 (https://github.com/petercorlettwiley/musicplayer)'

export interface MusicBrainzClientOptions {
  cache?: ApiCache
  // How many requests per second to allow. MusicBrainz enforces a 1 req/sec limit.
  requestsPerSecond?: number
}

export interface MBSearchParams {
  title?: string
  artist?: string
  barcode?: string
  catalogNumber?: string
  label?: string
  // MusicBrainz medium format — e.g. "Digital Media", "Vinyl", "CD".
  // Included as a Lucene clause to bias results toward the specified format.
  format?: string
}

export class MusicBrainzClient {
  private readonly cache: ApiCache
  private readonly minIntervalMs: number
  private lastRequestAt = 0

  constructor({ cache = new ApiCache(), requestsPerSecond = 1 }: MusicBrainzClientOptions = {}) {
    this.cache = cache
    this.minIntervalMs = requestsPerSecond > 0 ? Math.floor(1000 / requestsPerSecond) : 0
  }

  // Searches for releases matching any combination of title, artist, barcode,
  // catalog number, or label. Returns up to `limit` results with relevance scores.
  async searchReleases(params: MBSearchParams, limit = 10): Promise<MBReleaseSearchResponse> {
    const clauses: string[] = []
    if (params.title) clauses.push(`release:"${params.title}"`)
    if (params.artist) clauses.push(`artist:"${params.artist}"`)
    if (params.barcode) clauses.push(`barcode:${params.barcode}`)
    if (params.catalogNumber) clauses.push(`catno:"${params.catalogNumber}"`)
    if (params.label) clauses.push(`label:"${params.label}"`)
    if (params.format) clauses.push(`format:"${params.format}"`)

    const query = clauses.join(' AND ')
    const url = `${BASE_URL}/release?query=${encodeURIComponent(query)}&limit=${limit}&fmt=json`
    return this.fetch<MBReleaseSearchResponse>(url)
  }

  // Fetches the full details for one release by its MusicBrainz ID, including
  // track listing, artist credits, label info, and release group membership.
  async lookupRelease(mbid: string): Promise<MBRelease> {
    const inc = 'recordings+artists+labels+release-groups'
    const url = `${BASE_URL}/release/${mbid}?inc=${inc}&fmt=json`
    return this.fetch<MBRelease>(url)
  }

  // Makes a GET request, respecting the rate limit and returning cached responses
  // when available. Throws on non-2xx responses.
  private async fetch<T>(url: string): Promise<T> {
    const cached = this.cache.get<T>(url)
    if (cached !== undefined) return cached

    const now = Date.now()
    const elapsed = now - this.lastRequestAt
    if (this.minIntervalMs > 0 && elapsed < this.minIntervalMs) {
      await new Promise(resolve => setTimeout(resolve, this.minIntervalMs - elapsed))
    }
    this.lastRequestAt = Date.now()

    const response = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT, 'Accept': 'application/json' },
    })

    if (!response.ok) {
      throw new Error(`MusicBrainz API ${response.status}: ${response.statusText} — ${url}`)
    }

    const data = await response.json() as T
    this.cache.set(url, data)
    return data
  }
}
