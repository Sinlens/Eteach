import { z } from "zod";

import { careerIdSchema } from "./career";
import { targetLocaleSchema } from "./locale";

/**
 * Phrase card contract (manual §2.2, §11 Workflow 2, §15 `phrase_cards`).
 *
 * Cards are pre-generated rather than produced per request — the manual calls
 * for exactly that in §25 as a cost control — so the MVP reads them from a
 * fixture set and no service round-trip is required yet.
 */
export const PHRASE_CATEGORIES = [
  "linkedin",
  "interviews",
  "emails",
  "meetings",
  "technical_explanations",
  "portfolio",
  "recruiter_messages",
  "status_updates",
  "team_collaboration",
  "leadership",
  "project_management",
  "documentation",
] as const;

export type PhraseCategory = (typeof PHRASE_CATEGORIES)[number];

export const phraseCategorySchema = z.enum(PHRASE_CATEGORIES);

export const PHRASE_CATEGORY_LABELS: Record<PhraseCategory, string> = {
  linkedin: "LinkedIn",
  interviews: "Interviews",
  emails: "Emails",
  meetings: "Meetings",
  technical_explanations: "Technical explanations",
  portfolio: "Portfolio descriptions",
  recruiter_messages: "Recruiter messages",
  status_updates: "Status updates",
  team_collaboration: "Team collaboration",
  leadership: "Leadership",
  project_management: "Project management",
  documentation: "Documentation",
};

/** The manual leaves `difficulty` unspecified (§15); this is a placeholder scale. */
export const PHRASE_DIFFICULTIES = ["beginner", "intermediate", "advanced"] as const;

export type PhraseDifficulty = (typeof PHRASE_DIFFICULTIES)[number];

export const phraseDifficultySchema = z.enum(PHRASE_DIFFICULTIES);

export const phraseCardSchema = z.object({
  id: z.string().trim().min(1),
  phrase: z.string().trim().min(1),
  meaning: z.string().trim().min(1),
  example: z.string().trim().min(1),
  career: careerIdSchema,
  category: phraseCategorySchema,
  difficulty: phraseDifficultySchema,
  locale: targetLocaleSchema,
});

export type PhraseCard = z.infer<typeof phraseCardSchema>;
