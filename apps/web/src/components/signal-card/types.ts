import type { DerivedStatus } from '../../signal-status';
import type { RenderSignal } from '../../signal-format';

export type { RenderSignal };

export type SignalCardProps = {
  readonly signal: RenderSignal;
  readonly readOnly?: boolean;
  readonly hideHeader?: boolean;
  // Presentation mode renders only the signature hero for distance readability.
  readonly bodyOnly?: boolean;
};

export type CardStatus = DerivedStatus | 'setup';

export type SourcePosture = {
  readonly label: string;
  readonly title: string;
  readonly tone: string;
  readonly value: 'public' | 'blocked' | 'unknown';
};
