import { useEffect } from 'preact/hooks';
import { effect } from '@preact/signals';
import { getConnectorRequests } from '../api';
import { connectorRequests, currentPlan } from '../signals/plan';
import { safeExternalUrl } from '../signal-format/display';
import type { SourceBlockerReason } from '@antenna/shared';

const BLOCKER_LABELS: Record<SourceBlockerReason, string> = {
  irrelevant_request: 'Not a source',
  unsupported_source: 'Unsupported source',
  unsupported_symbol: 'Unsupported symbol',
  source_rights_blocked: 'Source review',
  auth_required_source: 'Needs account access',
  private_display_only_source: 'Private only',
  unsafe_generated_extraction: 'Source review',
};

const loadRequests = async () => {
  try {
    connectorRequests.value = await getConnectorRequests();
  } catch {
    // Best-effort; the signal stays hidden if empty.
  }
};

export function ConnectorRequests() {
  useEffect(() => {
    void loadRequests();
    // currentPlan returning to null means a plan was just confirmed/rejected, so
    // a new request row may exist. `primed` skips effect()'s synchronous fire.
    let primed = false;
    return effect(() => {
      const plan = currentPlan.value;
      if (!primed) {
        primed = true;
        return;
      }
      if (plan === null) void loadRequests();
    });
  }, []);

  const requests = connectorRequests.value;
  if (requests.length === 0) return null;

  return (
    <details class="antenna-panel rounded-2xl p-4 text-sm" data-testid="connector-requests">
      <summary class="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-semibold text-slate-900 marker:hidden dark:text-white">
        <span class="flex min-w-0 items-center gap-1.5">
          <svg
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            class="h-3.5 w-3.5 text-slate-400 dark:text-slate-500"
            aria-hidden="true"
          >
            <path d="M5.5 11h5M6.5 13.5h3M8 1.5a4.5 4.5 0 0 0-3 7.85V11h6V9.35A4.5 4.5 0 0 0 8 1.5z" />
          </svg>
          <span>Diagnostics</span>
        </span>
        <span class="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600 dark:bg-white/5 dark:text-slate-300">
          {requests.length} setup {requests.length === 1 ? 'request' : 'requests'}
        </span>
      </summary>
      <p class="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
        Sources waiting on credentials, stable data, or source-rights review.
      </p>
      <ul class="mt-3 space-y-0.5">
        {requests.map((req) => (
          <li
            key={req.id}
            class="-mx-2 rounded-md px-2 py-2 text-sm text-slate-700 transition-colors hover:bg-slate-900/[0.03] dark:text-slate-200 dark:hover:bg-white/5"
          >
            <div class="flex items-center justify-between gap-3">
              <span class="truncate">{req.source_label ?? req.fragment}</span>
              <span class="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600 dark:bg-white/5 dark:text-slate-300">
                ×{req.count}
              </span>
            </div>
            <div class="mt-0.5 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
              {req.blocker_reason ? (
                <span class="rounded-full bg-sky-50 px-1.5 py-0.5 text-sky-700 dark:bg-sky-400/10 dark:text-sky-300">
                  {BLOCKER_LABELS[req.blocker_reason]}
                </span>
              ) : null}
              {req.candidate_template_id ? (
                <span class="truncate">{req.candidate_template_id}</span>
              ) : null}
              {req.rights_status ? (
                <span class="rounded-full bg-amber-50 px-1.5 py-0.5 text-amber-700 dark:bg-amber-400/10 dark:text-amber-300">
                  {req.rights_status}
                </span>
              ) : null}
              {safeExternalUrl(req.source_url) ? (
                <a
                  href={safeExternalUrl(req.source_url) ?? undefined}
                  target="_blank"
                  rel="noreferrer"
                  class="truncate underline-offset-2 hover:text-slate-700 hover:underline dark:hover:text-slate-200"
                >
                  source
                </a>
              ) : null}
            </div>
            {req.setup_hint ? (
              <p class="mt-1 line-clamp-2 text-xs leading-snug text-slate-500 dark:text-slate-400">
                {req.setup_hint}
              </p>
            ) : null}
          </li>
        ))}
      </ul>
    </details>
  );
}
