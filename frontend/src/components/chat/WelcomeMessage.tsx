"use client";

interface WelcomeMessageProps {
  welcomeMessage: string;
  suggestions: string[];
  onSuggestionClick: (text: string) => void;
}

/**
 * Welcome message and suggestion buttons shown when chat is empty.
 */
export function WelcomeMessage({
  welcomeMessage,
  suggestions,
  onSuggestionClick,
}: WelcomeMessageProps) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 px-4">
      <p className="text-sm text-muted-foreground text-center">
        {welcomeMessage}
      </p>
      {suggestions.length > 0 && (
        <div className="flex flex-wrap justify-center gap-2">
          {suggestions.map((suggestion, i) => (
            <button
              key={i}
              onClick={() => onSuggestionClick(suggestion)}
              className="rounded-full border border-border bg-muted px-3 py-1.5 text-xs text-foreground transition-colors hover:bg-muted/80"
            >
              {suggestion}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
