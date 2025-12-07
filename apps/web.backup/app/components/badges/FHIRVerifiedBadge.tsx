/**
 * B128C-FE-035: Directory Badge - Verified via FHIR Pipeline
 *
 * Features:
 * - Shows badge when provider verified
 * - Tooltip with link to evidence
 * - Screen reader friendly
 */

'use client';

import { useState, useEffect } from 'react';
import { CheckCircle, ExternalLink } from 'lucide-react';

interface FHIRBadgeData {
  verified: boolean;
  evidenceFlag?: boolean;
  evidenceUrl?: string;
  badge?: {
    type: string;
    label: string;
    url: string;
    issuedAt?: string;
    npi: string;
  };
  evidence?: {
    id: string;
    doi: string;
    title: string;
    abstract?: string;
    hash?: string;
  };
}

interface FHIRVerifiedBadgeProps {
  npi: string;
  className?: string;
}

export function FHIRVerifiedBadge({ npi, className = '' }: FHIRVerifiedBadgeProps) {
  const [badgeData, setBadgeData] = useState<FHIRBadgeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchBadgeData();
  }, [npi]);

  async function fetchBadgeData() {
    try {
      const response = await fetch(`/api/compliance/fhir-badge/${npi}`);

      if (!response.ok) {
        throw new Error('Failed to fetch badge data');
      }

      const data = await response.json();
      setBadgeData(data);
    } catch (err) {
      console.error('Error fetching FHIR badge:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div
        className={`inline-flex items-center gap-1 text-sm ${className}`}
        aria-label="Loading verification status"
        role="status"
      >
        <div className="w-4 h-4 border-2 border-gray-300 border-t-blue-500 rounded-full animate-spin"></div>
        <span className="text-gray-500">Verifying...</span>
      </div>
    );
  }

  if (error || !badgeData) {
    return null; // Fail gracefully - don't show badge if error
  }

  if (!badgeData.verified || !badgeData.evidenceFlag) {
    return null; // Only show badge when verified via FHIR
  }

  const tooltipId = `fhir-badge-tooltip-${npi}`;
  const badgeUrl = badgeData.badge?.url || badgeData.evidenceUrl;

  return (
    <div className={`relative inline-flex ${className}`}>
      {/* Badge Button */}
      <button
        className="group relative inline-flex items-center gap-1.5 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-full px-3 py-1.5 text-sm font-medium text-emerald-700 transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-1"
        aria-describedby={tooltipId}
        aria-label="Verified via FHIR Pipeline - Click for details"
        type="button"
      >
        <CheckCircle size={16} aria-hidden="true" />
        <span>{badgeData.badge?.label || 'Verified via FHIR Pipeline'}</span>

        {/* Tooltip */}
        <div
          id={tooltipId}
          className="absolute left-0 top-full mt-2 w-80 bg-gray-900 text-white text-sm rounded-lg shadow-xl p-4 opacity-0 invisible group-hover:opacity-100 group-hover:visible group-focus:opacity-100 group-focus:visible transition-all duration-200 z-50"
          role="tooltip"
        >
          <div className="font-semibold mb-2">
            ✓ FHIR Pipeline Verification
          </div>

          <div className="text-gray-300 mb-3 text-xs leading-relaxed">
            This provider's credentials have been verified through our FHIR-compliant
            healthcare data pipeline, ensuring regulatory compliance and data accuracy.
          </div>

          {badgeData.badge?.issuedAt && (
            <div className="text-gray-400 text-xs mb-3">
              Verified: {new Date(badgeData.badge.issuedAt).toLocaleDateString()}
            </div>
          )}

          {badgeData.evidence && (
            <div className="mb-3 pb-3 border-b border-gray-700">
              <div className="text-xs font-semibold text-gray-300 mb-1">
                Evidence:
              </div>
              <div className="text-xs text-gray-400">
                {badgeData.evidence.title}
              </div>
              {badgeData.evidence.doi && (
                <div className="text-xs text-gray-500 mt-1">
                  DOI: {badgeData.evidence.doi}
                </div>
              )}
            </div>
          )}

          {badgeUrl && (
            <a
              href={badgeUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-emerald-300 hover:text-emerald-100 underline text-xs font-medium"
              onClick={(e) => e.stopPropagation()}
            >
              View verification details
              <ExternalLink size={12} aria-hidden="true" />
              <span className="sr-only"> (opens in new tab)</span>
            </a>
          )}

          {/* Tooltip arrow */}
          <div className="absolute -top-2 left-4 w-4 h-4 bg-gray-900 transform rotate-45" aria-hidden="true"></div>
        </div>
      </button>

      {/* Screen reader summary */}
      <span className="sr-only">
        This provider has been verified via FHIR Pipeline.
        {badgeData.badge?.issuedAt && ` Verified on ${new Date(badgeData.badge.issuedAt).toLocaleDateString()}.`}
        {badgeUrl && ` Verification details available at ${badgeUrl}.`}
      </span>
    </div>
  );
}

export default FHIRVerifiedBadge;

