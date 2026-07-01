/**
 * Import CLI — scans a folder of music, matches each subfolder to Discogs/MusicBrainz,
 * and writes release.yaml files.
 *
 * Usage:
 *   pnpm --filter @musicplayer/engine ingest -- <audio-folder> [options]
 *
 * Options:
 *   --output <path>     Where to write release.yaml files (default: <audio-folder>/../_metadata)
 *   --medium <format>   Preferred medium to bias matching toward, e.g. "Vinyl", "Digital Media"
 *   --auto              Skip interactive prompts; auto-write top candidate for high confidence
 *
 * Examples:
 *   pnpm --filter @musicplayer/engine ingest -- ~/Music
 *   pnpm --filter @musicplayer/engine ingest -- ~/Music --output ~/music-metadata
 *   pnpm --filter @musicplayer/engine ingest -- ~/Music --medium Vinyl
 *   pnpm --filter @musicplayer/engine ingest -- ~/Music --auto
 *
 * For each subfolder:
 *   - Clear winner (top candidate 15+ pts ahead) → writes release.yaml automatically
 *   - Ambiguous versions (multiple close candidates) → shows a numbered list to pick from
 *   - Low confidence → shows candidates to pick from or skip
 *   - No match → writes a stub release.yaml with embedded tag data as a starting point
 *
 * Set DISCOGS_TOKEN in packages/engine/.env to enable Discogs (strongly recommended).
 */

import 'dotenv/config'
import * as path from 'node:path'
import * as readline from 'node:readline/promises'
import { LocalFileSystemProvider } from '../filesystem/local.js'
import { scanLibrarySource } from '../scanner/index.js'
import { matchFolder, buildReleaseFromMBID, buildReleaseFromDiscogsId, buildStubRelease } from '../matching/index.js'
import { MusicBrainzClient } from '../metadata-providers/musicbrainz/client.js'
import { DiscogsClient } from '../metadata-providers/discogs/client.js'
import { writeYaml } from '../yaml/index.js'
import type { ReleaseCandidate } from '../matching/types.js'

const args = process.argv.slice(2).filter(a => a !== '--')
const audioFolder = args[0]
const outputFlagIdx = args.indexOf('--output')
const outputFolder = outputFlagIdx !== -1 ? args[outputFlagIdx + 1] : path.join(path.dirname(audioFolder ?? '.'), '_metadata')
const mediumFlagIdx = args.indexOf('--medium')
const preferredMedium = mediumFlagIdx !== -1 ? args[mediumFlagIdx + 1] : undefined
const autoMode = args.includes('--auto')

if (!audioFolder) {
  console.error('Usage: import-folder.ts <audio-folder> [--output <path>] [--medium <format>] [--auto]')
  process.exit(1)
}

const LIBRARY_SOURCE_ID = 'import-cli'
// Show the interactive picker when 2+ candidates are within this many points of the top.
const AMBIGUITY_THRESHOLD = 15

console.log(`\nScanning: ${audioFolder}`)
console.log(`Output:   ${outputFolder}`)
if (preferredMedium) console.log(`Medium:   ${preferredMedium} (preferred)`)
if (autoMode) console.log(`Mode:     auto (no prompts)`)
console.log()

const provider = new LocalFileSystemProvider()
const mbClient = new MusicBrainzClient()
const discogsClient = process.env['DISCOGS_TOKEN']
  ? new DiscogsClient({ token: process.env['DISCOGS_TOKEN'] })
  : undefined

if (!discogsClient) {
  console.log('(Discogs disabled — set DISCOGS_TOKEN in .env to enable)\n')
}

// Formats one candidate as a single summary line for the picker.
function formatCandidate(c: ReleaseCandidate, idx: number): string {
  const parts: string[] = []
  if (c.artist) parts.push(c.artist)
  parts.push('—')
  parts.push(c.title)
  const details: string[] = []
  if (c.year) details.push(String(c.year))
  if (c.medium) details.push(c.medium)
  if (c.label) details.push(c.label)
  if (c.catalogNumber) details.push(c.catalogNumber)
  if (c.country) details.push(c.country)
  const detailStr = details.length > 0 ? ` · ${details.join(' · ')}` : ''
  return `  ${idx + 1}.  [${c.score}%] (${c.provider}) ${parts.join(' ')}${detailStr}`
}

