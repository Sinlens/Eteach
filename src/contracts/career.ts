import { z } from "zod";

/**
 * Career taxonomy (manual §16).
 *
 * The id is the contract; the label is presentation only. Adding a career is a
 * one-line change here — never a free-text string at a call site.
 *
 * Career *vocabulary* and prompt context (manual §2.3, §12.2) deliberately do
 * not live here: they belong to the prompt layer in n8n. The frontend only
 * needs to know which careers exist and how to render them.
 */
export const CAREER_IDS = [
  "data_science",
  "data_analytics",
  "data_engineering",
  "software_architecture",
] as const;

export type CareerId = (typeof CAREER_IDS)[number];

export const careerIdSchema = z.enum(CAREER_IDS);

export const CAREER_LABELS: Record<CareerId, string> = {
  data_science: "Data Science",
  data_analytics: "Data Analytics",
  data_engineering: "Data Engineering",
  software_architecture: "Software Architecture",
};

export const DEFAULT_CAREER_ID: CareerId = "data_engineering";

export function careerLabel(id: CareerId): string {
  return CAREER_LABELS[id];
}

/** Ordered, render-ready list for selectors. */
export const CAREER_OPTIONS: ReadonlyArray<{ id: CareerId; label: string }> = CAREER_IDS.map(
  (id) => ({ id, label: CAREER_LABELS[id] }),
);
