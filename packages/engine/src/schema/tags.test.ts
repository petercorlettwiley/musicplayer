import { describe, it, expect } from 'vitest'
import { TagSchema, TagGroupSchema, TagApplicationSchema, TagTaxonomySchema } from './tags.js'

describe('TagGroupSchema', () => {
  it('parses a valid tag group', () => {
    const result = TagGroupSchema.safeParse({ id: 'summer-music', name: 'Summer Music' })
    expect(result.success).toBe(true)
  })

  it('rejects a group missing name', () => {
    expect(TagGroupSchema.safeParse({ id: 'summer-music' }).success).toBe(false)
  })
})

describe('TagSchema', () => {
  it('parses a tag with a metadata schema', () => {
    const tag = {
      id: 'beach-time',
      name: 'Beach Time',
      group_id: 'summer-music',
      metadata_schema: [{ key: 'temperature', type: 'number', unit: '°F' }],
    }
    const result = TagSchema.safeParse(tag)
    expect(result.success).toBe(true)
    if (!result.success) return
    expect(result.data.metadata_schema[0].type).toBe('number')
  })

  it('parses a one-off tag with no metadata schema', () => {
    const tag = { id: 'catchy', name: 'Catchy', group_id: null, metadata_schema: [] }
    expect(TagSchema.safeParse(tag).success).toBe(true)
  })

  it('rejects an unknown metadata field type', () => {
    const tag = {
      id: 'test',
      name: 'Test',
      group_id: null,
      metadata_schema: [{ key: 'foo', type: 'array' }],
    }
    expect(TagSchema.safeParse(tag).success).toBe(false)
  })
})

describe('TagApplicationSchema', () => {
  it('parses a simple tag application with no metadata', () => {
    expect(TagApplicationSchema.safeParse({ tag_id: 'catchy' }).success).toBe(true)
  })

  it('parses a tag application with typed metadata values', () => {
    const application = {
      tag_id: 'beach-time',
      metadata: { temperature: 80, notes: 'humid', sunny: true },
    }
    const result = TagApplicationSchema.safeParse(application)
    expect(result.success).toBe(true)
    if (!result.success) return
    expect(result.data.metadata?.temperature).toBe(80)
  })

  it('rejects metadata values that are not primitives', () => {
    const application = { tag_id: 'test', metadata: { nested: { object: true } } }
    expect(TagApplicationSchema.safeParse(application).success).toBe(false)
  })
})

describe('TagTaxonomySchema', () => {
  it('parses the full taxonomy example from the writeup', () => {
    const taxonomy = {
      tag_groups: [{ id: 'summer-music', name: 'Summer Music' }],
      tags: [
        {
          id: 'beach-time',
          name: 'Beach Time',
          group_id: 'summer-music',
          metadata_schema: [{ key: 'temperature', type: 'number', unit: '°F' }],
        },
        { id: 'catchy', name: 'Catchy', group_id: null, metadata_schema: [] },
      ],
    }
    const result = TagTaxonomySchema.safeParse(taxonomy)
    expect(result.success).toBe(true)
    if (!result.success) return
    expect(result.data.tags).toHaveLength(2)
    expect(result.data.tag_groups).toHaveLength(1)
  })
})
