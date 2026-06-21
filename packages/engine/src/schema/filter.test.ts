import { describe, it, expect } from 'vitest'
import { FilterExpressionSchema } from './filter.js'

describe('FilterExpressionSchema', () => {
  it('parses a simple field condition', () => {
    const expr = { field: 'label', op: 'eq', value: 'Atlantic' }
    expect(FilterExpressionSchema.safeParse(expr).success).toBe(true)
  })

  it('parses a between condition with a range tuple', () => {
    const expr = { field: 'year', op: 'between', value: [1980, 1989] }
    expect(FilterExpressionSchema.safeParse(expr).success).toBe(true)
  })

  it('parses has_tag with an optional scope', () => {
    const withScope = { type: 'has_tag', tag: 'synthesizer', scope: 'track' }
    const withoutScope = { type: 'has_tag', tag: 'synthesizer' }
    expect(FilterExpressionSchema.safeParse(withScope).success).toBe(true)
    expect(FilterExpressionSchema.safeParse(withoutScope).success).toBe(true)
  })

  it('parses a tag_meta condition', () => {
    const expr = { type: 'tag_meta', tag: 'color', key: 'value', op: 'eq', value: 'neon' }
    expect(FilterExpressionSchema.safeParse(expr).success).toBe(true)
  })

  it('parses a nested AND expression', () => {
    const expr = {
      and: [
        { field: 'label', op: 'eq', value: 'Atlantic' },
        { field: 'medium', op: 'eq', value: 'Vinyl' },
      ],
    }
    expect(FilterExpressionSchema.safeParse(expr).success).toBe(true)
  })

  it('parses a NOT expression', () => {
    const expr = { not: { field: 'medium', op: 'eq', value: 'Digital' } }
    expect(FilterExpressionSchema.safeParse(expr).success).toBe(true)
  })

  it('parses the full complex example from the writeup', () => {
    const expr = {
      and: [
        { field: 'year', op: 'between', value: [1980, 1989] },
        {
          or: [
            { field: 'genre', op: 'eq', value: 'disco' },
            { type: 'has_tag', tag: 'synthesizer' },
            { type: 'tag_meta', tag: 'color', key: 'value', op: 'eq', value: 'neon' },
          ],
        },
        { field: 'label', op: 'eq', value: 'Atlantic' },
        { field: 'medium', op: 'eq', value: 'Vinyl' },
        { field: 'date_added', op: 'between', value: ['2013-01-01', '2017-12-31'] },
      ],
    }
    const result = FilterExpressionSchema.safeParse(expr)
    expect(result.success).toBe(true)
  })

  it('parses deeply nested AND/OR/NOT', () => {
    const expr = {
      and: [
        { or: [{ field: 'label', op: 'eq', value: 'Atlantic' }, { not: { field: 'medium', op: 'eq', value: 'Digital' } }] },
        { field: 'year', op: 'gte', value: 1970 },
      ],
    }
    expect(FilterExpressionSchema.safeParse(expr).success).toBe(true)
  })

  it('rejects an unknown op', () => {
    const expr = { field: 'label', op: 'fuzzy', value: 'Atlantic' }
    expect(FilterExpressionSchema.safeParse(expr).success).toBe(false)
  })

  it('rejects an unknown tag scope', () => {
    const expr = { type: 'has_tag', tag: 'test', scope: 'global' }
    expect(FilterExpressionSchema.safeParse(expr).success).toBe(false)
  })
})
