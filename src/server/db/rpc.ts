import type { CareerId } from "@/contracts/career";
import type { FeedbackType } from "@/contracts/feedback";
import type { TargetLocale } from "@/contracts/locale";
import type { PhraseCategory, PhraseDifficulty } from "@/contracts/phrase-card";
import type { RewriteResponse } from "@/contracts/rewrite";
import type { SavedPhraseSource } from "@/contracts/saved-phrase";
import type { ToneId } from "@/contracts/tone";

/**
 * Every database call the application makes, as data.
 *
 * This module is deliberately free of any Supabase import: it builds the name
 * and the arguments, nothing else. That is what makes it testable — the schema
 * tests introspect `pg_proc` and assert these argument names match the real
 * function signatures, which is the one mistake PostgREST would otherwise only
 * reveal in production.
 *
 * Every parameter is always sent, including the nullable ones. PostgREST picks
 * an overload from the set of supplied arguments, so relying on SQL defaults
 * invites ambiguity.
 */
export type RpcCall = {
  readonly fn: string;
  readonly args: Readonly<Record<string, unknown>>;
};

/** Used to assert that SQL and TypeScript know about the same set of calls. */
export const RPC_FUNCTIONS = [
  "ensure_profile",
  "merge_profile",
  "start_sign_in",
  "record_translation",
  "list_history",
  "clear_history",
  "save_phrase",
  "remove_saved_phrase",
  "list_saved_phrases",
  "record_feedback",
  "record_outcome",
  "delete_profile",
] as const;

export function ensureProfileCall(anonymousKey: string): RpcCall {
  return {
    fn: "ensure_profile",
    args: { p_anonymous_key: anonymousKey },
  };
}

/**
 * The donor is the anonymous profile and it does not survive the call. Passing
 * these the wrong way round deletes the account, so they are named rather than
 * positional everywhere above this line.
 */
export function mergeProfileCall(input: {
  donorProfileId: string;
  survivorProfileId: string;
}): RpcCall {
  return {
    fn: "merge_profile",
    args: {
      p_donor_profile_id: input.donorProfileId,
      p_survivor_profile_id: input.survivorProfileId,
    },
  };
}

/**
 * How long a sign-in link stays usable. It lives here rather than as a default
 * in the function, because how long a link should last is a decision about the
 * product, and two places holding it is one place to forget.
 */
export const SIGN_IN_TTL_MINUTES = 15;

export function startSignInCall(input: { profileId: string; email: string }): RpcCall {
  return {
    fn: "start_sign_in",
    args: {
      p_profile_id: input.profileId,
      p_email: input.email,
      p_ttl_minutes: SIGN_IN_TTL_MINUTES,
    },
  };
}

export function recordTranslationCall(input: {
  profileId: string;
  translationId: string;
  inputText: string;
  career: CareerId;
  tone: ToneId;
  locale: TargetLocale;
  result: RewriteResponse;
}): RpcCall {
  return {
    fn: "record_translation",
    args: {
      p_profile_id: input.profileId,
      p_translation_id: input.translationId,
      p_input_text: input.inputText,
      p_career: input.career,
      p_tone: input.tone,
      p_locale: input.locale,
      p_result: input.result,
    },
  };
}

export function listHistoryCall(profileId: string, limit: number): RpcCall {
  return {
    fn: "list_history",
    args: { p_profile_id: profileId, p_limit: limit },
  };
}

export function clearHistoryCall(profileId: string): RpcCall {
  return {
    fn: "clear_history",
    args: { p_profile_id: profileId },
  };
}

export function listSavedPhrasesCall(profileId: string): RpcCall {
  return {
    fn: "list_saved_phrases",
    args: { p_profile_id: profileId },
  };
}

export function removeSavedPhraseCall(profileId: string, phraseKey: string): RpcCall {
  return {
    fn: "remove_saved_phrase",
    args: { p_profile_id: profileId, p_phrase_key: phraseKey },
  };
}

export function savePhraseCall(input: {
  profileId: string;
  phraseKey: string;
  phrase: string;
  meaning: string;
  career: CareerId;
  source: SavedPhraseSource;
  example: string | null;
  category: PhraseCategory | null;
  difficulty: PhraseDifficulty | null;
  phraseCardId: string | null;
}): RpcCall {
  return {
    fn: "save_phrase",
    args: {
      p_profile_id: input.profileId,
      p_phrase_key: input.phraseKey,
      p_phrase: input.phrase,
      p_meaning: input.meaning,
      p_career: input.career,
      p_source: input.source,
      p_example: input.example,
      p_category: input.category,
      p_difficulty: input.difficulty,
      p_phrase_card_id: input.phraseCardId,
    },
  };
}

export function recordFeedbackCall(input: {
  profileId: string;
  translationId: string;
  feedback: FeedbackType;
}): RpcCall {
  return {
    fn: "record_feedback",
    args: {
      p_profile_id: input.profileId,
      p_translation_id: input.translationId,
      p_feedback_type: input.feedback,
    },
  };
}

/** Removes the profile; `on delete cascade` takes everything hanging off it. */
export function deleteProfileCall(profileId: string): RpcCall {
  return {
    fn: "delete_profile",
    args: { p_profile_id: profileId },
  };
}

export function recordOutcomeCall(input: {
  profileId: string;
  translationId: string;
  action: "copied" | "edited" | "discarded";
  acceptedVersion: string | null;
}): RpcCall {
  return {
    fn: "record_outcome",
    args: {
      p_profile_id: input.profileId,
      p_translation_id: input.translationId,
      p_action: input.action,
      p_accepted_version: input.acceptedVersion,
    },
  };
}
