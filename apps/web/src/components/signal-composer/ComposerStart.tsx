import { useState } from 'preact/hooks';
import { ConnectorRequests } from '../ConnectorRequests';

type Props = {
  readonly busy: boolean;
  readonly offline: boolean;
  readonly value: string;
  readonly onBrowseSources: () => void;
  readonly onChange: (value: string) => void;
  readonly onSubmit: (event: Event) => void;
};

export function ComposerStart({
  busy,
  offline,
  value,
  onBrowseSources,
  onChange,
  onSubmit,
}: Props) {
  const [browserFallbackOpen, setBrowserFallbackOpen] = useState(false);

  return (
    <div class="space-y-5" data-testid="track-something-start">
      <section class="rounded-xl border border-emerald-500/25 bg-emerald-500/[0.06] p-4 dark:bg-emerald-400/[0.06]">
        <div class="flex items-center justify-between gap-4">
          <div>
            <p class="text-sm font-semibold text-slate-900 dark:text-white">
              Add it with your agent
            </p>
            <p class="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">
              Ask Codex or another connected agent to add what you need. It will inspect the
              available connectors and show the exact proposal for approval.
            </p>
          </div>
          <a
            href="/settings/tokens"
            class="antenna-control shrink-0 rounded-lg px-3 py-2 text-xs font-semibold"
          >
            Agent access
          </a>
        </div>
      </section>

      <section class="border-t border-slate-900/[0.08] pt-4 dark:border-white/10">
        <button
          type="button"
          aria-expanded={browserFallbackOpen}
          onClick={() => {
            setBrowserFallbackOpen((open) => !open);
          }}
          class="flex w-full items-center justify-between gap-4 text-left"
          data-testid="track-something-browser-fallback"
        >
          <span>
            <span class="block text-sm font-semibold text-slate-900 dark:text-white">
              Use the browser instead
            </span>
            <span class="mt-0.5 block text-xs text-slate-500 dark:text-slate-400">
              Describe a signal or select a reviewed source manually.
            </span>
          </span>
          <span aria-hidden="true" class="text-slate-400 dark:text-slate-500">
            {browserFallbackOpen ? '−' : '+'}
          </span>
        </button>

        {browserFallbackOpen ? (
          <div class="mt-4 space-y-4" data-testid="track-something-browser-fallback-panel">
            <form onSubmit={onSubmit}>
              <label
                for="track-something-request"
                class="text-sm font-semibold text-slate-900 dark:text-white"
              >
                What do you want to track?
              </label>
              <p class="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">
                Antenna matches your request to a reviewed source and shows the details before
                adding anything.
              </p>
              <div class="mt-3 flex flex-col gap-2 sm:flex-row">
                <input
                  id="track-something-request"
                  type="text"
                  value={value}
                  disabled={busy || offline}
                  onInput={(event) => {
                    onChange((event.target as HTMLInputElement).value);
                  }}
                  placeholder="Describe a signal or metric"
                  class="antenna-control h-11 min-w-0 flex-1 rounded-xl px-3.5 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 disabled:opacity-50"
                  data-testid="signal-composer-input"
                />
                <button
                  type="submit"
                  disabled={busy || offline || value.trim().length === 0}
                  class="antenna-primary inline-flex h-11 shrink-0 items-center justify-center rounded-xl px-4 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50"
                  data-testid="signal-composer-submit"
                >
                  {busy ? 'Reviewing…' : 'Review signal'}
                </button>
              </div>
            </form>

            <button
              type="button"
              disabled={busy || offline}
              onClick={onBrowseSources}
              class="antenna-control flex w-full items-center justify-between gap-4 rounded-xl px-4 py-3 text-left transition disabled:opacity-50"
              data-testid="track-something-browse-sources"
            >
              <span>
                <span class="block text-sm font-semibold text-slate-900 dark:text-white">
                  Browse reviewed sources
                </span>
                <span class="mt-0.5 block text-xs text-slate-500 dark:text-slate-400">
                  Choose a connector, then fill in its required details.
                </span>
              </span>
              <span aria-hidden="true" class="text-slate-400 dark:text-slate-500">
                →
              </span>
            </button>

            <ConnectorRequests />
          </div>
        ) : null}
      </section>
    </div>
  );
}
