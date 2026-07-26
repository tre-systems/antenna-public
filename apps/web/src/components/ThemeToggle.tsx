import { useEffect } from 'preact/hooks';
import { setTheme, themeChoice, watchSystemTheme, type ThemeChoice } from '../theme';

type Option = {
  readonly value: ThemeChoice;
  readonly label: string;
  readonly icon: (props: { class?: string }) => preact.JSX.Element;
};

const SunIcon = (props: { class?: string }) => (
  <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" class={props.class}>
    <circle cx="10" cy="10" r="3.25" />
    <path
      strokeLinecap="round"
      d="M10 2.5v1.5M10 16v1.5M3.5 10H5M15 10h1.5M5.05 5.05l1.06 1.06M13.89 13.89l1.06 1.06M14.95 5.05l-1.06 1.06M6.11 13.89l-1.06 1.06"
    />
  </svg>
);

const MoonIcon = (props: { class?: string }) => (
  <svg viewBox="0 0 20 20" fill="currentColor" class={props.class}>
    <path d="M14.5 12.6A6 6 0 0 1 7.4 5.5c0-.5.07-1 .2-1.46A6.5 6.5 0 1 0 16 12.4c-.49.13-1 .2-1.5.2Z" />
  </svg>
);

const AutoIcon = (props: { class?: string }) => (
  <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" class={props.class}>
    <circle cx="10" cy="10" r="6.5" />
    <path d="M10 3.5v13" />
    <path d="M10 3.5a6.5 6.5 0 0 1 0 13Z" fill="currentColor" stroke="none" />
  </svg>
);

const OPTIONS: readonly Option[] = [
  { value: 'light', label: 'Light', icon: SunIcon },
  { value: 'system', label: 'System', icon: AutoIcon },
  { value: 'dark', label: 'Dark', icon: MoonIcon },
];

export function ThemeToggle() {
  // Keep the page in sync with OS changes when the user is on 'system'.
  useEffect(() => watchSystemTheme(), []);

  const current = themeChoice.value;

  return (
    <div
      role="radiogroup"
      aria-label="Theme"
      class="antenna-control inline-flex items-center rounded-full p-0.5 text-slate-600 backdrop-blur-md dark:text-slate-300"
    >
      {OPTIONS.map((opt) => {
        const active = current === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={active}
            title={opt.label}
            onClick={() => {
              setTheme(opt.value);
            }}
            class={
              active
                ? 'inline-flex items-center justify-center rounded-full bg-emerald-700 px-2 py-1 text-white shadow-sm transition dark:bg-emerald-300 dark:text-emerald-950'
                : 'inline-flex items-center justify-center rounded-full px-2 py-1 text-slate-500 transition hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
            }
          >
            <opt.icon class="h-4 w-4" />
            <span class="sr-only">{opt.label}</span>
          </button>
        );
      })}
    </div>
  );
}
