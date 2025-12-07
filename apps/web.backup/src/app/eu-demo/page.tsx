'use client';

import { useState } from 'react';
import { Button } from '@/components/design/Button';
import { Card } from '@/components/design/Card';
import { CheckIcon, XMarkIcon, ShieldCheckIcon, GlobeAltIcon } from '@heroicons/react/24/outline';

const DEMO_SD_JWT = "eyJhbGciOiJFUzI1NiIsInR5cCI6InZjK3NkLWp3dCJ9.eyJpc3MiOiJkaWQ6d2ViOmRlbW8iLCJzdWIiOiJkaWQ6d2ViOnVzZXIiLCJfc2QiOlsiVFhRd0VmQk5QX2dEQnFyRlhTQkN5b3pObmpqckxRcDNjRGZjOGs2R2lWWSIsIlVFU192YkR6YlZ4cExkY2pwZnB4SWJyODJMaVZIS0Q2UkdONUpod2x2NVEiXSwiZXhwIjoxNzYzODAwODMyfQ.signature_placeholder~WyIyR0xDNDJzSlF0eFpiWGdzZkdyTXprIiwiZ2l2ZW5fbmFtZSIsIkVyaWthIl0~WyJ1cUsxV2FDS0JldFhWVFBLLU8taUJ3IiwiZmFtaWx5X25hbWUiLCJNdXN0ZXJtYW5uIl0";

const DISCLOSURES = [
  { id: 'd1', label: 'Given Name', value: 'Erika', raw: 'WyIyR0xDNDJzSlF0eFpiWGdzZkdyTXprIiwiZ2l2ZW5fbmFtZSIsIkVyaWthIl0' },
  { id: 'd2', label: 'Family Name', value: 'Mustermann', raw: 'WyJ1cUsxV2FDS0JldFhWVFBLLU8taUJ3IiwiZmFtaWx5X25hbWUiLCJNdXN0ZXJtYW5uIl0' }
];

export default function EuDemoPage() {
  const [step, setStep] = useState(1);
  const [selectedClaims, setSelectedClaims] = useState<string[]>(['d1', 'd2']);
  const [verificationResult, setVerificationResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const handlePresent = async () => {
    setLoading(true);
    try {
      const disclosuresToPresent = DISCLOSURES
        .filter(d => selectedClaims.includes(d.id))
        .map(d => d.raw);

      // Only send the JWT part + selected disclosures
      // The backend expects sd_jwt which can be compact (JWT~disclosures)
      // or split. Our backend verifySDJWT handles compact.

      // Construct compact SD-JWT with ONLY selected disclosures
      const jwtPart = DEMO_SD_JWT.split('~')[0];
      const token = [jwtPart, ...disclosuresToPresent].join('~');

      const res = await fetch('/api/eidas/present', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sd_jwt: token
        })
      });

      const data = await res.json();
      setVerificationResult(data);
      setStep(3);
    } catch (e) {
      console.error(e);
      setVerificationResult({ success: false, error: 'Network error' });
      setStep(3);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-3xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2 flex items-center gap-2">
            <GlobeAltIcon className="w-8 h-8 text-blue-600" />
            EU Digital Identity Wallet Demo
          </h1>
          <p className="text-gray-600">
            Demonstrating eIDAS-compliant SD-JWT credentials and selective disclosure.
          </p>
        </div>

        {step === 1 && (
          <Card className="p-6 space-y-6">
            <div className="text-center py-8">
              <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <ShieldCheckIcon className="w-8 h-8" />
              </div>
              <h2 className="text-xl font-semibold mb-2">Receive Credential</h2>
              <p className="text-gray-500 mb-6">
                Simulate receiving a verified ID from an EU Trust Provider.
              </p>
              <Button onClick={() => setStep(2)} size="lg">
                Receive & Store Credential
              </Button>
            </div>
          </Card>
        )}

        {step === 2 && (
          <Card className="p-6 space-y-6">
            <div className="border-b pb-4">
              <h2 className="text-xl font-semibold">Select Claims to Disclose</h2>
              <p className="text-sm text-gray-500">
                You are presenting your ID to a verifier. Choose which information to reveal.
              </p>
            </div>

            <div className="space-y-4">
              {DISCLOSURES.map(d => (
                <label key={d.id} className="flex items-center p-4 border rounded-lg hover:bg-gray-50 cursor-pointer">
                  <input
                    type="checkbox"
                    className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                    checked={selectedClaims.includes(d.id)}
                    onChange={e => {
                      if (e.target.checked) {
                        setSelectedClaims([...selectedClaims, d.id]);
                      } else {
                        setSelectedClaims(selectedClaims.filter(id => id !== d.id));
                      }
                    }}
                  />
                  <div className="ml-4">
                    <p className="font-medium text-gray-900">{d.label}</p>
                    <p className="text-sm text-gray-500">{d.value}</p>
                  </div>
                </label>
              ))}
            </div>

            <div className="pt-4 flex justify-end gap-3">
              <Button variant="outline" onClick={() => setStep(1)}>Back</Button>
              <Button onClick={handlePresent} isLoading={loading} disabled={selectedClaims.length === 0}>
                Present Proof
              </Button>
            </div>
          </Card>
        )}

        {step === 3 && (
          <Card className="p-6 space-y-6">
            <div className="text-center">
              {verificationResult?.success ? (
                <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
                  <CheckIcon className="w-8 h-8" />
                </div>
              ) : (
                <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
                  <XMarkIcon className="w-8 h-8" />
                </div>
              )}

              <h2 className="text-xl font-semibold mb-2">
                {verificationResult?.success ? 'Verification Successful' : 'Verification Failed'}
              </h2>

              <div className="mt-6 bg-gray-50 rounded-lg p-4 text-left overflow-auto">
                <h3 className="text-sm font-medium text-gray-500 mb-2 uppercase">Backend Response</h3>
                <pre className="text-xs text-gray-700 font-mono whitespace-pre-wrap">
                  {JSON.stringify(verificationResult, null, 2)}
                </pre>
              </div>

              <div className="mt-6">
                <Button onClick={() => { setStep(1); setVerificationResult(null); }}>
                  Start Over
                </Button>
              </div>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}














