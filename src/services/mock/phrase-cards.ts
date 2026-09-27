import type { CareerId } from "@/contracts/career";
import type { PhraseCard } from "@/contracts/phrase-card";

/**
 * Pre-generated phrase cards, one per career (manual §20, §25).
 *
 * The `phrase` is the reusable pattern; the `example` is the career-specific
 * instance of it. That split is what makes a card teach rather than just show.
 */
export const PHRASE_CARDS: Record<CareerId, PhraseCard> = {
  data_engineering: {
    id: "pc_data_engineering_01",
    phrase: "I'd be happy to discuss this further",
    meaning: "A warm, low-pressure way to keep a professional conversation open.",
    example: "I'd be happy to discuss the pipeline architecture further.",
    career: "data_engineering",
    category: "recruiter_messages",
    difficulty: "intermediate",
    locale: "en-US",
  },
  data_science: {
    id: "pc_data_science_01",
    phrase: "I'd be happy to walk you through this",
    meaning: "Offers to explain your work without assuming the other person needs it.",
    example: "I'd be happy to walk you through how we evaluated the model.",
    career: "data_science",
    category: "technical_explanations",
    difficulty: "intermediate",
    locale: "en-US",
  },
  data_analytics: {
    id: "pc_data_analytics_01",
    phrase: "happy to walk you through the numbers",
    meaning: "Invites a stakeholder into the detail without overwhelming them up front.",
    example: "The dashboard is live — happy to walk you through the numbers whenever suits you.",
    career: "data_analytics",
    category: "status_updates",
    difficulty: "intermediate",
    locale: "en-US",
  },
  software_architecture: {
    id: "pc_software_architecture_01",
    phrase: "let's align on the approach",
    meaning: "Frames a technical decision as shared rather than handed down.",
    example: "Before we commit to the migration, let's align on the approach.",
    career: "software_architecture",
    category: "meetings",
    difficulty: "advanced",
    locale: "en-US",
  },
};

export function phraseCardForCareer(career: CareerId): PhraseCard {
  return PHRASE_CARDS[career];
}
