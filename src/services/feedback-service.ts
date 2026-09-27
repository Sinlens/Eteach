import type { FeedbackRequest } from "@/contracts/feedback";

/**
 * Feedback port (manual §11 Workflow 4, §22 `POST /api/feedback`).
 *
 * Fire-and-forget by design: a failed feedback submission must never block the
 * user or replace the rewrite they came for.
 */
export interface FeedbackService {
  submit(request: FeedbackRequest): Promise<void>;
}

export class FeedbackServiceError extends Error {
  constructor(message = "Your feedback could not be recorded.") {
    super(message);
    this.name = "FeedbackServiceError";
  }
}
