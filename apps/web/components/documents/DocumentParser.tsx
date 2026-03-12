'use client';

/**
 * DocumentParser — Wave 237: Document Intelligence UI
 *
 * Drag-and-drop credential document parser with AI extraction,
 * confidence scoring, and source verification.
 *
 * Design: Qomplement-inspired UI on VitalCV antigravity token system.
 */

import React, { useCallback, useRef, useState } from 'react';
import { ParseAnimation } from './ParseAnimation';
import { CredentialReview } from './CredentialReview';

/* ─── Types ─────────────────────────────────────────────────── */

type DocType =
  | 'MEDICAL_LICENSE'
  | 'DEA_CERTIFICATE'
  | 'BOARD_CERTIFICATION'
  | 'NPI_RECORD'
  | 'HOSPITAL_PRIVILEGES'
  | 'UNKNOWN';

interface ExtractedField {
  field: string;
  value: string;
  confidence: number;
}

interface ParseResult {
  documentId: string;
  documentType: DocType;
  fields: ExtractedField[];
  rawText?: string;
}

interface VerifyResult {
  verified: boolean;
  matchedFields: string[];
  unmatchedFields: string[];
  boardRecord?: Record<string, string>;
  message?: string;
}

type Stage = 'idle' | 'uploading' | 'parsing' | 'parsed' | 'verifying' | 'verified' | 'error';

/* ─── Sample Documents ──────────────────────────────────────── */

const SAMPLE_DOCS = [
  { label: 'Medical License',  type: 'MEDICAL_LICENSE'    as DocType },
  { label: 'Board Cert',       type: 'BOARD_CERTIFICATION' as DocType },
  { label: 'DEA Registration', type: 'DEA_CERTIFICATE'     as DocType },
];

const SAMPLE_PARSE_RESULTS: Record<DocType, ParseResult> = {
  MEDICAL_LICENSE: {
    documentId: 'sample-ml-001',
    documentType: 'MEDICAL_LICENSE',
    fields: [
      { field: 'License Number',    value: 'G123456',              confidence: 0.98 },
      { field: 'Provider Name',     value: 'Dr. Jane A. Smith',    confidence: 0.95 },
      { field: 'License State',     value: 'California',           confidence: 0.99 },
      { field: 'License Type',      value: 'Physician & Surgeon',  confidence: 0.92 },
      { field: 'Issue Date',        value: '2018-04-15',           confidence: 0.88 },
      { field: 'Expiry Date',       value: '2026-01-31',           confidence: 0.91 },
      { field: 'Status',            value: 'Active',               confidence: 0.97 },
    ],
  },
  BOARD_CERTIFICATION: {
    documentId: 'sample-bc-001',
    documentType: 'BOARD_CERTIFICATION',
    fields: [
      { field: 'Certificate #',     value: 'ABIM-2019-88421',      confidence: 0.96 },
      { field: 'Specialty',         value: 'Internal Medicine',     confidence: 0.94 },
      { field: 'Certifying Board',  value: 'ABIM',                 confidence: 0.99 },
      { field: 'Provider Name',     value: 'Dr. Jane A. Smith',    confidence: 0.93 },
      { field: 'Certified Since',   value: '2019-10-01',           confidence: 0.87 },
      { field: 'MOC Status',        value: 'Current',              confidence: 0.76 },
      { field: 'Valid Through',     value: '2029-10-01',           confidence: 0.68 },
    ],
  },
  DEA_CERTIFICATE: {
    documentId: 'sample-dea-001',
    documentType: 'DEA_CERTIFICATE',
    fields: [
      { field: 'DEA Number',        value: 'BS1234563',            confidence: 0.99 },
      { field: 'Registrant Name',   value: 'SMITH JANE A',         confidence: 0.94 },
      { field: 'Business Activity', value: 'Practitioner',         confidence: 0.97 },
      { field: 'Schedules',         value: '2, 2N, 3, 3N, 4, 5',  confidence: 0.91 },
      { field: 'Expiry Date',       value: '2025-12-31',           confidence: 0.89 },
      { field: 'State',             value: 'CA',                   confidence: 0.99 },
      { field: 'Payment Method',    value: 'Credit Card',          confidence: 0.61 },
    ],
  },
  NPI_RECORD: {
    documentId: 'sample-npi-001',
    documentType: 'NPI_RECORD',
    fields: [
      { field: 'NPI Number',        value: '1234567890',           confidence: 0.99 },
      { field: 'Provider Name',     value: 'Dr. Jane A. Smith',    confidence: 0.95 },
      { field: 'Taxonomy Code',     value: '207R00000X',           confidence: 0.90 },
    ],
  },
  HOSPITAL_PRIVILEGES: {
    documentId: 'sample-hp-001',
    documentType: 'HOSPITAL_PRIVILEGES',
    fields: [
      { field: 'Institution',       value: 'General Hospital',     confidence: 0.88 },
      { field: 'Department',        value: 'Internal Medicine',    confidence: 0.85 },
    ],
  },
  UNKNOWN: {
    documentId: 'sample-unk-001',
    documentType: 'UNKNOWN',
    fields: [
      { field: 'Raw Text',          value: '(Document parsed)',    confidence: 0.5 },
    ],
  },
};

