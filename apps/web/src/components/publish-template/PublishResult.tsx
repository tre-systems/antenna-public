import type { CollectionTemplatePublishRecord } from '../../api';
import { humanSkippedReason } from './copy';

export function PublishResult({ result }: { readonly result: CollectionTemplatePublishRecord }) {
  return (
    <div
      class="mt-4 rounded-lg bg-emerald-50 p-3 text-xs text-emerald-900 ring-1 ring-emerald-200 dark:bg-emerald-400/10 dark:text-emerald-100 dark:ring-emerald-400/20"
      data-testid="publish-template-result"
    >
      <p class="font-medium">
        Published {result.template.signals.length}{' '}
        {result.template.signals.length === 1 ? 'signal' : 'signals'} as {result.template.label}.
      </p>
      {result.skipped_signals.length > 0 ? <SkippedSignals result={result} /> : null}
    </div>
  );
}

function SkippedSignals({ result }: { readonly result: CollectionTemplatePublishRecord }) {
  return (
    <div class="mt-2">
      <p class="text-emerald-800 dark:text-emerald-200">{result.skipped_signals.length} skipped:</p>
      <ul class="mt-1 space-y-1">
        {result.skipped_signals.map((signal) => (
          <li key={signal.id} class="flex items-start gap-2">
            <span class="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />
            <span>
              <span class="font-medium">{signal.title}</span> - {humanSkippedReason(signal.reason)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
