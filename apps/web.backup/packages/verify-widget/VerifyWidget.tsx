/**
 * VitalCV Verify Widget
 * Embeddable React component for credential verification
 * Can be used standalone or integrated into any React/Next.js application
 */

'use client';

import { tokens } from '@/styles/tokens';
import { useState } from 'react';

interface VerifyWidgetProps {
  apiKey: string;
  onVerified?: (result: VerificationResult) => void;
  onError?: (error: Error) => void;
  theme?: 'light' | 'dark' | 'auto';
  mode?: 'qr' | 'button' | 'both';
  buttonText?: string;
  className?: string;
}

interface VerificationResult {
  valid: boolean;
  credentialId: string;
  issuer?: string;
  subject?: Record<string, any>;
  timestamp: string;
}

export function VerifyWithVitalCV({
  apiKey,
  onVerified,
  onError,
  theme = 'auto',
  mode = 'both',
  buttonText = 'Verify with VitalCV',
  className = '',
}: VerifyWidgetProps) {
  const [isScanning, setIsScanning] = useState(false);
  const [result, setResult] = useState<VerificationResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleVerify = async (credentialData: string) => {
    try {
      setError(null);
      const response = await fetch('https://api.vitalcv.io/v1/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': apiKey,
        },
        body: JSON.stringify({ credentialData }),
      });

      if (!response.ok) {
        throw new Error('Verification failed');
      }

      const data = await response.json();
      const verificationResult: VerificationResult = {
        valid: data.valid,
        credentialId: data.credentialId,
        issuer: data.issuer,
        subject: data.subject,
        timestamp: new Date().toISOString(),
      };

      setResult(verificationResult);
      if (onVerified) {
        onVerified(verificationResult);
      }
    } catch (err) {
      const errorObj = err instanceof Error ? err : new Error('Verification failed');
      setError(errorObj.message);
      if (onError) {
        onError(errorObj);
      }
    }
  };

  const startQRScan = () => {
    setIsScanning(true);
    // QR scanning logic would go here
  };

  const triggerSignInAndShare = () => {
    // Deep link to VitalCV app
    const deepLink = `vitalcv://share?callback=${encodeURIComponent(window.location.href)}`;
    window.location.href = deepLink;
  };

  return (
    <div className={`vitalcv-widget ${className}`} data-theme={theme}>
      <style>{widgetStyles}</style>

      {!result && !error && (
        <div className="vitalcv-widget__container">
          {(mode === 'qr' || mode === 'both') && !isScanning && (
            <button className="vitalcv-widget__qr-button" onClick={startQRScan}>
              <svg
                className="vitalcv-widget__icon"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z"
                />
              </svg>
              Scan QR Code
            </button>
          )}

          {isScanning && (
            <div className="vitalcv-widget__scanner">
              <div className="vitalcv-widget__scanner-frame"></div>
              <p>Position QR code within frame</p>
              <button className="vitalcv-widget__cancel" onClick={() => setIsScanning(false)}>
                Cancel
              </button>
            </div>
          )}

          {(mode === 'button' || mode === 'both') && !isScanning && (
            <>
              {mode === 'both' && <div className="vitalcv-widget__divider">or</div>}
              <button className="vitalcv-widget__button" onClick={triggerSignInAndShare}>
                <svg
                  className="vitalcv-widget__icon"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                  />
                </svg>
                {buttonText}
              </button>
            </>
          )}

          <div className="vitalcv-widget__footer">
            <a href="https://vitalcv.io" target="_blank" rel="noopener noreferrer">
              Powered by VitalCV
            </a>
          </div>
        </div>
      )}

      {result && (
        <div className="vitalcv-widget__result vitalcv-widget__result--success">
          <svg
            className="vitalcv-widget__result-icon"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <h3>Credential Verified</h3>
          <p>Issued by {result.issuer || 'Trusted Issuer'}</p>
          <button className="vitalcv-widget__reset" onClick={() => setResult(null)}>
            Verify Another
          </button>
        </div>
      )}

      {error && (
        <div className="vitalcv-widget__result vitalcv-widget__result--error">
          <svg
            className="vitalcv-widget__result-icon"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <h3>Verification Failed</h3>
          <p>{error}</p>
          <button className="vitalcv-widget__reset" onClick={() => setError(null)}>
            Try Again
          </button>
        </div>
      )}
    </div>
  );
}

