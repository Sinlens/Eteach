import { describe, expect, it } from "vitest";

import { MAX_INPUT_LENGTH, rewriteRequestSchema, rewriteResponseSchema } from "./rewrite";

const validRequest = {
  text: "I already finished the pipeline but we still need to test it.",
  career: "data_engineering",
  tone: "professional",
  locale: "en-US",
};

const validResponse = {
  id: "rw_01",
  professionalVersion: "I've finished building the pipeline, but it still needs to be tested.",
  alternativeVersion: "The pipeline implementation is complete, and the next step is testing.",
  explanation: "This wording communicates project status and the remaining action clearly.",
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
};

describe("rewriteRequestSchema", () => {
  it("accepts a well-formed request", () => {
    const result = rewriteRequestSchema.safeParse(validRequest);

    expect(result.success).toBe(true);
  });

  it("trims surrounding whitespace from the input text", () => {
    const result = rewriteRequestSchema.safeParse({
      ...validRequest,
      text: "   I shipped the report.   ",
    });

    expect(result.success && result.data.text).toBe("I shipped the report.");
  });

  it("rejects empty text", () => {
    const result = rewriteRequestSchema.safeParse({ ...validRequest, text: "" });

    expect(result.success).toBe(false);
  });

  it("rejects whitespace-only text", () => {
    const result = rewriteRequestSchema.safeParse({ ...validRequest, text: "     " });

    expect(result.success).toBe(false);
  });

  it("accepts text of exactly MAX_INPUT_LENGTH characters", () => {
    const result = rewriteRequestSchema.safeParse({
      ...validRequest,
      text: "a".repeat(MAX_INPUT_LENGTH),
    });

    expect(result.success).toBe(true);
  });

  it("rejects text longer than MAX_INPUT_LENGTH", () => {
    const result = rewriteRequestSchema.safeParse({
      ...validRequest,
      text: "a".repeat(MAX_INPUT_LENGTH + 1),
    });

    expect(result.success).toBe(false);
  });

  it("rejects an unknown career id", () => {
    const result = rewriteRequestSchema.safeParse({ ...validRequest, career: "astrology" });

    expect(result.success).toBe(false);
  });

  // The UI currently passes display labels around. Labels are presentation,
  // ids are the contract — this guards that boundary.
  it("rejects a display label used in place of a career id", () => {
    const result = rewriteRequestSchema.safeParse({ ...validRequest, career: "Data Engineering" });

    expect(result.success).toBe(false);
  });

  it("rejects an unknown tone id", () => {
    const result = rewriteRequestSchema.safeParse({ ...validRequest, tone: "sarcastic" });

    expect(result.success).toBe(false);
  });

  it("rejects a locale outside the MVP", () => {
    const result = rewriteRequestSchema.safeParse({ ...validRequest, locale: "en-GB" });

    expect(result.success).toBe(false);
  });

  it("rejects a request missing the locale", () => {
    const { locale: _locale, ...withoutLocale } = validRequest;
    const result = rewriteRequestSchema.safeParse(withoutLocale);

    expect(result.success).toBe(false);
  });
});

describe("rewriteResponseSchema", () => {
  it("accepts a complete response", () => {
    const result = rewriteResponseSchema.safeParse(validResponse);

    expect(result.success).toBe(true);
  });

  it("defaults vocabulary to an empty array when the field is absent", () => {
    const { vocabulary: _vocabulary, ...withoutVocabulary } = validResponse;
    const result = rewriteResponseSchema.safeParse(withoutVocabulary);

    expect(result.success && result.data.vocabulary).toEqual([]);
  });

  it("accepts a response with no key phrases", () => {
    const result = rewriteResponseSchema.safeParse({ ...validResponse, keyPhrases: [] });

    expect(result.success).toBe(true);
  });

  // Manual §30 business rule: malformed AI output must never reach the frontend.
  it("rejects a response missing professionalVersion", () => {
    const { professionalVersion: _missing, ...incomplete } = validResponse;
    const result = rewriteResponseSchema.safeParse(incomplete);

    expect(result.success).toBe(false);
  });

  it("rejects a response with a blank professionalVersion", () => {
    const result = rewriteResponseSchema.safeParse({ ...validResponse, professionalVersion: "  " });

    expect(result.success).toBe(false);
  });

  it("rejects a response missing an id", () => {
    const { id: _id, ...withoutId } = validResponse;
    const result = rewriteResponseSchema.safeParse(withoutId);

    expect(result.success).toBe(false);
  });

  it("rejects malformed key phrase entries", () => {
    const result = rewriteResponseSchema.safeParse({
      ...validResponse,
      keyPhrases: [{ phrase: "the next step is" }],
    });

    expect(result.success).toBe(false);
  });

  it("rejects a bare string where a structured response is expected", () => {
    const result = rewriteResponseSchema.safeParse(
      "I've finished building the pipeline, but it still needs to be tested.",
    );

    expect(result.success).toBe(false);
  });
});
