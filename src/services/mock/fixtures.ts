import type { CareerId } from "@/contracts/career";
import type { KeyPhrase, VocabularyItem } from "@/contracts/rewrite";
import type { ToneId } from "@/contracts/tone";

/**
 * Authored stand-ins for the LLM, one per career.
 *
 * Deliberately shallow: the mock exists so the UI can be built against the real
 * contract, not to approximate the model. Genuine per-tone variation arrives
 * with the prompt layer in Phase 3.
 */
export type CareerFixture = {
  professionalVersion: string;
  alternativeVersion: string;
  rationale: string;
  keyPhrases: KeyPhrase[];
  vocabulary: VocabularyItem[];
};

export const CAREER_FIXTURES: Record<CareerId, CareerFixture> = {
  data_engineering: {
    professionalVersion: "I've finished building the pipeline, but it still needs to be tested.",
    alternativeVersion: "The pipeline implementation is complete, and the next step is testing.",
    rationale: "This wording communicates current project status and the remaining action clearly.",
    keyPhrases: [
      {
        phrase: "the next step is",
        meaning: "A clear way to introduce the next action or project step.",
      },
    ],
    vocabulary: [
      {
        term: "pipeline",
        definition: "A sequence of automated steps that moves and transforms data between systems.",
      },
    ],
  },
  data_science: {
    professionalVersion:
      "I've completed the first round of model evaluation, and the early results look promising.",
    alternativeVersion: "Initial model evaluation is done, and the early results are encouraging.",
    rationale: "It reports progress and signals confidence without overstating the outcome.",
    keyPhrases: [
      {
        phrase: "the early results look promising",
        meaning: "A measured way to share a positive signal before the work is final.",
      },
    ],
    vocabulary: [
      {
        term: "model evaluation",
        definition: "Measuring how well a trained model performs against data it has not seen.",
      },
    ],
  },
  data_analytics: {
    professionalVersion:
      "I've refreshed the dashboard, and the updated KPIs are ready for your review.",
    alternativeVersion:
      "The dashboard refresh is complete, and the new KPIs are ready whenever you'd like to walk through them.",
    rationale: "It closes the loop on the task and hands the next move to the reader.",
    keyPhrases: [
      {
        phrase: "ready for your review",
        meaning: "A polite way to hand work back to a stakeholder without chasing them.",
      },
    ],
    vocabulary: [
      {
        term: "KPI",
        definition:
          "A key performance indicator: the small set of metrics a team is actually measured on.",
      },
    ],
  },
  software_architecture: {
    professionalVersion:
      "I've documented the trade-offs, and I'd like to align on the approach before we move forward.",
    alternativeVersion:
      "The trade-offs are written up, and the next step is agreeing on which approach we take.",
    rationale: "It frames the decision as a shared one instead of asking for permission.",
    keyPhrases: [
      {
        phrase: "align on",
        meaning: "A collaborative way to ask for agreement before committing to a direction.",
      },
    ],
    vocabulary: [
      {
        term: "trade-off",
        definition:
          "An explicit exchange of one desirable property for another, such as latency for consistency.",
      },
    ],
  },
};

/** Appended to the explanation so the selected tone is visibly honoured. */
export const TONE_NOTES: Record<ToneId, string> = {
  professional: "Professional tone: clear and courteous, with no filler.",
  friendly: "Friendly tone: approachable without losing credibility.",
  concise: "Concise tone: every word earns its place.",
  technical: "Technical tone: precise terminology, no hand-waving.",
  linkedin: "LinkedIn tone: direct and credible, free of buzzwords.",
  recruiter: "Recruiter tone: courteous, specific and easy to reply to.",
  interview: "Interview tone: confident and structured, leading with results.",
};
