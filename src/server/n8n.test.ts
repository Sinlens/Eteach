import { describe, expect, it, vi } from "vitest";

import { rewriteResponseSchema, type RewriteRequest } from "@/contracts/rewrite";
import { RewriteServiceError } from "@/services/rewrite-service";

import {
  DEFAULT_AUTH_HEADER,
  DEFAULT_TIMEOUT_MS,
  n8nConfig,
  requestRewrite,
  type N8nConfig,
} from "./n8n";

const AUTH_HEADER = "x-eteach-secret";
const AUTH_VALUE = "a-long-random-value";

const config: N8nConfig = {
  url: "https://example.app.n8n.cloud/webhook/rewrite",
  headerName: AUTH_HEADER,
  headerValue: AUTH_VALUE,
  timeoutMs: 10_000,
};

const request: RewriteRequest = {
  text: "hey can u check this asap",
  career: "data_engineering",
  tone: "professional",
  locale: "en-US",
};

/** The smallest body that satisfies the contract, so each test varies one thing. */
function validBody() {
  return {
    professionalVersion: "Could you review this when you have a moment?",
    alternativeVersion: "Whenever you get a chance, I would appreciate your review.",
    explanation: "Naming the flexibility keeps the urgency without the demand.",
    keyPhrases: [{ phrase: "when you have a moment", meaning: "Signals it is not blocking." }],
    vocabulary: [{ term: "at your earliest convenience", definition: "Prompt, but undated." }],
  };
}

function respondWith(body: unknown, init: { status?: number } = {}) {
  return vi.fn(
    async () =>
      new Response(typeof body === "string" ? body : JSON.stringify(body), {
        status: init.status ?? 200,
        headers: { "content-type": "application/json" },
      }),
  );
}

/** The one call a stub received, typed the way `fetch` is actually called. */
function callOf(fetchImpl: ReturnType<typeof respondWith>): [string, RequestInit] {
  const call = fetchImpl.mock.calls[0];

  if (!call) throw new Error("the webhook was never called");

  return call as unknown as [string, RequestInit];
}

async function expectCode(promise: Promise<unknown>, code: string) {
  await expect(promise).rejects.toBeInstanceOf(RewriteServiceError);
  await expect(promise).rejects.toMatchObject({ code });
}

