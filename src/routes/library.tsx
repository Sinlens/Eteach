import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";

import { AppHeader } from "@/components/layout/app-header";
import { PhraseLibrary } from "@/components/phrases/phrase-library";
import { QUERY_KEYS } from "@/lib/query-keys";
import { savedPhraseService } from "@/services";

export const Route = createFileRoute("/library")({
  head: () => ({
    meta: [
      { title: "Phrase library — Professional English Coach" },
      {
        name: "description",
        content: "Every professional phrase you've saved, filtered by career and source.",
      },
    ],
  }),
  component: LibraryPage,
});

function LibraryPage() {
  const queryClient = useQueryClient();

  const savedPhrases = useQuery({
    queryKey: QUERY_KEYS.savedPhrases,
    queryFn: () => savedPhraseService.list(),
  });

  const removePhrase = useMutation({
    mutationFn: (id: string) => savedPhraseService.remove(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEYS.savedPhrases }),
  });

  return (
    <main className="min-h-screen bg-background text-foreground">
      <AppHeader />
      <PhraseLibrary
        phrases={savedPhrases.data ?? []}
        isLoading={savedPhrases.isPending}
        onRemove={(id) => removePhrase.mutate(id)}
      />
    </main>
  );
}
