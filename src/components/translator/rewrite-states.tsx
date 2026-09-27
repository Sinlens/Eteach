import { AlertTriangle, RotateCcw, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";

export function RewriteEmptyState() {
  return (
    <div className="flex min-h-[27rem] flex-col items-center justify-center text-center">
      <span className="grid size-14 place-items-center rounded-lg bg-accent text-primary">
        <Sparkles size={24} />
      </span>
      <h2 className="mt-5 text-lg font-semibold">Your professional version will appear here</h2>
      <p className="mt-2 max-w-sm text-sm leading-6 text-muted-foreground">
        Add your message, choose a career and tone, then rewrite it.
      </p>
    </div>
  );
}

export function RewriteSkeleton() {
  return (
    <div className="space-y-5" aria-label="Creating professional version">
      <div className="h-5 w-40 animate-pulse rounded-sm bg-accent" />
      <div className="h-28 animate-pulse rounded-md bg-accent" />
      <div className="h-20 animate-pulse rounded-md bg-accent" />
      <div className="h-24 animate-pulse rounded-md bg-accent" />
    </div>
  );
}

type RewriteErrorStateProps = {
  message: string;
  onRetry: () => void;
};

/**
 * The state the prototype never had. Every failure mode in `RewriteErrorCode`
 * lands here with copy the user can act on — never a stack trace.
 */
export function RewriteErrorState({ message, onRetry }: RewriteErrorStateProps) {
  return (
    <div
      className="flex min-h-[27rem] flex-col items-center justify-center text-center"
      role="alert"
    >
      <span className="grid size-14 place-items-center rounded-lg bg-destructive/15 text-destructive">
        <AlertTriangle size={24} />
      </span>
      <h2 className="mt-5 text-lg font-semibold">That didn't go through</h2>
      <p className="mt-2 max-w-sm text-sm leading-6 text-muted-foreground">{message}</p>
      <Button variant="secondary" size="sm" className="mt-6" onClick={onRetry}>
        <RotateCcw size={15} /> Try again
      </Button>
    </div>
  );
}
