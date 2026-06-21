import { z } from 'zod'

// Whether a tag-based filter condition applies to tags on releases, tracks, or either.
const TagScope = z.enum(['release', 'track', 'either'])

// All comparison operators available for filter conditions.
const FieldOp = z.enum(['eq', 'ne', 'lt', 'lte', 'gt', 'gte', 'between', 'contains', 'starts_with'])

// A single value (string, number, or boolean) or a [min, max] range pair.
const ScalarValue = z.union([z.string(), z.number(), z.boolean()])
const RangeValue = z.tuple([z.union([z.string(), z.number()]), z.union([z.string(), z.number()])])

// A comparison against a standard release field — e.g., { field: "label", op: "eq", value: "Atlantic" }.
const FieldConditionSchema = z.object({
  field: z.string(),
  op: FieldOp,
  value: z.union([ScalarValue, RangeValue]),
})

// Checks whether a release or track has a specific tag applied.
const HasTagConditionSchema = z.object({
  type: z.literal('has_tag'),
  tag: z.string(),
  scope: TagScope.optional(),
})

// Checks the value of a typed metadata field on a tag application —
// e.g., { type: "tag_meta", tag: "beach-time", key: "temperature", op: "gte", value: 75 }.
const TagMetaConditionSchema = z.object({
  type: z.literal('tag_meta'),
  tag: z.string(),
  key: z.string(),
  op: FieldOp,
  value: z.union([ScalarValue, RangeValue]),
  scope: TagScope.optional(),
})

// The full recursive filter tree. AND/OR/NOT nodes can contain any mix of other
// nodes and leaf conditions, allowing arbitrarily complex queries to be built up
// and compiled to a single SQL statement.
export type FilterExpression =
  | { and: FilterExpression[] }
  | { or: FilterExpression[] }
  | { not: FilterExpression }
  | z.infer<typeof FieldConditionSchema>
  | z.infer<typeof HasTagConditionSchema>
  | z.infer<typeof TagMetaConditionSchema>

export const FilterExpressionSchema: z.ZodType<FilterExpression> = z.lazy(() =>
  z.union([
    z.object({ and: z.array(FilterExpressionSchema) }),
    z.object({ or: z.array(FilterExpressionSchema) }),
    z.object({ not: FilterExpressionSchema }),
    FieldConditionSchema,
    HasTagConditionSchema,
    TagMetaConditionSchema,
  ])
)