const widgetStyles = `
  .vitalcv-widget {
    font-family: ${tokens.typography.fonts.sans};
    max-width: 400px;
    margin: 0 auto;
  }

  .vitalcv-widget__container {
    display: flex;
    flex-direction: column;
    gap: ${tokens.spacing.md};
    padding: ${tokens.spacing.xl};
    background: var(--vitalcv-bg, #ffffff);
    border: 1px solid var(--vitalcv-border, #e5e7eb);
    border-radius: ${tokens.radius.lg};
    box-shadow: ${tokens.shadows.md};
  }

  .vitalcv-widget[data-theme="dark"] {
    --vitalcv-bg: #1f2937;
    --vitalcv-border: #374151;
    --vitalcv-text: #f9fafb;
    --vitalcv-primary: #3b82f6;
  }

  .vitalcv-widget__button,
  .vitalcv-widget__qr-button {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: ${tokens.spacing.sm};
    padding: ${tokens.spacing.md} ${tokens.spacing.lg};
    background: var(--vitalcv-primary, #2563eb);
    color: white;
    border: none;
    border-radius: ${tokens.radius.md};
    font-size: ${tokens.typography.sizes.base};
    font-weight: ${tokens.typography.weights.medium};
    cursor: pointer;
    transition: all ${tokens.transitions.fast};
  }

  .vitalcv-widget__button:hover,
  .vitalcv-widget__qr-button:hover {
    background: var(--vitalcv-primary-hover, #1d4ed8);
    transform: translateY(-1px);
  }

  .vitalcv-widget__icon {
    width: 20px;
    height: 20px;
  }

  .vitalcv-widget__divider {
    text-align: center;
    color: var(--vitalcv-text-muted, #6b7280);
    font-size: ${tokens.typography.sizes.sm};
    position: relative;
  }

  .vitalcv-widget__divider::before,
  .vitalcv-widget__divider::after {
    content: '';
    position: absolute;
    top: 50%;
    width: 40%;
    height: 1px;
    background: var(--vitalcv-border, #e5e7eb);
  }

  .vitalcv-widget__divider::before {
    left: 0;
  }

  .vitalcv-widget__divider::after {
    right: 0;
  }

  .vitalcv-widget__footer {
    text-align: center;
    font-size: ${tokens.typography.sizes.xs};
    color: var(--vitalcv-text-muted, #6b7280);
  }

  .vitalcv-widget__footer a {
    color: var(--vitalcv-text-muted, #6b7280);
    text-decoration: none;
  }

  .vitalcv-widget__footer a:hover {
    text-decoration: underline;
  }

  .vitalcv-widget__result {
    text-align: center;
    padding: ${tokens.spacing.xl};
    border-radius: ${tokens.radius.lg};
  }

  .vitalcv-widget__result--success {
    background: #ecfdf5;
    color: #065f46;
  }

  .vitalcv-widget__result--error {
    background: #fef2f2;
    color: #991b1b;
  }

  .vitalcv-widget__result-icon {
    width: 64px;
    height: 64px;
    margin: 0 auto ${tokens.spacing.md};
  }

  .vitalcv-widget__result h3 {
    font-size: ${tokens.typography.sizes.xl};
    font-weight: ${tokens.typography.weights.bold};
    margin-bottom: ${tokens.spacing.sm};
  }

  .vitalcv-widget__result p {
    margin-bottom: ${tokens.spacing.lg};
  }

  .vitalcv-widget__reset {
    padding: ${tokens.spacing.sm} ${tokens.spacing.lg};
    background: white;
    border: 1px solid currentColor;
    border-radius: ${tokens.radius.md};
    cursor: pointer;
  }

  .vitalcv-widget__scanner {
    position: relative;
    aspect-ratio: 1;
    background: #000;
    border-radius: ${tokens.radius.md};
    overflow: hidden;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    color: white;
  }

  .vitalcv-widget__scanner-frame {
    width: 200px;
    height: 200px;
    border: 2px solid #3b82f6;
    border-radius: ${tokens.radius.md};
    animation: pulse 2s infinite;
  }

  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.5; }
  }

  .vitalcv-widget__cancel {
    margin-top: ${tokens.spacing.lg};
    padding: ${tokens.spacing.sm} ${tokens.spacing.md};
    background: rgba(255, 255, 255, 0.2);
    color: white;
    border: none;
    border-radius: ${tokens.radius.sm};
    cursor: pointer;
  }
`;

// Export for script loader usage
if (typeof window !== 'undefined') {
  (window as any).VitalCVVerifyWidget = VerifyWithVitalCV;
}
