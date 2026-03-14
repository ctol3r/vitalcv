'use client';

import * as React from 'react';
import { motion } from 'framer-motion';
import { Share2, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { CredentialCard } from '@/components/clinician/CredentialCard';
import type { CredentialCardData } from '@/components/clinician/CredentialCard';

// Dummy data for the passport
const credentials: CredentialCardData[] = [
  {
    id: 'c1',
    type: 'STATE_LICENSE',
    name: 'State Medical License',
    issuer: 'New Jersey Medical Board',
    status: 'ACTIVE',
    claimLevel: 'L3',
    expirationDate: '2026-05-01T00:00:00Z',
    issueDate: '2022-05-01T00:00:00Z',
    licenseId: 'NJ-1039485',
    psvSnapshotHash: '0x9a7bca3e...88f1',
  },
  {
    id: 'c2',
    type: 'BOARD_CERTIFICATION',
    name: 'Board Certification in Internal Medicine',
    issuer: 'American Board of Internal Medicine (ABIM)',
    status: 'ACTIVE',
    claimLevel: 'L3',
    expirationDate: '2030-12-31T00:00:00Z',
    psvSnapshotHash: '0x32ffaa22...11b2',
  },
];

export default function PassportPage({ params }: { params: { id: string } }) {
  // Use id from params for fetching in a real app
  
  return (
    <div className="min-h-screen bg-[#080e1a] py-12 px-6">
      <div className="max-w-4xl mx-auto space-y-12">
        
        {/* Header */}
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-8 border-b border-white/10"
        >
          <div>
            <Link href="/" className="inline-flex items-center gap-2 text-white/50 hover:text-white/80 transition-colors mb-6 text-sm">
              <ArrowLeft className="h-4 w-4" />
              Back to Home
            </Link>
            <div className="flex items-center gap-4 mb-2">
              <h1 className="text-4xl md:text-5xl font-heading font-bold text-white">Dr. Sarah Chen</h1>
              <span className="px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 text-xs font-bold tracking-widest uppercase border border-emerald-500/20">
                Verified
              </span>
            </div>
            <p className="text-white/50 text-lg">NPI 1003000126 • Internal Medicine</p>
          </div>
          
          <button className="flex items-center gap-2 px-5 py-3 rounded-full bg-white/10 hover:bg-white/15 text-white transition-colors border border-white/5">
            <Share2 className="h-4 w-4" />
            <span className="font-medium text-sm">Share Trust Link</span>
          </button>
        </motion.div>

        {/* Credentials Grid */}
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="grid gap-6 md:grid-cols-2"
        >
          {credentials.map((cred, i) => (
            <motion.div
              key={cred.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 + i * 0.1 }}
            >
              <CredentialCard credential={cred} />
            </motion.div>
          ))}
        </motion.div>

      </div>
    </div>
  );
}
