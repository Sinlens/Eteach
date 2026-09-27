import type { RewriteRequest, RewriteResponse } from "@/contracts/rewrite";

/**
 * The port the UI depends on.
 *
 * The UI must never know whether a rewrite came from a fixture, an HTTP call or
 * n8n. Phase 2 adds an HTTP adapter behind this same interface and nothing in
 * the components changes.
 */
export interface RewriteService {
  rewrite(request: RewriteRequest): Promise<RewriteResponse>;
}

/**
 * Failure modes the UI has to be able to render. These mirror the integration
 * tests the manual requires in Phase 4 (§30): bad input, n8n timeout, LLM
 * unavailable, malformed LLM JSON.
 */
export const REWRITE_ERROR_CODES = [
  "invalid_request",
  "upstream_unavailable",
  "upstream_timeout",
  "malformed_response",
  "rate_limited",
] as const;

export type RewriteErrorCode = (typeof REWRITE_ERROR_CODES)[number];

/** User-facing copy, one per failure mode. No stack traces reach the screen. */
export const REWRITE_ERROR_MESSAGES: Record<RewriteErrorCode, string> = {
  invalid_request: "Check your message and try again.",
  upstream_unavailable: "The rewriter is unavailable right now. Please try again in a moment.",
  upstream_timeout: "That took longer than expected. Please try again.",
  malformed_response: "We couldn't read the response. Please try again.",
  rate_limited: "You've made a lot of requests. Give it a minute and try again.",
};

export class RewriteServiceError extends Error {
  readonly code: RewriteErrorCode;

  constructor(code: RewriteErrorCode, message?: string) {
    super(message ?? REWRITE_ERROR_MESSAGES[code]);
    this.name = "RewriteServiceError";
    this.code = code;
  }
}

export function isRewriteServiceError(error: unknown): error is RewriteServiceError {
  return error instanceof RewriteServiceError;
}

/** Any thrown value turned into copy the UI can show. */
export function toRewriteErrorMessage(error: unknown): string {
  return isRewriteServiceError(error) ? error.message : REWRITE_ERROR_MESSAGES.upstream_unavailable;
}
