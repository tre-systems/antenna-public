type SlideshowChromeProps = {
  readonly eligible: number;
  readonly total: number;
  readonly onClose: () => void;
};

export function SlideshowChrome({ eligible, total, onClose }: SlideshowChromeProps) {
  return (
    <header class="flex items-center justify-between gap-4 px-8 py-4 text-xs uppercase tracking-widest text-slate-400">
      <span>
        Antenna · presenting {eligible} of {total}
      </span>
      <button
        type="button"
        onClick={onClose}
        class="rounded-md px-3 py-1 text-xs font-medium text-slate-300 transition-colors hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-sky-400/40"
        data-testid="slideshow-close"
      >
        Exit (Esc)
      </button>
    </header>
  );
}
