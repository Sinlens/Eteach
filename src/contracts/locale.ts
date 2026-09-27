import { z } from "zod";

/**
 * Locale model (manual §3, §17).
 *
 * `inputLanguage` and `targetLocale` are kept as separate axes on purpose. The
 * MVP locks both ("en" in, "en-US" out), but enabling Spanish input later means
 * widening INPUT_LANGUAGES only — the rest of the product model is unaffected.
 *
 * Both unions stay deliberately narrow so TypeScript rejects unsupported values
 * at compile time instead of letting them reach the prompt layer.
 */
export const INPUT_LANGUAGES = ["en"] as const;

export type InputLanguage = (typeof INPUT_LANGUAGES)[number];

export const inputLanguageSchema = z.enum(INPUT_LANGUAGES);

export const DEFAULT_INPUT_LANGUAGE: InputLanguage = "en";

/** Future locales (manual §17): en-CA, en-GB, en-AU. Out of scope for the MVP. */
export const TARGET_LOCALES = ["en-US"] as const;

export type TargetLocale = (typeof TARGET_LOCALES)[number];

export const targetLocaleSchema = z.enum(TARGET_LOCALES);

export const DEFAULT_TARGET_LOCALE: TargetLocale = "en-US";

export const TARGET_LOCALE_LABELS: Record<TargetLocale, string> = {
  "en-US": "United States · en-US",
};

export function targetLocaleLabel(locale: TargetLocale): string {
  return TARGET_LOCALE_LABELS[locale];
}
