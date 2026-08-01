import { APP_PURPOSE, COMPANY_NAME, PRODUCT_NAME, PRODUCT_TAGLINE } from '../../brand';
import { AppMark } from '../../components/AppMark';

export function SignInIntroduction() {
  return (
    <section aria-label="Antenna introduction" class="min-w-0 lg:col-start-1 lg:row-start-1">
      <PreviewHeading />
    </section>
  );
}

function PreviewHeading() {
  return (
    <div>
      <div class="flex items-start gap-4">
        <AppMark class="h-14 w-14 shrink-0 text-slate-950 dark:text-white" />
        <div class="min-w-0 pt-1">
          <h1 class="text-3xl font-semibold text-slate-950 sm:text-4xl dark:text-white">
            {PRODUCT_NAME}
          </h1>
          <p class="antenna-meta mt-1 text-sm font-medium tracking-[0.12em] text-slate-500 uppercase dark:text-slate-400">
            {COMPANY_NAME}
          </p>
        </div>
      </div>
      <p class="mt-5 max-w-2xl text-xl font-medium text-slate-700 dark:text-slate-200">
        {PRODUCT_TAGLINE}
      </p>
      <p
        class="mt-4 max-w-2xl text-base leading-7 text-slate-600 dark:text-slate-300"
        data-testid="app-purpose"
      >
        {APP_PURPOSE}
      </p>
    </div>
  );
}
