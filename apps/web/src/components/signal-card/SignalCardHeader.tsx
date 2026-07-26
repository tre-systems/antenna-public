import { signalSourceLabel, signalSourceUrl, signalTitle } from '../../signalFormat';
import { relativeTime } from '../../relativeTime';
import { sourcePosture } from './source-posture';
import { SignalActions } from './SignalActions';
import type { ApiSignal } from '../../api';
import type { CardStatus, RenderSignal, SourcePosture } from './types';

type Props = {
  readonly signal: RenderSignal;
  readonly cardStatus: CardStatus;
  readonly editableSignal: ApiSignal | null;
  readonly readOnly: boolean;
  readonly compact: boolean;
  readonly compactable: boolean;
  readonly expanded: boolean;
  readonly onToggleExpanded: () => void;
};

export function SignalCardHeader({
  signal,
  cardStatus,
  editableSignal,
  readOnly,
  compact,
  compactable,
  expanded,
  onToggleExpanded,
}: Props) {
  const sourceUrl = signalSourceUrl(signal);
  const posture = editableSignal ? sourcePosture(editableSignal) : null;

  return (
    <header
      class={
        compactable
          ? 'flex cursor-pointer items-start justify-between gap-3'
          : 'flex items-start justify-between gap-3'
      }
      onClick={(event) => {
        if (!compactable || shouldIgnoreHeaderToggle(event.target)) return;
        event.stopPropagation();
        onToggleExpanded();
      }}
      data-testid="signal-card-header"
    >
      <div class="min-w-0">
        <SignalTitle signal={signal} sourceUrl={sourceUrl} />
        <SignalMeta
          signal={signal}
          posture={readOnly || compact ? null : posture}
          sourceUrl={sourceUrl}
        />
      </div>
      <SignalActions
        cardStatus={cardStatus}
        editableSignal={editableSignal}
        readOnly={readOnly}
        compactable={compactable}
        expanded={expanded}
        onToggleExpanded={onToggleExpanded}
      />
    </header>
  );
}

function SignalTitle({
  signal,
  sourceUrl,
}: {
  readonly signal: RenderSignal;
  readonly sourceUrl: string | null;
}) {
  const title = signalTitle(signal);
  return (
    <h2
      class="line-clamp-2 break-words text-base font-semibold leading-tight tracking-tight text-slate-900 dark:text-white"
      title={title}
    >
      {sourceUrl ? <TitleLink sourceUrl={sourceUrl} title={title} /> : title}
    </h2>
  );
}

function TitleLink({ sourceUrl, title }: { readonly sourceUrl: string; readonly title: string }) {
  return (
    <a
      href={sourceUrl}
      target="_blank"
      rel="noreferrer"
      class="rounded-sm decoration-slate-400/60 underline-offset-2 hover:underline focus:outline-none focus:ring-2 focus:ring-emerald-500/60 dark:decoration-slate-500/60"
    >
      {title}
    </a>
  );
}

function SignalMeta({
  signal,
  posture,
  sourceUrl,
}: {
  readonly signal: RenderSignal;
  readonly posture: SourcePosture | null;
  readonly sourceUrl: string | null;
}) {
  const source = signalSourceLabel(signal);
  return (
    <p class="antenna-meta mt-1 text-[0.68rem] text-slate-500 dark:text-slate-400">
      {sourceUrl ? <SourceLink source={source} sourceUrl={sourceUrl} /> : source}
      <Separator />
      <time class="text-slate-400 dark:text-slate-500">
        {signal.status.last_ok_at !== null ? relativeTime(signal.status.last_ok_at) : 'never'}
      </time>
      {posture ? <PostureMeta posture={posture} /> : null}
    </p>
  );
}

function SourceLink({
  source,
  sourceUrl,
}: {
  readonly source: string;
  readonly sourceUrl: string;
}) {
  return (
    <a
      href={sourceUrl}
      target="_blank"
      rel="noreferrer"
      class="rounded-sm underline-offset-2 hover:text-slate-700 hover:underline focus:outline-none focus:ring-2 focus:ring-emerald-500/60 dark:hover:text-slate-200"
    >
      {source}
    </a>
  );
}

function PostureMeta({ posture }: { readonly posture: SourcePosture }) {
  return (
    <>
      <Separator />
      <span
        class={`inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium ring-1 ring-inset ${posture.tone}`}
        data-testid="source-posture-badge"
        data-source-posture={posture.value}
        title={posture.title}
      >
        {posture.label}
      </span>
    </>
  );
}

function shouldIgnoreHeaderToggle(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  return Boolean(
    target.closest('a, button, input, select, textarea, [role="button"], [role="menu"]'),
  );
}

function Separator() {
  return (
    <span class="mx-1 text-slate-300 dark:text-slate-600" aria-hidden="true">
      ·
    </span>
  );
}
