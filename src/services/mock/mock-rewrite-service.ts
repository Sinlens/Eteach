import {
  rewriteRequestSchema,
  rewriteResponseSchema,
  type RewriteRequest,
  type RewriteResponse,
  type RewriteResponsePayload,
} from "@/contracts/rewrite";
import {
  RewriteServiceError,
  type RewriteErrorCode,
  type RewriteService,
} from "@/services/rewrite-service";

import { CAREER_FIXTURES, TONE_NOTES } from "./fixtures";

export type MockRewriteServiceOptions = {
  /** Simulated round-trip. Set to 0 in tests. */
  latencyMs?: number;
  /** Force a failure so the error state can be built and demoed. */
  failWith?: RewriteErrorCode;
};

const DEFAULT_LATENCY_MS = 850;

let sequence = 0;

function nextId(): string {
  sequence += 1;
  return `mock_rw_${Date.now().toString(36)}_${sequence}`;
}

function delay(ms: number): Promise<void> {
  if (ms <= 0) return Promise.resolve();
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

/**
 * In-memory adapter for the rewrite port.
 *
 * It validates the request exactly like the real backend will, and parses its
 * own output through `rewriteResponseSchema` on the way out — so if a fixture
 * ever drifts from the contract, the mock fails here instead of the UI quietly
 * rendering something the real API would never send.
 */
export function createMockRewriteService(options: MockRewriteServiceOptions = {}): RewriteService {
  const latencyMs = options.latencyMs ?? DEFAULT_LATENCY_MS;
  const { failWith } = options;

  return {
    async rewrite(request: RewriteRequest): Promise<RewriteResponse> {
      const parsed = rewriteRequestSchema.safeParse(request);

      if (!parsed.success) {
        throw new RewriteServiceError("invalid_request", parsed.error.issues[0]?.message);
      }

      await delay(latencyMs);

      if (failWith) {
        throw new RewriteServiceError(failWith);
      }

      const { career, tone } = parsed.data;
      const fixture = CAREER_FIXTURES[career];

      const payload: RewriteResponsePayload = {
        id: nextId(),
        professionalVersion: fixture.professionalVersion,
        alternativeVersion: fixture.alternativeVersion,
        explanation: `${fixture.rationale} ${TONE_NOTES[tone]}`,
        keyPhrases: fixture.keyPhrases,
        vocabulary: fixture.vocabulary,
      };

      return rewriteResponseSchema.parse(payload);
    },
  };
}
