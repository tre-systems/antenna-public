export type SignalComposerProps = {
  readonly open: boolean;
  readonly onConfirmed: (createdSignalIds: readonly string[]) => void;
  readonly onOpenChange: (open: boolean) => void;
  readonly offline?: boolean;
  readonly autoFocus?: boolean;
};

export type SignalComposerView = 'start' | 'sources';
