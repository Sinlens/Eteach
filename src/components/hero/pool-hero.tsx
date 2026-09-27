import { ChevronDown, Sparkles } from "lucide-react";
import { useState } from "react";

import { AppHeader } from "@/components/layout/app-header";
import { Button } from "@/components/ui/button";
import { careerLabel, type CareerId } from "@/contracts/career";

type PoolHeroProps = {
  onSelectCareer: (career: CareerId) => void;
};

/** Bubble copy and colour are presentation, so the mapping lives here. */
const CAREER_BUBBLES: ReadonlyArray<{
  id: CareerId;
  lines: readonly string[];
  className: string;
}> = [
  { id: "data_science", lines: ["Data", "Science"], className: "career-bubble--science" },
  { id: "data_analytics", lines: ["Data", "Analytics"], className: "career-bubble--analytics" },
  {
    id: "data_engineering",
    lines: ["Data", "Engineering"],
    className: "career-bubble--engineering",
  },
  {
    id: "software_architecture",
    lines: ["Software", "Architecture"],
    className: "career-bubble--architecture",
  },
];

const POP_DURATION_MS = 420;

export function PoolHero({ onSelectCareer }: PoolHeroProps) {
  const [popping, setPopping] = useState<CareerId | null>(null);

  const chooseCareer = (career: CareerId) => {
    if (popping) return;
    setPopping(career);
    onSelectCareer(career);
    window.setTimeout(() => {
      document.getElementById("translator")?.scrollIntoView({ behavior: "smooth", block: "start" });
      setPopping(null);
    }, POP_DURATION_MS);
  };

  return (
    <section className="pool-hero" aria-labelledby="pool-heading">
      <AppHeader />

      <div className="pool-depth" aria-hidden="true">
        <span className="pool-light pool-light--one" />
        <span className="pool-light pool-light--two" />
        <span className="pool-floor" />
      </div>

      <div className="pool-copy">
        <p className="pool-eyebrow">
          <Sparkles size={15} /> Choose your professional context
        </p>
        <h1 id="pool-heading" className="font-display">
          Dive into better English.
        </h1>
        <p>Select your career bubble. Pop it to tailor the translator to your world.</p>
      </div>

      <div className="bubble-field" aria-label="Choose your career">
        {CAREER_BUBBLES.map((bubble) => (
          <Button
            key={bubble.id}
            type="button"
            variant="outline"
            className={`career-bubble ${bubble.className}${popping === bubble.id ? " is-popping" : ""}`}
            onClick={() => chooseCareer(bubble.id)}
            aria-label={`Choose ${careerLabel(bubble.id)} and open the translator`}
            disabled={Boolean(popping)}
          >
            <span className="bubble-shine" aria-hidden="true" />
            <span className="bubble-label">
              {bubble.lines.map((line) => (
                <span key={line}>{line}</span>
              ))}
            </span>
            <span className="bubble-ripple" aria-hidden="true" />
          </Button>
        ))}
      </div>

      <a href="#translator" className="pool-dive-link">
        <span>Or dive straight in</span>
        <ChevronDown size={18} aria-hidden="true" />
      </a>
    </section>
  );
}
