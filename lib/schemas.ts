import { z } from "zod";

// Base Action Item extracted from transcript by Agent 1
export const ActionItemSchema = z.object({
  id: z.string().uuid(),
  task: z.string().min(1, "Task description is required"),
  owner: z.string().default("UNKNOWN"),
  deadline: z.string().nullable().refine((val) => {
    if (!val) return true;
    return /^\d{4}-\d{2}-\d{2}$/.test(val); // YYYY-MM-DD format
  }, "Deadline must be in YYYY-MM-DD format"),
  deadline_confidence: z.enum(["explicit", "inferred", "none"]),
  extraction_confidence: z.number().min(0.0).max(1.0),
  source_quote: z.string(),
  needs_review: z.boolean().default(false),
});

// Output of Agent 1 Extractor
export const MeetingExtractionSchema = z.object({
  action_items: z.array(ActionItemSchema),
  meeting_summary: z.string(),
});

// Action Item enriched by Agent 2 (Cross-checker checks)
export const EnrichedActionItemSchema = ActionItemSchema.extend({
  duplicate_of: z.string().nullable().default(null),
  already_done: z.boolean().default(false),
  calendar_conflict: z.boolean().default(false),
  conflict_details: z.string().nullable().default(null),
  owner_resolved: z.string().email().nullable().default(null),
});

// Final Action Item resolved by Agent 3 (Judgment decision)
export const ResolvedActionItemSchema = EnrichedActionItemSchema.extend({
  action_taken: z.enum(["CREATE", "UPDATE", "SKIP", "FLAG_FOR_HUMAN"]),
  reason: z.string(),
  sheet_row_written: z.string().nullable().default(null),
  calendar_event_created: z.string().nullable().default(null),
});

// Log structure stored in DB
export const RunLogSchema = z.object({
  id: z.string().uuid().optional(),
  run_id: z.string().uuid(),
  agent_name: z.enum(["EXTRACTOR", "CROSS_CHECKER", "RESOLVER", "REPORTER", "PIPELINE"]),
  log_level: z.enum(["INFO", "WARNING", "ERROR"]),
  message: z.string(),
  timestamp: z.string(),
});

export type ActionItem = z.infer<typeof ActionItemSchema>;
export type MeetingExtraction = z.infer<typeof MeetingExtractionSchema>;
export type EnrichedActionItem = z.infer<typeof EnrichedActionItemSchema>;
export type ResolvedActionItem = z.infer<typeof ResolvedActionItemSchema>;
export type RunLog = z.infer<typeof RunLogSchema>;
