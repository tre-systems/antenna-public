import type { User } from '../auth';
import { firstName } from '../auth';

type Props = {
  readonly user: User;
  readonly saving: boolean;
  readonly error: string | null;
  readonly onUseStarter: () => void;
  readonly onCreateCollection: () => void;
  readonly onAddSignal: () => void;
};

export function OnboardingShell({
  user,
  saving,
  error,
  onUseStarter,
  onCreateCollection,
  onAddSignal,
}: Props) {
  return (
    <section
      class="rounded-2xl bg-white/75 p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_14px_40px_-24px_rgba(15,23,42,0.28)] ring-1 ring-slate-900/5 backdrop-blur-xl dark:bg-white/[0.04] dark:ring-white/10"
      data-testid="onboarding-shell"
    >
      <div class="max-w-2xl">
        <p class="text-xs font-medium uppercase tracking-[0.14em] text-slate-400 dark:text-slate-500">
          Welcome, {firstName(user)}
        </p>
        <h2 class="mt-2 text-xl font-semibold tracking-tight text-slate-900 dark:text-white">
          Choose how this collection should start
        </h2>
        <p class="mt-2 text-sm text-slate-500 dark:text-slate-400">
          Pick one path now — you can edit, add, remove, or share it later.
        </p>
      </div>

      <div class="mt-5 grid gap-3 md:grid-cols-3">
        <OnboardingChoice
          title="Use starter collection"
          description="Open the seeded morning view and tune it from there."
          cta="Use starter"
          disabled={saving}
          onClick={onUseStarter}
          testId="onboarding-use-starter"
        />
        <OnboardingChoice
          title="Template or blank"
          description="Create a private collection from a reviewed template, or start empty."
          cta="Create collection"
          disabled={saving}
          onClick={onCreateCollection}
          testId="onboarding-create-collection"
        />
        <OnboardingChoice
          title="Add a signal"
          description="Describe the first signal this collection should track."
          cta="Add signal"
          disabled={saving}
          onClick={onAddSignal}
          testId="onboarding-add-signal"
        />
      </div>

      {error ? (
        <p class="mt-4 text-sm text-rose-600 dark:text-rose-300" role="alert">
          {error}
        </p>
      ) : null}
    </section>
  );
}

function OnboardingChoice({
  title,
  description,
  cta,
  disabled,
  onClick,
  testId,
}: {
  readonly title: string;
  readonly description: string;
  readonly cta: string;
  readonly disabled: boolean;
  readonly onClick: () => void;
  readonly testId: string;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      class="group flex min-h-40 flex-col justify-between rounded-xl border border-slate-200 bg-white/70 p-4 text-left transition hover:border-slate-300 hover:bg-white focus:outline-none focus:ring-2 focus:ring-sky-400/40 disabled:cursor-wait disabled:opacity-60 dark:border-white/10 dark:bg-white/[0.04] dark:hover:bg-white/[0.07]"
      data-testid={testId}
    >
      <span>
        <span class="block text-sm font-semibold text-slate-900 dark:text-white">{title}</span>
        <span class="mt-1 block text-sm text-slate-500 dark:text-slate-400">{description}</span>
      </span>
      <span class="mt-5 inline-flex self-start rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-medium text-white transition group-hover:brightness-110 dark:bg-white dark:text-slate-900">
        {disabled ? 'Saving...' : cta}
      </span>
    </button>
  );
}
