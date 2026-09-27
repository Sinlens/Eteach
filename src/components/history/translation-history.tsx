import { History, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { careerLabel } from "@/contracts/career";
import { toneLabel } from "@/contracts/tone";
import type { TranslationRecord } from "@/contracts/translation";
import { cn } from "@/lib/utils";

/**
 * History is read from storage on the client, so nothing renders during SSR
 * and these timestamps never cause a hydration mismatch.
 */
const timeFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

type TranslationHistoryProps = {
  entries: TranslationRecord[];
  isLoading: boolean;
  activeId: string | null;
  onOpen: (entry: TranslationRecord) => void;
  onClear: () => void;
};

export function TranslationHistory({
  entries,
  isLoading,
  activeId,
  onOpen,
  onClear,
}: TranslationHistoryProps) {
  return (
    <section
      className="mt-5 rounded-lg border border-border bg-card p-5 sm:p-6"
      aria-labelledby="history-heading"
    >
      <div className="flex items-center justify-between gap-4">
        <h2
          id="history-heading"
          className="flex items-center gap-2 text-xs font-semibold uppercase text-muted-foreground"
        >
          <History size={15} /> Recent translations
        </h2>
        {entries.length > 0 ? (
          <Button
            variant="icon"
            size="icon"
            title="Clear history"
            aria-label="Clear history"
            onClick={onClear}
          >
            <Trash2 size={16} />
          </Button>
        ) : null}
      </div>

      {isLoading ? (
        <div className="mt-4 space-y-2" aria-label="Loading history">
          <div className="h-12 animate-pulse rounded-md bg-secondary" />
          <div className="h-12 animate-pulse rounded-md bg-secondary" />
        </div>
      ) : entries.length === 0 ? (
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          Your rewrites will be listed here so you can reopen them without running them again.
        </p>
      ) : (
        <ul className="mt-4 space-y-2">
          {entries.map((entry) => (
            <li key={entry.id}>
              <button
                type="button"
                onClick={() => onOpen(entry)}
                aria-current={entry.id === activeId}
                className={cn(
                  "w-full rounded-md border border-transparent bg-secondary p-3 text-left transition-colors hover:border-primary/40",
                  entry.id === activeId && "border-primary/60",
                )}
              >
                <p className="truncate text-sm font-medium">{entry.inputText}</p>
                <p className="mt-1 truncate text-xs text-muted-foreground">
                  {entry.result.professionalVersion}
                </p>
                <p className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <span className="rounded-sm bg-accent px-2 py-0.5 text-accent-foreground">
                    {careerLabel(entry.career)}
                  </span>
                  <span className="rounded-sm bg-accent px-2 py-0.5 text-accent-foreground">
                    {toneLabel(entry.tone)}
                  </span>
                  <span>· {timeFormatter.format(new Date(entry.createdAt))}</span>
                </p>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
