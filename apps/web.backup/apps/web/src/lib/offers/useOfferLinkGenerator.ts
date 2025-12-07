/**
 * OfferLinkGenerator Hook
 * Phase 2: Generate DPoP-signed URLs for offer delivery
 */

'use client';

import { useState, useCallback } from 'react';
import type { OfferLink } from './types';

export interface UseOfferLinkGeneratorReturn {
  isGenerating: boolean;
  error: string | null;
  generateLink: (offerId: string, method: 'email' | 'qr' | 'in-app') => Promise<OfferLink | null>;
  generateQRCode: (offerId: string) => Promise<string | null>;
}

export function useOfferLinkGenerator(): UseOfferLinkGeneratorReturn {
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generateLink = useCallback(
    async (offerId: string, method: 'email' | 'qr' | 'in-app'): Promise<OfferLink | null> => {
      setIsGenerating(true);
      setError(null);

      try {
        const response = await fetch('/api/offers/generate-link', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ offerId, method }),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.message || `HTTP ${response.status}`);
        }

        const link: OfferLink = await response.json();
        return link;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to generate link';
        setError(message);
        return null;
      } finally {
        setIsGenerating(false);
      }
    },
    []
  );

  const generateQRCode = useCallback(async (offerId: string): Promise<string | null> => {
    setIsGenerating(true);
    setError(null);

    try {
      const link = await generateLink(offerId, 'qr');
      return link?.qrCodeDataUrl || null;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to generate QR code';
      setError(message);
      return null;
    } finally {
      setIsGenerating(false);
    }
  }, [generateLink]);

  return {
    isGenerating,
    error,
    generateLink,
    generateQRCode,
  };
}

