import type { ComponentChildren } from 'preact';
import { ThemeToggle } from './ThemeToggle';

type Props = {
  readonly title: string;
  readonly description?: string;
  readonly children: ComponentChildren;
};

// Shared chrome for /settings/* pages. Keeps the visual rhythm consistent
// with the owner collection header and gives future settings pages (account,
// notifications, danger zone) the same shape.
export function SettingsShell({ title, description, children }: Props) {
  return (
    <main class="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
      <header class="mb-6 flex items-start justify-between gap-3">
        <div class="min-w-0">
          <p class="antenna-eyebrow">Settings</p>
          <h1 class="mt-0.5 text-2xl font-semibold tracking-tight text-slate-900 dark:text-white">
            {title}
          </h1>
          {description ? (
            <p class="mt-1 text-sm text-slate-500 dark:text-slate-400">{description}</p>
          ) : null}
        </div>
        <div class="flex shrink-0 items-center gap-2 sm:gap-3">
          <a
            href="/"
            class="antenna-control rounded-lg px-3 py-1.5 text-xs font-medium transition focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
            data-testid="settings-back-to-collection"
          >
            ← Collection
          </a>
          <ThemeToggle />
        </div>
      </header>
      {children}
    </main>
  );
}
