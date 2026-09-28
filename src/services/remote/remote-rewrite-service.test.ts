import { describe, expect, it, vi } from "vitest";

import type { RewriteRequest, RewriteResponse } from "@/contracts/rewrite";
import { RewriteServiceError } from "@/services/rewrite-service";

import { createRemoteRewriteService, type RewriteCall } from "./remote-rewrite-service";

const request: RewriteRequest = {
  text: "hey can u check this asap",
  career: "data_engineering",
  tone: "professional",
  locale: "en-US",
};

const result: RewriteResponse = {
  id: "rw_1",
  professionalVersion: "Could you review this when you have a moment?",
  alternativeVersion: "Whenever you get a chance, I would appreciate your review.",
  explanation: "Naming the flexibility keeps the urgency without the demand.",
  keyPhrases: [{ phrase: "when you have a moment", meaning: "Signals it is not blocking." }],
  vocabulary: [],
};

async function expectCode(promise: Promise<unknown>, code: string) {
  await expect(promise).rejects.toBeInstanceOf(RewriteServiceError);
  await expect(promise).rejects.toMatchObject({ code });
}

describe("createRemoteRewriteService", () => {
  it("sends the validated request across the boundary and returns the rewrite", async () => {
    const call: RewriteCall = vi.fn(async () => ({ ok: true as const, result }));
    const service = createRemoteRewriteService(call);

    await expect(service.rewrite(request)).resolves.toEqual(result);
    expect(call).toHaveBeenCalledWith({ data: request });
  });

  /**
   * The selected tone is the one field n8n routes on, so it is the one field
   * whose normalized id must survive the trip unchanged — never its label.
   */
  it("sends the tone id, not its label", async () => {
    const call: RewriteCall = vi.fn(async () => ({ ok: true as const, result }));

    await createRemoteRewriteService(call).rewrite({ ...request, tone: "linkedin" });

    expect(call).toHaveBeenCalledWith({ data: expect.objectContaining({ tone: "linkedin" }) });
  });

  it("trims the text the contract trims, so blank input never crosses", async () => {
    const call: RewriteCall = vi.fn(async () => ({ ok: true as const, result }));

    await createRemoteRewriteService(call).rewrite({ ...request, text: "  padded  " });

    expect(call).toHaveBeenCalledWith({ data: expect.objectContaining({ text: "padded" }) });
  });

  it("rejects a request the contract would not accept, without calling out", async () => {
    const call: RewriteCall = vi.fn(async () => ({ ok: true as const, result }));
    const service = createRemoteRewriteService(call);

    await expectCode(service.rewrite({ ...request, text: "   " }), "invalid_request");
    expect(call).not.toHaveBeenCalled();
  });

  /**
   * The server returns its failures as data precisely so this mapping is
   * possible: each distinct upstream failure keeps its own copy on the screen.
   */
  it.each([
    "upstream_timeout",
    "upstream_unavailable",
    "malformed_response",
    "rate_limited",
  ] as const)("turns a returned %s back into a thrown error", async (code) => {
    const call: RewriteCall = vi.fn(async () => ({ ok: false as const, code }));

    await expectCode(createRemoteRewriteService(call).rewrite(request), code);
  });

  it("reports a transport failure as upstream unavailable", async () => {
    const call: RewriteCall = vi.fn(async () => {
      throw new TypeError("Failed to fetch");
    });

    await expectCode(createRemoteRewriteService(call).rewrite(request), "upstream_unavailable");
  });
});
