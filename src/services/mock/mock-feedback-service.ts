import { feedbackRequestSchema, type FeedbackRequest } from "@/contracts/feedback";
import { FeedbackServiceError, type FeedbackService } from "@/services/feedback-service";

export type MockFeedbackService = FeedbackService & {
  /** Everything accepted so far — the assertion surface for tests. */
  readonly recorded: ReadonlyArray<FeedbackRequest>;
};

export type MockFeedbackServiceOptions = {
  latencyMs?: number;
};

const DEFAULT_LATENCY_MS = 200;

export function createMockFeedbackService(
  options: MockFeedbackServiceOptions = {},
): MockFeedbackService {
  const latencyMs = options.latencyMs ?? DEFAULT_LATENCY_MS;
  const recorded: FeedbackRequest[] = [];

  return {
    recorded,
    async submit(request: FeedbackRequest): Promise<void> {
      const parsed = feedbackRequestSchema.safeParse(request);

      if (!parsed.success) {
        throw new FeedbackServiceError(parsed.error.issues[0]?.message);
      }

      if (latencyMs > 0) {
        await new Promise<void>((resolve) => {
          setTimeout(resolve, latencyMs);
        });
      }

      recorded.push(parsed.data);
    },
  };
}
