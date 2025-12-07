/**
 * OfferIntakeViewModel Hook
 * Phase 3: Clinician offer intake state management
 */

'use client';

import { useState, useCallback, useEffect } from 'react';
import type {
  Offer,
  OfferPreviewData,
  CredentialReadinessCheck,
} from './types';

export interface UseOfferIntakeReturn {
  offer: Offer | null;
  previewData: OfferPreviewData | null;
  isLoading: boolean;
  error: string | null;
  loadOffer: (offerId: string) => Promise<void>;
  refreshPreview: () => Promise<void>;
}

export function useOfferIntake(offerId?: string): UseOfferIntakeReturn {
  const [offer, setOffer] = useState<Offer | null>(null);
  const [previewData, setPreviewData] = useState<OfferPreviewData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadOffer = useCallback(async (id: string) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/offers/${id}/preview`);
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `HTTP ${response.status}`);
      }

      const data: OfferPreviewData = await response.json();
      setOffer(data.offer);
      setPreviewData(data);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load offer';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const refreshPreview = useCallback(async () => {
    if (!offer?.id) return;
    await loadOffer(offer.id);
  }, [offer?.id, loadOffer]);

  useEffect(() => {
    if (offerId) {
      void loadOffer(offerId);
    }
  }, [offerId, loadOffer]);

  return {
    offer,
    previewData,
    isLoading,
    error,
    loadOffer,
    refreshPreview,
  };
}

