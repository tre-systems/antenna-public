import { useState } from 'preact/hooks';
import { deriveStatus } from '../signal-status';
import { signalSourceLabel, displayPoints } from '../signal-format';
import { SignalSparkline } from './SignalSparkline';
import { WatchlistAppend } from './WatchlistAppend';
import { ownerSignal } from './signal-card/signal';
import { SignalCardBody } from './signal-card/SignalCardBody';
import { SignalCardDetails } from './signal-card/SignalCardDetails';
import { SignalCardFooter } from './signal-card/SignalCardFooter';
import { SignalCardHeader } from './signal-card/SignalCardHeader';
import { SignalCardSummary } from './signal-card/SignalCardSummary';
import { CARD_CHROME, PRESENTATION_CARD_CHROME } from './signal-card/styles';
import { presentationStatus } from './signal-card/status';
import type { SignalCardProps } from './signal-card/types';

// Presentation mode caps list heroes for across-the-room readability.
const PRESENTATION_MAX_ROWS = 3;

export function SignalCard({
  signal,
  readOnly = false,
  hideHeader = false,
  bodyOnly = false,
}: SignalCardProps) {
  const compactable = !hideHeader;
  const [expanded, setExpanded] = useState(!compactable);
  const editableSignal = ownerSignal(signal);
  const status = deriveStatus(signal);
  const cardStatus = presentationStatus(status, signal.status.last_error);
  const points = displayPoints(signal);
  const source = signalSourceLabel(signal);
  const compact = compactable && !expanded;

  if (bodyOnly) {
    return (
      <article class={PRESENTATION_CARD_CHROME} data-expanded="true">
        <SignalCardBody
          signal={signal}
          cardStatus={cardStatus}
          points={points}
          presentation
          maxRows={PRESENTATION_MAX_ROWS}
        />
        {editableSignal === null ? null : (
          <SignalSparkline signal={editableSignal} variant="presentation" />
        )}
      </article>
    );
  }

  const toggleExpanded = (): void => {
    if (!compactable) return;
    setExpanded((current) => !current);
  };

  return (
    <article
      class={`${CARD_CHROME} ${compact ? 'cursor-pointer' : ''}`}
      onClick={(event) => {
        if (!compact || shouldIgnoreCardToggle(event.target)) return;
        toggleExpanded();
      }}
      data-expanded={expanded ? 'true' : 'false'}
    >
      {hideHeader ? null : (
        <SignalCardHeader
          signal={signal}
          cardStatus={cardStatus}
          editableSignal={editableSignal}
          readOnly={readOnly}
          compact={compact}
          compactable={compactable}
          expanded={expanded}
          onToggleExpanded={toggleExpanded}
        />
      )}

      {compact ? (
        <SignalCardSummary
          signal={signal}
          cardStatus={cardStatus}
          points={points}
          editableSignal={editableSignal}
        />
      ) : null}

      <div class={compact ? 'hidden' : ''}>
        <SignalCardBody signal={signal} cardStatus={cardStatus} points={points} />

        {/* Avoid a duplicate history request while the summary sparkline is mounted. */}
        {compact || editableSignal === null ? null : <SignalSparkline signal={editableSignal} />}

        {readOnly || editableSignal === null ? null : <WatchlistAppend signal={editableSignal} />}

        <SignalCardDetails
          signal={signal}
          cardStatus={cardStatus}
          editableSignal={editableSignal}
          source={source}
        />

        <SignalCardFooter
          signal={signal}
          cardStatus={cardStatus}
          editableSignal={editableSignal}
          source={source}
        />
      </div>
    </article>
  );
}

function shouldIgnoreCardToggle(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  return Boolean(
    target.closest('a, button, input, select, textarea, [role="button"], [role="menu"]'),
  );
}
