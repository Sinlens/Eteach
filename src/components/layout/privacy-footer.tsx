import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { storedDataService } from "@/services";

/**
 * The delete path, where a person can actually reach it.
 *
 * Deliberately quiet and deliberately on every page. An irreversible action
 * does not belong in the header competing with navigation, and it does not
 * belong buried where somebody who wants their data gone cannot find it.
 *
 * The confirmation is built here rather than with the Radix dialog sitting in
 * `components/ui`, for the same reason `waterfall-select.tsx` exists instead of
 * the shadcn select: nothing else in this interface is Radix, and a page-level
 * modal dependency is a large thing to add for one panel that can be part of
 * the document flow. Inline also means no focus trap to get wrong.
 *
 * What it says matters as much as that it works. It names what goes instead of
 * asking "are you sure?" — somebody about to erase their own work should read
 * the list first.
 */
export function PrivacyFooter() {
  const queryClient = useQueryClient();
  const [confirming, setConfirming] = useState(false);
  const [done, setDone] = useState(false);
  const confirmRef = useRef<HTMLButtonElement>(null);

  // Opening the panel moves focus onto the destructive button, so the keyboard
  // lands where the mouse would.
  useEffect(() => {
    if (confirming) confirmRef.current?.focus();
  }, [confirming]);

  const deleteEverything = useMutation({
    mutationFn: () => storedDataService.deleteEverything(),
    onSuccess: async () => {
      // The identity has been rotated, so every cached answer belongs to
      // somebody who no longer exists.
      queryClient.clear();
      await queryClient.invalidateQueries();
      setConfirming(false);
      setDone(true);
    },
  });

  return (
    <footer className="mx-auto max-w-7xl px-5 pb-10 pt-4 lg:px-8">
      <div className="border-t border-border pt-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs leading-5 text-muted-foreground">
            What you write is kept in your history for ninety days, then the text is erased.
          </p>

          {done ? (
            <p role="status" className="text-xs font-medium text-muted-foreground">
              Deleted. Nothing of yours is stored any more.
            </p>
          ) : (
            <button
              type="button"
              onClick={() => setConfirming(true)}
              aria-expanded={confirming}
              aria-controls="delete-everything-panel"
              className="rounded-sm text-xs font-medium text-muted-foreground underline underline-offset-4 transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              Delete everything stored about me
            </button>
          )}
        </div>

        {confirming && !done ? (
          <section
            id="delete-everything-panel"
            role="alertdialog"
            aria-labelledby="delete-everything-heading"
            className="mt-4 rounded-lg border border-destructive/40 bg-card p-5"
          >
            <h2 id="delete-everything-heading" className="text-sm font-semibold">
              Delete everything stored about you?
            </h2>

            <p className="mt-2 text-sm leading-6 text-muted-foreground">This removes, for good:</p>
            <ul className="mt-1 list-disc space-y-1 pl-5 text-sm leading-6 text-muted-foreground">
              <li>every rewrite in your history, and what you typed to get it</li>
              <li>every phrase you saved</li>
              <li>the feedback you sent</li>
            </ul>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              The identifier this device uses is replaced at the same time, so nothing links back to
              you afterwards. It cannot be undone.
            </p>

            {deleteEverything.isError ? (
              <p role="alert" className="mt-3 text-sm font-medium text-destructive">
                Nothing was deleted — the request did not go through. Please try again.
              </p>
            ) : null}

            <div className="mt-4 flex flex-wrap gap-2">
              <Button
                ref={confirmRef}
                variant="destructive"
                size="sm"
                onClick={() => deleteEverything.mutate()}
                disabled={deleteEverything.isPending}
              >
                {deleteEverything.isPending ? "Deleting…" : "Delete everything"}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setConfirming(false)}
                disabled={deleteEverything.isPending}
              >
                Keep it
              </Button>
            </div>
          </section>
        ) : null}
      </div>
    </footer>
  );
}
