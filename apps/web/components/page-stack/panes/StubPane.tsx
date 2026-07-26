'use client';

/**
 * Placeholder pane body for entity types whose real surface lands in a later
 * PR (employer, evidence claim). It renders the entity id honestly and says so
 * — it does not fabricate entity data. The shell can still resolve, stack, and
 * deep-link these panes today; only the body is provisional.
 */

interface StubPaneProps {
  readonly label: string;
  readonly id: string;
}

export function StubPane({ label, id }: StubPaneProps) {
  return (
    <div className="mz-inset" style={{ padding: 16, margin: 12, borderRadius: 12 }}>
      <p style={{ fontWeight: 600, marginBottom: 4 }}>{label}</p>
      <p style={{ opacity: 0.7, fontSize: 14 }}>
        <code>{id}</code>
      </p>
      <p style={{ opacity: 0.6, fontSize: 13, marginTop: 8 }}>
        The full {label.toLowerCase()} surface is wired in a later pass. This pane resolves,
        stacks, and deep-links today.
      </p>
    </div>
  );
}
