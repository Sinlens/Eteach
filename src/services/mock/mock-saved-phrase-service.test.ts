import { describe, expect, it } from "vitest";

import { rewritePhraseId, type SavedPhrase } from "@/contracts/saved-phrase";

import { createMemoryCollectionStore } from "./local-store";
import { createMockSavedPhraseService } from "./mock-saved-phrase-service";

const fromRewrite: SavedPhrase = {
  id: "rw_the_next_step_is",
  phrase: "the next step is",
  meaning: "A clear way to introduce the next action or project step.",
  example: null,
  career: "data_engineering",
  category: null,
  difficulty: null,
  source: "rewrite",
  savedAt: "2026-09-25T10:00:00.000Z",
};

const fromCard: SavedPhrase = {
  id: "pc_data_science_01",
  phrase: "I'd be happy to walk you through this",
  meaning: "Offers to explain your work without assuming the other person needs it.",
  example: "I'd be happy to walk you through how we evaluated the model.",
  career: "data_science",
  category: "technical_explanations",
  difficulty: "intermediate",
  source: "phrase_card",
  savedAt: "2026-09-26T10:00:00.000Z",
};

function createService() {
  return createMockSavedPhraseService(createMemoryCollectionStore<SavedPhrase>());
}

describe("createMockSavedPhraseService", () => {
  it("starts empty", async () => {
    expect(await createService().list()).toEqual([]);
  });

  it("stores phrases from both sources", async () => {
    const service = createService();

    await service.save(fromRewrite);
    await service.save(fromCard);

    expect((await service.list()).map((item) => item.source)).toEqual(["phrase_card", "rewrite"]);
  });

  it("lists newest first", async () => {
    const service = createService();

    await service.save(fromRewrite);
    await service.save(fromCard);

    expect((await service.list())[0]?.id).toBe(fromCard.id);
  });

  it("upserts by id so saving twice does not duplicate", async () => {
    const service = createService();

    await service.save(fromRewrite);
    await service.save({ ...fromRewrite, savedAt: "2026-09-27T10:00:00.000Z" });

    expect(await service.list()).toHaveLength(1);
  });

  it("removes a phrase", async () => {
    const service = createService();
    await service.save(fromRewrite);
    await service.save(fromCard);

    await service.remove(fromRewrite.id);

    expect((await service.list()).map((item) => item.id)).toEqual([fromCard.id]);
  });

  it("rejects a phrase that does not satisfy the contract", async () => {
    const service = createService();

    await expect(service.save({ ...fromRewrite, phrase: "" })).rejects.toThrow();
    expect(await service.list()).toEqual([]);
  });
});

describe("rewritePhraseId", () => {
  it("is stable for the same wording", () => {
    expect(rewritePhraseId("the next step is")).toBe(rewritePhraseId("  The Next Step Is  "));
  });

  it("distinguishes different wording", () => {
    expect(rewritePhraseId("align on")).not.toBe(rewritePhraseId("the next step is"));
  });

  it("does not leave separator characters dangling", () => {
    expect(rewritePhraseId("ready for your review!")).toBe("rw_ready_for_your_review");
  });
});
