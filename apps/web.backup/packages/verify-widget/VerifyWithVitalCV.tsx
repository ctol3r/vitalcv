/**
 * Embeddable Verification Widget
 * Task: 1106-frontend-0009
 *
 * Standalone component for embedding VitalCV verification in third-party sites
 * Supports theming props: brand color, border radius, size
 */

'use client';

import { useEffect, useRef, useState } from 'react';
import { createVerifierError, type VerifierErrorCode } from '@/lib/verifier-errors';

export interface VerifyWithVitalCVProps {
  /** API endpoint for verification (defaults to VitalCV production API) */
  apiEndpoint?: string;

  /** Callback when verification succeeds */
  onVerifySuccess?: (credential: any) => void;

  /** Callback when verification fails */
  onVerifyFail?: (errorCode: VerifierErrorCode, errorMessage: string) => void;

  /** Primary brand color (CSS color value) */
  brandColor?: string;

  /** Border radius (CSS value, e.g., "8px", "0.5rem", "none") */
  borderRadius?: string;

  /** Widget size preset */
  size?: 'sm' | 'md' | 'lg';

  /** Custom CSS class name */
  className?: string;

  /** Show QR scanner (if false, only paste input) */
  enableScanner?: boolean;

  /** Custom labels */
  labels?: {
    title?: string;
    scanButton?: string;
    pasteButton?: string;
    verifying?: string;
    success?: string;
    failure?: string;
  };
}

const DEFAULT_LABELS = {
  title: 'Verify Credential',
  scanButton: 'Scan QR Code',
  pasteButton: 'Paste Credential',
  verifying: 'Verifying...',
  success: 'Credential verified successfully',
  failure: 'Verification failed',
};

/**
 * Embeddable verification widget for VitalCV credentials
 *
 * @example
 * ```tsx
 * <VerifyWithVitalCV
 *   brandColor="#6366f1"
 *   borderRadius="12px"
 *   size="md"
 *   onVerifySuccess={(cred) => console.log('Verified:', cred)}
 *   onVerifyFail={(code, msg) => console.error(code, msg)}
 * />
 * ```
 */
