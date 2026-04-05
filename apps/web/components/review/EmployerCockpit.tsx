'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Shield, AlertCircle, Clock, FileText, Database, ShieldAlert, FileCheck, CheckCircle2, User, Share2 } from 'lucide-react';
import type { PassportData } from '@/lib/trust/passport-contract';

interface EmployerCockpitProps {
  passport: PassportData;
}

export function EmployerCockpit({ passport }: EmployerCockpitProps) {
  const [actionTaken, setActionTaken] = useState<string | null>(null);

  const { identity, readiness, authority, standing } = passport;
  const name = identity?.displayName || 'Unknown Clinician';
  const score = readiness?.score || 0;
  const band = readiness?.level || 'UNKNOWN';
  const blockers = readiness?.blockers || [];
  
  // Decision logic
  const isBlocked = band === 'L0' || band === 'RED' || standing?.exclusionStatus === 'EXCLUDED';
  const isReady = score >= 80 && !isBlocked;
  const isPartial = !isReady && !isBlocked;

  const decisionState = isBlocked ? 'BLOCKED' : isReady ? 'READY' : 'PARTIAL';
  const proceedText = isBlocked ? 'CANNOT PROCEED' : isReady ? 'SAFE TO PROCEED' : 'PROCEED WITH CAUTION';
  const nextAction = isBlocked 
    ? 'Do not hire. Critical source verification failed.' 
    : isReady 
      ? 'Accept as head start. Move to privileging.' 
      : 'Route to credentialing team for gap resolution.';

  // Map credentials for Source Truth Panel
  const creds = authority?.credentials || [];
  const identityCred = creds.find(c => c.type === 'IDENTITY');
  const sanctionsCred = creds.find(c => c.type === 'SANCTIONS_CHECK');
  const licenseCreds = creds.filter(c => c.type === 'STATE_LICENSE');
  const deaCred = creds.find(c => c.type === 'DEA' || c.type === 'CSR');
  const boardCreds = creds.filter(c => c.type === 'BOARD_CERTIFICATION');

  const sources = [
    {
      category: 'Identity',
      source: 'NPPES',
      status: identityCred ? identityCred.status : 'MISSING',
      date: identityCred?.verifiedAt || '—',
      decisionGrade: true,
      failure: identityCred ? null : 'Identity resolution pending',
    },
    {
      category: 'Sanctions',
      source: 'OIG/LEIE',
      status: sanctionsCred ? sanctionsCred.status : (standing?.exclusionStatus || 'UNCHECKED'),
      date: sanctionsCred?.verifiedAt || standing?.exclusionCheckedAt || '—',
      decisionGrade: true,
      failure: standing?.exclusionStatus === 'EXCLUDED' ? 'Exclusion found' : null,
    },
    {
      category: 'Licensure',
      source: licenseCreds.length > 0 ? (licenseCreds[0].issuerName || licenseCreds[0].sourceId) : 'STATE_BOARD / FSMB',
      status: licenseCreds.length > 0 ? (licenseCreds.some(c => c.status === 'ACTIVE') ? 'ACTIVE' : licenseCreds[0].status) : 'MISSING',
      date: licenseCreds.length > 0 ? licenseCreds[0].verifiedAt : '—',
      decisionGrade: true,
      failure: licenseCreds.length === 0 ? 'Requires institutional access' : null,
    },
    {
      category: 'DEA Registration',
      source: 'DEA',
      status: deaCred ? deaCred.status : 'ACCESS REQUIRED',
      date: deaCred?.verifiedAt || '—',
      decisionGrade: true,
      failure: deaCred ? null : 'Gated source',
    },
    {
      category: 'Board Cert',
      source: boardCreds.length > 0 ? (boardCreds[0].issuerName || boardCreds[0].sourceId) : 'ABMS',
      status: boardCreds.length > 0 ? 'ACTIVE' : 'UNVERIFIED',
      date: boardCreds.length > 0 ? boardCreds[0].verifiedAt : '—',
      decisionGrade: false,
      failure: boardCreds.length === 0 ? 'Verification pending' : null,
    }
  ];

  return (
    <div className="min-h-screen bg-[var(--vt-bg)] text-[var(--vt-text-primary)] font-sans antialiased pb-24">
      {/* Brutalist Header */}
      <header className="border-b border-[var(--vt-border)] p-6 flex justify-between items-center bg-[var(--vt-bg)] sticky top-0 z-10">
        <Link href="/" className="flex items-center gap-2 text-[var(--vt-text-primary)]">
          <div className="w-8 h-8 bg-[var(--vt-text-primary)] flex items-center justify-center font-bold text-[var(--vt-bg)]">V</div>
          <h1 className="text-xl font-bold tracking-tighter uppercase">VitalCV</h1>
        </Link>
        <div className="flex items-center gap-4">
          <span className="text-[10px] font-bold uppercase tracking-widest border border-[var(--vt-border)] px-3 py-1">
            Employer Review
          </span>
        </div>
      </header>

      <main className="max-w-5xl mx-auto p-6 md:p-12 space-y-16">
        
        {/* Clinician Header */}
        <div>
          <h2 className="text-4xl md:text-5xl font-bold tracking-tighter uppercase mb-2">{name}</h2>
          <p className="text-sm font-mono opacity-60 uppercase tracking-widest">
            {identity?.specialty || 'Clinician'} · NPI: {passport.npi}
          </p>
        </div>

        {/* Top Decision Block */}
        <div className={`border-2 ${isBlocked ? 'border-[var(--vt-severity-critical)]' : isReady ? 'border-[var(--vt-status-resolved)]' : 'border-[var(--vt-severity-high)]'} bg-white/5 p-8 relative`}>
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 pb-8 border-b border-[var(--vt-border-subtle)] gap-6">
            <div>
              <div className="text-[10px] font-bold uppercase tracking-widest opacity-40 mb-2">Decision Posture</div>
              <div className="flex items-center gap-4">
                <span className={`text-4xl font-bold tracking-tighter uppercase ${isBlocked ? 'text-[var(--vt-severity-critical)]' : isReady ? 'text-[var(--vt-status-resolved)]' : 'text-[var(--vt-severity-high)]'}`}>
                  {decisionState}
                </span>
                <span className="text-sm font-mono border border-[var(--vt-border)] px-3 py-1 bg-[var(--vt-bg)] text-[var(--vt-text-primary)]">
                  {proceedText}
                </span>
              </div>
            </div>
            <div className="text-right">
              <div className="text-[10px] font-bold uppercase tracking-widest opacity-40 mb-2">Readiness Score</div>
              <div className="text-4xl font-mono tracking-tighter">{score}<span className="text-xl opacity-40">/100</span></div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
            <div>
              <h3 className="text-xs font-bold uppercase tracking-widest opacity-40 mb-4 flex items-center gap-2">
                <AlertCircle className="w-4 h-4" /> Blockers
              </h3>
              {blockers.length > 0 ? (
                <ul className="space-y-2 font-mono text-sm">
                  {blockers.map((b, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="text-[var(--vt-severity-critical)] mt-0.5">■</span> {b}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="font-mono text-sm opacity-60">No critical blockers identified.</p>
              )}
            </div>
            
            <div className="bg-[var(--vt-text-primary)] text-[var(--vt-bg)] p-6">
              <h3 className="text-xs font-bold uppercase tracking-widest opacity-60 mb-2">Next Best Action</h3>
              <p className="text-lg font-bold leading-snug">{nextAction}</p>
            </div>
          </div>
        </div>

        {/* Source Truth Panel */}
        <div>
          <h3 className="text-xs font-bold uppercase tracking-[0.2em] opacity-40 mb-6">Source Truth</h3>
          <div className="border border-[var(--vt-border)] bg-white/5">
            <div className="grid grid-cols-5 p-4 border-b border-[var(--vt-border)] font-serif italic text-[11px] uppercase tracking-widest opacity-50">
              <div>Category</div>
              <div>Status</div>
              <div>Source</div>
              <div>Freshness</div>
              <div>Decision Grade</div>
            </div>
            {sources.map((s, i) => (
              <div key={i} className="grid grid-cols-5 p-4 border-b border-[var(--vt-border-subtle)] last:border-0 hover:bg-[var(--vt-text-primary)] hover:text-[var(--vt-bg)] transition-colors group font-mono text-xs items-center">
                <div className="font-bold">{s.category}</div>
                <div>
                  <span className={`px-2 py-0.5 border ${s.status === 'ACTIVE' || s.status === 'CLEAR' ? 'border-[var(--vt-status-resolved)] text-[var(--vt-status-resolved)] group-hover:border-[var(--vt-bg)] group-hover:text-[var(--vt-bg)]' : s.status === 'MISSING' || s.status === 'ACCESS REQUIRED' ? 'border-[var(--vt-severity-high)] text-[var(--vt-severity-high)] group-hover:border-[var(--vt-bg)] group-hover:text-[var(--vt-bg)]' : 'border-[var(--vt-border)]'} uppercase text-[10px]`}>
                    {s.status}
                  </span>
                  {s.failure && <div className="text-[10px] mt-1 opacity-60 group-hover:opacity-90">{s.failure}</div>}
                </div>
                <div className="opacity-80">{s.source}</div>
                <div className="opacity-80">{s.date && s.date !== '—' ? new Date(s.date).toISOString().split('T')[0] : '—'}</div>
                <div>{s.decisionGrade ? 'YES' : 'NO'}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Evidence Summary */}
        <div>
          <h3 className="text-xs font-bold uppercase tracking-[0.2em] opacity-40 mb-6">All Verified Claims ({creds.length})</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {creds.map((c, i) => (
              <div key={i} className="border border-[var(--vt-border)] p-4 flex flex-col gap-3 bg-white/5 hover:bg-white/10 transition-colors">
                <div className="flex justify-between items-start">
                  <div className="text-[10px] font-bold uppercase tracking-widest opacity-50">{c.domain || 'CREDENTIAL'}</div>
                  <div className="text-[8px] font-mono border border-[var(--vt-border)] px-1.5 py-0.5">{c.status}</div>
                </div>
                <div className="font-bold text-sm leading-tight">{c.type.replace(/_/g, ' ')}</div>
                <div className="flex items-center gap-2 mt-auto pt-4 border-t border-[var(--vt-border-subtle)] text-[10px] font-mono opacity-60">
                  <Database className="w-3 h-3" /> {c.issuerName || c.sourceId}
                </div>
              </div>
            ))}
            {creds.length === 0 && (
              <div className="col-span-full border border-[var(--vt-border)] p-8 text-center font-mono text-sm opacity-50">
                No credentials hydrated.
              </div>
            )}
          </div>
        </div>

        {/* Action Panel */}
        <div className="border-t-4 border-[var(--vt-border)] pt-12 pb-12 sticky bottom-0 bg-[var(--vt-bg)] z-10 flex flex-col md:flex-row justify-between items-center gap-6 mt-24">
          <div>
            <h3 className="text-lg font-bold uppercase tracking-widest mb-1">Make a Decision</h3>
            <p className="text-xs font-mono opacity-60">Your action will be logged in the audit trail.</p>
          </div>
          
          <div className="flex flex-wrap gap-4 w-full md:w-auto">
            {actionTaken ? (
              <div className="flex items-center gap-2 text-[var(--vt-status-resolved)] font-bold uppercase tracking-widest border border-[var(--vt-status-resolved)] px-6 py-4">
                <CheckCircle2 className="w-5 h-5" />
                {actionTaken}
              </div>
            ) : (
              <>
                <button 
                  onClick={() => setActionTaken('Routed to Credentialing')}
                  className="flex-1 md:flex-none border border-[var(--vt-border)] px-6 py-4 text-xs font-bold uppercase tracking-widest hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                >
                  Route to Credentialing
                </button>
                <button 
                  onClick={() => setActionTaken('Requested Update')}
                  className="flex-1 md:flex-none border border-[var(--vt-border)] px-6 py-4 text-xs font-bold uppercase tracking-widest hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                >
                  Request Update
                </button>
                <button 
                  onClick={() => setActionTaken('Accepted Head Start')}
                  disabled={isBlocked}
                  className="flex-1 md:flex-none border border-[var(--vt-text-primary)] bg-[var(--vt-text-primary)] text-[var(--vt-bg)] px-8 py-4 text-sm font-bold uppercase tracking-widest hover:opacity-90 disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
                >
                  Accept as Head Start
                </button>
              </>
            )}
          </div>
        </div>

      </main>
    </div>
  );
}
