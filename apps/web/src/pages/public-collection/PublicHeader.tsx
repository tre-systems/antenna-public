import { ThemeToggle } from '../../components/ThemeToggle';
import { PRODUCT_NAME } from '../../brand';
import type { ShareableCollectionResponse } from './types';

type Props = {
  readonly title: string;
  readonly collection?: ShareableCollectionResponse['collection'];
};

export function PublicHeader({ collection, title }: Props) {
  return (
    <header class="mb-8 flex items-center justify-between gap-3">
      <div class="min-w-0">
        <h1 class="text-2xl font-semibold tracking-tight text-slate-900 dark:text-white">
          {title}
        </h1>
        <p class="hidden text-sm text-slate-500 sm:block dark:text-slate-400">
          Shared collection on {PRODUCT_NAME}
          {collection?.visibility === 'public' ? ' · public link' : ''}.
        </p>
      </div>
      <div class="flex shrink-0 items-center gap-2 sm:gap-3">
        <a
          href="/"
          class="inline-flex h-8 items-center rounded-lg bg-white/50 px-3 text-xs font-medium text-slate-600 ring-1 ring-slate-900/10 transition hover:bg-white/80 hover:text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-400/40 dark:bg-white/5 dark:text-slate-200 dark:ring-white/10 dark:hover:bg-white/10 dark:hover:text-white"
          data-testid="public-cta-sign-in"
        >
          Sign in
        </a>
        <ThemeToggle />
      </div>
    </header>
  );
}
