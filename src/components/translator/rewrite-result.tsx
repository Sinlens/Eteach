import { Bookmark, Check, Copy } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { FeedbackType } from "@/contracts/feedback";
import type { KeyPhrase, RewriteResponse } from "@/contracts/rewrite";
import { rewritePhraseId } from "@/contracts/saved-phrase";

import { FeedbackControls } from "./feedback-controls";

type RewriteResultProps = {
  result: RewriteResponse;
  copied: boolean;
  onCopy: () => void;
  savedPhraseIds: ReadonlySet<string>;
  onToggleSavePhrase: (keyPhrase: KeyPhrase) => void;
  feedback: FeedbackType | null;
  onFeedback: (feedback: FeedbackType) => void;
};

export function RewriteResult({
  result,
  copied,
  onCopy,
  savedPhraseIds,
  onToggleSavePhrase,
  feedback,
  onFeedback,
}: RewriteResultProps) {
  return (
    <div className="result-enter">
      <div className="flex items-start justify-between gap-4">
        <div>
          <span className="text-xs font-semibold uppercase text-primary">Professional version</span>
          <h2 className="mt-3 text-xl font-semibold leading-8 sm:text-2xl">
            “{result.professionalVersion}”
          </h2>
        </div>
        <Button
          variant="icon"
          size="icon"
          title="Copy professional version"
          aria-label="Copy professional version"
          onClick={onCopy}
        >
          {copied ? <Check size={18} className="text-primary" /> : <Copy size={18} />}
        </Button>
      </div>

      <div className="my-6 border-t border-border" />

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-md bg-background p-4">
          <p className="text-xs font-semibold text-category-purple">ALTERNATIVE</p>
          <p className="mt-2 text-sm leading-6">{result.alternativeVersion}</p>
        </div>
        <div className="rounded-md bg-background p-4">
          <p className="text-xs font-semibold text-category-orange">WHY THIS WORKS</p>
          <p className="mt-2 text-sm leading-6 text-secondary-foreground">{result.explanation}</p>
        </div>
      </div>

      {result.keyPhrases.map((keyPhrase) => {
        const saved = savedPhraseIds.has(rewritePhraseId(keyPhrase.phrase));
        return (
          <div
            key={keyPhrase.phrase}
            className="mt-4 rounded-md border border-primary/30 bg-primary-soft p-4"
          >
            <p className="text-xs font-semibold text-primary">KEY PHRASE</p>
            <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="font-semibold">“{keyPhrase.phrase}”</p>
                <p className="mt-1 text-xs text-muted-foreground">{keyPhrase.meaning}</p>
              </div>
              <Button
                variant="secondary"
                size="sm"
                aria-pressed={saved}
                onClick={() => onToggleSavePhrase(keyPhrase)}
              >
                {saved ? <Check size={15} /> : <Bookmark size={15} />}
                {saved ? "Saved" : "Save phrase"}
              </Button>
            </div>
          </div>
        );
      })}

      {result.vocabulary.length > 0 && (
        <div className="mt-4 rounded-md bg-background p-4">
          <p className="text-xs font-semibold text-category-blue">VOCABULARY</p>
          <dl className="mt-2 space-y-2">
            {result.vocabulary.map((item) => (
              <div key={item.term}>
                <dt className="text-sm font-semibold">{item.term}</dt>
                <dd className="text-xs leading-5 text-muted-foreground">{item.definition}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}

      <FeedbackControls value={feedback} onSelect={onFeedback} />
    </div>
  );
}
