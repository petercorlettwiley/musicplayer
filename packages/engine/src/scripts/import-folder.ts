/**
 * Import CLI — the Section 10 milestone.
 * Scans a folder of music, matches each subfolder to MusicBrainz/Discogs,
 * and writes release.yaml files for high-confidence matches.
 *
 * Usage:
 *   pnpm --filter @musicplayer/engine ingest -- <audio-folder> [--output <metadata-folder>]
 *
 * Examples:
 *   pnpm --filter @musicplayer/engine ingest -- ~/Music
 *   pnpm --filter @musicplayer/engine ingest -- ~/Music --output ~/music-metadata
 *
 * For each subfolder:
 *   - High confidence  → writes release.yaml automatically
 *   - Low confidence   → prints candidates for you to review (no file written)
 *   - No match         → writes a stub release.yaml with embedded tag data as a starting point
 *
 * Set DISCOGS_TOKEN in packages/engine/.env to also query Discogs.
 */

import 'dotenv/config'
import * as path from 'node:path'
import { LocalFileSystemProvider } from '../filesystem/local.js'
import { scanLibrarySource } from '../scanner/index.js'
import { matchFolder, buildReleaseFromMBID, buildReleaseFromDiscogsId, buildStubRelease } from '../matching/index.js'
import { MusicBrainzClient } from '../metadata-providers/musicbrainz/client.js'
import { DiscogsClient } from '../metadata-providers/discogs/client.js'
import { writeYaml } from '../yaml/index.js'

const args = process.argv.slice(2).filter(a => a !== '--')
const audioFolder = args[0]
const outputFlagIdx = args.indexOf('--output')
const outputFolder = outputFlagIdx !== -1 ? args[outputFlagIdx + 1] : path.join(path.dirname(audioFolder ?? '.'), '_metadata')

if (!audioFolder) {
  console.error('Usage: import-folder.ts <audio-folder> [--output <metadata-folder>]')
  process.exit(1)
}

const LIBRARY_SOURCE_ID = 'import-cli'

console.log(`\nScanning: ${audioFolder}`)
console.log(`Output:   ${outputFolder}\n`)

const provider = new LocalFileSystemProvider()
const mbClient = new MusicBrainzClient()
const discogsClient = process.env['DISCOGS_TOKEN']
  ? new DiscogsClient({ token: process.env['DISCOGS_TOKEN'] })
  : undefined

if (!discogsClient) {
  console.log('(Discogs disabled — set DISCOGS_TOKEN in .env to enable)\n')
}

// Scan the audio folder.
const folders = await scanLibrarySource(provider, audioFolder)

if (folders.length === 0) {
  console.log('No audio files found in any subfolder.')
  process.exit(0)
}

console.log(`Found ${folders.length} release folder${folders.length === 1 ? '' : 's'}.\n`)
console.log('─'.repeat(60))

let matched = 0
let lowConfidence = 0
let unmatched = 0

for (const folder of folders) {
  console.log(`\n▸ ${folder.relativePath}`)
  console.log(`  ${folder.tracks.length} track${folder.tracks.length === 1 ? '' : 's'}`)

  const result = await matchFolder(folder, { mbClient, discogsClient })

  if (result.confidence === 'high') {
    const top = result.candidates[0]
    console.log(`  ✓ High confidence [${top.score}%]: ${top.artist ?? '?'} — ${top.title} (${top.year ?? '?'})`)
    console.log(`    ${top.medium ?? '?'} · ${top.label ?? '?'} ${top.catalogNumber ?? ''}`.trim())

    // Build and write the release.yaml.
    let release
    if (top.provider === 'musicbrainz') {
      release = await buildReleaseFromMBID(top.externalId, folder, LIBRARY_SOURCE_ID, mbClient)
    } else {
      release = await buildReleaseFromDiscogsId(Number(top.externalId), folder, LIBRARY_SOURCE_ID, discogsClient!)
    }

    const yamlPath = path.join(outputFolder, folder.relativePath, 'release.yaml')
    await writeYaml(yamlPath, release)
    console.log(`    → wrote ${path.relative(process.cwd(), yamlPath)}`)
    matched++

  } else if (result.confidence === 'low') {
    console.log(`  ⚠ Low confidence — top candidates:`)
    for (const c of result.candidates.slice(0, 3)) {
      console.log(`    [${c.score}%] (${c.provider}) ${c.artist ?? '?'} — ${c.title} (${c.year ?? '?'}) ${c.catalogNumber ?? ''}`)
    }
    console.log(`    → no file written; review candidates and pick one manually`)
    lowConfidence++

  } else {
    console.log(`  ✗ No match found`)
    if (folder.tracks[0]?.tags && Object.keys(folder.tracks[0].tags).length === 0) {
      console.log(`    (no embedded tags — fingerprinting not yet implemented)`)
    }
    const stub = buildStubRelease(folder, LIBRARY_SOURCE_ID)
    const yamlPath = path.join(outputFolder, folder.relativePath, 'release.yaml')
    await writeYaml(yamlPath, stub)
    console.log(`    → wrote stub ${path.relative(process.cwd(), yamlPath)}`)
    unmatched++
  }
}

console.log('\n' + '─'.repeat(60))
console.log(`\nDone. ${matched} matched · ${lowConfidence} need review · ${unmatched} unmatched (stub written)\n`)
