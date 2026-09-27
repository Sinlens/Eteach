import { Check, ChevronDown } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";

import { cn } from "@/lib/utils";

/** An option is an id that travels and a label that renders. */
export type WaterfallOption<T extends string> = { id: T; label: string };

type WaterfallSelectProps<T extends string> = {
  value: T;
  options: readonly WaterfallOption<T>[];
  onChange: (value: T) => void;
  /** Accessible name for the control, e.g. "Career". */
  label: string;
  leadingIcon?: ReactNode;
  className?: string;
};

export function WaterfallSelect<T extends string>({
  value,
  options,
  onChange,
  label,
  leadingIcon,
  className,
}: WaterfallSelectProps<T>) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedLabel = options.find((option) => option.id === value)?.label ?? value;

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`${label}: ${selectedLabel}`}
        onClick={() => setOpen((current) => !current)}
        className="flex h-11 w-full items-center rounded-md border border-input bg-background px-3 text-sm font-medium text-foreground outline-none transition-colors hover:border-primary/60 focus:border-primary"
      >
        {leadingIcon ? (
          <span className="mr-2 shrink-0 text-category-blue">{leadingIcon}</span>
        ) : null}
        <span className="flex-1 truncate text-left">{selectedLabel}</span>
        <ChevronDown
          size={16}
          className={cn(
            "shrink-0 text-muted-foreground transition-transform duration-200",
            open && "rotate-180 text-primary",
          )}
        />
      </button>

      {open && (
        <div
          role="listbox"
          aria-label={label}
          className="waterfall-panel absolute inset-x-0 top-[calc(100%+0.4rem)] z-30 max-h-80 overflow-y-auto rounded-md border border-border bg-background p-1.5 shadow-xl shadow-black/50"
        >
          {options.map((option, index) => {
            const selected = option.id === value;
            return (
              <button
                key={option.id}
                type="button"
                role="option"
                aria-selected={selected}
                style={{ animationDelay: `${index * 45}ms` }}
                onClick={() => {
                  onChange(option.id);
                  setOpen(false);
                }}
                className={cn(
                  "waterfall-card flex w-full items-center justify-between gap-2 rounded-sm px-3 py-2.5 text-left text-sm transition-colors hover:bg-accent",
                  selected ? "font-semibold text-primary" : "text-secondary-foreground",
                )}
              >
                <span>{option.label}</span>
                {selected ? <Check size={14} className="shrink-0" /> : null}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
