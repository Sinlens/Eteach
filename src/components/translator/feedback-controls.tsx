import { Button } from "@/components/ui/button";
import { FEEDBACK_OPTIONS, type FeedbackType } from "@/contracts/feedback";

type FeedbackControlsProps = {
  value: FeedbackType | null;
  onSelect: (feedback: FeedbackType) => void;
};

/**
 * All four signals the product defines (manual §5.7). "Too formal" and "too
 * informal" are the ones that later drive tone personalization, so they are
 * here from the start rather than bolted on.
 */
export function FeedbackControls({ value, onSelect }: FeedbackControlsProps) {
  return (
    <div
      className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4"
      role="group"
      aria-label="Rate this rewrite"
    >
      <span className="text-xs text-muted-foreground">Was this useful?</span>
      <div className="flex flex-wrap gap-1.5">
        {FEEDBACK_OPTIONS.map((option) => (
          <Button
            key={option.id}
            type="button"
            size="sm"
            variant={value === option.id ? "secondary" : "outline"}
            aria-pressed={value === option.id}
            onClick={() => onSelect(option.id)}
          >
            {option.label}
          </Button>
        ))}
      </div>
    </div>
  );
}
