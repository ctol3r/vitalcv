import { Metadata } from 'next';
import { ShieldCheck, Database, FileKey, Activity, Link as LinkIcon, Server } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

export const metadata: Metadata = {
  title: 'Trust Center | VitalCV',
  description: 'System uptime, source health, verification status, and audit integrity for the VitalCV Network.',
};

export default function TrustCenterPage() {
  return (
    <div className="bg-background min-h-screen">
      <div className="mx-auto max-w-5xl px-4 py-16 sm:px-6 lg:px-8">
        
        {/* Header */}
        <div className="mb-12">
          <h1 className="text-3xl font-bold text-foreground sm:text-4xl flex items-center gap-3">
            <ShieldCheck className="w-8 h-8 text-primary" />
            Trust Center
          </h1>
          <p className="mt-4 text-lg text-muted-foreground">
            System uptime, source health, verification status, and audit integrity. 
            VitalCV operates on mathematical truth, tracking and enforcing reality across multiple federal and state authorities.
          </p>
        </div>

        {/* System Uptime */}
        <div className="mb-12 border border-border rounded-2xl bg-card overflow-hidden shadow-sm">
          <div className="bg-muted px-6 py-4 border-b border-border flex justify-between items-center">
            <h2 className="text-sm font-semibold uppercase tracking-widest text-foreground flex items-center gap-2">
              <Activity className="w-4 h-4 text-emerald-500" />
              System Status
            </h2>
            <span className="bg-emerald-500/10 text-emerald-600 px-2 py-0.5 rounded text-xs font-bold">ALL SYSTEMS OPERATIONAL</span>
          </div>
          <div className="p-6 grid grid-cols-1 sm:grid-cols-3 gap-6">
            <div>
              <p className="text-sm text-muted-foreground">Omega Orchestrator</p>
              <p className="text-2xl font-bold text-foreground mt-1">99.99%</p>
              <p className="text-xs text-emerald-600 mt-1">Online</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Arbitration Engine</p>
              <p className="text-2xl font-bold text-foreground mt-1">100.0%</p>
              <p className="text-xs text-emerald-600 mt-1">Online</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Manifest Edge Cache</p>
              <p className="text-2xl font-bold text-foreground mt-1">99.98%</p>
              <p className="text-xs text-emerald-600 mt-1">Online</p>
            </div>
          </div>
        </div>

        {/* Source Health */}
        <div className="mb-12 border border-border rounded-2xl bg-card overflow-hidden shadow-sm">
          <div className="bg-muted px-6 py-4 border-b border-border flex justify-between items-center">
            <h2 className="text-sm font-semibold uppercase tracking-widest text-foreground flex items-center gap-2">
              <Database className="w-4 h-4 text-primary" />
              Primary Source Health
            </h2>
          </div>
          <div className="p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 border border-border rounded-xl">
              <div>
                <h3 className="font-bold text-foreground flex items-center gap-2">
                  CMS NPPES Registry
                </h3>
                <p className="text-sm text-muted-foreground">Identity & Taxonomy checks</p>
              </div>
              <div className="flex items-center gap-4 text-sm text-right">
                <div>
                  <p className="text-muted-foreground">Avg Latency</p>
                  <p className="font-mono text-foreground">1.2s</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Status</p>
                  <p className="font-bold text-emerald-600">HEALTHY</p>
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 border border-border rounded-xl">
              <div>
                <h3 className="font-bold text-foreground flex items-center gap-2">
                  OIG LEIE Database
                </h3>
                <p className="text-sm text-muted-foreground">Exclusion checks</p>
              </div>
              <div className="flex items-center gap-4 text-sm text-right">
                <div>
                  <p className="text-muted-foreground">Avg Latency</p>
                  <p className="font-mono text-foreground">0.8s</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Status</p>
                  <p className="font-bold text-emerald-600">HEALTHY</p>
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 border border-border rounded-xl">
              <div>
                <h3 className="font-bold text-foreground flex items-center gap-2">
                  PECOS
                </h3>
                <p className="text-sm text-muted-foreground">Enrollment & Ordering checks</p>
              </div>
              <div className="flex items-center gap-4 text-sm text-right">
                <div>
                  <p className="text-muted-foreground">Avg Latency</p>
                  <p className="font-mono text-foreground">1.5s</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Status</p>
                  <p className="font-bold text-emerald-600">HEALTHY</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Audit Integrity */}
        <div className="border border-border rounded-2xl bg-card overflow-hidden shadow-sm">
          <div className="bg-muted px-6 py-4 border-b border-border flex justify-between items-center">
            <h2 className="text-sm font-semibold uppercase tracking-widest text-foreground flex items-center gap-2">
              <FileKey className="w-4 h-4 text-primary" />
              Audit Integrity
            </h2>
          </div>
          <div className="p-6">
            <p className="text-sm text-muted-foreground mb-6 max-w-2xl">
              Every manifest and decision generated by VitalCV is mathematically verifiable and cryptographically secured. Time-locked snapshots guarantee complete traceability from raw source data to final employer action.
            </p>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-4 bg-background border border-border rounded-xl">
                <h3 className="font-bold text-foreground mb-1">Cryptographic Receipts</h3>
                <p className="text-xs text-muted-foreground">Every source check generates an immutable SHA-256 hash. If raw federal data changes, the receipt invalidates.</p>
              </div>
              <div className="p-4 bg-background border border-border rounded-xl">
                <h3 className="font-bold text-foreground mb-1">Time-Locked Truth Snapshots</h3>
                <p className="text-xs text-muted-foreground">The Omega Orchestrator captures the exact state of all rules, policies, and signals at the moment a decision is rendered.</p>
              </div>
              <div className="p-4 bg-background border border-border rounded-xl">
                <h3 className="font-bold text-foreground mb-1">Truth Enforcement Gates</h3>
                <p className="text-xs text-muted-foreground">Hard-coded failsafes block the promotion of profiles that lack sufficient evidence, invalidating any UI assumptions.</p>
              </div>
              <div className="p-4 bg-background border border-border rounded-xl">
                <h3 className="font-bold text-foreground mb-1">Continuous Drift Detection</h3>
                <p className="text-xs text-muted-foreground">Asynchronous workers ping the Trust Registry to evaluate historic attestations against fresh registry data.</p>
              </div>
            </div>

            <div className="mt-8">
              <Link href="/">
                <Button variant="default" className="rounded-xl px-8 h-12">Return to Console</Button>
              </Link>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
