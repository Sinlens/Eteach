import {
  rewriteRequestSchema,
  type RewriteRequest,
  type RewriteResponse,
} from "@/contracts/rewrite";
import { RewriteServiceError, type RewriteService } from "@/services/rewrite-service";

import { rewriteFn, type RewriteFnResult } from "./rewrite-function";

/**
 * The rewrite port, backed by n8n through our own server.
 *
 * Thin by design, like the other remote adapters: the call to n8n and every
 * mapping it needs live server-side, and all that happens here is crossing the
 * boundary and turning a returned failure back into a thrown one — because the
 * UI's error state is driven by a rejected mutation, and that is a decision the
 * components already made.
 */
export type RewriteCall = (options: { data: RewriteRequest }) => Promise<RewriteFnResult>;

export function createRemoteRewriteService(
  call: RewriteCall = rewriteFn as unknown as RewriteCall,
): RewriteService {
  return {
    async rewrite(request: RewriteRequest): Promise<RewriteResponse> {
      // Checked before crossing, exactly as the mock does. A request the
      // contract would reject costs nothing here, and the alternative is a
      // round trip that ends in a thrown `ZodError` — which loses its code on
      // the way back and would surface as the wrong message.
      const parsed = rewriteRequestSchema.safeParse(request);

      if (!parsed.success) {
        throw new RewriteServiceError("invalid_request", parsed.error.issues[0]?.message);
      }

      let outcome: RewriteFnResult;

      try {
        outcome = await call({ data: parsed.data });
      } catch {
        // Our own server did not answer — an offline browser or a cold deploy,
        // not n8n. The person can only be told to try again either way.
        throw new RewriteServiceError("upstream_unavailable");
      }

      if (!outcome.ok) {
        throw new RewriteServiceError(outcome.code);
      }

      return outcome.result;
    },
  };
}
