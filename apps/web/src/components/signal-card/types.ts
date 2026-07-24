import type { DerivedStatus } from '../../signalStatus';
import type { RenderSignal } from '../../signalFormat';

export type { RenderSignal };

export type SignalCardProps = {
  readonly signal: RenderSignal;
  readonly readOnly?: boolean;
  readonly hideHeader?: boolean;
  // Presentation mode: render only the signature hero (no header, summary,
  // details grid, or footer) so a slide stays glanceable from across a room.
  readonly bodyOnly?: boolean;
};

export type CardStatus = DerivedStatus | 'setup';

export type SourcePosture = {
  readonly label: string;
  readonly title: string;
  readonly tone: string;
  readonly value: 'public' | 'blocked' | 'unknown';
};
