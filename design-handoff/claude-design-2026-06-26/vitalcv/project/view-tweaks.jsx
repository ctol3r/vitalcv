// view-tweaks.jsx — Wave 28 Tweaks Panel surface (developer-only, gated)
//
// PRODUCTION GATE:
//   process.env.NODE_ENV !== 'production' renders the panel.
//   In production builds, this surface renders a 404-style placeholder.
//
// In a no-bundler environment (this prototype), `process` may be undefined.
// We treat undefined-or-not-production as "non-prod" (panel visible).

function isNonProductionBuild() {
  const env = (typeof process !== 'undefined' && process && process.env && process.env.NODE_ENV) || 'development';
  return env !== 'production';
}

function ProductionPlaceholder() {
  return (
    <div style={{
      minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'var(--vt-surface-page-v2)', color: 'var(--vt-ink-default-v2)',
    }}>
      <div className="vt-card-v2" style={{ textAlign: 'center', maxWidth: 480 }}>
        <div style={{ font: 'var(--vt-type-display-v2)', color: 'var(--vt-ink-strong-v2)' }}>404</div>
        <div style={{ font: 'var(--vt-type-h4-v2)', color: 'var(--vt-ink-default-v2)', marginTop: '0.5rem' }}>
          Surface not available
        </div>
        <div style={{ font: 'var(--vt-type-small-v2)', color: 'var(--vt-ink-muted-v2)', marginTop: '0.5rem' }}>
          The Tweaks Panel is a developer-only surface. It is not exposed in production builds.
        </div>
      </div>
    </div>
  );
}

function TweaksPanelView() {
  if (!isNonProductionBuild()) return <ProductionPlaceholder />;

  const [tab, setTab] = React.useState('tokens');                 // 'tokens' | 'variants' | 'a11y'
  const [variantPrimitive, setVariantPrimitive] = React.useState('button');
  const [exportOpen, setExportOpen] = React.useState(false);
  const [mode, setMode] = React.useState('light');                 // 'light' | 'dark' | 'print'

  // Apply mode to <html> for live preview.
  React.useEffect(() => {
    const root = document.documentElement;
    root.classList.remove('dark');
    root.removeAttribute('data-print-preview');
    if (mode === 'dark')  root.classList.add('dark');
    if (mode === 'print') root.setAttribute('data-print-preview', 'true');
  }, [mode]);

  return (
    <div className="vt-tweaks-panel-v2"
         data-tweaks-panel
         data-mode={mode}
         style={{
           minHeight: '100vh',
           background: 'var(--vt-surface-page-v2)',
           color: 'var(--vt-ink-default-v2)',
           padding: 'var(--vt-space-6-v2)',
         }}>

      {/* Header */}
      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 'var(--vt-space-3-v2)', marginBottom: 'var(--vt-space-5-v2)' }}>
        <div>
          <div style={{ font: 'var(--vt-type-micro-v2)', color: 'var(--vt-ink-muted-v2)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            Wave 28 · developer surface · non-production only
          </div>
          <h1 style={{ font: 'var(--vt-type-display-v2)', color: 'var(--vt-ink-strong-v2)', marginTop: '0.25rem' }}>
            Tweaks Panel
          </h1>
          <div style={{ font: 'var(--vt-type-small-v2)', color: 'var(--vt-ink-muted-v2)', marginTop: '0.25rem', maxWidth: 720 }}>
            Live token grid, variant explorer across primitives, and accessibility contrast scanner.
            Tokens render from the canonical oklch values declared in <code>tokens-v2.css</code> with
            hex fallbacks for browsers without oklch support.
          </div>
        </div>
        <div style={{ display: 'flex', gap: 'var(--vt-space-2-v2)', alignItems: 'center' }} data-panel-control>
          <ModeToggle mode={mode} onChange={setMode} />
          <button onClick={() => setExportOpen(true)} className="vt-btn-v2 vt-btn-v2--ghost">
            Export tokens…
          </button>
        </div>
      </header>

      {/* Tab nav */}
      <nav role="tablist" data-panel-control
           style={{ display: 'flex', gap: 'var(--vt-space-2-v2)', marginBottom: 'var(--vt-space-5-v2)' }}>
        {[
          { id: 'tokens',   label: 'Tokens grid' },
          { id: 'variants', label: 'Variant explorer' },
          { id: 'a11y',     label: 'A11y scanner' },
        ].map(t => (
          <button
            key={t.id}
            role="tab"
            aria-selected={t.id === tab}
            onClick={() => setTab(t.id)}
            className={`vt-btn-v2 ${t.id === tab ? 'vt-btn-v2--primary' : 'vt-btn-v2--ghost'}`}
          >
            {t.label}
          </button>
        ))}
      </nav>

      {/* Active tab */}
      {tab === 'tokens' && (
        <section>
          <div style={{ font: 'var(--vt-type-small-v2)', color: 'var(--vt-ink-muted-v2)', marginBottom: 'var(--vt-space-4-v2)' }}>
            All values resolved live from <code>:root</code>. Switch modes above to compare light / dark / print outputs.
          </div>
          <TokensGrid />
        </section>
      )}

      {tab === 'variants' && (
        <section>
          <div style={{ font: 'var(--vt-type-small-v2)', color: 'var(--vt-ink-muted-v2)', marginBottom: 'var(--vt-space-4-v2)' }}>
            Pick a primitive to see all variants × states in one grid.
          </div>
          <VariantExplorer
            activePrimitiveId={variantPrimitive}
            onSelect={setVariantPrimitive}
          />
        </section>
      )}

      {tab === 'a11y' && (
        <section>
          <div style={{ font: 'var(--vt-type-small-v2)', color: 'var(--vt-ink-muted-v2)', marginBottom: 'var(--vt-space-4-v2)' }}>
            WCAG 2.x contrast ratios. AA = 4.5:1 (normal text), AAA = 7:1. Click <em>Run scan</em> to compute pairs.
          </div>
          <A11yContrastScanner />
        </section>
      )}

      <TokenExportModal open={exportOpen} onClose={() => setExportOpen(false)} />

      <footer style={{ marginTop: 'var(--vt-space-7-v2)', font: 'var(--vt-type-micro-v2)', color: 'var(--vt-ink-subtle-v2)' }}>
        Tweaks Panel is internal tooling. Production builds replace this view with a 404 placeholder.
      </footer>
    </div>
  );
}

Object.assign(window, { TweaksPanelView, ProductionPlaceholder, isNonProductionBuild });