/* ─── Helpers ───────────────────────────────────────────────── */

function confidenceColor(c: number): string {
  if (c > 0.85) return '#10b981'; // green
  if (c > 0.70) return '#f59e0b'; // yellow
  return '#ef4444'; // red
}

function confidenceBg(c: number): string {
  if (c > 0.85) return 'rgba(16,185,129,0.12)';
  if (c > 0.70) return 'rgba(245,158,11,0.12)';
  return 'rgba(239,68,68,0.12)';
}

function docTypeBadgeColor(t: DocType): { bg: string; text: string; border: string } {
  const map: Record<DocType, { bg: string; text: string; border: string }> = {
    MEDICAL_LICENSE:    { bg: 'rgba(16,185,129,0.12)',  text: '#10b981', border: 'rgba(16,185,129,0.3)' },
    DEA_CERTIFICATE:    { bg: 'rgba(99,102,241,0.12)',  text: '#818cf8', border: 'rgba(99,102,241,0.3)' },
    BOARD_CERTIFICATION:{ bg: 'rgba(14,165,233,0.12)',  text: '#38bdf8', border: 'rgba(14,165,233,0.3)' },
    NPI_RECORD:         { bg: 'rgba(245,158,11,0.12)',  text: '#fbbf24', border: 'rgba(245,158,11,0.3)' },
    HOSPITAL_PRIVILEGES:{ bg: 'rgba(236,72,153,0.12)',  text: '#f472b6', border: 'rgba(236,72,153,0.3)' },
    UNKNOWN:            { bg: 'rgba(255,255,255,0.06)', text: 'rgba(255,255,255,0.4)', border: 'rgba(255,255,255,0.1)' },
  };
  return map[t] ?? map.UNKNOWN;
}

/* ─── Main Component ────────────────────────────────────────── */