// Returns true when multiple candidates are close enough in score that the top
// pick isn't a clear winner and the user should be asked to confirm.
function isAmbiguous(candidates: ReleaseCandidate[]): boolean {
  if (candidates.length < 2) return false
  return candidates[1].score >= candidates[0].score - AMBIGUITY_THRESHOLD
}

// Shows a numbered list of candidates and prompts the user to pick one.
// Returns the chosen candidate, 'skip' to write nothing, or 'quit' to stop everything.
async function promptPick(
  candidates: ReleaseCandidate[],
  rl: readline.Interface,
): Promise<ReleaseCandidate | 'skip' | 'quit'> {
  const shown = candidates.slice(0, 5)
  console.log()
  shown.forEach((c, i) => console.log(formatCandidate(c, i)))
  console.log()

  while (true) {
    const answer = (await rl.question(`  Pick 1–${shown.length}, (s)kip, (q)uit: `)).trim().toLowerCase()
    if (answer === 'q' || answer === 'quit') return 'quit'
    if (answer === 's' || answer === 'skip') return 'skip'
    const n = parseInt(answer)
    if (!isNaN(n) && n >= 1 && n <= shown.length) return shown[n - 1]
    console.log('  Invalid input — try again.')
  }
}

// Builds a Release from a chosen candidate and writes release.yaml.
async function writeCandidate(
  candidate: ReleaseCandidate,
  folder: Parameters<typeof buildReleaseFromMBID>[1],
  yamlPath: string,
) {
  let release
  if (candidate.provider === 'musicbrainz') {
    release = await buildReleaseFromMBID(candidate.externalId, folder, LIBRARY_SOURCE_ID, mbClient)
  } else {
    release = await buildReleaseFromDiscogsId(Number(candidate.externalId), folder, LIBRARY_SOURCE_ID, discogsClient!)
  }
  await writeYaml(yamlPath, release)
  console.log(`    → wrote ${path.relative(process.cwd(), yamlPath)}`)
}

// Scan the audio folder.
const folders = await scanLibrarySource(provider, audioFolder)

if (folders.length === 0) {
  console.log('No audio files found in any subfolder.')
  process.exit(0)
}

console.log(`Found ${folders.length} release folder${folders.length === 1 ? '' : 's'}.\n`)
console.log('─'.repeat(60))

const rl = autoMode
  ? null
  : readline.createInterface({ input: process.stdin, output: process.stdout })

let matched = 0
let skipped = 0
let unmatched = 0
let quit = false

for (const folder of folders) {
  if (quit) break

  console.log(`\n▸ ${folder.relativePath}`)
  console.log(`  ${folder.tracks.length} track${folder.tracks.length === 1 ? '' : 's'}`)

  const result = await matchFolder(folder, { mbClient, discogsClient, preferredMedium })
  const yamlPath = path.join(outputFolder, folder.relativePath, 'release.yaml')

  if (result.confidence === 'none') {
    console.log(`  ✗ No match found`)
    const stub = buildStubRelease(folder, LIBRARY_SOURCE_ID)
    await writeYaml(yamlPath, stub)
    console.log(`    → wrote stub ${path.relative(process.cwd(), yamlPath)}`)
    unmatched++
    continue
  }

  const top = result.candidates[0]

  // Auto-write path: high confidence AND either auto mode or a clear winner.
  if (result.confidence === 'high' && (autoMode || !isAmbiguous(result.candidates))) {
    console.log(`  ✓ [${top.score}%] (${top.provider}) ${top.artist ?? '?'} — ${top.title} (${top.year ?? '?'})`)
    const details = [top.medium, top.label, top.catalogNumber, top.country].filter(Boolean).join(' · ')
    if (details) console.log(`    ${details}`)
    await writeCandidate(top, folder, yamlPath)
    matched++
    continue
  }

  // Interactive path: ambiguous high-confidence, or low confidence.
  const label = result.confidence === 'high'
    ? `  Multiple versions found for "${top.title}" — pick one:`
    : `  Low confidence — pick a candidate or skip:`

  console.log(label)

  const choice = await promptPick(result.candidates, rl!)

  if (choice === 'quit') {
    quit = true
    console.log('\n  Stopped.')
    break
  }

  if (choice === 'skip') {
    console.log('    → skipped')
    skipped++
    continue
  }

  await writeCandidate(choice, folder, yamlPath)
  matched++
}

rl?.close()

console.log('\n' + '─'.repeat(60))
console.log(`\nDone. ${matched} matched · ${skipped} skipped · ${unmatched} unmatched (stub written)\n`)
