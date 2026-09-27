import { ArrowRight, Bookmark, Check, MessageSquareText } from "lucide-react";

import { Button } from "@/components/ui/button";
import { careerLabel } from "@/contracts/career";
import type { PhraseCard as PhraseCardModel } from "@/contracts/phrase-card";

type PhraseCardProps = {
  card: PhraseCardModel;
  saved: boolean;
  onToggleSave: () => void;
  onUse: (example: string) => void;
};

/**
 * Notification-style learning card (manual §20).
 *
 * The card follows the selected career, so the heading and the example can no
 * longer disagree with each other.
 */
export function PhraseCard({ card, saved, onToggleSave, onUse }: PhraseCardProps) {
  return (
    <aside className="mt-5 flex flex-col justify-between gap-5 rounded-lg border border-border bg-card p-5 sm:flex-row sm:items-center sm:p-6">
      <div className="flex gap-4">
        <span className="grid size-10 shrink-0 place-items-center rounded-md bg-category-blue text-category-ink">
          <MessageSquareText size={19} />
        </span>
        <div>
          <p className="text-xs font-semibold uppercase text-category-blue">
            Useful phrase · {careerLabel(card.career)}
          </p>
          <p className="mt-2 text-base font-semibold">“{card.example}”</p>
          <p className="mt-1 text-sm text-muted-foreground">{card.meaning}</p>
        </div>
      </div>
      <div className="flex shrink-0 flex-wrap gap-2">
        <Button variant="secondary" size="sm" aria-pressed={saved} onClick={onToggleSave}>
          {saved ? <Check size={15} /> : <Bookmark size={15} />}
          {saved ? "Saved" : "Save"}
        </Button>
        <Button variant="secondary" size="sm" onClick={() => onUse(card.example)}>
          Use in rewriter <ArrowRight size={15} />
        </Button>
      </div>
    </aside>
  );
}
