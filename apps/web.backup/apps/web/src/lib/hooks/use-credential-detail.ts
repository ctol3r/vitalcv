/**
 * useCredentialDetail Hook
 * React hook equivalent of CredentialDetailViewModel
 * Manages credential detail state and data fetching
 */

import { useCallback, useEffect, useState } from 'react';
import { credentialRepository, type Credential } from '@/lib/repositories/credential-repository';
import { evidenceRepository, type Evidence } from '@/lib/repositories/evidence-repository';
import { chainService, type AnchorStatus, type ChainEvent } from '@/lib/services/chain-service';
import { trustService, type TrustScore, type ProofHealth, type SelectiveDisclosure } from '@/lib/services/trust-service';

export type CredentialDetailState =
  | { type: 'loading' }
  | { type: 'loaded'; credential: Credential; evidence: Evidence[]; anchorStatus: AnchorStatus; trustScore: TrustScore; proofHealth: ProofHealth; selectiveDisclosure: SelectiveDisclosure; timeline: ChainEvent[] }
  | { type: 'error'; error: string };

export type CredentialDetailRoute = 'overview' | 'evidence' | 'timeline' | 'chain';

export interface UseCredentialDetailOptions {
  credentialId: string;
  autoLoad?: boolean;
}

export interface UseCredentialDetailReturn {
  state: CredentialDetailState;
  route: CredentialDetailRoute;
  setRoute: (route: CredentialDetailRoute) => void;
  refresh: () => Promise<void>;
  loading: boolean;
}

export function useCredentialDetail({
  credentialId,
  autoLoad = true,
}: UseCredentialDetailOptions): UseCredentialDetailReturn {
  const [state, setState] = useState<CredentialDetailState>({ type: 'loading' });
  const [route, setRoute] = useState<CredentialDetailRoute>('overview');

  const loadData = useCallback(async () => {
    setState({ type: 'loading' });

    try {
      // Load all data in parallel
      const [credential, evidence, anchorStatus] = await Promise.all([
        credentialRepository.getCredential(credentialId),
        evidenceRepository.getEvidence(credentialId).catch(() => []),
        chainService.getAnchorStatus(credentialId).catch(() => undefined),
      ]);

      // Calculate trust metrics
      const trustScore = trustService.calculateTrustScore(credential, anchorStatus, evidence);
      const proofHealth = trustService.calculateProofHealth(evidence, anchorStatus);
      const selectiveDisclosure = trustService.analyzeSelectiveDisclosure(credential);

      // Load timeline
      const timeline = await chainService.getChainTimeline(credentialId).catch(() => []);

      setState({
        type: 'loaded',
        credential,
        evidence: evidence || [],
        anchorStatus: anchorStatus || {
          credentialId,
          anchored: false,
          verified: false,
        },
        trustScore,
        proofHealth,
        selectiveDisclosure,
        timeline,
      });
    } catch (error) {
      console.error('[useCredentialDetail] Failed to load credential:', error);
      setState({
        type: 'error',
        error: error instanceof Error ? error.message : 'Failed to load credential',
      });
    }
  }, [credentialId]);

  useEffect(() => {
    if (autoLoad) {
      void loadData();
    }
  }, [autoLoad, loadData]);

  const refresh = useCallback(async () => {
    credentialRepository.clearCache(credentialId);
    await loadData();
  }, [credentialId, loadData]);

  return {
    state,
    route,
    setRoute,
    refresh,
    loading: state.type === 'loading',
  };
}

