/**
 * Documents Page — holder upload surface
 *
 * Full-page layout for CV and credential upload.
 */

import React from 'react';
import Link from 'next/link';
import { DocumentParser } from '@/components/documents/DocumentParser';

export const metadata = {
  title: 'Upload CV or Credential Evidence',
  description: 'Attach a CV or credential document to your clinician record and carry it into passport, readiness, employer shares, and applications.',
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
              Holder upload
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
            Upload CV or credential evidence
          </h1>
          <p
            style={{
              fontSize: '17px',
              color: 'rgba(255,255,255,0.5)',
              margin: 0,
              lineHeight: 1.5,
            }}
          >
            Add a CV, license, board certificate, or verification letter to the same clinician record VitalCV uses for your passport, readiness, employer shares, and applications.
          </p>
          <div
            style={{
              display: 'grid',
              gap: '12px',
              gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
              marginTop: '24px',
            }}
          >
            <div
              style={{
                borderRadius: '20px',
                border: '1px solid rgba(255,255,255,0.08)',
                background: 'rgba(255,255,255,0.03)',
                padding: '16px',
              }}
            >
              <p style={{ margin: 0, fontSize: '14px', fontWeight: 600, color: '#fff' }}>Stored on your profile</p>
              <p style={{ margin: '8px 0 0', fontSize: '13px', lineHeight: 1.5, color: 'rgba(255,255,255,0.55)' }}>
                The file attaches to your clinician record right away.
              </p>
            </div>
            <div
              style={{
                borderRadius: '20px',
                border: '1px solid rgba(255,255,255,0.08)',
                background: 'rgba(255,255,255,0.03)',
                padding: '16px',
              }}
            >
              <p style={{ margin: 0, fontSize: '14px', fontWeight: 600, color: '#fff' }}>Parsed into state</p>
              <p style={{ margin: '8px 0 0', fontSize: '13px', lineHeight: 1.5, color: 'rgba(255,255,255,0.55)' }}>
                VitalCV shows whether it is stored, parsed, source-checked, or still missing detail.
              </p>
            </div>
            <div
              style={{
                borderRadius: '20px',
                border: '1px solid rgba(255,255,255,0.08)',
                background: 'rgba(255,255,255,0.03)',
                padding: '16px',
              }}
            >
              <p style={{ margin: 0, fontSize: '14px', fontWeight: 600, color: '#fff' }}>Used everywhere next</p>
              <p style={{ margin: '8px 0 0', fontSize: '13px', lineHeight: 1.5, color: 'rgba(255,255,255,0.55)' }}>
                The updated record flows into readiness, passport, and future applications.
              </p>
            </div>
          </div>
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '12px',
              marginTop: '20px',
            }}
          >
            <Link
              href="/holder"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                minHeight: '44px',
                padding: '0 18px',
                borderRadius: '9999px',
                background: '#fff',
                color: '#080e1a',
                fontSize: '14px',
                fontWeight: 600,
                textDecoration: 'none',
              }}
            >
              Return to passport
            </Link>
            <Link
              href="/holder/readiness"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                minHeight: '44px',
                padding: '0 18px',
                borderRadius: '9999px',
                border: '1px solid rgba(255,255,255,0.14)',
                color: '#fff',
                fontSize: '14px',
                fontWeight: 600,
                textDecoration: 'none',
                background: 'rgba(255,255,255,0.03)',
              }}
            >
              Review readiness
            </Link>
          </div>
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
