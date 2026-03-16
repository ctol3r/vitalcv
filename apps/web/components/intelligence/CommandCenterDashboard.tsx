'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { ShieldAlert, Activity, GitCommit, FileWarning, Search, Zap, CheckCircle, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export function CommandCenterDashboard() {
  return (
    <div className="min-h-screen bg-[#0D1117] text-[var(--vt-text-2)] font-sans p-6 overflow-hidden flex flex-col gap-6">
      
      {/* Top Header / Context */}
      <header className="flex items-center justify-between pb-4 border-b border-[var(--vt-border)]">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[var(--vt-text-1)] flex items-center gap-2">
            <Zap className="w-6 h-6 text-vt-info" />
            Watchtower Command Center
          </h1>
          <p className="text-sm text-[var(--vt-text-1)]0 font-mono mt-1">SYSTEM_STATUS: NOMINAL | INGESTION_RATE: 4.2k events/s</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-vt-success/10 border border-vt-success/20 rounded-md text-vt-success text-sm font-mono">
            <CheckCircle className="w-4 h-4" />
            GRAPH_SYNCED
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 bg-[var(--vt-surface-2)] border border-[var(--vt-border)] rounded-md text-[var(--vt-text-3)] text-sm font-mono">
            <Clock className="w-4 h-4" />
            {new Date().toISOString().split('T')[1].substring(0, 8)} UTC
          </div>
        </div>
      </header>

      {/* Main Grid Workspace */}
      <div className="grid grid-cols-12 gap-6 flex-1 min-h-0">
        
        {/* Left Column: Active Storylines */}
        <div className="col-span-3 flex flex-col gap-4 overflow-y-auto pr-2 custom-scrollbar">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold tracking-widest text-[var(--vt-text-3)] uppercase">Active Storylines</h2>
            <span className="text-xs bg-[var(--vt-surface-2)] px-2 py-0.5 rounded-full">12 Live</span>
          </div>
          
          {[
            { id: 'ST-8991', title: 'Dr. R. Vance Anomaly', desc: 'Sudden spike in Medicare billing linked to Facility Y.', severity: 'high' },
            { id: 'ST-8992', title: 'Credential Expiry Ring', desc: '3 providers at Mercy General missing valid DEA licenses.', severity: 'medium' },
            { id: 'ST-8993', title: 'Unusual Referral Loop', desc: 'Closed network of referrals detected between 4 cardiologists.', severity: 'high' }
          ].map((story) => (
            <motion.div 
              key={story.id} 
              whileHover={{ scale: 1.01 }}
              className={cn(
                "p-4 rounded-xl border-l-[3px] bg-[var(--vt-surface-2)] border-y border-r border-[var(--vt-border)] backdrop-blur-md cursor-pointer transition-colors hover:bg-[var(--vt-surface-2)]",
                story.severity === 'high' ? 'border-l-vt-destructive' : 'border-l-vt-warning'
              )}
            >
              <div className="text-xs font-mono text-[var(--vt-text-1)]0 mb-1">{story.id}</div>
              <h3 className="font-semibold text-[var(--vt-text-1)] text-sm mb-1">{story.title}</h3>
              <p className="text-xs text-[var(--vt-text-3)] leading-relaxed">{story.desc}</p>
            </motion.div>
          ))}
        </div>

        {/* Center Column: Top Findings & Recommended Actions */}
        <div className="col-span-6 flex flex-col gap-6">
          <div className="grid grid-cols-2 gap-4">
             {/* Top Findings */}
            <Card className="bg-gradient-to-br from-vt-destructive/20 to-transparent border-vt-destructive/30">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-bold tracking-widest text-vt-destructive uppercase flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4" /> Critical Findings
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-4xl font-mono text-[var(--vt-text-1)] mb-2">3</div>
                <p className="text-sm text-[var(--vt-text-3)]">Providers flagged for peer-review discrepancies in the last hour.</p>
              </CardContent>
            </Card>

             <Card className="bg-gradient-to-br from-vt-info/20 to-transparent border-vt-info/30">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-bold tracking-widest text-vt-info uppercase flex items-center gap-2">
                  <GitCommit className="w-4 h-4" /> Graph Updates
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-4xl font-mono text-[var(--vt-text-1)] mb-2">1,402</div>
                <p className="text-sm text-[var(--vt-text-3)]">New edges formed regarding clinical trial collaborations.</p>
              </CardContent>
            </Card>
          </div>

          <div className="flex-1 bg-[var(--vt-surface-2)] border border-[var(--vt-border)] rounded-xl p-6 backdrop-blur-sm flex flex-col">
            <h2 className="text-sm font-bold tracking-widest text-[var(--vt-text-3)] uppercase mb-4">Recommended Actions</h2>
            <div className="space-y-3">
              {[
                { action: 'Request Audit Proof', context: 'Dr. Vance missing primary source verification for state license.', type: 'alert' },
                { action: 'Suspend Auto-Verification', context: 'High volume of mismatched NPI records from National Registry.', type: 'warning' },
                { action: 'Generate Investigation Dossier', context: 'Compile findings for the Mercy General credentialring ring.', type: 'info' }
              ].map((rec, i) => (
                <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-[var(--vt-surface)] border border-[var(--vt-border-2)] hover:border-[var(--vt-border)] transition-all group">
                  <div>
                    <div className="text-sm font-medium text-[var(--vt-text-1)] group-hover:text-vt-info transition-colors">{rec.action}</div>
                    <div className="text-xs text-[var(--vt-text-1)]0 mt-0.5">{rec.context}</div>
                  </div>
                  <button className="px-3 py-1.5 bg-[var(--vt-surface-2)] hover:bg-white/20 text-[var(--vt-text-1)] rounded-md text-xs font-semibold uppercase tracking-wide transition-colors">
                    Execute
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column: System Health & Recent */}
        <div className="col-span-3 flex flex-col gap-6">
          <Card className="bg-[#0a0a0f] border-[var(--vt-border)]">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-bold tracking-widest text-[var(--vt-text-3)] uppercase flex items-center gap-2">
                <Activity className="w-4 h-4" /> System Health
              </CardTitle>
            </CardHeader>
            <CardContent className="font-mono text-xs space-y-3">
              <div className="flex justify-between">
                <span className="text-[var(--vt-text-1)]0">Ingestion Latency</span>
                <span className="text-vt-success">14ms</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--vt-text-1)]0">Graph Compute</span>
                <span className="text-vt-success">42ms</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--vt-text-1)]0">Resolver Workers</span>
                <span className="text-[var(--vt-text-1)]">8/12 ACTIVE</span>
              </div>
              <div className="h-1 bg-[var(--vt-surface-2)] rounded-full mt-2 overflow-hidden">
                <div className="h-full bg-vt-success w-[66%] shadow-[0_0_10px_rgba(0,230,118,0.5)]" />
              </div>
            </CardContent>
          </Card>

          <div className="flex-1 bg-[#0a0a0f] border border-[var(--vt-border)] rounded-xl p-4 flex flex-col">
            <h2 className="text-sm font-bold tracking-widest text-[var(--vt-text-3)] uppercase mb-4 flex items-center gap-2">
              <Search className="w-4 h-4" /> Recent Investigations
            </h2>
            <div className="space-y-2 flex-1 overflow-y-auto">
              {[
                { id: 'PRV-1092', label: 'Dr. Sarah Jenkins' },
                { id: 'FAC-0041', label: 'Mercy General Hospital' },
                { id: 'TXT-9921', label: 'Payment Query #44' },
                { id: 'PRV-8812', label: 'Dr. Marcus Webb' }
              ].map((inv) => (
                <div key={inv.id} className="text-sm flex items-center gap-3 p-2 rounded hover:bg-[var(--vt-surface-2)] cursor-pointer text-[var(--vt-text-2)]">
                  <span className="font-mono text-xs text-[var(--vt-text-1)]0">{inv.id}</span>
                  <span className="truncate">{inv.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
