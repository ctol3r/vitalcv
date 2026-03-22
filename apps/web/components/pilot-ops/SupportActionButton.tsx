'use client';

import { openPilotReporter, trackPilotEvent, type PilotSeverity } from '@/lib/pilot-ops/client';

export function SupportActionButton({
  label = 'Contact support',
  title,
  messagePrefill,
  severity = 'high',
  className,
}: {
  label?: string;
  title?: string;
  messagePrefill?: string;
  severity?: PilotSeverity;
  className?: string;
}) {
  async function handleClick() {
    await trackPilotEvent({
      eventType: 'support_triggered',
      severity,
      message: title ?? label,
      dedupeKey: `support:${title ?? label}`,
      oncePerSession: false,
    });

    openPilotReporter({
      kind: 'support',
      type: 'bug',
      title: title ?? label,
      messagePrefill,
      severity,
      details: {
        source: 'support-action-button',
      },
    });
  }

  return (
    <button type="button" onClick={() => void handleClick()} className={className}>
      {label}
    </button>
  );
}
