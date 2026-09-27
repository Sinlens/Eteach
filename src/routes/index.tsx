import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

import { PoolHero } from "@/components/hero/pool-hero";
import { TranslatorPanel } from "@/components/translator/translator-panel";
import { DEFAULT_CAREER_ID, type CareerId } from "@/contracts/career";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Professional English Coach — Write with confidence" },
      {
        name: "description",
        content:
          "Turn everyday English into clear, natural professional American English for your technology career.",
      },
      { property: "og:title", content: "Professional English Coach" },
      {
        property: "og:description",
        content:
          "Rewrite workplace English with the right tone and context for your technology career.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

/**
 * Route composition only. `career` is lifted here because both the hero's
 * bubbles and the translator's selector write to it.
 */
function Index() {
  const [career, setCareer] = useState<CareerId>(DEFAULT_CAREER_ID);

  return (
    <main className="min-h-screen bg-background text-foreground">
      <PoolHero onSelectCareer={setCareer} />
      <TranslatorPanel career={career} onCareerChange={setCareer} />
    </main>
  );
}
