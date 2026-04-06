export function SectionDivider({ label }: { label: string }) {
  return (
    <div
      className="flex items-center gap-2 pt-2"
      data-testid={`section-divider-${label.toLowerCase().replace(/\s+/g, "-")}`}
    >
      <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground whitespace-nowrap">
        {label}
      </span>
      <div className="flex-1 h-px bg-border" />
    </div>
  );
}
