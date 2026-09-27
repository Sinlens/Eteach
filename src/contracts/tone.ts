import { z } from "zod";

/**
 * Tone taxonomy (manual §5.3, §30).
 *
 * Same rule as careers: ids travel, labels render.
 */
export const TONE_IDS = [
  "professional",
  "friendly",
  "concise",
  "technical",
  "linkedin",
  "recruiter",
  "interview",
] as const;

export type ToneId = (typeof TONE_IDS)[number];

export const toneIdSchema = z.enum(TONE_IDS);

export const TONE_LABELS: Record<ToneId, string> = {
  professional: "Professional",
  friendly: "Friendly",
  concise: "Concise",
  technical: "Technical",
  linkedin: "LinkedIn",
  recruiter: "Recruiter",
  interview: "Interview",
};

export const DEFAULT_TONE_ID: ToneId = "professional";

export function toneLabel(id: ToneId): string {
  return TONE_LABELS[id];
}

/** Ordered, render-ready list for selectors. */
export const TONE_OPTIONS: ReadonlyArray<{ id: ToneId; label: string }> = TONE_IDS.map((id) => ({
  id,
  label: TONE_LABELS[id],
}));
