export default function HomePage() {
  return (
    <main style={{ padding: '4rem 2rem', fontFamily: 'system-ui, sans-serif' }}>
      <h1 style={{ fontSize: '2rem', fontWeight: 600 }}>VitalCV web-v2 sandbox</h1>
      <p style={{ marginTop: '1rem', color: '#555', maxWidth: '36rem', lineHeight: 1.55 }}>
        This is a sandbox Next 15 app inside the VitalCV monorepo. It exists for
        UI exploration outside the main <code>apps/web</code> surface. It
        inherits the truth contract and banned-strings rules from the
        repository <code>CLAUDE.md</code>.
      </p>
      <p style={{ marginTop: '1rem', color: '#888', fontSize: '0.875rem' }}>
        Add features as separate PRs. Do not import this sandbox from production
        surfaces.
      </p>
    </main>
  );
}
