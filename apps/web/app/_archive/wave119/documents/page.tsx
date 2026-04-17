/**
 * Documents Page — Wave 237: Document Intelligence
 *
 * Full-page layout for AI-powered credential document parsing + verification.
 * Dark theme: #080e1a surface, consistent with VitalCV homepage.
 */

import { DocumentParser } from '@/components/documents/DocumentParser';

export const metadata = {
  title: 'Document Intelligence',
  description: 'Drop any credential. Watch AI verify it.',
};

export default function DocumentsPage() {
  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#080e1a',
        color: '#fff',
        fontFamily: "'Google Sans Flex', 'Google Sans', system-ui, sans-serif",
      }}
    >
      {/* ── Page Header ───────────────────────────────────── */}
      <div
        style={{
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          background: 'rgba(255,255,255,0.01)',
        }}
      >
        <div
          style={{
            maxWidth: '800px',
            margin: '0 auto',
            padding: '48px 24px 40px',
          }}
        >
          {/* Badge */}
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '4px 12px',
              borderRadius: '9999px',
              background: 'rgba(16,185,129,0.1)',
              border: '1px solid rgba(16,185,129,0.25)',
              marginBottom: '16px',
            }}
          >
            <span
              style={{
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                background: '#10b981',
                display: 'inline-block',
              }}
              aria-hidden="true"
            />
            <span
              style={{
                fontSize: '12px',
                color: '#10b981',
                fontWeight: 600,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
              }}
            >
              Wave 237
            </span>
          </div>

          <h1
            style={{
              fontSize: 'clamp(28px, 5vw, 44px)',
              fontWeight: 450,
              lineHeight: 1.1,
              letterSpacing: '-0.02em',
              color: '#fff',
              margin: '0 0 12px',
            }}
          >
            Document Intelligence
          </h1>
          <p
            style={{
              fontSize: '17px',
              color: 'rgba(255,255,255,0.5)',
              margin: 0,
              lineHeight: 1.5,
            }}
          >
            Drop any credential. Watch AI verify it.
          </p>
        </div>
      </div>

      {/* ── Main Content ──────────────────────────────────── */}
      <main
        style={{
          maxWidth: '800px',
          margin: '0 auto',
          padding: '40px 24px 80px',
        }}
      >
        <DocumentParser />
      </main>
    </div>
  );
}
