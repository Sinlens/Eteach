import { Bookmark, Search, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { WaterfallSelect, type WaterfallOption } from "@/components/waterfall-select";
import { CAREER_OPTIONS, careerLabel, type CareerId } from "@/contracts/career";
import { PHRASE_CATEGORY_LABELS } from "@/contracts/phrase-card";
import {
  SAVED_PHRASE_SOURCE_LABELS,
  type SavedPhrase,
  type SavedPhraseSource,
} from "@/contracts/saved-phrase";

type CareerFilter = CareerId | "all";
type SourceFilter = SavedPhraseSource | "all";

const CAREER_FILTER_OPTIONS: ReadonlyArray<WaterfallOption<CareerFilter>> = [
  { id: "all", label: "All careers" },
  ...CAREER_OPTIONS,
];

const SOURCE_FILTER_OPTIONS: ReadonlyArray<WaterfallOption<SourceFilter>> = [
  { id: "all", label: "All sources" },
  { id: "rewrite", label: SAVED_PHRASE_SOURCE_LABELS.rewrite },
  { id: "phrase_card", label: SAVED_PHRASE_SOURCE_LABELS.phrase_card },
];

const savedAtFormatter = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" });

type PhraseLibraryProps = {
  phrases: SavedPhrase[];
  isLoading: boolean;
  onRemove: (id: string) => void;
};

export function PhraseLibrary({ phrases, isLoading, onRemove }: PhraseLibraryProps) {
  const [career, setCareer] = useState<CareerFilter>("all");
  const [source, setSource] = useState<SourceFilter>("all");
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();

    return phrases.filter((item) => {
      if (career !== "all" && item.career !== career) return false;
      if (source !== "all" && item.source !== source) return false;
      if (!needle) return true;

      return (
        item.phrase.toLowerCase().includes(needle) ||
        item.meaning.toLowerCase().includes(needle) ||
        (item.example?.toLowerCase().includes(needle) ?? false)
      );
    });
  }, [phrases, career, source, search]);

  return (
    <section className="mx-auto max-w-5xl px-5 py-10 lg:px-8 lg:py-14">
      <div className="mb-8 max-w-2xl">
        <div className="mb-4 flex items-center gap-2 text-xs font-semibold uppercase text-primary">
          <Bookmark size={15} /> Phrase library
        </div>
        <h1 className="font-display text-3xl font-semibold leading-tight sm:text-4xl">
          Everything you've saved.
        </h1>
        <p className="mt-4 text-base leading-7 text-muted-foreground">
          Phrases you kept from a rewrite or a suggestion card, ready to reuse.
        </p>
      </div>

      <div className="mb-6 grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,14rem)_minmax(0,14rem)]">
        <div className="relative">
          <Search
            size={16}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
          />
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search your phrases..."
            aria-label="Search your phrases"
            className="h-11 w-full rounded-md border border-input bg-background pl-9 pr-3 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-primary focus:ring-1 focus:ring-primary"
          />
        </div>
        <WaterfallSelect
          label="Career"
          value={career}
          options={CAREER_FILTER_OPTIONS}
          onChange={setCareer}
        />
        <WaterfallSelect
          label="Source"
          value={source}
          options={SOURCE_FILTER_OPTIONS}
          onChange={setSource}
        />
      </div>

      {isLoading ? (
        <div className="space-y-3" aria-label="Loading your phrases">
          <div className="h-24 animate-pulse rounded-lg bg-secondary" />
          <div className="h-24 animate-pulse rounded-lg bg-secondary" />
        </div>
      ) : phrases.length === 0 ? (
        <EmptyLibrary />
      ) : filtered.length === 0 ? (
        <NoMatches />
      ) : (
        <>
          <p className="mb-3 text-xs text-muted-foreground">
            {filtered.length} of {phrases.length} saved
          </p>
          <ul className="space-y-3">
            {filtered.map((item) => (
              <li key={item.id} className="rounded-lg border border-border bg-secondary p-5 sm:p-6">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-base font-semibold">“{item.phrase}”</p>
                    <p className="mt-1 text-sm leading-6 text-muted-foreground">{item.meaning}</p>
                    {item.example ? (
                      <p className="mt-3 rounded-md bg-background p-3 text-sm leading-6">
                        {item.example}
                      </p>
                    ) : null}
                  </div>
                  <Button
                    variant="icon"
                    size="icon"
                    title="Remove from library"
                    aria-label={`Remove “${item.phrase}” from your library`}
                    onClick={() => onRemove(item.id)}
                  >
                    <Trash2 size={17} />
                  </Button>
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
                  <span className="rounded-sm bg-accent px-2 py-1 text-accent-foreground">
                    {careerLabel(item.career)}
                  </span>
                  {item.category ? (
                    <span className="rounded-sm bg-accent px-2 py-1 text-accent-foreground">
                      {PHRASE_CATEGORY_LABELS[item.category]}
                    </span>
                  ) : null}
                  <span className="text-muted-foreground">
                    {SAVED_PHRASE_SOURCE_LABELS[item.source]}
                  </span>
                  <span className="text-muted-foreground">
                    · {savedAtFormatter.format(new Date(item.savedAt))}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

function EmptyLibrary() {
  return (
    <div className="rounded-lg border border-border bg-secondary p-10 text-center">
      <span className="mx-auto grid size-14 place-items-center rounded-lg bg-accent text-primary">
        <Bookmark size={24} />
      </span>
      <h2 className="mt-5 text-lg font-semibold">Nothing saved yet</h2>
      <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-muted-foreground">
        Save a key phrase from a rewrite, or a suggestion card, and it will show up here.
      </p>
    </div>
  );
}

function NoMatches() {
  return (
    <div className="rounded-lg border border-border bg-secondary p-10 text-center">
      <h2 className="text-lg font-semibold">No phrases match those filters</h2>
      <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-muted-foreground">
        Try a different career, source or search term.
      </p>
    </div>
  );
}
