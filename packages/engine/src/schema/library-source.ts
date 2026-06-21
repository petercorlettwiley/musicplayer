import { z } from 'zod'

// One place where music files live — either a folder on the local machine or a
// remote SFTP server. audio_root points to the files; metadata_root points to
// where this library's YAML metadata is written (always local and writable).
export const LibrarySourceSchema = z.object({
  id: z.string(),
  type: z.enum(['local', 'sftp']),
  host: z.string().optional(),
  port: z.number().int().optional(),
  username: z.string().optional(),
  audio_root: z.string(),
  // When true, the engine will never attempt to write anything to audio_root.
  readonly: z.boolean(),
  metadata_root: z.string(),
  // Optional template for how metadata folders are named on disk — e.g.,
  // "{year} - {artist} - {title}". Defaults to just the release ID.
  folder_naming_template: z.string().optional(),
})
export type LibrarySource = z.infer<typeof LibrarySourceSchema>

// The top-level library-sources.yaml file that lists every source the engine knows about.
export const LibrarySourcesFileSchema = z.object({
  sources: z.array(LibrarySourceSchema),
})
export type LibrarySourcesFile = z.infer<typeof LibrarySourcesFileSchema>
