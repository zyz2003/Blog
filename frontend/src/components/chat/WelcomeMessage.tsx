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
      <p className="text-sm text-neutral-600 dark:text-neutral-400 text-center">
        {welcomeMessage}
      </p>
      {suggestions.length > 0 && (
        <div className="flex flex-wrap justify-center gap-2">
          {suggestions.map((suggestion, i) => (
            <button
              key={i}
              onClick={() => onSuggestionClick(suggestion)}
              className="rounded-full border border-neutral-200 bg-neutral-50 px-3 py-1.5 text-xs text-neutral-700 transition-colors hover:bg-neutral-100 hover:border-neutral-300 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-700 dark:hover:border-neutral-600"
            >
              {suggestion}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
