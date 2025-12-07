/**
 * Behavioral Health Compact Eligibility - Batch 54
 * PSYPACT (APIT/TAP/E.Passport) + Counseling Compact
 */

"use client";

import { useEffect, useState } from 'react';

interface EligibilityData {
  ok: boolean;
  mode: string;
  psypact: {
    apit: boolean;
    tap: boolean;
    epassport: string;
    home_state: string;
    member_states: number;
  };
  counseling: {
    privilege_required: boolean;
    eligible: boolean;
    compact_name: string;
    member_states: number;
  };
  note: string;
}

export default function BehavioralEligibility() {
  const [data, setData] = useState<EligibilityData | null>(null);
  const [mode, setMode] = useState<'tele' | 'temp'>('tele');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/behavioral/eligibility?mode=${mode}`);
        const json = await res.json();
        setData(json);
      } catch (err) {
        console.error('Failed to load eligibility:', err);
      } finally {
        setLoading(false);
      }
    })();
  }, [mode]);

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto py-8 px-4">
        <p className="text-gray-500">Loading eligibility data...</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      <h1 className="text-2xl font-bold mb-2">
        Behavioral Health Compact Eligibility
      </h1>
      <p className="text-sm text-gray-600 mb-6">
        PSYPACT (psychologists) + Counseling Compact (LPCs) telepractice & temporary privileges
      </p>

      {/* Mode Selector */}
      <div className="mb-6 flex gap-3">
        <button
          onClick={() => setMode('tele')}
          className={`px-4 py-2 rounded text-sm font-medium ${
            mode === 'tele'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          Telepsychology/Telecounseling
        </button>
        <button
          onClick={() => setMode('temp')}
          className={`px-4 py-2 rounded text-sm font-medium ${
            mode === 'temp'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          Temporary In-Person
        </button>
      </div>

      {data && (
        <>
          {/* PSYPACT Card */}
          <div className="mb-6 border border-purple-300 rounded-lg p-5 bg-purple-50">
            <h2 className="text-lg font-semibold mb-1 text-purple-900">
              PSYPACT (Psychology Compact)
            </h2>
            <p className="text-xs text-purple-700 mb-4">
              {data.psypact.member_states} member states • Home State: {data.psypact.home_state}
            </p>

            <div className="grid md:grid-cols-3 gap-4 mb-4">
              <div className="bg-white p-3 rounded border border-purple-200">
                <div className="text-xs text-gray-500 mb-1">APIT</div>
                <div className="font-semibold text-lg">
                  {data.psypact.apit ? (
                    <span className="text-green-600">✓ Authorized</span>
                  ) : (
                    <span className="text-gray-400">Not Active</span>
                  )}
                </div>
                <div className="text-xs text-gray-600 mt-1">
                  Authority to Practice Interjurisdictional Telepsychology
                </div>
              </div>

              <div className="bg-white p-3 rounded border border-purple-200">
                <div className="text-xs text-gray-500 mb-1">TAP</div>
                <div className="font-semibold text-lg">
                  {data.psypact.tap ? (
                    <span className="text-green-600">✓ Active</span>
                  ) : (
                    <span className="text-gray-400">Not Active</span>
                  )}
                </div>
                <div className="text-xs text-gray-600 mt-1">
                  Temporary Authorization to Practice (in-person)
                </div>
              </div>

              <div className="bg-white p-3 rounded border border-purple-200">
                <div className="text-xs text-gray-500 mb-1">E.Passport</div>
                <div className="font-mono text-sm font-medium truncate">
                  {data.psypact.epassport}
                </div>
                <div className="text-xs text-gray-600 mt-1">
                  PSYPACT credential identifier
                </div>
              </div>
            </div>
          </div>

          {/* Counseling Compact Card */}
          <div className="mb-6 border border-teal-300 rounded-lg p-5 bg-teal-50">
            <h2 className="text-lg font-semibold mb-1 text-teal-900">
              Counseling Compact
            </h2>
            <p className="text-xs text-teal-700 mb-4">
              {data.counseling.member_states} member states • Privilege-to-practice model
            </p>

            <div className="grid md:grid-cols-2 gap-4">
              <div className="bg-white p-3 rounded border border-teal-200">
                <div className="text-xs text-gray-500 mb-1">Privilege Required</div>
                <div className="font-semibold text-lg">
                  {data.counseling.privilege_required ? (
                    <span className="text-orange-600">Yes</span>
                  ) : (
                    <span className="text-gray-400">No</span>
                  )}
                </div>
                <div className="text-xs text-gray-600 mt-1">
                  Must obtain privilege in destination state
                </div>
              </div>

              <div className="bg-white p-3 rounded border border-teal-200">
                <div className="text-xs text-gray-500 mb-1">Eligible for {mode}</div>
                <div className="font-semibold text-lg">
                  {data.counseling.eligible ? (
                    <span className="text-green-600">✓ Eligible</span>
                  ) : (
                    <span className="text-red-600">Not Eligible</span>
                  )}
                </div>
                <div className="text-xs text-gray-600 mt-1">
                  Based on current compact rules
                </div>
              </div>
            </div>
          </div>

          {/* Informational Note */}
          <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
            <p className="text-xs text-gray-700">
              <strong>Note:</strong> {data.note}
            </p>
          </div>
        </>
      )}
    </div>
  );
}

