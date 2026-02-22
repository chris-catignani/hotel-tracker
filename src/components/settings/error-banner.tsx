"use client";

export function ErrorBanner({ error, onDismiss }: { error: string | null; onDismiss: () => void }) {
  if (!error) return null;
  return (
    <div className="rounded-md border border-red-300 bg-red-50 p-4 text-sm text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-200">
      <div className="flex items-start justify-between gap-2">
        <pre className="whitespace-pre-wrap font-mono text-xs flex-1">{error}</pre>
        <button
          onClick={onDismiss}
          className="shrink-0 text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-200"
        >
          &times;
        </button>
      </div>
    </div>
  );
}