describe("requestRewrite", () => {
  it("posts the request to the webhook behind its auth header", async () => {
    const fetchImpl = respondWith(validBody());

    await requestRewrite(request, config, fetchImpl);

    expect(fetchImpl).toHaveBeenCalledTimes(1);

    const [url, init] = callOf(fetchImpl);
    const headers = new Headers(init.headers);

    expect(url).toBe(config.url);
    expect(init.method).toBe("POST");
    expect(headers.get(AUTH_HEADER)).toBe(AUTH_VALUE);
    expect(headers.get("content-type")).toBe("application/json");
    expect(JSON.parse(init.body as string)).toEqual(request);
  });

  /**
   * An n8n Test URL has no authentication to satisfy. Sending it a header whose
   * value is the empty string would assert a credential rather than omit one.
   */
  it("omits the auth header when no secret is configured", async () => {
    const fetchImpl = respondWith(validBody());
    const { headerName: _n, headerValue: _v, ...unsecured } = config;

    await requestRewrite(request, unsecured, fetchImpl);

    const [, init] = callOf(fetchImpl);

    expect(new Headers(init.headers).has(AUTH_HEADER)).toBe(false);
  });

  it("returns a response the contract accepts", async () => {
    const response = await requestRewrite(request, config, respondWith(validBody()));

    expect(rewriteResponseSchema.safeParse(response).success).toBe(true);
    expect(response.professionalVersion).toBe(validBody().professionalVersion);
  });

  /**
   * The id keys feedback in our own database, so it is ours to mint. Letting the
   * workflow name it would make a row's identity depend on something outside
   * this system, and nothing would notice if it started repeating.
   */
  it("mints its own id and ignores one the workflow sends", async () => {
    const response = await requestRewrite(
      request,
      config,
      respondWith({ ...validBody(), id: "id-from-n8n" }),
    );

    expect(response.id).not.toBe("id-from-n8n");
    expect(response.id.length).toBeGreaterThan(0);
  });

  it("issues a distinct id per rewrite so feedback can be attributed", async () => {
    const first = await requestRewrite(request, config, respondWith(validBody()));
    const second = await requestRewrite(request, config, respondWith(validBody()));

    expect(first.id).not.toBe(second.id);
  });

  it("treats an omitted vocabulary as empty rather than missing", async () => {
    const { vocabulary: _omitted, ...withoutVocabulary } = validBody();

    const response = await requestRewrite(request, config, respondWith(withoutVocabulary));

    expect(response.vocabulary).toEqual([]);
  });

  it("rejects a request the contract would not accept, without calling out", async () => {
    const fetchImpl = respondWith(validBody());

    await expectCode(
      requestRewrite({ ...request, text: "   " }, config, fetchImpl),
      "invalid_request",
    );
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  /**
   * Whether a "Respond to Webhook" node answers flat or wrapped is a detail of
   * how somebody wired a node. Both shapes reach the same contract.
   */
  describe("when the workflow wraps its answer in an envelope", () => {
    it("reads the rewrite out of `result`", async () => {
      const response = await requestRewrite(
        request,
        config,
        respondWith({ success: true, result: validBody() }),
      );

      expect(response.professionalVersion).toBe(validBody().professionalVersion);
    });

    it("still mints its own id inside the envelope", async () => {
      const response = await requestRewrite(
        request,
        config,
        respondWith({ success: true, result: { ...validBody(), id: "id-from-n8n" } }),
      );

      expect(response.id).not.toBe("id-from-n8n");
    });

    /**
     * A workflow that says it failed has told us more than a schema check would,
     * so this is not a malformed response — it is an upstream one.
     */
    it("treats a declared failure as upstream unavailable", async () => {
      await expectCode(
        requestRewrite(request, config, respondWith({ success: false, error: "no model" })),
        "upstream_unavailable",
      );
    });
  });

  describe("when the workflow answers with something unusable", () => {
    it("reports a malformed response for a missing field", async () => {
      const { explanation: _missing, ...incomplete } = validBody();

      await expectCode(
        requestRewrite(request, config, respondWith(incomplete)),
        "malformed_response",
      );
    });

    /**
     * The likeliest failure in the whole path: a model told to answer in JSON
     * answers with prose, or with JSON wrapped in a string. Either way the UI
     * shows copy, never a parser error.
     */
    it("reports a malformed response for a body that is not JSON", async () => {
      await expectCode(
        requestRewrite(request, config, respondWith("Sure! Here is the rewrite:")),
        "malformed_response",
      );
    });

    it("reports a malformed response for an incomplete key phrase", async () => {
      await expectCode(
        requestRewrite(
          request,
          config,
          respondWith({ ...validBody(), keyPhrases: [{ phrase: "no meaning here" }] }),
        ),
        "malformed_response",
      );
    });
  });

  describe("when the workflow answers with a failure", () => {
    it("maps 429 to rate limited", async () => {
      await expectCode(
        requestRewrite(request, config, respondWith({}, { status: 429 })),
        "rate_limited",
      );
    });

    it("maps a server error to upstream unavailable", async () => {
      await expectCode(
        requestRewrite(request, config, respondWith({}, { status: 500 })),
        "upstream_unavailable",
      );
    });

    /**
     * A 401 means the header is wrong, which is our misconfiguration and not
     * something the person typing can fix. It still has to render as copy.
     */
    it("maps a rejected credential to upstream unavailable", async () => {
      await expectCode(
        requestRewrite(request, config, respondWith({}, { status: 401 })),
        "upstream_unavailable",
      );
    });
  });

  describe("when the workflow does not answer", () => {
    it("maps an abort to a timeout", async () => {
      const fetchImpl = vi.fn(async (_url: string, init?: RequestInit) => {
        init?.signal?.throwIfAborted();
        throw new DOMException("The operation was aborted.", "AbortError");
      });

      await expectCode(
        requestRewrite(request, config, fetchImpl as unknown as typeof fetch),
        "upstream_timeout",
      );
    });

    it("maps a transport failure to upstream unavailable", async () => {
      const fetchImpl = vi.fn(async () => {
        throw new TypeError("fetch failed");
      });

      await expectCode(
        requestRewrite(request, config, fetchImpl as unknown as typeof fetch),
        "upstream_unavailable",
      );
    });

    it("stops waiting once the configured timeout elapses", async () => {
      vi.useFakeTimers();

      try {
        const fetchImpl = vi.fn(
          (_url: string, init?: RequestInit) =>
            new Promise<Response>((_resolve, reject) => {
              init?.signal?.addEventListener("abort", () => {
                reject(new DOMException("The operation was aborted.", "AbortError"));
              });
            }),
        );

        const pending = requestRewrite(
          request,
          { ...config, timeoutMs: 5_000 },
          fetchImpl as unknown as typeof fetch,
        );
        const assertion = expectCode(pending, "upstream_timeout");

        await vi.advanceTimersByTimeAsync(5_000);
        await assertion;
      } finally {
        vi.useRealTimers();
      }
    });
  });
});

describe("n8nConfig", () => {
  const url = "https://example.app.n8n.cloud/webhook/rewrite";

  it("reads the webhook and its secret from the server environment", () => {
    const result = n8nConfig({
      N8N_WEBHOOK_URL: url,
      N8N_WEBHOOK_SECRET: "a-long-random-value",
    });

    expect(result.url).toBe(url);
    expect(result.headerValue).toBe("a-long-random-value");
    expect(result.headerName).toBe(DEFAULT_AUTH_HEADER);
    expect(result.timeoutMs).toBe(DEFAULT_TIMEOUT_MS);
  });

  it("lets the workflow name the header it authenticates on", () => {
    const result = n8nConfig({
      N8N_WEBHOOK_URL: url,
      N8N_WEBHOOK_SECRET: "a-long-random-value",
      N8N_WEBHOOK_HEADER: "x-workflow-token",
    });

    expect(result.headerName).toBe("x-workflow-token");
  });

  /** An n8n Test URL is unauthenticated, and configuring one must not need a lie. */
  it("configures no header at all when no secret is set", () => {
    const result = n8nConfig({ N8N_WEBHOOK_URL: url });

    expect(result.headerName).toBeUndefined();
    expect(result.headerValue).toBeUndefined();
  });

  it("accepts an overridden timeout and ignores an unusable one", () => {
    expect(n8nConfig({ N8N_WEBHOOK_URL: url, N8N_TIMEOUT_MS: "5000" }).timeoutMs).toBe(5_000);
    expect(n8nConfig({ N8N_WEBHOOK_URL: url, N8N_TIMEOUT_MS: "soon" }).timeoutMs).toBe(
      DEFAULT_TIMEOUT_MS,
    );
    expect(n8nConfig({ N8N_WEBHOOK_URL: url, N8N_TIMEOUT_MS: "-1" }).timeoutMs).toBe(
      DEFAULT_TIMEOUT_MS,
    );
  });

  /**
   * The failure has to name the variable and the way out. A missing webhook is a
   * deployment that was never finished, not something a retry will fix.
   */
  it("names the missing variable when the webhook URL is absent", () => {
    expect(() => n8nConfig({})).toThrow(/N8N_WEBHOOK_URL/);
    expect(() => n8nConfig({ N8N_WEBHOOK_URL: "   " })).toThrow(/VITE_REWRITE_BACKEND/);
  });
});
