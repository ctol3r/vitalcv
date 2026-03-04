'use client';

/**
 * GuidancePanel.tsx — Wave 65: Clinician Guidance Panel
 *
 * Displays upcoming deadlines, recommended actions, required documents,
 * and regulatory contacts. Fetches from /api/clinician/guidance/:npi.
 */

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

// ── Types ─────────────────────────────────────────────────────────────────

interface GuidanceAction {
  priority: 'urgent' | 'high' | 'medium' | 'low';
  category: string;
  title: string;
  description: string;
  deadline?: string;
}

interface ExpirationAlert {
  credentialName: string;
  state?: string;
  expiresAt: string;
  daysUntilExpiry: number;
  severity: 'critical' | 'warning' | 'info';
}

interface RegulatoryContact {
  id: string;
  name: string;
  type: string;
  phone?: string;
  website: string;
}

interface GuidanceReport {
  nextActions: GuidanceAction[];
  expirationAlerts: ExpirationAlert[];
  missingCredentials: string[];
  recommendedLicenses: Array<{ state: string; reason: string }>;
  complianceScore: number;
}

interface GuidancePanelProps {
  npi: string;
  className?: string;
}

// ── Constants ─────────────────────────────────────────────────────────────

const PRIORITY_CFG: Record<string, { dot: string; text: string; bg: string }> = {
  urgent: { dot: 'bg-red-400', text: 'text-red-400', bg: 'bg-red-500/10 border-red-500/20' },
  high: { dot: 'bg-amber-400', text: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/20' },
  medium: { dot: 'bg-blue-400', text: 'text-blue-400', bg: 'bg-blue-500/10 border-blue-500/20' },
  low: { dot: 'bg-zinc-400', text: 'text-zinc-400', bg: 'bg-zinc-500/10 border-zinc-500/20' },
};

const SEVERITY_CFG: Record<string, { color: string; icon: string }> = {
  critical: { color: 'text-red-400', icon: '🔴' },
  warning: { color: 'text-amber-400', icon: '🟡' },
  info: { color: 'text-blue-400', icon: '🔵' },
};

// Demo data when API not available
function demoReport(): GuidanceReport {
  return {
    nextActions: [
      { priority: 'urgent', category: 'expiration', title: 'CA Medical License expires in 28 days', description: 'Begin renewal at mbc.ca.gov immediately.' },
      { priority: 'high', category: 'missing', title: 'Missing: ACLS Certification', description: 'Required for hospital privileges. Schedule course.' },
      { priority: 'medium', category: 'interstate', title: 'IMLC eligible: NV, AZ, UT', description: 'Your CA license qualifies for expedited interstate compact.' },
      { priority: 'low', category: 'compliance', title: 'CME hours due in 90 days', description: '15 of 25 required hours completed.' },
    ],
    expirationAlerts: [
      { credentialName: 'CA Medical License', state: 'CA', expiresAt: '2026-04-01T00:00:00Z', daysUntilExpiry: 28, severity: 'critical' },
      { credentialName: 'DEA Registration', expiresAt: '2026-08-15T00:00:00Z', daysUntilExpiry: 165, severity: 'info' },
    ],
    missingCredentials: ['ACLS Certification', 'Malpractice Insurance Certificate'],
    recommendedLicenses: [
      { state: 'NV', reason: 'IMLC compact — expedited from CA license' },
      { state: 'AZ', reason: 'IMLC compact — expedited from CA license' },
      { state: 'UT', reason: 'IMLC compact — expedited from CA license' },
    ],
    complianceScore: 72,
  };
}

// ── Component ─────────────────────────────────────────────────────────────

export function GuidancePanel({ npi, className = '' }: GuidancePanelProps) {
  const [report, setReport] = useState<GuidanceReport | null>(null);
  const [tab, setTab] = useState<'actions' | 'deadlines' | 'contacts'>('actions');

  const loadGuidance = useCallback(async () => {
    try {
      const res = await fetch(`/api/clinician/guidance/${npi}`);
      if (!res.ok) throw new Error('');
      setReport((await res.json()) as GuidanceReport);
    } catch {
      setReport(demoReport());
    }
  }, [npi]);

  useEffect(() => { loadGuidance(); }, [loadGuidance]);

  if (!report) return <div className={`animate-pulse bg-white/[0.03] rounded-xl h-64 ${className}`} />;

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.2, 0.8, 0.2, 1] }}
      className={`glass rounded-xl overflow-hidden ${className}`}>

      {/* Header with compliance score */}
      <div className="px-4 pt-4 pb-3 border-b border-white/[0.04] flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-zinc-200">Clinician Guidance</h3>
          <p className="text-[10px] text-zinc-500">{report.nextActions.length} action items</p>
        </div>
        <div className="text-center">
          <p className={`text-lg font-bold ${report.complianceScore >= 80 ? 'text-emerald-400' : report.complianceScore >= 60 ? 'text-amber-400' : 'text-red-400'}`}>
            {report.complianceScore}
          </p>
          <p className="text-[8px] text-zinc-600">Compliance</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-white/[0.04]">
        {(['actions', 'deadlines', 'contacts'] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`flex-1 py-2 text-[10px] font-medium transition-colors ${
              tab === t ? 'text-white border-b border-emerald-500' : 'text-zinc-500 hover:text-zinc-300'
            }`}>
            {t === 'actions' ? 'Actions' : t === 'deadlines' ? 'Deadlines' : 'Contacts'}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="p-4 max-h-[400px] overflow-y-auto">
        <AnimatePresence mode="wait">
          {tab === 'actions' && (
            <motion.div key="actions" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-2">
              {report.nextActions.map((action, i) => {
                const cfg = PRIORITY_CFG[action.priority] ?? PRIORITY_CFG.low;
                return (
                  <motion.div key={i} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className={`rounded-lg border p-3 ${cfg.bg}`}>
                    <div className="flex items-start gap-2">
                      <div className={`w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0 ${cfg.dot}`} />
                      <div>
                        <p className={`text-[11px] font-semibold ${cfg.text}`}>{action.title}</p>
                        <p className="text-[10px] text-zinc-500 mt-0.5">{action.description}</p>
                        {action.deadline && (
                          <p className="text-[9px] text-zinc-600 mt-1">Due: {new Date(action.deadline).toLocaleDateString()}</p>
                        )}
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </motion.div>
          )}

          {tab === 'deadlines' && (
            <motion.div key="deadlines" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-2">
              {report.expirationAlerts.map((alert, i) => {
                const sev = SEVERITY_CFG[alert.severity] ?? SEVERITY_CFG.info;
                return (
                  <div key={i} className="flex items-center gap-3 px-3 py-2 rounded-lg bg-white/[0.02]">
                    <span className="text-sm">{sev.icon}</span>
                    <div className="flex-1">
                      <p className={`text-[11px] font-medium ${sev.color}`}>{alert.credentialName}</p>
                      <p className="text-[9px] text-zinc-600">{alert.daysUntilExpiry} days remaining</p>
                    </div>
                    <span className="text-[9px] text-zinc-600">{new Date(alert.expiresAt).toLocaleDateString()}</span>
                  </div>
                );
              })}

              {report.missingCredentials.length > 0 && (
                <div className="mt-3">
                  <p className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1.5">Missing Credentials</p>
                  {report.missingCredentials.map((cred, i) => (
                    <div key={i} className="flex items-center gap-2 px-3 py-1.5 text-[11px] text-amber-400">
                      <span>⚠</span> {cred}
                    </div>
                  ))}
                </div>
              )}

              {report.recommendedLicenses.length > 0 && (
                <div className="mt-3">
                  <p className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1.5">Recommended Licenses</p>
                  {report.recommendedLicenses.map((lic, i) => (
                    <div key={i} className="flex items-center gap-2 px-3 py-1.5 text-[11px] text-blue-400">
                      <span>→</span> {lic.state}: {lic.reason}
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          )}

          {tab === 'contacts' && (
            <motion.div key="contacts" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-2">
              {[
                { name: 'Medical Board of California', type: 'State Board', phone: '(916) 263-2382', url: 'mbc.ca.gov' },
                { name: 'DEA Registration', type: 'Federal', phone: '(800) 882-9539', url: 'deadiversion.usdoj.gov' },
                { name: 'ABMS', type: 'Board', phone: '(312) 436-2600', url: 'abms.org' },
                { name: 'NPDB', type: 'Database', phone: '(800) 767-6732', url: 'npdb.hrsa.gov' },
              ].map((contact, i) => (
                <div key={i} className="px-3 py-2.5 rounded-lg bg-white/[0.02] hover:bg-white/[0.04] transition-colors">
                  <p className="text-[11px] font-medium text-zinc-300">{contact.name}</p>
                  <div className="flex items-center gap-3 mt-1">
                    <span className="text-[9px] text-zinc-600">{contact.type}</span>
                    {contact.phone && <span className="text-[9px] text-zinc-500">{contact.phone}</span>}
                    <a href={`https://${contact.url}`} target="_blank" rel="noopener noreferrer"
                      className="text-[9px] text-emerald-500 hover:text-emerald-400 ml-auto">{contact.url}</a>
                  </div>
                </div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

export default GuidancePanel;
