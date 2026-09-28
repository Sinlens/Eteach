import {
  rewriteRequestSchema,
  rewriteResponseSchema,
  type RewriteRequest,
  type RewriteResponse,
} from "@/contracts/rewrite";
import { RewriteServiceError } from "@/services/rewrite-service";

/**
 * The call into n8n.
 *
 * n8n owns the prompt and the model; this owns the contract. Everything that
 * crosses the boundary is checked on the way back in, because the last step of
 * that workflow is a language model being asked to answer in JSON — the one
 * part of this system that can fail by being plausible rather than by erroring.
 *
 * Nothing here reaches the browser. The webhook URL and its secret are server
 * secrets for the same reason the service role key is: a `VITE_` prefix would
 * inline them into the bundle, and a webhook anybody can call is a webhook
 * anybody can bill you for.
 */
export type N8nConfig = {
  url: string;
  /**
   * The header the webhook authenticates on, named by the workflow.
   *
   * Optional, and optional *together*: an n8n Test URL has nothing to
   * authenticate, and sending it a header with an empty value would be a claim
   * rather than a default.
   */
  headerName?: string;
  headerValue?: string;
  timeoutMs: number;
};

/**
 * Long enough for a model to think, short enough that somebody watching a
 * spinner gives up second. The port has a timeout error code precisely because
 * this call can outlive the person's patience.
 */
export const DEFAULT_TIMEOUT_MS = 30_000;

/** Used when a secret is configured but the workflow's header name is not. */
export const DEFAULT_AUTH_HEADER = "x-eteach-secret";

type Env = Record<string, string | undefined>;

function requiredEnv(name: string, env: Env): string {
  const value = env[name]?.trim();

  if (!value) {
    throw new Error(
      `${name} is not set. The rewrite backend is configured as "n8n" — set it as a ` +
        `server secret, or set VITE_REWRITE_BACKEND to "mock" to run against fixtures.`,
    );
  }

  return value;
}

function timeoutFrom(raw: string | undefined): number {
  const parsed = Number(raw);

  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_TIMEOUT_MS;
}

/**
 * The configuration, read from the server's environment.
 *
 * Deliberately not `VITE_`-prefixed, and this is the whole reason the call lives
 * on this side: that prefix inlines a value into the browser bundle, which would
 * publish both the endpoint and the secret that guards it. Same rule as
 * `SUPABASE_SERVICE_ROLE_KEY`, same reason.
 */
export function n8nConfig(env: Env = process.env): N8nConfig {
  const headerValue = env["N8N_WEBHOOK_SECRET"]?.trim();

  return {
    url: requiredEnv("N8N_WEBHOOK_URL", env),
    ...(headerValue
      ? { headerName: env["N8N_WEBHOOK_HEADER"]?.trim() || DEFAULT_AUTH_HEADER, headerValue }
      : {}),
    timeoutMs: timeoutFrom(env["N8N_TIMEOUT_MS"]),
  };
}

/**
 * Ours to mint, never the workflow's. This id is what feedback is keyed on in
 * `translations`, so a row's identity cannot depend on something outside this
 * system that nothing would notice had started repeating.
 */
function mintId(): string {
  return `rw_${globalThis.crypto.randomUUID()}`;
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}

function headersFor(config: N8nConfig): Record<string, string> {
  const headers: Record<string, string> = { "content-type": "application/json" };

  if (config.headerName && config.headerValue) {
    headers[config.headerName] = config.headerValue;
  }

  return headers;
}

/**
 * The rewrite, wherever the workflow chose to put it.
 *
 * A "Respond to Webhook" node is as likely to answer with the rewrite at the top
 * level as wrapped in `{ success, result }`, and which one it does is a detail of
 * how somebody wired a node — not something worth a contract change or a second
 * adapter. `success: false` is honoured on the way past, because a workflow that
 * says it failed has told us more than a schema check would.
 */
function unwrapBody(payload: Record<string, unknown>): Record<string, unknown> {
  if (payload["success"] === false) {
    throw new RewriteServiceError("upstream_unavailable");
  }

  const result = payload["result"];

  return typeof result === "object" && result !== null
    ? (result as Record<string, unknown>)
    : payload;
}

export async function requestRewrite(
  request: RewriteRequest,
  config: N8nConfig,
  fetchImpl: typeof fetch = fetch,
): Promise<RewriteResponse> {
  // Checked here rather than trusted, so a bad request costs nothing upstream.
  const parsedRequest = rewriteRequestSchema.safeParse(request);

  if (!parsedRequest.success) {
    throw new RewriteServiceError("invalid_request");
  }

  const controller = new AbortController();
  let timedOut = false;

  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, config.timeoutMs);

  let response: Response;

  try {
    response = await fetchImpl(config.url, {
      method: "POST",
      headers: headersFor(config),
      body: JSON.stringify(parsedRequest.data),
      signal: controller.signal,
    });
  } catch (error) {
    // A timeout and a severed connection are the same event to `fetch` and
    // different events to somebody waiting, so they are told apart here.
    throw new RewriteServiceError(
      timedOut || isAbortError(error) ? "upstream_timeout" : "upstream_unavailable",
    );
  } finally {
    clearTimeout(timer);
  }

  if (!response.ok) {
    // Only rate limiting is worth its own copy: it is the one failure the
    // person can resolve by waiting. A rejected credential is our mistake, not
    // theirs, and saying so would only tell them something they cannot act on.
    throw new RewriteServiceError(
      response.status === 429 ? "rate_limited" : "upstream_unavailable",
    );
  }

  let payload: unknown;

  try {
    payload = await response.json();
  } catch {
    throw new RewriteServiceError("malformed_response");
  }

  if (typeof payload !== "object" || payload === null) {
    throw new RewriteServiceError("malformed_response");
  }

  // The id is applied last so a workflow that sends one cannot win.
  const parsed = rewriteResponseSchema.safeParse({
    ...unwrapBody(payload as Record<string, unknown>),
    id: mintId(),
  });

  if (!parsed.success) {
    throw new RewriteServiceError("malformed_response");
  }

  return parsed.data;
}
