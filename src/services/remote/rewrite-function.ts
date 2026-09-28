import { createServerFn } from "@tanstack/react-start";

import { rewriteRequestSchema, type RewriteResponse } from "@/contracts/rewrite";
import { n8nConfig, requestRewrite } from "@/server/n8n";
import { isRewriteServiceError, type RewriteErrorCode } from "@/services/rewrite-service";

/**
 * The rewrite's server boundary.
 *
 * The browser calls this; this calls n8n. That indirection is the whole point:
 * the webhook URL and the secret that guards it stay in `process.env` on this
 * side, where a bundle cannot reach them, and the browser only ever talks to its
 * own origin — so there is no cross-origin request for n8n to have to allow.
 */

/**
 * A failure is returned, not thrown.
 *
 * `RewriteServiceError` does not survive the boundary: what crosses is JSON, so
 * the class is gone and `code` with it — and `code` is the only thing that picks
 * the copy the person reads. Thrown, every distinct failure would arrive as the
 * same unnameable one. Returned, the discrimination is data and survives.
 */
export type RewriteFnResult =
  { ok: true; result: RewriteResponse } | { ok: false; code: RewriteErrorCode };

export const rewriteFn = createServerFn({ method: "POST" })
  .validator((input: unknown) => rewriteRequestSchema.parse(input))
  .handler(async ({ data }): Promise<RewriteFnResult> => {
    try {
      return { ok: true, result: await requestRewrite(data, n8nConfig()) };
    } catch (error) {
      if (isRewriteServiceError(error)) {
        return { ok: false, code: error.code };
      }

      // Anything else is ours — a missing environment variable, most likely.
      // It belongs in the server log, and on the screen only as generic copy.
      console.error(error);

      return { ok: false, code: "upstream_unavailable" };
    }
  });
