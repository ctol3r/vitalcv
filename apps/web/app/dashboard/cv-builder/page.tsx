'use client';

import type { GraphNode } from '@/components/graph/types';
import { TrustGraph } from '@/components/clinician/TrustGraph';
import { Button } from '@/components/ui/button';
import {
    GlassCard,
    GlassCardContent,
    GlassCardHeader,
    GlassCardTitle,
} from '@/components/ui/glass-card';
import { CheckCircle2, FileText, Share2 } from 'lucide-react';
import { Suspense, useEffect, useState } from 'react';

export default function CVBuilderPage() {
  const [npi, setNpi] = useState('1234567890');
  const [nodes, setNodes] = useState<GraphNode[]>([]);
  const [isCopied, setIsCopied] = useState(false);

  useEffect(() => {
    async function fetchGraphData() {
      try {
        const res = await fetch(`/api/graph/${npi}`);
        if (!res.ok) throw new Error('Failed to fetch graph');
        const data = await res.json();
        setNodes(data.nodes || []);
      } catch (err) {
        console.error('Error fetching CV components', err);
      }
    }
    fetchGraphData();
  }, [npi]);

  const clinicianNode = nodes.find(n => n.group === 'clinician');
  const employers = nodes.filter(n => n.group === 'employer');
  const credentials = nodes.filter(n => n.group === 'credential');
  const issuers = nodes.filter(n => n.group === 'issuer');

  const shareUrl = typeof window !== 'undefined' ? `${window.location.origin}/p/dr-sarah-jenkins` : '';

  const handleShare = () => {
    navigator.clipboard.writeText(shareUrl);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">

      {/* Header section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="font-heading text-3xl font-bold tracking-tight text-white mb-2">
            Clinical Knowledge Graph & Living CV
          </h1>
          <p className="text-slate-400">
            Your cryptographic trust state synthesized into a living, verifiable resumé.
          </p>
        </div>

        <Button onClick={handleShare} className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium shrink-0 flex items-center gap-2">
          {isCopied ? <CheckCircle2 className="h-4 w-4" /> : <Share2 className="h-4 w-4" />}
          {isCopied ? "Link Copied!" : "Generate Share Link"}
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Left Column: Visual Graph Engine */}
        <div className="space-y-6">
          <GlassCard className="border-slate-800 bg-slate-900/50 backdrop-blur-xl">
            <GlassCardHeader>
              <GlassCardTitle className="flex items-center gap-2">
                <Share2 className="h-5 w-5 text-indigo-400" />
                Network Visualization
              </GlassCardTitle>
            </GlassCardHeader>
            <GlassCardContent>
              <Suspense fallback={<div className="h-[500px] w-full flex items-center justify-center text-slate-500 animate-pulse">Loading Graph Engine...</div>}>
                <TrustGraph npi={npi} />
              </Suspense>
            </GlassCardContent>
          </GlassCard>
        </div>

        {/* Right Column: Chronological Narrative */}
        <div className="space-y-6">
          <GlassCard className="border-slate-800 bg-slate-900/50 backdrop-blur-xl h-full">
            <GlassCardHeader>
              <GlassCardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-indigo-400" />
                Living Chronology
              </GlassCardTitle>
            </GlassCardHeader>
            <GlassCardContent>
              <div className="space-y-8 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-slate-700 before:to-transparent">

                {/* 1. Education / Issuers */}
                {issuers.length > 0 && (
                  <div className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                    <div className="flex items-center justify-center w-10 h-10 rounded-full border border-indigo-500 bg-slate-900 shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 z-10 text-indigo-400 font-bold text-xs shadow-indigo-500/50">
                      EDU
                    </div>
                    <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] p-4 rounded border border-slate-700 bg-slate-800/50 shadow-sm opacity-90 transition-opacity translate-y-2 group-hover:opacity-100 group-hover:translate-y-0 duration-300">
                      <div className="font-bold text-slate-200">Education & Issuers</div>
                      <ul className="text-sm text-slate-400 mt-2 space-y-1 list-disc pl-4">
                        {issuers.map((iss, i) => (
                          <li key={i}>{iss.label}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}

                {/* 2. Licensure & Credentials */}
                {credentials.length > 0 && (
                  <div className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                    <div className="flex items-center justify-center w-10 h-10 rounded-full border border-emerald-500 bg-slate-900 shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 z-10 text-emerald-400 font-bold text-xs shadow-emerald-500/50">
                      LIC
                    </div>
                    <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] p-4 rounded border border-slate-700 bg-slate-800/50 shadow-sm opacity-90 transition-opacity translate-y-2 group-hover:opacity-100 group-hover:translate-y-0 duration-300">
                      <div className="font-bold text-slate-200">Licensure & CVOs</div>
                      <ul className="text-sm text-slate-400 mt-2 space-y-1 list-disc pl-4">
                        {credentials.map((cred, i) => (
                          <li key={i} className="flex flex-col">
                            {cred.label}
                            {cred.trustState === 'GREEN' && <span className="text-[10px] text-emerald-400">Verifiable Checksum: {cred.auditHash?.substring(0,8)}...</span>}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}

                {/* 3. Employment History */}
                {employers.length > 0 && (
                  <div className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                    <div className="flex items-center justify-center w-10 h-10 rounded-full border border-amber-500 bg-slate-900 shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 z-10 text-amber-500 font-bold text-xs shadow-amber-500/50">
                      EMP
                    </div>
                    <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] p-4 rounded border border-slate-700 bg-slate-800/50 shadow-sm opacity-90 transition-opacity translate-y-2 group-hover:opacity-100 group-hover:translate-y-0 duration-300">
                      <div className="font-bold text-slate-200">Employment Graph</div>
                      <ul className="text-sm text-slate-400 mt-2 space-y-1 list-disc pl-4">
                        {employers.map((emp, i) => (
                          <li key={i}>{emp.label}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}

              </div>
            </GlassCardContent>
          </GlassCard>
        </div>
      </div>

    </div>
  );
}
