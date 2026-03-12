'use client';

/**
 * ParseAnimation — Wave 237: Document Intelligence
 *
 * Pure CSS scanning animation — no JS animation libraries.
 * Horizontal scan line moves top-to-bottom over document preview.
 * Fields "light up" with staggered fade-in as they're detected.
 */

import React from 'react';

interface ParseAnimationField {
  label: string;
  value: string;
  delay: number; // seconds
}

interface ParseAnimationProps {
  fields?: ParseAnimationField[];
  isScanning?: boolean;
}

const DEFAULT_FIELDS: ParseAnimationField[] = [
  { label: 'License Number', value: 'MD-2024-XXXXX', delay: 0.4 },
  { label: 'Provider Name',  value: 'Detecting…',    delay: 0.8 },
  { label: 'State',          value: 'Detecting…',    delay: 1.2 },
  { label: 'Expiry Date',    value: 'Detecting…',    delay: 1.6 },
  { label: 'Board',          value: 'Detecting…',    delay: 2.0 },
];

export function ParseAnimation({ fields = DEFAULT_FIELDS, isScanning = true }: ParseAnimationProps) {
  return (
    <div
      aria-label="Parsing document"
      style={{
        position: 'relative',
        borderRadius: '12px',
        overflow: 'hidden',
        border: '1px solid rgba(255,255,255,0.06)',
        background: 'rgba(255,255,255,0.03)',
        padding: '24px',
        minHeight: '260px',
      }}
    >
      {/* Scan line */}
      {isScanning && (
        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: '2px',
            background: 'linear-gradient(90deg, transparent, #10b981, transparent)',
            boxShadow: '0 0 12px 2px rgba(16,185,129,0.6)',
            animation: 'parse-scanline 2s cubic-bezier(0.4,0,0.6,1) infinite',
          }}
        />
      )}

      {/* Glow overlay */}
      {isScanning && (
        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background:
              'linear-gradient(180deg, rgba(16,185,129,0.04) 0%, transparent 40%)',
            animation: 'parse-glow 2s cubic-bezier(0.4,0,0.6,1) infinite',
            pointerEvents: 'none',
          }}
        />
      )}

      {/* Header row */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          marginBottom: '16px',
        }}
      >
        {/* Pulsing indicator */}
        <span
          aria-hidden="true"
          style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            background: '#10b981',
            display: 'inline-block',
            animation: isScanning ? 'parse-pulse 1s ease-in-out infinite' : 'none',
            boxShadow: '0 0 6px rgba(16,185,129,0.8)',
          }}
        />
        <span
          style={{
            fontSize: '13px',
            fontWeight: 500,
            color: '#10b981',
            letterSpacing: '0.05em',
            textTransform: 'uppercase',
          }}
        >
          {isScanning ? 'AI Parsing…' : 'Parse Complete'}
        </span>
      </div>

      {/* Detected fields */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {fields.map((field, i) => (
          <div
            key={i}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              animation: `parse-field-in 0.4s ease forwards`,
              animationDelay: `${field.delay}s`,
              opacity: 0,
              padding: '8px 12px',
              borderRadius: '8px',
              background: 'rgba(16,185,129,0.06)',
              border: '1px solid rgba(16,185,129,0.15)',
            }}
          >
            <span
              style={{
                fontSize: '12px',
                color: 'rgba(255,255,255,0.5)',
                fontWeight: 500,
                letterSpacing: '0.03em',
                textTransform: 'uppercase',
              }}
            >
              {field.label}
            </span>
            <span
              style={{
                fontSize: '13px',
                color: 'rgba(255,255,255,0.85)',
                fontFamily: "'Google Sans Code', monospace",
                fontWeight: 400,
              }}
            >
              {field.value}
            </span>
          </div>
        ))}
      </div>

      {/* Keyframes injected via style tag */}
      <style>{`
        @keyframes parse-scanline {
          0%   { transform: translateY(0); opacity: 1; }
          90%  { transform: translateY(260px); opacity: 1; }
          100% { transform: translateY(260px); opacity: 0; }
        }
        @keyframes parse-glow {
          0%   { transform: translateY(0); }
          100% { transform: translateY(260px); }
        }
        @keyframes parse-pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50%       { opacity: 0.5; transform: scale(1.4); }
        }
        @keyframes parse-field-in {
          from { opacity: 0; transform: translateX(-8px); }
          to   { opacity: 1; transform: translateX(0); }
        }
      `}</style>
    </div>
  );
}
