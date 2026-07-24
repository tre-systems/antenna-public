type Props = {
  readonly activeTitle: string;
  readonly open: boolean;
  readonly onToggle: () => void;
};

export function CollectionSwitcherTrigger({ activeTitle, open, onToggle }: Props) {
  return (
    <button
      type="button"
      aria-haspopup="menu"
      aria-expanded={open}
      aria-label={`Switch collection, current collection ${activeTitle}`}
      title={`Switch collection, current collection ${activeTitle}`}
      onClick={onToggle}
      class="antenna-control inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium transition focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
      data-testid="collection-switcher-trigger"
    >
      <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true" class="h-3.5 w-3.5">
        <rect x="2" y="2" width="5" height="5" rx="1" />
        <rect x="9" y="2" width="5" height="5" rx="1" />
        <rect x="2" y="9" width="5" height="5" rx="1" />
        <rect x="9" y="9" width="5" height="5" rx="1" />
      </svg>
      <span class="hidden max-w-[10rem] truncate min-[780px]:inline-block">{activeTitle}</span>
      <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true" class="h-3 w-3 opacity-70">
        <path d="M4 6l4 4 4-4z" />
      </svg>
    </button>
  );
}
