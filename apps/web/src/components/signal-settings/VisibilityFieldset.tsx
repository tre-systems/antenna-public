import type { ApiSignal } from '../../api';

const visibilityOptions = ['private', 'shared'] as const;

const visibilityHint: Record<ApiSignal['visibility'], string> = {
  private: '— only on private collections',
  shared: '— visible to anyone with the collection link',
  public: '— legacy public mode',
};

type VisibilityFieldsetProps = {
  readonly signalId: string;
  readonly pendingVisibility: ApiSignal['visibility'];
  readonly shareBlocker: string | null;
  readonly disabled: boolean;
  readonly onChange: (visibility: ApiSignal['visibility']) => void;
};

export function VisibilityFieldset({
  signalId,
  pendingVisibility,
  shareBlocker,
  disabled,
  onChange,
}: VisibilityFieldsetProps) {
  return (
    <fieldset class="block" data-testid="signal-settings-visibility">
      <legend class="text-xs font-medium text-slate-600 dark:text-slate-300">Visibility</legend>
      <div class="mt-1 flex flex-col gap-1.5">
        {visibilityOptions.map((option) => {
          const disabledForPolicy = option === 'shared' && shareBlocker !== null;
          return (
            <VisibilityOption
              key={option}
              signalId={signalId}
              option={option}
              checked={pendingVisibility === option}
              disabled={disabled || disabledForPolicy}
              disabledForPolicy={disabledForPolicy}
              onChange={onChange}
            />
          );
        })}
      </div>
      <p class="mt-1 text-xs text-slate-500 dark:text-slate-400">
        Controls whether this signal appears on the shared collection link.
      </p>
    </fieldset>
  );
}

type VisibilityOptionProps = {
  readonly signalId: string;
  readonly option: ApiSignal['visibility'];
  readonly checked: boolean;
  readonly disabled: boolean;
  readonly disabledForPolicy: boolean;
  readonly onChange: (visibility: ApiSignal['visibility']) => void;
};

function VisibilityOption({
  signalId,
  option,
  checked,
  disabled,
  disabledForPolicy,
  onChange,
}: VisibilityOptionProps) {
  return (
    <label class={`flex items-start gap-2 text-sm ${disabledForPolicy ? 'opacity-60' : ''}`}>
      <input
        type="radio"
        name={`signal-visibility-${signalId}`}
        value={option}
        checked={checked}
        disabled={disabled}
        onChange={() => {
          onChange(option);
        }}
        class="mt-0.5"
        data-testid={`signal-visibility-${option}`}
      />
      <span class="min-w-0">
        <span class="font-medium capitalize text-slate-700 dark:text-slate-200">{option}</span>
        <span class="ml-1 text-xs text-slate-500 dark:text-slate-400">
          {visibilityHint[option]}
        </span>
        {disabledForPolicy ? (
          <p class="mt-0.5 text-xs italic text-amber-700 dark:text-amber-300">
            Can't be shared: source policy blocks public links for this signal.
          </p>
        ) : null}
      </span>
    </label>
  );
}
