export default function DemoPage() {
  return (
    <main style={{ maxWidth: 920, margin: '48px auto', padding: 24 }}>
      <h1 style={{ fontSize: 36, marginBottom: 12 }}>VitalCV Demo</h1>
      <p style={{ fontSize: 18, marginBottom: 20 }}>
        This demo reflects the frozen MVP trust path: Recognition → Acceptance → Start.
      </p>
      <ul style={{ fontSize: 16, lineHeight: 1.6, marginBottom: 28 }}>
        <li>Trust-state is the only decision surface.</li>
        <li>CRS and PSV validity gate start readiness.</li>
        <li>Audit events replay the full chain deterministically.</li>
      </ul>
      <a
        href="/verifier"
        style={{
          display: 'inline-block',
          padding: '12px 20px',
          borderRadius: 8,
          background: '#111',
          color: '#fff',
          textDecoration: 'none',
          fontWeight: 600,
        }}
      >
        Open Verifier View
      </a>
    </main>
  );
}
