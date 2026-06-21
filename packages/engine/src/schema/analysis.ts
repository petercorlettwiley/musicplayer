import { z } from 'zod'

// Auto-generated audio analysis data for one track — BPM, musical key, and
// acoustic fingerprint. Stored separately from release.yaml so it can be
// regenerated without ever touching the hand-written release metadata.
export const TrackAnalysisSchema = z.object({
  track_id: z.string(),
  bpm: z.number().optional(),
  key: z.string().optional(),
  fingerprint: z.string().optional(),
  analyzed_at: z.string().datetime().optional(),
})
export type TrackAnalysis = z.infer<typeof TrackAnalysisSchema>

// The full analysis.yaml file for a release — analysis data for each of its tracks.
export const AnalysisDataSchema = z.object({
  release_id: z.string(),
  tracks: z.array(TrackAnalysisSchema),
})
export type AnalysisData = z.infer<typeof AnalysisDataSchema>
