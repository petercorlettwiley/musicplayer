import { z } from 'zod'

// Links multiple releases that represent the "same album" in different forms —
// e.g., the 1984 original pressing and the 2015 Super Deluxe reissue of Purple Rain.
// Most releases will not belong to a group; grouping is opt-in, not the default.
export const ReleaseGroupSchema = z.object({
  id: z.string(),
  name: z.string(),
  musicbrainz_release_group_id: z.string().nullable(),
  members: z.array(z.string()),
})
export type ReleaseGroup = z.infer<typeof ReleaseGroupSchema>
