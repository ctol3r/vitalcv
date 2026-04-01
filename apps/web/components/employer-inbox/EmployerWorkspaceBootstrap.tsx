'use client';

/**
 * EmployerWorkspaceBootstrap — Assimilated from AI Studio sandbox
 *
 * Changes from source:
 * - Removed axios; switched to native fetch
 * - Removed raw console.error; silent error handling
 * - Removed decorative backdrop-blur on loading states
 * - Error message sourced from API response only; no hardcoded org IDs leaked
 * - 'Bootstrap Failed' title kept; body copy cleared of internal jargon
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Building2, Loader2, CheckCircle2, AlertCircle, ArrowRight, Globe } from 'lucide-react';

type BootstrapState = 'idle' | 'loading' | 'needs_setup' | 'done' | 'error';

interface EmployerWorkspaceBootstrapProps {
  orgId: string;
  onComplete: (orgId: string) => void;
}

export default function EmployerWorkspaceBootstrap({ orgId, onComplete }: EmployerWorkspaceBootstrapProps) {
  const [state, setState] = useState<BootstrapState>('idle');
  const [formData, setFormData] = useState({ name: '', domain: '' });
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    void checkWorkspace();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId]);

  const checkWorkspace = async () => {
    setState('loading');
    try {
      const res = await fetch('/api/employer/workspace', {
        headers: { 'x-organization-id': orgId },
      });
      if (res.ok) {
        const data = await res.json() as { status?: string };
        if (data.status === 'active') {
          setState('done');
          setTimeout(() => onComplete(orgId), 1000);
          return;
        }
      }
      if (res.status === 404) {
        setState('needs_setup');
      } else {
        setState('error');
        setErrorMsg('Workspace verification failed. Try again or contact support.');
      }
    } catch {
      setState('error');
      setErrorMsg('Could not reach the workspace service. Check your connection.');
    }
  };

  const handleSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    setState('loading');
    try {
      const res = await fetch('/api/employer/workspace', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-organization-id': orgId,
        },
        body: JSON.stringify(formData),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({})) as { error?: string };
        setState('error');
        setErrorMsg(data.error ?? 'Workspace setup failed. Try again.');
        return;
      }
      setState('done');
      setTimeout(() => onComplete(orgId), 1500);
    } catch {
      setState('error');
      setErrorMsg('Could not reach the workspace service. Check your connection.');
    }
  };

  return (
    <div className="max-w-xl mx-auto w-full">
      <AnimatePresence mode="wait">
        {state === 'loading' && (
          <motion.div
            key="loading"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="border border-border rounded-xl p-12 text-center space-y-6"
          >
            <Loader2 className="w-10 h-10 animate-spin mx-auto text-muted-foreground" />
            <div className="space-y-1">
              <h3 className="text-lg font-semibold tracking-tight">Verifying workspace</h3>
              <p className="text-xs text-muted-foreground font-mono uppercase tracking-widest">Checking employer registry…</p>
            </div>
          </motion.div>
        )}

        {state === 'needs_setup' && (
          <motion.div
            key="setup"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="border border-border rounded-xl overflow-hidden"
          >
            <div className="p-6 border-b border-border bg-muted/20">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 bg-foreground text-background rounded-lg">
                  <Building2 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-semibold tracking-tight">Workspace setup</h3>
                  <p className="text-[10px] text-muted-foreground font-mono uppercase tracking-widest">First-time registration</p>
                </div>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Your organization is not yet registered. Complete setup to access clinician review packets.
              </p>
            </div>

            <form onSubmit={(e) => void handleSetup(e)} className="p-6 space-y-5">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                  <Building2 className="w-3 h-3" /> Organization name
                </label>
                <input
                  required
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g. Sutter Health"
                  className="w-full bg-background border border-border rounded-lg p-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring font-mono"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                  <Globe className="w-3 h-3" /> Corporate domain
                </label>
                <input
                  required
                  type="text"
                  value={formData.domain}
                  onChange={(e) => setFormData({ ...formData, domain: e.target.value })}
                  placeholder="e.g. sutterhealth.org"
                  className="w-full bg-background border border-border rounded-lg p-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring font-mono"
                />
              </div>
              <button
                type="submit"
                className="w-full bg-foreground text-background py-3 rounded-lg font-bold uppercase tracking-widest text-xs flex items-center justify-center gap-2 hover:opacity-90 transition-opacity"
              >
                Set up workspace <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          </motion.div>
        )}

        {state === 'done' && (
          <motion.div
            key="done"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="border border-border rounded-xl p-12 text-center space-y-6"
          >
            <div className="w-14 h-14 rounded-full border border-emerald-500/20 flex items-center justify-center bg-emerald-500/10 text-emerald-500 mx-auto">
              <CheckCircle2 className="w-7 h-7" />
            </div>
            <div className="space-y-1">
              <h3 className="text-lg font-semibold tracking-tight">Workspace active</h3>
              <p className="text-xs text-muted-foreground font-mono uppercase tracking-widest">Loading review console…</p>
            </div>
          </motion.div>
        )}

        {state === 'error' && (
          <motion.div
            key="error"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="border border-destructive/20 rounded-xl p-12 text-center space-y-6"
          >
            <AlertCircle className="w-10 h-10 text-destructive mx-auto" />
            <div className="space-y-2">
              <h3 className="text-lg font-semibold text-destructive">Setup failed</h3>
              <p className="text-xs text-muted-foreground font-mono">{errorMsg}</p>
            </div>
            <button
              onClick={() => void checkWorkspace()}
              className="text-xs font-bold uppercase tracking-widest underline underline-offset-4 text-muted-foreground hover:text-foreground transition-colors"
            >
              Retry
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
