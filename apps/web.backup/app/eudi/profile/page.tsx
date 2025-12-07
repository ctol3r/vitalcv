/**
 * EUDI Issuer Profiles - Batch 54
 * Trust-service badges + "Add to EUDI Wallet" integration
 */

"use client";

import { useEffect, useState } from 'react';

interface IssuerProfile {
  profile_id: string;
  vc_type: string;
  trust_service_id?: string;
  disclosure: 'sd-jwt' | 'bbs';
  min_assurance?: string;
}

export default function EUDIProfiles() {
  const [profiles, setProfiles] = useState<IssuerProfile[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/eudi/issuer/profiles');
        const data = await res.json();
        setProfiles(data.rows || []);
      } catch (err) {
        console.error('Failed to load EUDI profiles:', err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const getAssuranceBadge = (assurance?: string) => {
    const colors: Record<string, string> = {
      low: 'bg-gray-100 text-gray-700',
      substantial: 'bg-blue-100 text-blue-700',
      high: 'bg-green-100 text-green-700',
    };
    return colors[assurance || 'low'] || colors.low;
  };

  const getTrustBadge = (trustServiceId?: string) => {
    if (!trustServiceId) return null;
    const isQualified = trustServiceId.includes('cab');
    return (
      <span
        className={`text-xs px-2 py-0.5 rounded-full font-medium ${
          isQualified
            ? 'bg-purple-100 text-purple-700'
            : 'bg-yellow-100 text-yellow-700'
        }`}
      >
        {isQualified ? 'Qualified (CAB)' : 'Non-Qualified'}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto py-8 px-4">
        <p className="text-gray-500">Loading EUDI profiles...</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      <h1 className="text-2xl font-bold mb-2">EUDI Issuer Profiles</h1>
      <p className="text-sm text-gray-600 mb-6">
        Trust-service aligned credential profiles for EU Digital Identity Wallet (EUDI)
      </p>

      <div className="space-y-4">
        {profiles.map((profile, idx) => (
          <div
            key={idx}
            className="border border-gray-300 rounded-lg p-4 bg-white shadow-sm hover:shadow-md transition"
          >
            <div className="flex items-start justify-between mb-3">
              <div>
                <h3 className="font-semibold text-lg">{profile.profile_id}</h3>
                <p className="text-sm text-gray-600 mt-0.5">{profile.vc_type}</p>
              </div>
              <div className="flex gap-2">
                {getTrustBadge(profile.trust_service_id)}
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${getAssuranceBadge(profile.min_assurance)}`}>
                  {profile.min_assurance || 'low'}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs mb-3">
              <div>
                <span className="text-gray-500">Disclosure:</span>{' '}
                <span className="font-mono font-medium">{profile.disclosure}</span>
              </div>
              {profile.trust_service_id && (
                <div>
                  <span className="text-gray-500">Trust Service:</span>{' '}
                  <span className="font-mono text-xs">{profile.trust_service_id}</span>
                </div>
              )}
            </div>

            <div className="flex gap-2">
              <button
                className="px-3 py-1.5 bg-indigo-600 text-white rounded text-sm hover:bg-indigo-700 font-medium"
                onClick={() => window.open('/wallet/settings/wallets', '_blank')}
              >
                Add to EUDI Wallet
              </button>
              <button
                className="px-3 py-1.5 border border-gray-300 rounded text-sm hover:bg-gray-50"
                onClick={() => window.open('/api/eudi/issuer/metadata', '_blank')}
              >
                View OIDC4VCI Metadata
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-8 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <h3 className="font-semibold text-sm mb-2">About EUDI Wallet Integration</h3>
        <p className="text-xs text-gray-700">
          VitalCV issuer profiles align with <strong>eIDAS2</strong> regulations and{' '}
          <strong>ETSI TS 119612 v2.4.1</strong> trusted lists. Qualified profiles are
          backed by Conformity Assessment Bodies (CAB); non-qualified profiles follow
          risk-based policies.
        </p>
      </div>
    </div>
  );
}

