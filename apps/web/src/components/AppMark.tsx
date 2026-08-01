type Props = {
  readonly class?: string;
};

export function AppMark({ class: className = 'h-12 w-12' }: Props) {
  return (
    <svg viewBox="0 0 64 64" role="img" aria-hidden="true" class={className} width={64} height={64}>
      <rect
        x="26.75"
        y="36"
        width="10"
        height="25.75"
        fill="#19c15e"
        transform="rotate(22 32.75 36.875)"
      />
      <path
        d="M32 4.5 9 59.5h46Z"
        fill="none"
        stroke="currentColor"
        stroke-width="3.75"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
      <circle cx="32" cy="36" r="5" fill="currentColor" />
    </svg>
  );
}
