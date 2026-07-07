const STATE_CLASSES: Record<string, string> = {
  OPEN: "bg-accent-100 text-accent-700 dark:bg-accent-500/15 dark:text-accent-100",
  MERGED: "bg-primary-100 text-primary-700 dark:bg-primary-500/15 dark:text-primary-100",
  CLOSED: "bg-stone-200 text-stone-600 dark:bg-stone-800 dark:text-stone-300",
};

export function PrStateBadge({ state }: { state: string }) {
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${STATE_CLASSES[state] ?? ""}`}>
      {state}
    </span>
  );
}
