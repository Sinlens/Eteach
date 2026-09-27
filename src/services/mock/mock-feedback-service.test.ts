import { describe, expect, it } from "vitest";

import type { FeedbackRequest } from "@/contracts/feedback";
import { FeedbackServiceError } from "@/services/feedback-service";

import { createMockFeedbackService } from "./mock-feedback-service";

describe("createMockFeedbackService", () => {
  it("records a valid submission", async () => {
    const service = createMockFeedbackService({ latencyMs: 0 });

    await service.submit({ translationId: "rw_01", feedback: "too_formal" });

    expect(service.recorded).toEqual([{ translationId: "rw_01", feedback: "too_formal" }]);
  });

  it("accepts every feedback type the product defines", async () => {
    const service = createMockFeedbackService({ latencyMs: 0 });

    await service.submit({ translationId: "rw_01", feedback: "useful" });
    await service.submit({ translationId: "rw_01", feedback: "not_useful" });
    await service.submit({ translationId: "rw_01", feedback: "too_formal" });
    await service.submit({ translationId: "rw_01", feedback: "too_informal" });

    expect(service.recorded).toHaveLength(4);
  });

  it("rejects an unknown feedback type", async () => {
    const service = createMockFeedbackService({ latencyMs: 0 });
    const request = { translationId: "rw_01", feedback: "amazing" } as unknown as FeedbackRequest;

    await expect(service.submit(request)).rejects.toBeInstanceOf(FeedbackServiceError);
    expect(service.recorded).toHaveLength(0);
  });

  it("rejects a submission with no translation id", async () => {
    const service = createMockFeedbackService({ latencyMs: 0 });

    await expect(service.submit({ translationId: "", feedback: "useful" })).rejects.toBeInstanceOf(
      FeedbackServiceError,
    );
  });
});
