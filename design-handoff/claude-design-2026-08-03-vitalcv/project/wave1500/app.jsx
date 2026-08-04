// Wave 1500 · shell
const App = () => (
  <div style={{ maxWidth: 'var(--container-max)', margin: '0 auto', padding: '0 32px 96px' }}>
    <header style={{ padding: '40px 0 24px', borderBottom: '2px solid var(--vt-rule-strong)' }}>
      <div className="vt-eyebrow" style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
        <span>VitalCV · Wave 1500 · Foundation + Proof</span>
        <span style={{ flex: 1, height: 1, background: 'var(--vt-rule)' }}></span>
        <span className="vt-num">2026-07-11</span>
      </div>
      <h1 style={{ fontSize: 'var(--text-2xl)', lineHeight: 1.1, maxWidth: '30ch' }}>
        One design system: paper, ink, and <span className="vt-accent-i">one honest accent.</span>
      </h1>
      <p style={{ margin: '12px 0 0', fontSize: 13.5, color: 'var(--vt-text-secondary)', maxWidth: '72ch', lineHeight: 1.65 }}>
        Locks DG-1.1–1.3, 2.1, 3.2, 4.2, 6.1–6.6 — proven on the homepage hero (DG-7.1–7.4).
        Token files <code style={{ fontFamily: 'var(--font-mono)', fontSize: 11.5 }}>01-primitives / 02-semantic / 03-themes</code> are
        drop-in replacements for the five conflicting layers.
      </p>
    </header>
    <ViewFoundation />
    <ViewGallery />
    <ViewHero />
  </div>
);

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
