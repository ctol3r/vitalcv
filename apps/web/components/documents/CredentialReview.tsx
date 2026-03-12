'use client';

/**
 * CredentialReview — Wave 238: Holder Credential Onboarding
 *
 * Shown after a successful document parse. Lets the clinician review extracted
 * fields, correct any errors, and submit the credential for verification.
 *
 * Design: antigravity dark theme (#080e1a), glass card styling.
 */

import React, { useState } from 'react';
import Link from 'next/link';

/* ─── Types ─────────────────────────────────────────────────── */

export interface ExtractedField {
  field: string;
  value: string;
  confidence: number;
}

export interface CredentialReviewProps {
  documentId: string;
  documentType: string;
  fields: ExtractedField[];
  onBack?: () => void;
}

/* ─── Confidence helpers ─────────────────────────────────────── */

function confidenceDot(c: number): string {
  if (c > 0.85) return '#10b981'; // green
  if (c > 0.70) return '#f59e0b'; // yellow
  return '#ef4444';               // red
}

function confidenceLabel(c: number): string {
  if (c > 0.85) return 'High';
  if (c > 0.70) return 'Med';
  return 'Low';
}

/* ─── Component ─────────────────────────────────────────────── */

export function CredentialReview({ documentId, documentType, fields, onBack }: CredentialReviewProps) {
  // editable field values keyed by field name
  const [values, setValues] = useState<Record<string, string>>(
    () => Object.fromEntries(fields.map((f) => [f.field, f.value])),
  );

  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /* ── Submit ─────────────────────────────────────────────── */

  const handleSubmit = async () => {
    setSubmitting(true);
    setError(null);

    try {
      // Step 1: ingest — create the CandidateCredential
      const ingestRes = await fetch('/api/credentials/ingest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ documentId }),
      });

      if (!ingestRes.ok) {
        const err = await ingestRes.json().catch(() => ({})) as { error?: string };
        throw new Error(err.error ?? `Ingest failed (${ingestRes.status})`);
      }

      const { credentialId } = await ingestRes.json() as { credentialId: string; status: string };

      // Step 2: confirm — merge corrections
      const corrections: Record<string, string> = {};
      for (const f of fields) {
        if (values[f.field] !== f.value) {
          corrections[f.field] = values[f.field] ?? f.value;
        }
      }

      const confirmRes = await fetch(`/api/credentials/${credentialId}/confirm`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ corrections }),
      });

      if (!confirmRes.ok) {
        const err = await confirmRes.json().catch(() => ({})) as { error?: string };
        throw new Error(err.error ?? `Confirm failed (${confirmRes.status})`);
      }

      setSuccess(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Submission failed');
    } finally {
      setSubmitting(false);
    }
  };

  /* ── Styles ─────────────────────────────────────────────── */

  const glass: React.CSSProperties = {
    border: '1px solid rgba(255,255,255,0.07)',
    background: 'rgba(255,255,255,0.03)',
    borderRadius: '16px',
    padding: '24px',
    backdropFilter: 'blur(12px)',
  };

  const label: React.CSSProperties = {
    display: 'block',
    fontSize: '11px',
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
    color: 'rgba(255,255,255,0.4)',
    marginBottom: '4px',
  };

  const input: React.CSSProperties = {
    width: '100%',
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '8px',
    padding: '9px 12px',
    color: 'rgba(255,255,255,0.9)',
    fontSize: '13px',
    fontFamily: "'Google Sans Code', 'Fira Code', monospace",
    outline: 'none',
    boxSizing: 'border-box',
    transition: 'border-color 0.15s ease',
  };

  /* ── Success state ──────────────────────────────────────── */

  if (success) {
    return (
      <div
        style={{
          ...glass,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '20px',
          textAlign: 'center',
          padding: '48px 32px',
        }}
      >
        <div
          style={{
            width: '64px',
            height: '64px',
            borderRadius: '50%',
            background: 'rgba(16,185,129,0.12)',
            border: '1px solid rgba(16,185,129,0.3)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '28px',
          }}
        >
          ✓
        </div>
        <div>
          <h2
            style={{
              margin: '0 0 8px',
              fontSize: '18px',
              fontWeight: 700,
              color: '#fff',
            }}
          >
            Credential submitted for verification
          </h2>
          <p
            style={{
              margin: 0,
              fontSize: '14px',
              color: 'rgba(255,255,255,0.5)',
              maxWidth: '340px',
            }}
          >
            Your {documentType.replace(/_/g, ' ')} has been queued for primary-source verification.
            You&apos;ll see the result in your trust passport.
          </p>
        </div>

        <Link
          href="/holder"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: '11px 28px',
            borderRadius: '9999px',
            background: 'linear-gradient(135deg, #10b981, #059669)',
            color: '#fff',
            fontSize: '14px',
            fontWeight: 600,
            textDecoration: 'none',
            boxShadow: '0 0 20px rgba(16,185,129,0.3)',
          }}
        >
          View your Trust Passport →
        </Link>
      </div>
    );
  }

  /* ── Review form ────────────────────────────────────────── */

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
          flexWrap: 'wrap',
        }}
      >
        <div>
          <h2
            style={{
              margin: '0 0 4px',
              fontSize: '16px',
              fontWeight: 700,
              color: '#fff',
            }}
          >
            Review &amp; Confirm
          </h2>
          <p
            style={{
              margin: 0,
              fontSize: '13px',
              color: 'rgba(255,255,255,0.4)',
            }}
          >
            Correct any fields before submitting for verification.
          </p>
        </div>
        {onBack && (
          <button
            onClick={onBack}
            style={{
              padding: '5px 14px',
              borderRadius: '9999px',
              border: '1px solid rgba(255,255,255,0.1)',
              background: 'transparent',
              color: 'rgba(255,255,255,0.4)',
              fontSize: '12px',
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            ← Back
          </button>
        )}
      </div>

      {/* Field editor */}
      <div style={glass}>
        {/* Doc type badge */}
        <div
          style={{
            display: 'inline-block',
            marginBottom: '20px',
            padding: '4px 12px',
            borderRadius: '9999px',
            background: 'rgba(16,185,129,0.1)',
            border: '1px solid rgba(16,185,129,0.25)',
            color: '#10b981',
            fontSize: '12px',
            fontWeight: 600,
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
          }}
        >
          {documentType.replace(/_/g, ' ')}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {fields.map((f) => (
            <div key={f.field}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: '4px',
                }}
              >
                <span style={label}>{f.field}</span>
                {/* Confidence dot */}
                <span
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '5px',
                    fontSize: '11px',
                    color: confidenceDot(f.confidence),
                    fontWeight: 600,
                  }}
                >
                  <span
                    style={{
                      width: '8px',
                      height: '8px',
                      borderRadius: '50%',
                      background: confidenceDot(f.confidence),
                      display: 'inline-block',
                      flexShrink: 0,
                    }}
                    title={`Confidence: ${Math.round(f.confidence * 100)}%`}
                  />
                  {confidenceLabel(f.confidence)} ({Math.round(f.confidence * 100)}%)
                </span>
              </div>
              <input
                type="text"
                value={values[f.field] ?? ''}
                onChange={(e) =>
                  setValues((prev) => ({ ...prev, [f.field]: e.target.value }))
                }
                style={{
                  ...input,
                  borderColor:
                    values[f.field] !== f.value
                      ? 'rgba(245,158,11,0.5)'
                      : 'rgba(255,255,255,0.1)',
                }}
                onFocus={(e) => {
                  (e.target as HTMLInputElement).style.borderColor = 'rgba(16,185,129,0.5)';
                }}
                onBlur={(e) => {
                  (e.target as HTMLInputElement).style.borderColor =
                    values[f.field] !== f.value
                      ? 'rgba(245,158,11,0.5)'
                      : 'rgba(255,255,255,0.1)';
                }}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div
          role="alert"
          style={{
            padding: '12px 16px',
            borderRadius: '10px',
            background: 'rgba(239,68,68,0.08)',
            border: '1px solid rgba(239,68,68,0.2)',
            color: '#f87171',
            fontSize: '13px',
          }}
        >
          {error}
        </div>
      )}

      {/* Confirm button */}
      <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
        <button
          onClick={handleSubmit}
          disabled={submitting}
          style={{
            padding: '12px 30px',
            borderRadius: '9999px',
            border: 'none',
            background: submitting
              ? 'rgba(16,185,129,0.4)'
              : 'linear-gradient(135deg, #10b981, #059669)',
            color: '#fff',
            fontSize: '14px',
            fontWeight: 600,
            cursor: submitting ? 'not-allowed' : 'pointer',
            fontFamily: 'inherit',
            boxShadow: submitting ? 'none' : '0 0 20px rgba(16,185,129,0.3)',
            transition: 'all 0.2s ease',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          {submitting ? (
            <>
              <span
                aria-hidden="true"
                style={{
                  width: '14px',
                  height: '14px',
                  borderRadius: '50%',
                  border: '2px solid rgba(255,255,255,0.3)',
                  borderTopColor: '#fff',
                  display: 'inline-block',
                  animation: 'cr-spin 0.7s linear infinite',
                }}
              />
              Submitting…
            </>
          ) : (
            '✓ Confirm & Submit'
          )}
        </button>

        <p
          style={{
            margin: 0,
            fontSize: '12px',
            color: 'rgba(255,255,255,0.3)',
          }}
        >
          Fields with amber borders have been edited from extracted values.
        </p>
      </div>

      <style>{`@keyframes cr-spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
