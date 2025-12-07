/**
 * OfferComposerViewModel Hook
 * Phase 1: Recruiter offer creation state management
 */

'use client';

import { useState, useCallback, useMemo } from 'react';
import type {
  OfferDraft,
  CredentialRequirement,
  Offer,
} from './types';

export interface UseOfferComposerReturn {
  draft: OfferDraft | null;
  isDirty: boolean;
  isSubmitting: boolean;
  error: string | null;
  updateDraft: (updates: Partial<OfferDraft>) => void;
  addCredentialRequirement: (req: CredentialRequirement) => void;
  removeCredentialRequirement: (index: number) => void;
  resetDraft: () => void;
  createOffer: () => Promise<Offer | null>;
  validateDraft: () => { valid: boolean; errors: string[] };
}

const DEFAULT_DRAFT: Partial<OfferDraft> = {
  expirationHours: 48,
  credentialRequirements: [],
};

export function useOfferComposer(
  recruiterDid: string,
  recruiterId: string
): UseOfferComposerReturn {
  const [draft, setDraft] = useState<OfferDraft | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const updateDraft = useCallback((updates: Partial<OfferDraft>) => {
    setDraft((prev) => {
      const newDraft = prev
        ? { ...prev, ...updates, updatedAt: new Date().toISOString() }
        : {
            ...DEFAULT_DRAFT,
            ...updates,
            recruiterDid,
            recruiterId,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          } as OfferDraft;
      return newDraft;
    });
    setIsDirty(true);
    setError(null);
  }, [recruiterDid, recruiterId]);

  const addCredentialRequirement = useCallback((req: CredentialRequirement) => {
    setDraft((prev) => {
      if (!prev) {
        const newDraft = {
          ...DEFAULT_DRAFT,
          recruiterDid,
          recruiterId,
          credentialRequirements: [req],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        } as OfferDraft;
        return newDraft;
      }
      return {
        ...prev,
        credentialRequirements: [...prev.credentialRequirements, req],
        updatedAt: new Date().toISOString(),
      };
    });
    setIsDirty(true);
  }, [recruiterDid, recruiterId]);

  const removeCredentialRequirement = useCallback((index: number) => {
    setDraft((prev) => {
      if (!prev) return null;
      const newRequirements = prev.credentialRequirements.filter((_, i) => i !== index);
      return {
        ...prev,
        credentialRequirements: newRequirements,
        updatedAt: new Date().toISOString(),
      };
    });
    setIsDirty(true);
  }, []);

  const resetDraft = useCallback(() => {
    setDraft(null);
    setIsDirty(false);
    setError(null);
  }, []);

  const validateDraft = useCallback((): { valid: boolean; errors: string[] } => {
    const errors: string[] = [];

    if (!draft) {
      return { valid: false, errors: ['No draft to validate'] };
    }

    if (!draft.roleId || !draft.roleTitle) {
      errors.push('Role ID and title are required');
    }

    if (!draft.facilityName) {
      errors.push('Facility name is required');
    }

    if (!draft.startDate) {
      errors.push('Start date is required');
    } else {
      const start = new Date(draft.startDate);
      const now = new Date();
      if (start < now) {
        errors.push('Start date must be in the future');
      }
    }

    if (!draft.salary || draft.salary.min <= 0 || draft.salary.max <= 0) {
      errors.push('Valid salary range is required');
    }

    if (draft.salary.min > draft.salary.max) {
      errors.push('Minimum salary cannot exceed maximum salary');
    }

    if (!draft.recruiterDid || !draft.recruiterId) {
      errors.push('Recruiter identity is required');
    }

    return { valid: errors.length === 0, errors };
  }, [draft]);

  const createOffer = useCallback(async (): Promise<Offer | null> => {
    if (!draft) {
      setError('No draft to submit');
      return null;
    }

    const validation = validateDraft();
    if (!validation.valid) {
      setError(validation.errors.join(', '));
      return null;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch('/api/offers/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(draft),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `HTTP ${response.status}`);
      }

      const offer: Offer = await response.json();
      setIsDirty(false);
      return offer;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create offer';
      setError(message);
      return null;
    } finally {
      setIsSubmitting(false);
    }
  }, [draft, validateDraft]);

  return {
    draft,
    isDirty,
    isSubmitting,
    error,
    updateDraft,
    addCredentialRequirement,
    removeCredentialRequirement,
    resetDraft,
    createOffer,
    validateDraft,
  };
}

