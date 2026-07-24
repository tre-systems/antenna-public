import type { ApiSignal } from '../../api';
import { friendlyError, setupCopy, strippedError } from './status';
import type { CardStatus, RenderSignal } from './types';

type Props = {
  readonly signal: RenderSignal;
  readonly cardStatus: CardStatus;
  readonly editableSignal: ApiSignal | null;
  readonly source: string;
};

export function SignalCardFooter({ signal, cardStatus, editableSignal, source }: Props) {
  const lastError = signal.status.last_error;
  if (cardStatus === 'setup' && lastError) {
    return editableSignal === null ? (
      <PublicUnavailableFooter />
    ) : (
      <SetupFooter lastError={lastError} source={source} />
    );
  }
  if (cardStatus === 'error' && lastError) {
    return editableSignal === null ? (
      <PublicUnavailableFooter />
    ) : (
      <ErrorFooter lastError={lastError} />
    );
  }
  return null;
}

function PublicUnavailableFooter() {
  return (
    <p class="mt-4 border-t border-rose-200/60 pt-3 text-xs italic text-rose-600 dark:border-rose-400/20 dark:text-rose-300">
      This signal is temporarily unavailable.
    </p>
  );
}

function ErrorFooter({ lastError }: { readonly lastError: string }) {
  return (
    <p
      class="mt-4 border-t border-rose-200/60 pt-3 text-xs italic text-rose-600 dark:border-rose-400/20 dark:text-rose-300"
      title={lastError}
    >
      {friendlyError(lastError)}
    </p>
  );
}

function SetupFooter({
  lastError,
  source,
}: {
  readonly lastError: string;
  readonly source: string;
}) {
  const copy = setupCopy(lastError, source);
  return (
    <p
      class="mt-4 border-t border-amber-200/60 pt-3 text-xs not-italic text-amber-700 dark:border-amber-400/20 dark:text-amber-300"
      title={strippedError(lastError)}
    >
      <span class="font-medium">{copy.title}</span> <span class="italic">{copy.detail}</span>
    </p>
  );
}
