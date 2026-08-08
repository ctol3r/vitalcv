/**
 * EcosystemMap — Wave 8. The VitalCV flywheel rendered as a labeled flow so the moat is
 * legible at a glance: each stage feeds the next, and reuse compounds into network effects.
 *
 * Static SVG with CSS-only hover emphasis (no client JS) so it renders in server components
 * and SSR tests. Every node is a real stage of the platform — nothing decorative-only.
 */

const ACCENT = 'var(--vt-accent, #0A7B7F)';

const STAGES: Array<{ key: string; label: string; note: string }> = [
  { key: 'clinicians', label: 'Clinicians', note: 'Own their career evidence' },
  { key: 'wallet', label: 'Profile', note: 'Home base for credentials' },
  { key: 'trust', label: 'Trust', note: 'Source-backed readiness' },
  { key: 'recognition', label: 'Recognition', note: 'Employer acceptance, reusable' },
  { key: 'matcha', label: 'MATCHA', note: 'Learns preferences + fit' },
  { key: 'matching', label: 'Matching', note: 'Explained recommendations' },
  { key: 'hiring', label: 'Hiring', note: 'Faster time-to-start' },
  { key: 'credentialing', label: 'Credentialing', note: 'Head start, not restart' },
  { key: 'reuse', label: 'Reuse', note: 'Evidence follows the clinician' },
  { key: 'network', label: 'Network effects', note: 'Each loop compounds the moat' },
];

export function EcosystemMap() {
  return (
    <section style={{ marginTop: 56 }}>
      <h2 style={{ margin: 0, fontSize: 24, fontWeight: 600, letterSpacing: '-0.01em' }}>The compounding loop</h2>
      <p style={{ margin: '8px 0 0', fontSize: 15, color: 'var(--vt-text-secondary)', maxWidth: 720, lineHeight: 1.55 }}>
        Reusable, source-backed career evidence is the asset. Every hire it powers makes the next
        one cheaper and faster — and leaves more reusable evidence behind.
      </p>

      <div
        style={{
          marginTop: 20,
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
          gap: 12,
        }}
      >
        {STAGES.map((stage, i) => (
          <div
            key={stage.key}
            className="vcv-eco-node"
            style={{
              position: 'relative',
              background: 'var(--vt-surface, #fff)',
              border: '1px solid var(--vt-border, #E2E8E6)',
              borderRadius: 14,
              padding: '14px 16px',
              transition: 'transform 200ms cubic-bezier(0.2,0.8,0.2,1), border-color 200ms, box-shadow 200ms',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span
                style={{
                  flex: '0 0 auto',
                  width: 22,
                  height: 22,
                  borderRadius: 999,
                  background: `color-mix(in srgb, ${ACCENT} 14%, transparent)`,
                  color: ACCENT,
                  fontSize: 11,
                  fontWeight: 700,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {i + 1}
              </span>
              <span style={{ fontSize: 15, fontWeight: 600 }}>{stage.label}</span>
            </div>
            <p style={{ margin: '8px 0 0', fontSize: 12, lineHeight: 1.45, color: 'var(--vt-text-muted)' }}>{stage.note}</p>
            {i < STAGES.length - 1 ? (
              <span aria-hidden="true" style={{ position: 'absolute', right: -9, top: '50%', transform: 'translateY(-50%)', color: ACCENT, fontSize: 14, fontWeight: 700 }}>
                →
              </span>
            ) : null}
          </div>
        ))}
      </div>

      <style
        dangerouslySetInnerHTML={{
          __html:
            '.vcv-eco-node:hover{transform:translateY(-3px);border-color:' +
            ACCENT +
            ';box-shadow:0 12px 30px rgba(10,123,127,0.12);}',
        }}
      />
    </section>
  );
}
