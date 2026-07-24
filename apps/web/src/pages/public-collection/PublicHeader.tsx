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
      <div class="min-w-0 border-l-2 border-emerald-500 pl-3">
        <p class="antenna-eyebrow mb-1">Shared signal collection</p>
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
          class="antenna-control inline-flex h-8 items-center rounded-lg px-3 text-xs font-medium transition focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
          data-testid="public-cta-sign-in"
        >
          Sign in
        </a>
        <ThemeToggle />
      </div>
    </header>
  );
}
