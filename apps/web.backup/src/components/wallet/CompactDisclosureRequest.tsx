'use client'

import React, { useState } from 'react';
import { Button } from '@/components/design/Button';
import { Card } from '@/components/design/Card';

export interface CompactDisclosureRequestProps {
  appName: string;
  requestType: 'revealCompactTypeOnly' | 'revealMemberStateOnly' | 'revealEligibilityProof';
  compactType: string; // e.g. "NLC"
  memberState?: string; // e.g. "TX", optional if hidden
  onApprove: (disclosures: string[]) => void;
  onReject: () => void;
}

export function CompactDisclosureRequest({
  appName,
  requestType,
  compactType,
  memberState,
  onApprove,
  onReject
}: CompactDisclosureRequestProps) {

  // Logic to determine what is being shared based on the request type
  // In a full implementation, these could be toggles, but for compacts,
  // the templates usually enforce specific combinations.

  const isZk = requestType === 'revealEligibilityProof';
  const revealsState = requestType === 'revealMemberStateOnly';

  const handleApprove = () => {
    const disclosures = [];
    disclosures.push('compactType'); // Always revealed in this context

    if (revealsState) {
        disclosures.push('memberState');
    }

    if (isZk) {
        disclosures.push('zkProof');
    }

    onApprove(disclosures);
  };

  return (
    <Card className="max-w-md mx-auto shadow-lg">
      <div className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="bg-blue-100 text-blue-800 text-xs font-semibold px-2 py-1 rounded">
            Proof Request
          </div>
          <div className="text-gray-500 text-sm">
            from <span className="font-semibold text-gray-700">{appName}</span>
          </div>
        </div>

        <h3 className="text-lg font-bold mb-2">
          {isZk ? 'Private Eligibility Proof' : 'Credential Disclosure'}
        </h3>
        <p className="text-gray-600 text-sm mb-6">
            {appName} is requesting proof of your {compactType} membership.
            {isZk
                ? ' A Zero-Knowledge proof will be generated to verify your status without revealing your home state.'
                : ' Please review the information that will be shared.'}
        </p>

        <div className="space-y-3 mb-6">
          {/* Compact Type - Always Revealed */}
          <div className="flex items-center justify-between p-3 bg-gray-50 rounded border">
            <div className="flex flex-col">
              <span className="font-medium text-sm">Compact Type</span>
              <span className="text-xs text-gray-500">{compactType}</span>
            </div>
            <div className="flex items-center gap-1 text-green-600 text-xs font-bold">
                 <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                 </svg>
                 REVEALED
            </div>
          </div>

          {/* Member State - Hidden in ZK, Revealed otherwise if requested */}
          <div className="flex items-center justify-between p-3 bg-gray-50 rounded border">
            <div className="flex flex-col">
              <span className="font-medium text-sm">Home State</span>
              <span className="text-xs text-gray-500">{memberState || '***'}</span>
            </div>
            {isZk ? (
                 <div className="flex items-center gap-1 text-gray-400 text-xs font-bold">
                     <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                     </svg>
                    HIDDEN (ZK)
                 </div>
            ) : (
                revealsState ? (
                     <div className="flex items-center gap-1 text-green-600 text-xs font-bold">
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                        REVEALED
                    </div>
                ) : (
                    <div className="text-gray-400 text-xs font-bold">NOT REQUESTED</div>
                )
            )}
          </div>

          {/* ZK Proof Indicator */}
          {isZk && (
             <div className="flex items-center justify-between p-3 bg-blue-50 rounded border border-blue-100">
             <div className="flex flex-col">
               <span className="font-medium text-sm text-blue-900">ZK Proof</span>
               <span className="text-xs text-blue-700">Cryptographic eligibility proof</span>
             </div>
             <div className="flex items-center gap-1 text-blue-700 text-xs font-bold">
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                GENERATED
             </div>
           </div>
          )}
        </div>

        <div className="flex gap-3">
          <Button variant="secondary" fullWidth onClick={onReject}>
            Deny
          </Button>
          <Button fullWidth onClick={handleApprove}>
            Approve & Share
          </Button>
        </div>
      </div>
    </Card>
  );
}














