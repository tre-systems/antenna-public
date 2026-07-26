import { InlineEditableText } from './InlineEditableText';
import { PRODUCT_NAME, SHORT_PRODUCT_NAME } from '../brand';

type Props = {
  readonly title: string;
  readonly onSaveTitle: (next: string) => Promise<void>;
};

const TITLE_MAX = 80;

export function CollectionHeader({ title, onSaveTitle }: Props) {
  return (
    <div class="min-w-0 flex-1">
      <InlineEditableText
        value={title}
        placeholder={title}
        maxLength={TITLE_MAX}
        ariaLabel="Collection title"
        onSave={onSaveTitle}
        displayClass="-mx-1 block max-w-full overflow-hidden rounded-md px-1 text-left text-xl font-semibold tracking-tight text-slate-900 transition-colors hover:bg-slate-900/[0.04] focus:outline-none focus:ring-2 focus:ring-emerald-500/40 sm:text-2xl dark:text-white dark:hover:bg-white/5"
        inputClass="w-full max-w-md rounded-md border border-emerald-700/20 bg-white/90 px-2 py-1 text-xl font-semibold tracking-tight text-slate-900 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 disabled:opacity-60 sm:text-2xl dark:border-emerald-300/20 dark:bg-white/[0.06] dark:text-white"
        testidPrefix="collection-title"
        renderDisplay={(text) => <CollectionTitle text={text} />}
      />
    </div>
  );
}

function CollectionTitle({ text }: { readonly text: string }) {
  const title = text.trim();
  if (title !== PRODUCT_NAME && title !== SHORT_PRODUCT_NAME) {
    return <h1 class="min-w-0 truncate">{text}</h1>;
  }

  return (
    <h1 class="flex min-w-0 max-w-full items-center gap-2.5 overflow-hidden">
      <img
        src="/favicon.svg"
        alt=""
        class="h-8 w-8 shrink-0 rounded-lg shadow-sm sm:h-9 sm:w-9 sm:rounded-xl"
      />
      <span class="block min-w-0 truncate text-slate-950 dark:text-white">{PRODUCT_NAME}</span>
    </h1>
  );
}
