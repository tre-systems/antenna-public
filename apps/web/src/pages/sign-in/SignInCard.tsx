import type { SignInError } from './types';

type Props = {
  readonly error: SignInError | null;
  readonly isSubmitting: boolean;
  readonly onSubmit: () => void;
};

export function SignInCard({ error, isSubmitting, onSubmit }: Props) {
  return (
    <div class="antenna-panel order-first w-full rounded-2xl p-8 lg:order-last">
      <BrandMark />
      <p class="antenna-eyebrow mb-2">Private signal layer</p>
      <h2 class="text-xl font-semibold text-slate-900 dark:text-white">Sign in</h2>
      <p class="mt-1 text-sm text-slate-500 dark:text-slate-400">
        Open your private collection with Google.
      </p>
      {error ? <SignInAlert error={error} /> : null}
      <GoogleButton isSubmitting={isSubmitting} onSubmit={onSubmit} />
      <p class="mt-6 text-xs leading-5 text-slate-400 dark:text-slate-500">
        Self-hosted early release. By continuing, you agree to our{' '}
        <a
          href="/terms/"
          class="underline decoration-slate-300 underline-offset-2 hover:text-slate-600 dark:decoration-white/20 dark:hover:text-slate-300"
        >
          Terms of Service
        </a>{' '}
        and{' '}
        <a
          href="/privacy/"
          class="underline decoration-slate-300 underline-offset-2 hover:text-slate-600 dark:decoration-white/20 dark:hover:text-slate-300"
        >
          Privacy Policy
        </a>
        .
      </p>
    </div>
  );
}

function BrandMark() {
  return (
    <img src="/favicon.svg" alt="" class="mb-6 h-12 w-12 rounded-xl shadow-md" aria-hidden="true" />
  );
}

function SignInAlert({ error }: { readonly error: SignInError }) {
  return (
    <div
      role="alert"
      class="mt-6 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800 ring-1 ring-amber-200 dark:bg-amber-500/10 dark:text-amber-200 dark:ring-amber-400/20"
    >
      {error.kind === 'whitelist'
        ? "That email isn't on the access list. Contact this Antenna instance's operator."
        : "Couldn't sign you in. Try again, or contact this Antenna instance's operator."}
    </div>
  );
}

function GoogleButton({
  isSubmitting,
  onSubmit,
}: {
  readonly isSubmitting: boolean;
  readonly onSubmit: () => void;
}) {
  return (
    <button
      type="button"
      disabled={isSubmitting}
      onClick={onSubmit}
      class="antenna-primary mt-6 flex w-full items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50"
    >
      <GoogleIcon />
      {isSubmitting ? 'Connecting...' : 'Continue with Google'}
    </button>
  );
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" class="h-4 w-4" fill="currentColor">
      <path d="M12 11v2.84h6.49a5.6 5.6 0 0 1-2.43 3.66l-.02.16 3.53 2.74.24.02c2.25-2.08 3.55-5.13 3.55-8.74 0-.6-.05-1.18-.15-1.74H12Z" />
      <path d="M12 22c3.24 0 5.96-1.07 7.94-2.9l-3.78-2.92c-1.02.7-2.4 1.19-4.16 1.19a7.24 7.24 0 0 1-6.82-4.97l-.14.01-3.67 2.84-.05.13A11.99 11.99 0 0 0 12 22Z" />
      <path d="M5.18 13.4A7.27 7.27 0 0 1 4.8 11c0-.84.14-1.65.36-2.41l-.01-.16L1.43 5.55l-.12.06A11.95 11.95 0 0 0 0 11c0 1.94.46 3.77 1.31 5.39l3.87-3Z" />
      <path d="M12 4.43c2.27 0 3.8.98 4.67 1.8l3.41-3.33C18 1.06 15.28 0 12 0 7.39 0 3.4 2.65 1.31 6.49l3.86 3a7.26 7.26 0 0 1 6.83-5.06Z" />
    </svg>
  );
}
