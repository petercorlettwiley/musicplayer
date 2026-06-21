import { z } from 'zod'
import { TagApplicationSchema } from './tags.js'

// A piece of cover art associated with a release (front cover, back cover, etc.).
export const ArtworkSchema = z.object({
  file: z.string(),
  type: z.enum(['front', 'back', 'disc', 'other']),
})
export type Artwork = z.infer<typeof ArtworkSchema>

// One track within a release, pointing to its audio file on disk.
// position accepts both numeric ("1", "2") and vinyl-style side/track ("A1", "B2") labels.
export const TrackSchema = z.object({
  track_id: z.string(),
  position: z.string(),
  title: z.string(),
  file: z.string(),
  tags: z.array(TagApplicationSchema).optional(),
})
export type Track = z.infer<typeof TrackSchema>

// The central entity — one specific release of an album (a particular pressing,
// format, reissue, etc.), with enough detail to distinguish it from other versions
// of the "same" album. audio_path is treated as opaque and never parsed or cleaned.
export const ReleaseSchema = z.object({
  id: z.string(),
  release_group_id: z.string().nullable(),
  source: z.object({
    library_source_id: z.string(),
    audio_path: z.string(),
  }),
  artist: z.string().nullable(),
  title: z.string(),
  year: z.number().int().nullable(),
  label: z.string().nullable(),
  catalog_number: z.string().nullable(),
  medium: z.string().nullable(),
  source_format_note: z.string().nullable(),
  genres: z.array(z.string()).optional(),
  tracks: z.array(TrackSchema),
  artwork: z.array(ArtworkSchema).optional(),
  tags: z.array(TagApplicationSchema).optional(),
  date_added: z.string().datetime().optional(),
})
export type Release = z.infer<typeof ReleaseSchema>
