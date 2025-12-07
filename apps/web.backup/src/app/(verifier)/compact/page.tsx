'use client'

import React, { useState } from 'react';
import { Button } from '@/components/design/Button';
import { Card } from '@/components/design/Card';

export default function CompactVerifierPage() {
  const [status, setStatus] = useState<string>('');
  const [proofData, setProofData] = useState<any>(null);

  const requestProof = async (type: string, description: string) => {
    setStatus(`Requesting: ${description}...`);
    setProofData(null);

    // Simulate API call or wallet interaction
    // In a real implementation, this would trigger an OID4VP flow or similar
    setTimeout(() => {
      setStatus(`Proof received and verified: ${description}`);
      setProofData({
        type,
        verified: true,
        timestamp: new Date().toISOString(),
        details: type === 'revealEligibilityProof' ? 'ZK Proof Validated (Home State Hidden)' : 'SD-JWT Disclosed',
        anchored: true, // Mocking the chain anchor result
        anchorHash: '0x' + Math.random().toString(16).substr(2, 40)
      });
    }, 1500);
  };

  return (
    <div className="container mx-auto py-10 px-4">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Compact Eligibility Verification</h1>
        <p className="text-gray-600">
          Request and verify interstate compact eligibility proofs using Selective Disclosure (SD-JWT) and Zero-Knowledge (ZK) proofs.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card
          header={<h3 className="text-xl font-semibold">Compact Type Only</h3>}
          footer={
            <div className="w-full mt-4">
                <Button fullWidth onClick={() => requestProof('revealCompactTypeOnly', 'Compact Type Only')}>
                Verify Compact
                </Button>
            </div>
          }
        >
          <p className="text-sm text-gray-600 mb-4 min-h-[40px]">
            Verify that the user holds a license in a specific compact (e.g., NLC, IMLC) without revealing their home state or license number.
          </p>
          <div className="text-xs bg-gray-100 p-2 rounded">
            Reveals: <span className="font-mono text-blue-600">compactType</span>
          </div>
        </Card>

        <Card
          header={<h3 className="text-xl font-semibold">State Membership</h3>}
          footer={
             <div className="w-full mt-4">
                <Button fullWidth onClick={() => requestProof('revealMemberStateOnly', 'State Membership')}>
                Verify State
                </Button>
            </div>
          }
        >
          <p className="text-sm text-gray-600 mb-4 min-h-[40px]">
            Verify that the user is a licensed member of a specific state within the compact.
          </p>
          <div className="text-xs bg-gray-100 p-2 rounded">
            Reveals: <span className="font-mono text-blue-600">compactType, memberState</span>
          </div>
        </Card>

        <Card
          header={<h3 className="text-xl font-semibold">ZK Eligibility (Private)</h3>}
          footer={
             <div className="w-full mt-4">
                <Button variant="secondary" fullWidth onClick={() => requestProof('revealEligibilityProof', 'ZK Eligibility')}>
                Verify Privately
                </Button>
            </div>
          }
        >
          <p className="text-sm text-gray-600 mb-4 min-h-[40px]">
            Cryptographically verify compact eligibility using a Zero-Knowledge proof. Proves valid standing without revealing the home state.
          </p>
          <div className="text-xs bg-gray-100 p-2 rounded">
            Reveals: <span className="font-mono text-blue-600">compactType, zkProof</span>
          </div>
        </Card>
      </div>

      {status && (
        <div className="mt-8 p-6 bg-slate-50 rounded-xl border">
          <div className="flex items-center gap-2 mb-2">
            <div className={`h-3 w-3 rounded-full ${proofData ? 'bg-green-500' : 'bg-yellow-500 animate-pulse'}`}></div>
            <h4 className="font-semibold">Verification Status</h4>
          </div>
          <p className="mb-4 text-gray-700">{status}</p>
          {proofData && (
            <div className="bg-white p-4 rounded border text-sm font-mono overflow-auto">
              <pre>{JSON.stringify(proofData, null, 2)}</pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}














