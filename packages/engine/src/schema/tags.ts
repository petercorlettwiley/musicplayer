import { z } from 'zod'

// A single typed field in a tag's metadata definition — e.g., "temperature" as
// a number measured in °F. Declared on the tag definition, not per-application.
export const TagMetadataFieldSchema = z.object({
  key: z.string(),
  type: z.enum(['number', 'string', 'boolean', 'date']),
  unit: z.string().optional(),
})
export type TagMetadataField = z.infer<typeof TagMetadataFieldSchema>

// A named collection that tags can belong to — e.g., "Summer Music".
// Tags without a group_id are standalone one-off tags.
export const TagGroupSchema = z.object({
  id: z.string(),
  name: z.string(),
})
export type TagGroup = z.infer<typeof TagGroupSchema>

// The definition of a single tag — its name, which group it belongs to (if any),
// and what metadata fields can be filled in when it is applied to a release or track.
export const TagSchema = z.object({
  id: z.string(),
  name: z.string(),
  group_id: z.string().nullable(),
  metadata_schema: z.array(TagMetadataFieldSchema),
})
export type Tag = z.infer<typeof TagSchema>

// A tag being applied to a specific release or track, optionally carrying
// typed metadata values (e.g., { temperature: 80 } for a "Beach Time" tag).
// The actual type checking of metadata values against the tag's schema happens
// at the tagging layer, not here.
export const TagApplicationSchema = z.object({
  tag_id: z.string(),
  metadata: z.record(z.union([z.string(), z.number(), z.boolean()])).optional(),
})
export type TagApplication = z.infer<typeof TagApplicationSchema>

// The full _taxonomy/tags.yaml file — the global list of all tag groups
// and tag definitions shared across the entire library.
export const TagTaxonomySchema = z.object({
  tag_groups: z.array(TagGroupSchema),
  tags: z.array(TagSchema),
})
export type TagTaxonomy = z.infer<typeof TagTaxonomySchema>
