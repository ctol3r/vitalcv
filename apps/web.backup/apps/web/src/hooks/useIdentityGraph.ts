'use client';

import { useState, useEffect, useCallback } from 'react';

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE ||
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  process.env.API_BASE_URL ||
  '';

export interface GraphNode {
  id: string;
  clinicianId: string;
  role?: string;
  specialty?: string;
  trustScore: number;
  endorsementsCount: number;
  communityTrustScore?: number;
  identityResonanceCoefficient?: number;
}

export interface GraphEdge {
  id: string;
  fromNodeId: string;
  toNodeId: string;
  edgeType: 'supervisor-of' | 'collaborated-with' | 'verified-skill-for' | 'referenced-by';
  trustWeight: number;
  strength: number;
  recency: number;
  chainAnchored: boolean;
  verified: boolean;
}

export interface NetworkData {
  node: GraphNode;
  connections: Array<{
    edge: GraphEdge;
    node: GraphNode;
    depth: number;
  }>;
}

export interface SocialTrustSignals {
  relationshipStrengthScore: number;
  verificationWeight: number;
  peerStability: number;
  endorsementDensity: number;
  trustLift: number;
  communityTrustScore: number;
  identityResonanceCoefficient: number;
}

export function useIdentityGraph(clinicianId: string | null) {
  const [networkData, setNetworkData] = useState<NetworkData | null>(null);
  const [signals, setSignals] = useState<SocialTrustSignals | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchNetwork = useCallback(async (depth: number = 2) => {
    if (!clinicianId) return;

    try {
      setLoading(true);
      setError(null);
      const response = await fetch(`${API_BASE}/api/graph/network/${clinicianId}?depth=${depth}`);

      if (!response.ok) {
        throw new Error('Failed to fetch network');
      }

      const data = await response.json();
      setNetworkData(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load network');
    } finally {
      setLoading(false);
    }
  }, [clinicianId]);

  const fetchSignals = useCallback(async () => {
    if (!clinicianId) return;

    try {
      setError(null);
      const response = await fetch(`${API_BASE}/api/graph/signals/${clinicianId}`);

      if (!response.ok) {
        throw new Error('Failed to fetch signals');
      }

      const data = await response.json();
      setSignals(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load signals');
    }
  }, [clinicianId]);

  const syncReferencesAndEndorsements = useCallback(async () => {
    if (!clinicianId) return null;

    try {
      setError(null);
      const response = await fetch(`${API_BASE}/api/graph/sync/${clinicianId}`, {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error('Failed to sync');
      }

      const data = await response.json();
      return data;
    } catch (err: any) {
      setError(err.message || 'Failed to sync');
      return null;
    }
  }, [clinicianId]);

  const createSnapshot = useCallback(async () => {
    if (!clinicianId) return null;

    try {
      setError(null);
      const response = await fetch(`${API_BASE}/api/graph/snapshot/${clinicianId}`, {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error('Failed to create snapshot');
      }

      const data = await response.json();
      return data;
    } catch (err: any) {
      setError(err.message || 'Failed to create snapshot');
      return null;
    }
  }, [clinicianId]);

  const propagateTrust = useCallback(async () => {
    if (!clinicianId) return null;

    try {
      setError(null);
      const response = await fetch(`${API_BASE}/api/graph/propagate/${clinicianId}`, {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error('Failed to propagate trust');
      }

      const data = await response.json();
      // Refresh network data after propagation
      await fetchNetwork();
      return data;
    } catch (err: any) {
      setError(err.message || 'Failed to propagate trust');
      return null;
    }
  }, [clinicianId, fetchNetwork]);

  useEffect(() => {
    if (clinicianId) {
      fetchNetwork();
      fetchSignals();
    }
  }, [clinicianId, fetchNetwork, fetchSignals]);

  return {
    networkData,
    signals,
    loading,
    error,
    fetchNetwork,
    fetchSignals,
    syncReferencesAndEndorsements,
    createSnapshot,
    propagateTrust,
  };
}








