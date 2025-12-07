/**
 * EvidenceRepository
 * Handles evidence file fetching and metadata
 */

import { getJSON } from '@/components/api/http';

export interface Evidence {
  id: string;
  credentialId: string;
  type: 'pdf' | 'image' | 'document' | 'screenshot';
  url: string;
  thumbnailUrl?: string;
  filename: string;
  mimeType: string;
  size: number;
  sourceUrl?: string;
  fetchedAt?: string;
  digest?: string;
  sha256?: string;
  metadata?: {
    pageCount?: number;
    dimensions?: { width: number; height: number };
    capturedAt?: string;
    device?: string;
  };
  version?: number;
}

export class EvidenceRepository {
  async getEvidence(credentialId: string): Promise<Evidence[]> {
    try {
      const data = await getJSON<Evidence[]>(`/api/wallet/credentials/${credentialId}/evidence`);
      return data;
    } catch (error) {
      console.error(`[EvidenceRepository] Failed to fetch evidence for ${credentialId}:`, error);
      // Return mock data for development
      return this.getMockEvidence(credentialId);
    }
  }

  async getEvidenceFile(evidenceId: string): Promise<Blob> {
    try {
      const response = await fetch(`/api/wallet/evidence/${evidenceId}/file`);
      if (!response.ok) {
        throw new Error(`Failed to fetch evidence file: ${response.statusText}`);
      }
      return await response.blob();
    } catch (error) {
      console.error(`[EvidenceRepository] Failed to fetch evidence file ${evidenceId}:`, error);
      throw error;
    }
  }

  private getMockEvidence(credentialId: string): Evidence[] {
    return [
      {
        id: `ev-${credentialId}-1`,
        credentialId,
        type: 'pdf',
        url: `/api/wallet/evidence/ev-${credentialId}-1/file`,
        thumbnailUrl: `/api/wallet/evidence/ev-${credentialId}-1/thumbnail`,
        filename: 'license-certificate.pdf',
        mimeType: 'application/pdf',
        size: 245678,
        sourceUrl: 'https://example.com/source/license.pdf',
        fetchedAt: new Date().toISOString(),
        digest: 'sha256:abc123...',
        sha256: 'abc123def456...',
        metadata: {
          pageCount: 2,
        },
        version: 1,
      },
      {
        id: `ev-${credentialId}-2`,
        credentialId,
        type: 'image',
        url: `/api/wallet/evidence/ev-${credentialId}-2/file`,
        thumbnailUrl: `/api/wallet/evidence/ev-${credentialId}-2/thumbnail`,
        filename: 'selfie-proof.jpg',
        mimeType: 'image/jpeg',
        size: 123456,
        sourceUrl: 'https://example.com/source/selfie.jpg',
        fetchedAt: new Date().toISOString(),
        digest: 'sha256:def456...',
        sha256: 'def456ghi789...',
        metadata: {
          dimensions: { width: 1920, height: 1080 },
          capturedAt: new Date().toISOString(),
          device: 'iPhone 14 Pro',
        },
        version: 1,
      },
    ];
  }
}

export const evidenceRepository = new EvidenceRepository();

