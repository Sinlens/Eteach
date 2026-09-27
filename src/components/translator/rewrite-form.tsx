import { ArrowRight, BriefcaseBusiness, RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { WaterfallSelect } from "@/components/waterfall-select";
import { CAREER_OPTIONS, type CareerId } from "@/contracts/career";
import { targetLocaleLabel, type TargetLocale } from "@/contracts/locale";
import { MAX_INPUT_LENGTH } from "@/contracts/rewrite";
import { TONE_OPTIONS, type ToneId } from "@/contracts/tone";

type RewriteFormProps = {
  text: string;
  onTextChange: (text: string) => void;
  career: CareerId;
  onCareerChange: (career: CareerId) => void;
  tone: ToneId;
  onToneChange: (tone: ToneId) => void;
  locale: TargetLocale;
  isPending: boolean;
  onSubmit: () => void;
};

export function RewriteForm({
  text,
  onTextChange,
  career,
  onCareerChange,
  tone,
  onToneChange,
  locale,
  isPending,
  onSubmit,
}: RewriteFormProps) {
  const canSubmit = text.trim().length > 0 && !isPending;

  return (
    <form
      className="rounded-lg border border-border bg-secondary p-5 sm:p-6"
      aria-labelledby="input-heading"
      onSubmit={(event) => {
        event.preventDefault();
        if (canSubmit) onSubmit();
      }}
    >
      <div className="mb-4 flex items-center justify-between">
        <h2 id="input-heading" className="text-sm font-semibold">
          Your message
        </h2>
        <span className="text-xs text-muted-foreground">
          {text.length} / {MAX_INPUT_LENGTH.toLocaleString("en-US")}
        </span>
      </div>

      <textarea
        value={text}
        onChange={(event) => onTextChange(event.target.value.slice(0, MAX_INPUT_LENGTH))}
        placeholder="Write what you want to say in English..."
        aria-label="Your message"
        className="min-h-52 w-full resize-none rounded-md border border-input bg-background p-4 text-base leading-7 text-foreground outline-none placeholder:text-muted-foreground focus:border-primary focus:ring-1 focus:ring-primary"
      />

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <div className="space-y-2 text-xs font-medium text-muted-foreground">
          <span className="block">Career</span>
          <WaterfallSelect
            label="Career"
            value={career}
            options={CAREER_OPTIONS}
            onChange={onCareerChange}
            leadingIcon={<BriefcaseBusiness size={16} />}
          />
        </div>
        <div className="space-y-2 text-xs font-medium text-muted-foreground">
          <span className="block">Tone</span>
          <WaterfallSelect
            label="Tone"
            value={tone}
            options={TONE_OPTIONS}
            onChange={onToneChange}
          />
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
        <span>Context</span>
        <span className="rounded-sm bg-accent px-2 py-1 text-accent-foreground">
          {targetLocaleLabel(locale)}
        </span>
      </div>

      <Button size="lg" type="submit" className="mt-6 w-full" disabled={!canSubmit}>
        {isPending ? (
          <>
            <RotateCcw className="animate-spin" size={18} /> Rewriting...
          </>
        ) : (
          <>
            Rewrite professionally <ArrowRight size={18} />
          </>
        )}
      </Button>
    </form>
  );
}
