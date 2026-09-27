import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Sparkles } from "lucide-react";
import { useMemo, useState } from "react";

import { TranslationHistory } from "@/components/history/translation-history";
import { PhraseCard } from "@/components/phrases/phrase-card";
import { careerLabel, type CareerId } from "@/contracts/career";
import type { FeedbackRequest, FeedbackType } from "@/contracts/feedback";
import { DEFAULT_TARGET_LOCALE } from "@/contracts/locale";
import type { KeyPhrase, RewriteRequest } from "@/contracts/rewrite";
import { rewritePhraseId, type SavedPhrase } from "@/contracts/saved-phrase";
import { DEFAULT_TONE_ID, type ToneId } from "@/contracts/tone";
import type { TranslationRecord } from "@/contracts/translation";
import { QUERY_KEYS } from "@/lib/query-keys";
import {
  feedbackService,
  historyService,
  phraseCardForCareer,
  rewriteService,
  savedPhraseService,
  toRewriteErrorMessage,
} from "@/services";

import { RewriteForm } from "./rewrite-form";
import { RewriteResult } from "./rewrite-result";
import { RewriteEmptyState, RewriteErrorState, RewriteSkeleton } from "./rewrite-states";

const EXAMPLE_TEXT = "I already finished the pipeline but we still need to test it.";
const HISTORY_LIMIT = 8;

type TranslatorPanelProps = {
  career: CareerId;
  onCareerChange: (career: CareerId) => void;
};

/**
 * Container for the rewrite loop: owns the state, talks to the ports, and hands
 * plain data to presentational children. No copy, no fixtures, no AI logic.
 *
 * `career` is lifted because the hero's bubbles set it too.
 */
export function TranslatorPanel({ career, onCareerChange }: TranslatorPanelProps) {
  const queryClient = useQueryClient();

  const [text, setText] = useState(EXAMPLE_TEXT);
  const [tone, setTone] = useState<ToneId>(DEFAULT_TONE_ID);
  const [copied, setCopied] = useState(false);
  const [feedback, setFeedback] = useState<FeedbackType | null>(null);
  const [reopened, setReopened] = useState<TranslationRecord | null>(null);

  const history = useQuery({
    queryKey: QUERY_KEYS.history,
    queryFn: () => historyService.list(HISTORY_LIMIT),
  });

  const savedPhrases = useQuery({
    queryKey: QUERY_KEYS.savedPhrases,
    queryFn: () => savedPhraseService.list(),
  });

  const savedPhraseIds = useMemo(
    () => new Set((savedPhrases.data ?? []).map((item) => item.id)),
    [savedPhrases.data],
  );

  const rewrite = useMutation({
    mutationFn: (request: RewriteRequest) => rewriteService.rewrite(request),
    onSuccess: async (result, request) => {
      await historyService.record({
        id: result.id,
        inputText: request.text,
        career: request.career,
        tone: request.tone,
        locale: request.locale,
        createdAt: new Date().toISOString(),
        result,
      });
      await queryClient.invalidateQueries({ queryKey: QUERY_KEYS.history });
    },
  });

  // Fire-and-forget: a failed submission must not disturb the rewrite.
  const submitFeedback = useMutation({
    mutationFn: (request: FeedbackRequest) => feedbackService.submit(request),
  });

  const toggleSavedPhrase = useMutation({
    mutationFn: async (phrase: SavedPhrase) => {
      if (savedPhraseIds.has(phrase.id)) {
        await savedPhraseService.remove(phrase.id);
        return;
      }
      await savedPhraseService.save(phrase);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEYS.savedPhrases }),
  });

  const clearHistory = useMutation({
    mutationFn: () => historyService.clear(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEYS.history }),
  });

  /** Either a fresh rewrite or one reopened from history — never both. */
  const activeResult = rewrite.data ?? reopened?.result ?? null;

  const card = phraseCardForCareer(career);

  const runRewrite = () => {
    setReopened(null);
    setCopied(false);
    setFeedback(null);
    rewrite.mutate({ text, career, tone, locale: DEFAULT_TARGET_LOCALE });
  };

  const openHistoryEntry = (entry: TranslationRecord) => {
    rewrite.reset();
    setReopened(entry);
    setText(entry.inputText);
    setTone(entry.tone);
    onCareerChange(entry.career);
    setCopied(false);
    setFeedback(null);
  };

  const handleCopy = () => {
    if (!activeResult) return;

    navigator.clipboard
      .writeText(activeResult.professionalVersion)
      .then(() => {
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1800);
      })
      .catch(() => {
        // Clipboard access can be denied; failing to copy is not worth an alert.
      });
  };

  const handleToggleKeyPhrase = (keyPhrase: KeyPhrase) => {
    toggleSavedPhrase.mutate({
      id: rewritePhraseId(keyPhrase.phrase),
      phrase: keyPhrase.phrase,
      meaning: keyPhrase.meaning,
      example: null,
      career,
      category: null,
      difficulty: null,
      source: "rewrite",
      savedAt: new Date().toISOString(),
    });
  };

  const handleTogglePhraseCard = () => {
    toggleSavedPhrase.mutate({
      id: card.id,
      phrase: card.phrase,
      meaning: card.meaning,
      example: card.example,
      career: card.career,
      category: card.category,
      difficulty: card.difficulty,
      source: "phrase_card",
      savedAt: new Date().toISOString(),
    });
  };

  const handleFeedback = (next: FeedbackType) => {
    if (!activeResult) return;

    setFeedback(next);
    submitFeedback.mutate({ translationId: activeResult.id, feedback: next });
  };

  function renderResult() {
    if (rewrite.isPending) return <RewriteSkeleton />;
    if (rewrite.isError) {
      return (
        <RewriteErrorState message={toRewriteErrorMessage(rewrite.error)} onRetry={runRewrite} />
      );
    }
    if (activeResult) {
      return (
        <RewriteResult
          result={activeResult}
          copied={copied}
          onCopy={handleCopy}
          savedPhraseIds={savedPhraseIds}
          onToggleSavePhrase={handleToggleKeyPhrase}
          feedback={feedback}
          onFeedback={handleFeedback}
        />
      );
    }
    return <RewriteEmptyState />;
  }

  return (
    <section id="translator" className="mx-auto max-w-7xl scroll-mt-4 px-5 py-10 lg:px-8 lg:py-16">
      <div className="mb-6 flex items-center gap-2 text-xs font-semibold uppercase text-primary">
        <Sparkles size={15} /> {careerLabel(career)} rewriter
      </div>
      <h1 className="sr-only">Professional English rewriter</h1>

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)]">
        <RewriteForm
          text={text}
          onTextChange={setText}
          career={career}
          onCareerChange={onCareerChange}
          tone={tone}
          onToneChange={setTone}
          locale={DEFAULT_TARGET_LOCALE}
          isPending={rewrite.isPending}
          onSubmit={runRewrite}
        />

        <section
          className="min-h-[31rem] rounded-lg border border-border bg-secondary p-5 sm:p-6"
          aria-live="polite"
        >
          {renderResult()}
        </section>
      </div>

      <PhraseCard
        card={card}
        saved={savedPhraseIds.has(card.id)}
        onToggleSave={handleTogglePhraseCard}
        onUse={setText}
      />

      <TranslationHistory
        entries={history.data ?? []}
        isLoading={history.isPending}
        activeId={activeResult?.id ?? null}
        onOpen={openHistoryEntry}
        onClear={() => clearHistory.mutate()}
      />
    </section>
  );
}
