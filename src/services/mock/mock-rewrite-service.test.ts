import { describe, expect, it } from "vitest";

import { CAREER_IDS } from "@/contracts/career";
import { rewriteResponseSchema, type RewriteRequest } from "@/contracts/rewrite";
import { TONE_IDS } from "@/contracts/tone";
import { RewriteServiceError } from "@/services/rewrite-service";

import { createMockRewriteService } from "./mock-rewrite-service";

const baseRequest: RewriteRequest = {
  text: "I already finished the pipeline but we still need to test it.",
  career: "data_engineering",
  tone: "professional",
  locale: "en-US",
};

// Latency is simulated, so every test opts out of the wait.
const service = createMockRewriteService({ latencyMs: 0 });

describe("createMockRewriteService", () => {
  it("returns a contract-compliant response for every career and tone combination", async () => {
    for (const career of CAREER_IDS) {
      for (const tone of TONE_IDS) {
        const response = await service.rewrite({ ...baseRequest, career, tone });

        expect(rewriteResponseSchema.safeParse(response).success).toBe(true);
      }
    }
  });

  it("produces career-specific wording", async () => {
    const engineering = await service.rewrite({ ...baseRequest, career: "data_engineering" });
    const analytics = await service.rewrite({ ...baseRequest, career: "data_analytics" });

    expect(engineering.professionalVersion).not.toBe(analytics.professionalVersion);
  });

  it("reflects the requested tone in the explanation", async () => {
    const response = await service.rewrite({ ...baseRequest, tone: "recruiter" });

    expect(response.explanation.toLowerCase()).toContain("recruiter");
  });

  it("issues a distinct id per rewrite so feedback can be attributed", async () => {
    const first = await service.rewrite(baseRequest);
    const second = await service.rewrite(baseRequest);

    expect(first.id).not.toBe(second.id);
  });

  it("rejects an invalid request with an invalid_request error", async () => {
    await expect(service.rewrite({ ...baseRequest, text: "   " })).rejects.toMatchObject({
      code: "invalid_request",
    });
  });

  it("rejects an unknown career before reaching the transport", async () => {
    const badRequest = { ...baseRequest, career: "astrology" } as unknown as RewriteRequest;

    await expect(service.rewrite(badRequest)).rejects.toBeInstanceOf(RewriteServiceError);
  });

  it("can be configured to fail, so the UI error state is buildable", async () => {
    const failing = createMockRewriteService({ latencyMs: 0, failWith: "upstream_timeout" });

    await expect(failing.rewrite(baseRequest)).rejects.toMatchObject({
      code: "upstream_timeout",
    });
  });
});