export function VerifyWithVitalCV({
  apiEndpoint = 'https://vitalcv.com/api/verifier/presentation',
  onVerifySuccess,
  onVerifyFail,
  brandColor = '#6366f1',
  borderRadius = '0.5rem',
  size = 'md',
  className = '',
  enableScanner = true,
  labels,
}: VerifyWithVitalCVProps) {
  const [mode, setMode] = useState<'idle' | 'scan' | 'paste' | 'verifying' | 'success' | 'error'>('idle');
  const [credentialData, setCredentialData] = useState('');
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const mergedLabels = { ...DEFAULT_LABELS, ...labels };

  // Size mappings
  const sizeClasses = {
    sm: { width: '320px', height: '400px', fontSize: '14px', padding: '16px' },
    md: { width: '400px', height: '500px', fontSize: '16px', padding: '24px' },
    lg: { width: '500px', height: '600px', fontSize: '18px', padding: '32px' },
  };

  const sizeConfig = sizeClasses[size];

  const verify = async (data: string) => {
    setMode('verifying');
    setError(null);

    try {
      const response = await fetch(apiEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ presentation: data }),
      });

      const result = await response.json();

      if (response.ok && result.verified) {
        setResult(result);
        setMode('success');
        onVerifySuccess?.(result);
      } else {
        const errorCode = result.errorCode || 'E_UNKNOWN';
        const errorMessage = result.error || 'Verification failed';
        setError(errorMessage);
        setMode('error');
        onVerifyFail?.(errorCode, errorMessage);
      }
    } catch (err: any) {
      const errorMessage = err.message || 'Network error during verification';
      setError(errorMessage);
      setMode('error');
      onVerifyFail?.('E_NETWORK_ERROR', errorMessage);
    }
  };

  const handlePaste = async () => {
    setMode('paste');
  };

  const handleScan = () => {
    setMode('scan');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (credentialData) {
      verify(credentialData);
    }
  };

  const reset = () => {
    setMode('idle');
    setCredentialData('');
    setResult(null);
    setError(null);
  };

  const styles = `
    .vitalcv-widget {
      --brand-color: ${brandColor};
      --border-radius: ${borderRadius};
      width: ${sizeConfig.width};
      min-height: ${sizeConfig.height};
      font-size: ${sizeConfig.fontSize};
      padding: ${sizeConfig.padding};
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', sans-serif;
      border: 1px solid #e5e7eb;
      border-radius: var(--border-radius);
      background: white;
      box-shadow: 0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1);
    }

    .vitalcv-widget * {
      box-sizing: border-box;
    }

    .vitalcv-button {
      background: var(--brand-color);
      color: white;
      border: none;
      padding: 12px 24px;
      border-radius: calc(var(--border-radius) * 0.75);
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s;
      width: 100%;
      font-size: inherit;
    }

    .vitalcv-button:hover {
      opacity: 0.9;
      transform: translateY(-1px);
    }

    .vitalcv-button:active {
      transform: translateY(0);
    }

    .vitalcv-button-secondary {
      background: #f3f4f6;
      color: #374151;
    }

    .vitalcv-input {
      width: 100%;
      padding: 12px;
      border: 1px solid #d1d5db;
      border-radius: calc(var(--border-radius) * 0.75);
      font-size: inherit;
      font-family: inherit;
    }

    .vitalcv-input:focus {
      outline: 2px solid var(--brand-color);
      outline-offset: 2px;
      border-color: var(--brand-color);
    }

    .vitalcv-title {
      font-size: 1.5em;
      font-weight: 600;
      margin: 0 0 1em 0;
      color: #111827;
    }

    .vitalcv-success {
      background: #d1fae5;
      border: 1px solid #34d399;
      padding: 16px;
      border-radius: calc(var(--border-radius) * 0.75);
      color: #065f46;
    }

    .vitalcv-error {
      background: #fee2e2;
      border: 1px solid #f87171;
      padding: 16px;
      border-radius: calc(var(--border-radius) * 0.75);
      color: #991b1b;
    }

    .vitalcv-stack {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .vitalcv-spinner {
      border: 3px solid #f3f4f6;
      border-top: 3px solid var(--brand-color);
      border-radius: 50%;
      width: 40px;
      height: 40px;
      animation: vitalcv-spin 1s linear infinite;
      margin: 0 auto;
    }

    @keyframes vitalcv-spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
  `;

  return (
    <div className={`vitalcv-widget ${className}`} data-vitalcv-widget>
      <style>{styles}</style>

      <h2 className="vitalcv-title">{mergedLabels.title}</h2>

      {mode === 'idle' && (
        <div className="vitalcv-stack">
          {enableScanner && (
            <button className="vitalcv-button" onClick={handleScan}>
              📷 {mergedLabels.scanButton}
            </button>
          )}
          <button
            className="vitalcv-button vitalcv-button-secondary"
            onClick={handlePaste}
          >
            📋 {mergedLabels.pasteButton}
          </button>
        </div>
      )}

      {mode === 'paste' && (
        <form onSubmit={handleSubmit} className="vitalcv-stack">
          <textarea
            className="vitalcv-input"
            rows={8}
            placeholder="Paste credential JSON or JWT here..."
            value={credentialData}
            onChange={(e) => setCredentialData(e.target.value)}
            autoFocus
          />
          <button
            type="submit"
            className="vitalcv-button"
            disabled={!credentialData}
          >
            Verify
          </button>
          <button
            type="button"
            className="vitalcv-button vitalcv-button-secondary"
            onClick={reset}
          >
            Cancel
          </button>
        </form>
      )}

      {mode === 'scan' && (
        <div className="vitalcv-stack">
          <div style={{ padding: '40px', textAlign: 'center', background: '#f9fafb', borderRadius: 'var(--border-radius)' }}>
            <p>QR Scanner would appear here</p>
            <p style={{ fontSize: '0.875em', color: '#6b7280', marginTop: '8px' }}>
              (Implement using @zxing/library or similar)
            </p>
          </div>
          <button className="vitalcv-button vitalcv-button-secondary" onClick={reset}>
            Cancel
          </button>
        </div>
      )}

      {mode === 'verifying' && (
        <div className="vitalcv-stack" style={{ alignItems: 'center', padding: '40px 0' }}>
          <div className="vitalcv-spinner" />
          <p>{mergedLabels.verifying}</p>
        </div>
      )}

      {mode === 'success' && (
        <div className="vitalcv-stack">
          <div className="vitalcv-success">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '1.5em' }}>✓</span>
              <strong>{mergedLabels.success}</strong>
            </div>
            {result && (
              <div style={{ marginTop: '12px', fontSize: '0.875em' }}>
                <p><strong>Type:</strong> {result.credentialType || 'Unknown'}</p>
                <p><strong>Issuer:</strong> {result.issuer || 'Unknown'}</p>
              </div>
            )}
          </div>
          <button className="vitalcv-button vitalcv-button-secondary" onClick={reset}>
            Verify Another
          </button>
        </div>
      )}

      {mode === 'error' && (
        <div className="vitalcv-stack">
          <div className="vitalcv-error">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '1.5em' }}>✕</span>
              <strong>{mergedLabels.failure}</strong>
            </div>
            {error && (
              <p style={{ marginTop: '8px', fontSize: '0.875em' }}>{error}</p>
            )}
          </div>
          <button className="vitalcv-button" onClick={reset}>
            Try Again
          </button>
        </div>
      )}
    </div>
  );
}

export default VerifyWithVitalCV;

