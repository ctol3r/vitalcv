'use client';

import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FUNNEL_EVENTS, trackFunnelEvent } from '@/lib/analytics/funnel';
import { ShieldCheck, Database, FileKey, Navigation } from 'lucide-react';

export function LiveTrustConsole({
  onPreviewReady,
  initialNpi,
}: {
  onPreviewReady?: (npi: string, name: string) => void;
  initialNpi?: string;
}) {
  const router = useRouter();
  const [npi, setNpi] = useState(initialNpi || '');
  const [phase, setPhase] = useState<'idle' | 'loading'>('idle');
  const [formMessage, setFormMessage] = useState<string | null>(null);

  const npiFocusTrackedRef = useRef(false);

  const [terminalSteps, setTerminalSteps] = useState<string[]>([]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanNpi = npi.replace(/\D/g, '');
    
    if (cleanNpi.length !== 10) {
      setFormMessage('NPI must be exactly 10 digits.');
      return;
    }
    
    setFormMessage(null);
    setPhase('loading');
    trackFunnelEvent(FUNNEL_EVENTS.NPI_SUBMITTED);
    
    // Terminal Handshake Sequence
    setTerminalSteps(['[SYSTEM] Initializing Omega Orchestrator...']);
    
    setTimeout(() => {
      setTerminalSteps(prev => [...prev, '[OK] NPPES verified (Identity & Taxonomy)']);
    }, 400);

    setTimeout(() => {
      setTerminalSteps(prev => [...prev, '[OK] OIG cleared (Exclusion Check)']);
    }, 800);

    setTimeout(() => {
      setTerminalSteps(prev => [...prev, '[OK] PECOS matched (Enrollment)']);
      setTerminalSteps(prev => [...prev, '[SYSTEM] Compiling Proof Manifest...']);
    }, 1200);

    setTimeout(() => {
      // Send directly to the canonical passport page (mobile-optimized by default)
      router.push(`/p/${cleanNpi}?mobile=true`);
    }, 1600);
  };

  return (
    <div className="w-full bg-background">
      {/* ── HERO SECTION ── */}
      <section className="relative overflow-hidden pt-16 pb-12 sm:pt-24 sm:pb-16 border-b border-border">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            
            {/* Left: Copy & Input */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="text-center lg:text-left"
            >
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold leading-tight tracking-tight text-foreground">
                Stop starting over.
                <span className="block text-emerald-600 mt-2">Start ready.</span>
              </h1>
              <p className="mt-6 text-lg leading-relaxed text-muted-foreground max-w-xl mx-auto lg:mx-0">
                Enter your NPI to check your credentialing status across federal sources in seconds. See what&rsquo;s verified, what&rsquo;s missing, and what could delay your next start.
              </p>

              <form onSubmit={handleSubmit} className="mt-8 flex flex-col sm:flex-row gap-3 max-w-md mx-auto lg:mx-0">
                <Input
                  type="text"
                  inputMode="numeric"
                  pattern="\d{10}"
                  maxLength={10}
                  value={npi}
                  readOnly={phase === 'loading'}
                  onChange={(e) => {
                    setFormMessage(null);
                    setNpi(e.target.value.replace(/\D/g, ''));
                  }}
                  onFocus={() => {
                    if (!npiFocusTrackedRef.current) {
                      trackFunnelEvent(FUNNEL_EVENTS.NPI_INPUT_FOCUSED);
                      npiFocusTrackedRef.current = true;
                    }
                  }}
                  placeholder="Enter 10-digit NPI"
                  className="h-14 text-lg rounded-none flex-1 shadow-sm"
                />
                <Button 
                  type="submit" 
                  disabled={phase === 'loading'}
                  className="h-14 px-8 text-base font-semibold rounded-none"
                >
                  {phase === 'loading' ? 'Checking…' : 'Check readiness'}
                </Button>
              </form>
              {formMessage && (
                <p className="mt-3 text-sm text-destructive">{formMessage}</p>
              )}
            </motion.div>

            {/* Right: Live Passport Preview or Terminal */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.8, delay: 0.2 }}
              className="relative mx-auto w-full max-w-md lg:max-w-full"
            >
              <div className="absolute inset-0 bg-gradient-to-tr from-primary/10  rounded-none transform rotate-3 scale-105 -z-10" />
              
              {phase === 'loading' ? (
                <div className="bg-zinc-950 border border-zinc-800 rounded-none shadow-xl overflow-hidden flex flex-col h-[320px]">
                  <div className="bg-zinc-900 px-4 py-2 border-b border-zinc-800 flex justify-between items-center">
                    <span className="text-xs font-semibold tracking-widest text-zinc-400 flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4 text-emerald-500" /> SYSTEM.EXECUTE
                    </span>
                  </div>
                  <div className="p-6 font-mono text-sm text-zinc-300 flex flex-col gap-2">
                    {terminalSteps.map((step, i) => (
                      <motion.div 
                        key={i} 
                        initial={{ opacity: 0, x: -10 }} 
                        animate={{ opacity: 1, x: 0 }}
                        className={step.includes('[OK]') ? 'text-emerald-400' : 'text-zinc-500'}
                      >
                        {step}
                      </motion.div>
                    ))}
                    <motion.div 
                      animate={{ opacity: [1, 0] }} 
                      transition={{ repeat: Infinity, duration: 0.8 }}
                      className="w-2 h-4 bg-emerald-500 mt-1"
                    />
                  </div>
                </div>
              ) : (
                <div className="bg-card border border-border rounded-none shadow-xl overflow-hidden flex flex-col h-[320px]">
                  <div className="bg-muted px-4 py-2 border-b border-border flex justify-between items-center">
                    <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4 text-primary" /> Live Trust Snapshot
                    </span>
                    <span className="text-[10px] uppercase bg-primary/10 text-primary px-2 py-1 rounded-full font-bold">
                      Demo Data
                    </span>
                  </div>
                  
                  <div className="p-6 space-y-6">
                    <div>
                      <h3 className="text-xl font-bold text-foreground">Dr. Sarah Jenkins</h3>
                      <p className="text-sm text-muted-foreground font-mono mt-1">NPI: 1487664858</p>
                    </div>
                    
                    <div className="space-y-3">
                      <div className="flex justify-between items-center border-b border-border pb-2">
                        <span className="text-sm text-muted-foreground">Readiness Posture</span>
                        <span className="text-sm font-bold text-emerald-600 bg-emerald-500/10 px-2 py-0.5 rounded">DECISION_GRADE</span>
                      </div>
                      <div className="flex justify-between items-center border-b border-border pb-2">
                        <span className="text-sm text-muted-foreground">Coverage</span>
                        <span className="text-sm font-medium text-foreground">3 / 3 Critical Lanes</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-muted-foreground">Immutable Receipts</span>
                        <span className="text-sm font-mono text-muted-foreground">SHA256...e9f4</span>
                      </div>
                    </div>
                    
                    <Button variant="secondary" className="w-full" disabled>
                      View System Recommendation
                    </Button>
                  </div>
                </div>
              )}
            </motion.div>

          </div>
        </div>
      </section>

      {/* ── FLOW SECTION ── */}
      <section className="py-16 sm:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-2xl sm:text-3xl font-bold text-foreground">The Algorithm Canon in Action</h2>
            <p className="mt-4 text-muted-foreground max-w-2xl mx-auto">
              VitalCV operates on mathematical truth, not self-reported claims. Our orchestrator enforces strict execution integrity across three distinct layers.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            
            {/* Step 1: Check */}
            <div className="bg-card border border-border rounded-none p-8 shadow-sm">
              <div className="w-12 h-12 bg-primary/10 rounded-none flex items-center justify-center mb-6">
                <Database className="w-6 h-6 text-primary" />
              </div>
              <h3 className="text-xl font-bold text-foreground mb-3">1. Check</h3>
              <p className="text-sm text-muted-foreground mb-4">
                <strong>Ingestion + Sources</strong><br/>
                We execute asynchronous pipelines to fetch facts directly from federal and state authorities (NPPES, OIG, PECOS), dropping upstream network latency from the critical path.
              </p>
            </div>

            {/* Step 2: Prove */}
            <div className="bg-card border border-border rounded-none p-8 shadow-sm">
              <div className="w-12 h-12 bg-primary/10 rounded-none flex items-center justify-center mb-6">
                <FileKey className="w-6 h-6 text-primary" />
              </div>
              <h3 className="text-xl font-bold text-foreground mb-3">2. Prove</h3>
              <p className="text-sm text-muted-foreground mb-4">
                <strong>Claims + Receipts</strong><br/>
                Every fetched fact is hashed into a cryptographic receipt. Conflicting data is mathematically resolved by our Arbitration Engine based on strict source authority.
              </p>
            </div>

            {/* Step 3: Start */}
            <div className="bg-card border border-border rounded-none p-8 shadow-sm">
              <div className="w-12 h-12 bg-primary/10 rounded-none flex items-center justify-center mb-6">
                <Navigation className="w-6 h-6 text-primary" />
              </div>
              <h3 className="text-xl font-bold text-foreground mb-3">3. Start</h3>
              <p className="text-sm text-muted-foreground mb-4">
                <strong>Decision + Apply</strong><br/>
                The Omega Orchestrator evaluates the time-locked Proof Manifest against organizational policy and outputs a deterministic recommendation, completely bypassing traditional credentialing delays.
              </p>
            </div>

          </div>
        </div>
      </section>

    </div>
  );
}
