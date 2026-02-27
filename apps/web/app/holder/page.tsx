'use client';

import { useEffect, useState } from 'react';

import { CredentialCard } from '@/components/holder/CredentialCard';
import { FocusMode } from '@/components/holder/FocusMode';
import {
  parseCredentialPayload,
  parsedToHolderCredential,
} from '@/lib/credentials/sdJwtParser';
import type { HolderCredential } from '@/types/holder';

/* ------------------------------------------------------------------ */
/*  Demo SD-JWT — real base64url-encoded token for client-side parse   */
/* ------------------------------------------------------------------ */

const DEMO_SD_JWT =
  'eyJhbGciOiJFUzI1NiIsInR5cCI6InZjK3NkLWp3dCJ9.eyJpc3MiOiJkaWQ6d2ViOmlzc3Vlci52aXRhbGN2LmNvbSIsInN1YiI6ImRpZDprZXk6ejZNa2hhWGdCWkR2b3REa0w1MjU3ZmFpenRpR2lDMlF0S0xHcGJubkVHdGEyZG9LIiwidmN0IjoiTWVkaWNhbExpY2Vuc2UiLCJpYXQiOjE3MDY3NDU2MDAsImV4cCI6MTc2OTgxNzYwMCwiaG9sZGVyTmFtZSI6IkRyLiBTYXJhaCBDaGVuIiwibGljZW5zZU51bWJlciI6IkEtMTQyODU3IiwibnBpIjoiMTAwMzAwMDEyNiIsInNjb3BlIjoiTWVkaWNpbmUgYW5kIFN1cmdlcnkiLCJzdGF0dXMiOiJ2YWxpZCIsInRydXN0TGV2ZWwiOiJMMyIsIm1ldGhvZG9sb2d5VmVyc2lvbiI6IjIuMS4wIiwicmF3U25hcHNob3RIYXNoIjoiZTNiMGM0NDI5OGZjMWMxNDlhZmJmNGM4OTk2ZmI5MjQyN2FlNDFlNDY0OWI5MzRjYTQ5NTk5MWI3ODUyYjg1NSIsInZlcmlmaWVyRElEIjoiZGlkOndlYjp2ZXJpZnkudml0YWxjdi5jb20iLCJfc2QiOlsiV3lKellXeDBNU0lzSW14cFkyVnVjMlZPZFcxaVpYSWlMQ0pCTFRFME1qZzFOeUpkIiwiV3lKellXeDBNaUlzSW01d2FTSXNJakV3TURNd01EQXhNallpWFEiXX0.AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA~WyJzYWx0MSIsImxpY2Vuc2VOdW1iZXIiLCJBLTE0Mjg1NyJd~WyJzYWx0MiIsIm5waSIsIjEwMDMwMDAxMjYiXQ~';

const OPENID4VP_URI =
  'openid4vp://?client_id=did:web:demo&request_uri=https://api.vitalcv.com/vp/req-123';

/* ------------------------------------------------------------------ */
/*  Holder Dashboard Page                                              */
/* ------------------------------------------------------------------ */

export default function HolderPage() {
  const [credentials, setCredentials] = useState<HolderCredential[]>([]);
  const [focusCredential, setFocusCredential] =
    useState<HolderCredential | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    try {
      const parsed = parseCredentialPayload(DEMO_SD_JWT);
      const cred = parsedToHolderCredential(parsed);
      setCredentials([cred]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Parse error');
      setCredentials([
        {
          id: 'fallback',
          type: 'CREDENTIAL',
          name: 'Credential (parse failed)',
          issuer: 'Unknown',
          state: 'valid',
          trustLevel: 'L0',
          issueDate: 'N/A',
          auditTrail: [],
        },
      ]);
    }
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-slate-100">
      <div className="max-w-5xl mx-auto px-4 py-10">
        <h1 className="text-3xl font-bold text-gray-900">My Credentials</h1>
        <p className="text-lg text-gray-600 mt-2">
          Your verified clinical credentials
        </p>

        {error && (
          <div className="mt-4 rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800">
            SD-JWT parse warning: {error}
          </div>
        )}

        {credentials.length === 0 ? (
          <p className="mt-8 text-gray-500">No credentials loaded.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
            {credentials.map((c) => (
              <CredentialCard
                key={c.id}
                credential={c}
                onFocusMode={setFocusCredential}
              />
            ))}
          </div>
        )}
      </div>

      <FocusMode
        credential={focusCredential}
        onClose={() => setFocusCredential(null)}
        qrValue={OPENID4VP_URI}
      />
    </div>
  );
}
