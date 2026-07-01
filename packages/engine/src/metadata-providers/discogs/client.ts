import { ApiCache } from '../cache/index.js'
import type { DiscogsMaster, DiscogsRelease, DiscogsSearchResponse } from './types.js'

const BASE_URL = 'https://api.discogs.com'

export interface DiscogsClientOptions {
  // Personal access token from https://www.discogs.com/settings/developers
  token: string
  cache?: ApiCache
  // Discogs allows 60 requests/minute with auth — default stays well under that.
  requestsPerSecond?: number
}

export interface DiscogsSearchParams {
  title?: string
  artist?: string
  label?: string
  catalogNumber?: string
  barcode?: string
  format?: string
  year?: number
}

export class DiscogsClient {
  private readonly token: string
  private readonly cache: ApiCache
  private readonly minIntervalMs: number
  private lastRequestAt = 0

  constructor({ token, cache = new ApiCache(), requestsPerSecond = 1 }: DiscogsClientOptions) {
    this.token = token
    this.cache = cache
    this.minIntervalMs = requestsPerSecond > 0 ? Math.floor(1000 / requestsPerSecond) : 0
  }

  // Searches the Discogs database for releases matching the given params.
  // Returns up to `perPage` results (max 100).
  async searchReleases(params: DiscogsSearchParams, perPage = 10): Promise<DiscogsSearchResponse> {
    const query = new URLSearchParams({ type: 'release', per_page: String(perPage) })
    if (params.title) query.set('title', params.title)
    if (params.artist) query.set('artist', params.artist)
    if (params.label) query.set('label', params.label)
    if (params.catalogNumber) query.set('catno', params.catalogNumber)
    if (params.barcode) query.set('barcode', params.barcode)
    if (params.format) query.set('format', params.format)
    if (params.year) query.set('year', String(params.year))

    const url = `${BASE_URL}/database/search?${query.toString()}`
    return this.fetch<DiscogsSearchResponse>(url)
  }

  // Fetches the full details for a specific Discogs release by its numeric ID.
  async lookupRelease(releaseId: number): Promise<DiscogsRelease> {
    const url = `${BASE_URL}/releases/${releaseId}`
    return this.fetch<DiscogsRelease>(url)
  }

  // Fetches a Discogs master release by its numeric ID.
  // The master's year is the earliest known release year across all versions.
  async lookupMaster(masterId: number): Promise<DiscogsMaster> {
    const url = `${BASE_URL}/masters/${masterId}`
    return this.fetch<DiscogsMaster>(url)
  }

  // Makes a GET request with token auth, respecting rate limits and caching responses.
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
      headers: {
        'Authorization': `Discogs token=${this.token}`,
        'Accept': 'application/json',
        'User-Agent': 'musicplayer/0.0.0 (https://github.com/petercorlettwiley/musicplayer)',
      },
    })

    if (!response.ok) {
      throw new Error(`Discogs API ${response.status}: ${response.statusText} — ${url}`)
    }

    const data = await response.json() as T
    this.cache.set(url, data)
    return data
  }
}