export function DocumentParser() {
  const [stage, setStage] = useState<Stage>('idle');
  const [dragOver, setDragOver] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [parseResult, setParseResult] = useState<ParseResult | null>(null);
  const [verifyResult, setVerifyResult] = useState<VerifyResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [showReview, setShowReview] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  /* ── Upload + parse ─────────────────────────────────────── */

  const handleFile = useCallback(async (file: File) => {
    setFileName(file.name);
    setStage('uploading');
    setUploadProgress(0);
    setParseResult(null);
    setVerifyResult(null);
    setErrorMsg(null);

    // Simulate upload progress
    const progressInterval = setInterval(() => {
      setUploadProgress((p) => {
        if (p >= 90) { clearInterval(progressInterval); return 90; }
        return p + Math.random() * 15;
      });
    }, 150);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch('/api/documents/parse', {
        method: 'POST',
        body: formData,
      });

      clearInterval(progressInterval);
      setUploadProgress(100);

      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: 'Upload failed' }));
        throw new Error(err.message ?? `HTTP ${res.status}`);
      }

      const data: ParseResult = await res.json();
      setStage('parsing');

      // Parsing animation plays for 2.5s
      setTimeout(() => {
        setParseResult(data);
        setStage('parsed');
      }, 2500);
    } catch (e) {
      clearInterval(progressInterval);
      setErrorMsg(e instanceof Error ? e.message : 'Unknown error');
      setStage('error');
    }
  }, []);

  /* ── Drag & drop handlers ───────────────────────────────── */

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };
  const onDragLeave = () => setDragOver(false);
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  };
  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  };

  /* ── Sample document ────────────────────────────────────── */

  const loadSample = (type: DocType) => {
    setStage('parsing');
    setFileName(`sample-${type.toLowerCase().replace(/_/g, '-')}.pdf`);
    setParseResult(null);
    setVerifyResult(null);
    setErrorMsg(null);
    setTimeout(() => {
      setParseResult(SAMPLE_PARSE_RESULTS[type] ?? SAMPLE_PARSE_RESULTS.UNKNOWN);
      setStage('parsed');
    }, 2800);
  };

  /* ── Verify ─────────────────────────────────────────────── */

  const handleVerify = async () => {
    if (!parseResult) return;
    setStage('verifying');
    setVerifyResult(null);

    try {
      const res = await fetch('/api/documents/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documentId: parseResult.documentId,
          documentType: parseResult.documentType,
          fields: parseResult.fields,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: 'Verification failed' }));
        throw new Error(err.message ?? `HTTP ${res.status}`);
      }

      const data: VerifyResult = await res.json();
      setVerifyResult(data);
      setStage('verified');
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : 'Verification error');
      setStage('error');
    }
  };

  /* ── Reset ──────────────────────────────────────────────── */

  const reset = () => {
    setStage('idle');
    setParseResult(null);
    setVerifyResult(null);
    setErrorMsg(null);
    setFileName(null);
    setUploadProgress(0);
    setShowReview(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  /* ── Styles (inline for portability) ───────────────────── */

  const card: React.CSSProperties = {
    border: '1px solid rgba(255,255,255,0.06)',
    background: 'rgba(255,255,255,0.03)',
    borderRadius: '16px',
    padding: '24px',
  };

  /* ── Render ─────────────────────────────────────────────── */

  /* ── CredentialReview overlay ───────────────────────────── */

  if (showReview && parseResult) {
    return (
      <CredentialReview
        documentId={parseResult.documentId}
        documentType={parseResult.documentType}
        fields={parseResult.fields}
        onBack={() => setShowReview(false)}
      />
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

      {/* ── Sample Docs Quick-Launch ─────────────────────── */}
      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
        {SAMPLE_DOCS.map((doc) => (
          <button
            key={doc.type}
            onClick={() => loadSample(doc.type)}
            disabled={stage === 'uploading' || stage === 'parsing' || stage === 'verifying'}
            style={{
              padding: '7px 16px',
              borderRadius: '9999px',
              border: '1px solid rgba(255,255,255,0.12)',
              background: 'rgba(255,255,255,0.04)',
              color: 'rgba(255,255,255,0.7)',
              fontSize: '13px',
              fontWeight: 500,
              cursor: 'pointer',
              transition: 'all 0.15s ease',
              fontFamily: 'inherit',
            }}
            onMouseEnter={(e) => {
              (e.target as HTMLButtonElement).style.background = 'rgba(16,185,129,0.1)';
              (e.target as HTMLButtonElement).style.borderColor = 'rgba(16,185,129,0.4)';
              (e.target as HTMLButtonElement).style.color = '#10b981';
            }}
            onMouseLeave={(e) => {
              (e.target as HTMLButtonElement).style.background = 'rgba(255,255,255,0.04)';
              (e.target as HTMLButtonElement).style.borderColor = 'rgba(255,255,255,0.12)';
              (e.target as HTMLButtonElement).style.color = 'rgba(255,255,255,0.7)';
            }}
          >
            ↗ {doc.label}
          </button>
        ))}
      </div>

      {/* ── Drop Zone ───────────────────────────────────── */}
      {(stage === 'idle' || stage === 'error') && (
        <div
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
          onClick={() => fileInputRef.current?.click()}
          role="button"
          tabIndex={0}
          aria-label="Drop zone: upload credential document"
          onKeyDown={(e) => e.key === 'Enter' && fileInputRef.current?.click()}
          style={{
            border: `2px dashed ${dragOver ? '#10b981' : 'rgba(255,255,255,0.15)'}`,
            borderRadius: '16px',
            padding: '48px 32px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '14px',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            background: dragOver ? 'rgba(16,185,129,0.06)' : 'rgba(255,255,255,0.02)',
            textAlign: 'center',
          }}
        >
          {/* Upload icon */}
          <div
            style={{
              width: '56px',
              height: '56px',
              borderRadius: '50%',
              background: 'rgba(16,185,129,0.1)',
              border: '1px solid rgba(16,185,129,0.25)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '24px',
            }}
            aria-hidden="true"
          >
            📄
          </div>

          <div>
            <p
              style={{
                color: 'rgba(255,255,255,0.85)',
                fontWeight: 500,
                fontSize: '16px',
                margin: 0,
              }}
            >
              Drop any credential document
            </p>
            <p
              style={{
                color: 'rgba(255,255,255,0.4)',
                fontSize: '13px',
                marginTop: '4px',
                margin: '4px 0 0',
              }}
            >
              PDF, PNG, JPG, TIFF — medical licenses, board certs, DEA registrations
            </p>
          </div>

          <button
            onClick={(e) => {
              e.stopPropagation();
              fileInputRef.current?.click();
            }}
            style={{
              marginTop: '4px',
              padding: '9px 22px',
              borderRadius: '9999px',
              border: '1px solid rgba(255,255,255,0.2)',
              background: 'transparent',
              color: 'rgba(255,255,255,0.7)',
              fontSize: '14px',
              fontWeight: 500,
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            Browse Files
          </button>

          {stage === 'error' && errorMsg && (
            <p
              role="alert"
              style={{
                color: '#ef4444',
                fontSize: '13px',
                margin: '4px 0 0',
                padding: '8px 16px',
                borderRadius: '8px',
                background: 'rgba(239,68,68,0.1)',
                border: '1px solid rgba(239,68,68,0.2)',
              }}
            >
              {errorMsg}
            </p>
          )}
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.png,.jpg,.jpeg,.tiff,.tif"
        onChange={onFileChange}
        style={{ display: 'none' }}
        aria-hidden="true"
      />

      {/* ── Upload Progress ──────────────────────────────── */}
      {stage === 'uploading' && (
        <div style={card}>
          <p
            style={{
              color: 'rgba(255,255,255,0.7)',
              fontSize: '14px',
              margin: '0 0 12px',
            }}
          >
            Uploading{fileName ? ` ${fileName}` : ''}…
          </p>
          <div
            style={{
              height: '4px',
              borderRadius: '999px',
              background: 'rgba(255,255,255,0.08)',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                height: '100%',
                width: `${uploadProgress}%`,
                borderRadius: '999px',
                background: 'linear-gradient(90deg, #10b981, #34d399)',
                transition: 'width 0.15s ease',
              }}
            />
          </div>
          <p
            style={{
              color: 'rgba(255,255,255,0.35)',
              fontSize: '12px',
              marginTop: '6px',
              margin: '6px 0 0',
              textAlign: 'right',
            }}
          >
            {Math.round(uploadProgress)}%
          </p>
        </div>
      )}

      {/* ── Parsing Animation ────────────────────────────── */}
      {stage === 'parsing' && (
        <ParseAnimation isScanning={true} />
      )}

      {/* ── Parse Results ────────────────────────────────── */}
      {(stage === 'parsed' || stage === 'verifying' || stage === 'verified') && parseResult && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

          {/* Doc type badge + filename */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '10px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              {(() => {
                const c = docTypeBadgeColor(parseResult.documentType);
                return (
                  <span
                    style={{
                      padding: '4px 12px',
                      borderRadius: '9999px',
                      background: c.bg,
                      border: `1px solid ${c.border}`,
                      color: c.text,
                      fontSize: '12px',
                      fontWeight: 600,
                      letterSpacing: '0.06em',
                      textTransform: 'uppercase',
                    }}
                  >
                    {parseResult.documentType.replace(/_/g, ' ')}
                  </span>
                );
              })()}
              {fileName && (
                <span
                  style={{
                    fontSize: '12px',
                    color: 'rgba(255,255,255,0.35)',
                  }}
                >
                  {fileName}
                </span>
              )}
            </div>
            <button
              onClick={reset}
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
              ✕ Clear
            </button>
          </div>

          {/* Extracted fields table */}
          <div style={card}>
            <h3
              style={{
                fontSize: '14px',
                fontWeight: 600,
                color: 'rgba(255,255,255,0.85)',
                margin: '0 0 16px',
                letterSpacing: '0.02em',
              }}
            >
              Extracted Fields
            </h3>

            <div style={{ overflowX: 'auto' }}>
              <table
                style={{
                  width: '100%',
                  borderCollapse: 'collapse',
                  fontSize: '13px',
                }}
              >
                <thead>
                  <tr>
                    {['Field', 'Value', 'Confidence'].map((h) => (
                      <th
                        key={h}
                        style={{
                          textAlign: 'left',
                          padding: '8px 12px',
                          borderBottom: '1px solid rgba(255,255,255,0.07)',
                          color: 'rgba(255,255,255,0.4)',
                          fontSize: '11px',
                          fontWeight: 600,
                          letterSpacing: '0.08em',
                          textTransform: 'uppercase',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {parseResult.fields.map((f, i) => (
                    <tr
                      key={i}
                      style={{
                        borderBottom: '1px solid rgba(255,255,255,0.04)',
                      }}
                    >
                      <td
                        style={{
                          padding: '10px 12px',
                          color: 'rgba(255,255,255,0.6)',
                          fontWeight: 500,
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {f.field}
                      </td>
                      <td
                        style={{
                          padding: '10px 12px',
                          color: 'rgba(255,255,255,0.9)',
                          fontFamily: "'Google Sans Code', monospace",
                        }}
                      >
                        {f.value}
                      </td>
                      <td style={{ padding: '10px 12px', whiteSpace: 'nowrap' }}>
                        <span
                          style={{
                            display: 'inline-block',
                            padding: '2px 10px',
                            borderRadius: '9999px',
                            background: confidenceBg(f.confidence),
                            color: confidenceColor(f.confidence),
                            fontSize: '12px',
                            fontWeight: 600,
                          }}
                        >
                          {(f.confidence * 100).toFixed(0)}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Verify + Save as Credential buttons */}
          {(stage === 'parsed') && (
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
              <button
                onClick={handleVerify}
                style={{
                  padding: '11px 28px',
                  borderRadius: '9999px',
                  border: 'none',
                  background: 'linear-gradient(135deg, #10b981, #059669)',
                  color: '#fff',
                  fontSize: '14px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  boxShadow: '0 0 20px rgba(16,185,129,0.3)',
                  transition: 'all 0.2s ease',
                }}
                onMouseEnter={(e) => {
                  (e.target as HTMLButtonElement).style.boxShadow = '0 0 30px rgba(16,185,129,0.5)';
                  (e.target as HTMLButtonElement).style.transform = 'translateY(-1px)';
                }}
                onMouseLeave={(e) => {
                  (e.target as HTMLButtonElement).style.boxShadow = '0 0 20px rgba(16,185,129,0.3)';
                  (e.target as HTMLButtonElement).style.transform = 'translateY(0)';
                }}
              >
                ✓ Verify Against Source
              </button>

              <button
                onClick={() => setShowReview(true)}
                style={{
                  padding: '11px 28px',
                  borderRadius: '9999px',
                  border: '1px solid rgba(16,185,129,0.35)',
                  background: 'rgba(16,185,129,0.08)',
                  color: '#10b981',
                  fontSize: '14px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  transition: 'all 0.2s ease',
                }}
                onMouseEnter={(e) => {
                  (e.target as HTMLButtonElement).style.background = 'rgba(16,185,129,0.15)';
                }}
                onMouseLeave={(e) => {
                  (e.target as HTMLButtonElement).style.background = 'rgba(16,185,129,0.08)';
                }}
              >
                ⊕ Save as Credential
              </button>
            </div>
          )}

          {/* Verifying spinner */}
          {stage === 'verifying' && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '12px 20px',
                borderRadius: '12px',
                background: 'rgba(16,185,129,0.06)',
                border: '1px solid rgba(16,185,129,0.15)',
              }}
            >
              <div
                aria-hidden="true"
                style={{
                  width: '16px',
                  height: '16px',
                  borderRadius: '50%',
                  border: '2px solid rgba(16,185,129,0.3)',
                  borderTopColor: '#10b981',
                  animation: 'doc-spin 0.8s linear infinite',
                }}
              />
              <span style={{ fontSize: '14px', color: '#10b981' }}>
                Checking against primary source…
              </span>
              <style>{`@keyframes doc-spin { to { transform: rotate(360deg); } }`}</style>
            </div>
          )}
        </div>
      )}

      {/* ── Verification Results ─────────────────────────── */}
      {stage === 'verified' && verifyResult && (
        <div style={card}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              marginBottom: '20px',
            }}
          >
            <span
              style={{
                fontSize: '20px',
                lineHeight: 1,
              }}
              aria-hidden="true"
            >
              {verifyResult.verified ? '✅' : '⚠️'}
            </span>
            <div>
              <h3
                style={{
                  margin: 0,
                  fontSize: '15px',
                  fontWeight: 600,
                  color: verifyResult.verified ? '#10b981' : '#f59e0b',
                }}
              >
                {verifyResult.verified ? 'Verified Against Source' : 'Partial Match — Review Required'}
              </h3>
              {verifyResult.message && (
                <p
                  style={{
                    margin: '2px 0 0',
                    fontSize: '13px',
                    color: 'rgba(255,255,255,0.5)',
                  }}
                >
                  {verifyResult.message}
                </p>
              )}
            </div>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: '12px',
              marginBottom: verifyResult.boardRecord ? '20px' : 0,
            }}
          >
            {/* Matched */}
            {verifyResult.matchedFields.length > 0 && (
              <div>
                <p
                  style={{
                    fontSize: '11px',
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    letterSpacing: '0.08em',
                    color: '#10b981',
                    margin: '0 0 8px',
                  }}
                >
                  Matched ({verifyResult.matchedFields.length})
                </p>
                <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  {verifyResult.matchedFields.map((f) => (
                    <li
                      key={f}
                      style={{
                        fontSize: '13px',
                        color: 'rgba(255,255,255,0.7)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                      }}
                    >
                      <span style={{ color: '#10b981' }}>✓</span> {f}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Unmatched */}
            {verifyResult.unmatchedFields.length > 0 && (
              <div>
                <p
                  style={{
                    fontSize: '11px',
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    letterSpacing: '0.08em',
                    color: '#f59e0b',
                    margin: '0 0 8px',
                  }}
                >
                  Unmatched ({verifyResult.unmatchedFields.length})
                </p>
                <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  {verifyResult.unmatchedFields.map((f) => (
                    <li
                      key={f}
                      style={{
                        fontSize: '13px',
                        color: 'rgba(255,255,255,0.7)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                      }}
                    >
                      <span style={{ color: '#f59e0b' }}>△</span> {f}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Board Record */}
          {verifyResult.boardRecord && Object.keys(verifyResult.boardRecord).length > 0 && (
            <div
              style={{
                borderTop: '1px solid rgba(255,255,255,0.06)',
                paddingTop: '16px',
              }}
            >
              <p
                style={{
                  fontSize: '11px',
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                  color: 'rgba(255,255,255,0.4)',
                  margin: '0 0 10px',
                }}
              >
                Board Record
              </p>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
                  gap: '10px',
                }}
              >
                {Object.entries(verifyResult.boardRecord).map(([k, v]) => (
                  <div key={k}>
                    <p style={{ margin: 0, fontSize: '11px', color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                      {k}
                    </p>
                    <p style={{ margin: '2px 0 0', fontSize: '13px', color: 'rgba(255,255,255,0.8)', fontFamily: "'Google Sans Code', monospace" }}>
                      {v}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
