import { describe, expect, it } from "vitest";

import type { TranslationRecord } from "@/contracts/translation";

import { createMemoryCollectionStore } from "./local-store";
import { createMockHistoryService } from "./mock-history-service";

function buildRecord(id: string, createdAt: string): TranslationRecord {
  return {
    id,
    inputText: "I already finished the pipeline but we still need to test it.",
    career: "data_engineering",
    tone: "professional",
    locale: "en-US",
    createdAt,
    result: {
      id,
      professionalVersion: "I've finished building the pipeline, but it still needs to be tested.",
      alternativeVersion: "The pipeline implementation is complete, and the next step is testing.",
      explanation: "It communicates status and the remaining action.",
      keyPhrases: [],
      vocabulary: [],
    },
  };
}

function createService() {
  return createMockHistoryService(createMemoryCollectionStore<TranslationRecord>());
}

describe("createMockHistoryService", () => {
  it("returns an empty history before anything is recorded", async () => {
    const service = createService();

    expect(await service.list()).toEqual([]);
  });

  it("lists entries newest first regardless of insertion order", async () => {
    const service = createService();

    await service.record(buildRecord("rw_old", "2026-09-20T10:00:00.000Z"));
    await service.record(buildRecord("rw_new", "2026-09-26T10:00:00.000Z"));
    await service.record(buildRecord("rw_mid", "2026-09-23T10:00:00.000Z"));

    expect((await service.list()).map((entry) => entry.id)).toEqual(["rw_new", "rw_mid", "rw_old"]);
  });

  it("upserts by id instead of duplicating an entry", async () => {
    const service = createService();

    await service.record(buildRecord("rw_01", "2026-09-26T10:00:00.000Z"));
    await service.record(buildRecord("rw_01", "2026-09-26T11:00:00.000Z"));

    const entries = await service.list();
    expect(entries).toHaveLength(1);
    expect(entries[0]?.createdAt).toBe("2026-09-26T11:00:00.000Z");
  });

  it("honours a limit", async () => {
    const service = createService();

    await service.record(buildRecord("rw_01", "2026-09-24T10:00:00.000Z"));
    await service.record(buildRecord("rw_02", "2026-09-25T10:00:00.000Z"));
    await service.record(buildRecord("rw_03", "2026-09-26T10:00:00.000Z"));

    expect(await service.list(2)).toHaveLength(2);
  });

  it("keeps the whole rewrite so an entry can be reopened without a model call", async () => {
    const service = createService();
    await service.record(buildRecord("rw_01", "2026-09-26T10:00:00.000Z"));

    const [entry] = await service.list();

    expect(entry?.result.professionalVersion).toContain("pipeline");
  });

  it("clears the history", async () => {
    const service = createService();
    await service.record(buildRecord("rw_01", "2026-09-26T10:00:00.000Z"));

    await service.clear();

    expect(await service.list()).toEqual([]);
  });

  it("rejects a record that does not satisfy the contract", async () => {
    const service = createService();
    const broken = { ...buildRecord("rw_01", "2026-09-26T10:00:00.000Z"), inputText: "" };

    await expect(service.record(broken)).rejects.toThrow();
    expect(await service.list()).toEqual([]);
  });
});
