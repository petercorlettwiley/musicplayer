/**
 * Local testing script — queries MusicBrainz and optionally Discogs for a release.
 *
 * Usage:
 *   pnpm --filter @musicplayer/engine query -- "Artist" "Album Title"
 *   pnpm --filter @musicplayer/engine query -- "Jay L" "BRSTL004"
 *
 * Discogs is enabled automatically when DISCOGS_TOKEN is set in packages/engine/.env.
 * See .env.example for the format.
 */

import 'dotenv/config'
import { MusicBrainzClient } from '../metadata-providers/musicbrainz/client.js'
import { DiscogsClient } from '../metadata-providers/discogs/client.js'

const args = process.argv.slice(2).filter(a => a !== '--')
const artist = args[0]
const title = args[1]

if (!artist || !title) {
  console.error('Usage: query-release.ts <artist> <title>')
  process.exit(1)
}

console.log(`\nSearching for: ${artist} — ${title}\n`)

// --- MusicBrainz ---
console.log('=== MusicBrainz ===')
try {
  const mb = new MusicBrainzClient()
  const mbResults = await mb.searchReleases({ artist, title }, 5)

  if (mbResults.releases.length === 0) {
    console.log('  No results found.')
  } else {
    for (const r of mbResults.releases) {
      const artistStr = r['artist-credit']?.map(c => c.name).join('') ?? 'Unknown'
      const label = r['label-info']?.[0]
      const labelStr = label?.label?.name ?? '—'
      const catno = label?.['catalog-number'] ?? '—'
      const format = r.media?.[0]?.format ?? '—'
      const tracks = r.media?.[0]?.['track-count'] ?? '?'
      console.log(`  [${r.score ?? '?'}%] ${artistStr} — ${r.title}`)
      console.log(`         ${r.date ?? '?'} · ${format} · ${tracks} tracks · ${labelStr} ${catno}`)
      console.log(`         MBID: ${r.id}`)
      console.log()
    }
  }
} catch (err) {
  console.error('  MusicBrainz error:', (err as Error).message)
}

// --- Discogs ---
const discogsToken = process.env['DISCOGS_TOKEN']
if (!discogsToken) {
  console.log('\n=== Discogs ===')
  console.log('  Skipped — set DISCOGS_TOKEN to enable.')
  console.log('  Get a token at: https://www.discogs.com/settings/developers')
} else {
  console.log('\n=== Discogs ===')
  try {
    const discogs = new DiscogsClient({ token: discogsToken })
    const dResults = await discogs.searchReleases({ artist, title }, 5)

    if (dResults.results.length === 0) {
      console.log('  No results found.')
    } else {
      for (const r of dResults.results) {
        const labelStr = r.label?.join(', ') ?? '—'
        const formatStr = r.format?.join(', ') ?? '—'
        console.log(`  ${r.title}`)
        console.log(`         ${r.year ?? '?'} · ${formatStr} · ${r.catno ?? '—'} · ${labelStr}`)
        console.log(`         Discogs ID: ${r.id}`)
        console.log()
      }
    }
  } catch (err) {
    console.error('  Discogs error:', (err as Error).message)
  }
}
