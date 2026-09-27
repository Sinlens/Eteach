/** Shared React Query keys, so writes can invalidate the right reads. */
export const QUERY_KEYS = {
  history: ["history"] as const,
  savedPhrases: ["saved-phrases"] as const,
};
