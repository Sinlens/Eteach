import { z } from "zod";

/**
 * Feedback contract (manual §5.7, §11 Workflow 4).
 *
 * The current UI only exposes thumbs up/down. The product defines four signals —
 * "too formal" and "too informal" are the ones that actually drive tone
 * personalization later, so they are part of the contract from the start.
 */
export const FEEDBACK_TYPES = ["useful", "not_useful", "too_formal", "too_informal"] as const;

export type FeedbackType = (typeof FEEDBACK_TYPES)[number];

export const feedbackTypeSchema = z.enum(FEEDBACK_TYPES);

export const FEEDBACK_LABELS: Record<FeedbackType, string> = {
  useful: "Useful",
  not_useful: "Not useful",
  too_formal: "Too formal",
  too_informal: "Too informal",
};

export const feedbackRequestSchema = z.object({
  translationId: z.string().trim().min(1),
  feedback: feedbackTypeSchema,
});

export type FeedbackRequest = z.infer<typeof feedbackRequestSchema>;

export const FEEDBACK_OPTIONS: ReadonlyArray<{ id: FeedbackType; label: string }> =
  FEEDBACK_TYPES.map((id) => ({ id, label: FEEDBACK_LABELS[id] }));
