import { Link } from "@tanstack/react-router";
import { Bookmark, MessageSquareText } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type AppHeaderProps = {
  className?: string;
};

/** Shared across the hero and the library page so navigation stays in one place. */
export function AppHeader({ className }: AppHeaderProps) {
  return (
    <header className={cn("pool-header", className)}>
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5 lg:px-8">
        <Link
          to="/"
          className="flex items-center gap-3"
          aria-label="Professional English Coach home"
        >
          <span className="grid size-9 place-items-center rounded-md bg-primary text-primary-foreground">
            <MessageSquareText size={19} strokeWidth={2.25} />
          </span>
          <span className="text-sm font-bold sm:text-base">Professional English Coach</span>
        </Link>
        <Button asChild variant="ghost" size="sm" className="pool-library-button">
          {/* The label is hidden on narrow screens, so the link is named explicitly. */}
          <Link to="/library" aria-label="Phrase library">
            <Bookmark size={16} />
            <span className="hidden sm:inline">Phrase library</span>
          </Link>
        </Button>
      </div>
    </header>
  );
}
