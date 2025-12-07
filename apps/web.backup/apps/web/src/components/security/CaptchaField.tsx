/**
 * B143E-FE-006: Client-side CAPTCHA integration (e.g., hCaptcha/ReCAPTCHA stub)
 *
 * Renders placeholder captcha widget; collects token; passes to backend.
 * Tests ensure token appended to form submission.
 */

'use client';

import React, { useRef, useEffect, useState } from 'react';

export interface CaptchaFieldProps {
  /** CAPTCHA site key (from environment) */
  siteKey?: string;
  /** Callback when CAPTCHA token is received */
  onToken: (token: string) => void;
  /** Callback when CAPTCHA expires or errors */
  onError?: (error: string) => void;
  /** Whether CAPTCHA is required */
  required?: boolean;
  /** Whether CAPTCHA is disabled */
  disabled?: boolean;
  /** Additional CSS classes */
  className?: string;
}

/**
 * CAPTCHA Field Component
 *
 * Placeholder implementation for CAPTCHA integration.
 * In production, integrate with hCaptcha, reCAPTCHA v3, or similar service.
 *
 * Example hCaptcha integration:
 * ```tsx
 * useEffect(() => {
 *   const script = document.createElement('script');
 *   script.src = 'https://js.hcaptcha.com/1/api.js';
 *   script.async = true;
 *   script.defer = true;
 *   document.body.appendChild(script);
 *
 *   return () => {
 *     document.body.removeChild(script);
 *   };
 * }, []);
 *
 * const widgetId = useRef<string | null>(null);
 *
 * useEffect(() => {
 *   if (siteKey && !disabled) {
 *     widgetId.current = (window as any).hcaptcha.render(containerRef.current, {
 *       sitekey: siteKey,
 *       callback: (token: string) => {
 *         onToken(token);
 *       },
 *       'error-callback': (error: string) => {
 *         onError?.(error);
 *       },
 *     });
 *   }
 *
 *   return () => {
 *     if (widgetId.current) {
 *       (window as any).hcaptcha.reset(widgetId.current);
 *     }
 *   };
 * }, [siteKey, disabled, onToken, onError]);
 * ```
 */
export function CaptchaField({
  siteKey,
  onToken,
  onError,
  required = false,
  disabled = false,
  className = '',
}: CaptchaFieldProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Stub implementation: Generate mock token for development
  const generateMockToken = () => {
    setIsLoading(true);

    // Simulate CAPTCHA challenge
    setTimeout(() => {
      const mockToken = `mock_captcha_token_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      setToken(mockToken);
      onToken(mockToken);
      setIsLoading(false);
    }, 1000);
  };

  const handleVerify = () => {
    if (disabled || isLoading) return;

    if (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test') {
      // Development: Use mock token
      generateMockToken();
    } else {
      // Production: Integrate with real CAPTCHA service
      // This is a placeholder - replace with actual CAPTCHA widget
      console.warn('[CaptchaField] CAPTCHA not implemented, using mock token');
      generateMockToken();
    }
  };

  const handleReset = () => {
    setToken(null);
    if (onError) {
      onError('CAPTCHA reset');
    }
  };

  useEffect(() => {
    // Auto-verify in development mode
    if (process.env.NODE_ENV === 'development' && !disabled && !token) {
      // Don't auto-verify - require user interaction
    }
  }, [disabled, token]);

  return (
    <div className={`captcha-field ${className}`}>
      <div
        ref={containerRef}
        className="captcha-container"
        style={{
          minHeight: '78px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          border: '1px solid #d1d5db',
          borderRadius: '6px',
          padding: '12px',
          backgroundColor: '#f9fafb',
        }}
      >
        {disabled ? (
          <span className="text-sm text-gray-500">CAPTCHA disabled</span>
        ) : token ? (
          <div className="flex items-center gap-2">
            <svg
              className="w-5 h-5 text-green-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
            <span className="text-sm text-green-600">Verified</span>
            <button
              type="button"
              onClick={handleReset}
              className="text-xs text-blue-600 hover:underline"
            >
              Reset
            </button>
          </div>
        ) : isLoading ? (
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
            <span className="text-sm text-gray-600">Verifying...</span>
          </div>
        ) : (
          <button
            type="button"
            onClick={handleVerify}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            disabled={isLoading}
          >
            Verify CAPTCHA
          </button>
        )}
      </div>

      {required && !token && !disabled && (
        <p className="mt-1 text-xs text-gray-500">
          Please complete the CAPTCHA verification
        </p>
      )}

      {process.env.NODE_ENV === 'development' && (
        <p className="mt-1 text-xs text-gray-400">
          [DEV] CAPTCHA placeholder - replace with real widget in production
        </p>
      )}
    </div>
  );
}

/**
 * Hook to get CAPTCHA token from form
 */
export function useCaptchaToken() {
  const [token, setToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleToken = (captchaToken: string) => {
    setToken(captchaToken);
    setError(null);
  };

  const handleError = (errorMessage: string) => {
    setError(errorMessage);
    setToken(null);
  };

  const reset = () => {
    setToken(null);
    setError(null);
  };

  return {
    token,
    error,
    onToken: handleToken,
    onError: handleError,
    reset,
    isValid: !!token && !error,
  };
}

export default CaptchaField;

