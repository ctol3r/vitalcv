'use client';

import { useSystemHealth, useSystemHealthReports, useSystemHealthScan, usePollingStatus, usePollTrigger } from '@/lib/hooks/useIntelligence';
import { motion } from 'framer-motion';
import { useState } from 'react';

export default function SystemHealthPage() {
  const { data: health, loading: healthLoading, refetch: refetchHealth } = useSystemHealth();
  const { data: reports } = useSystemHealthReports(10);
  const { data: polling, refetch: refetchPolling } = usePollingStatus();
  const { loading: scanning, post: runScan } = useSystemHealthScan();
  const { loading: triggering, post: triggerPoll } = usePollTrigger();
  const [scanResult, setScanResult] = useState<Record<string, unknown> | null>(null);

  const handleScan = async () => {
    const result = await runScan('/api/system-health/scan', {});
    setScanResult(result as Record<string, unknown> | null);
    refetchHealth();
  };

  const handleTriggerAll = async () => {
    await triggerPoll('/api/polling/trigger-all', {});
    refetchPolling();
  };

  return (
    <div className="min-h-screen bg-[#080e1a] text-white p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">System Health</h1>
            <p className="text-sm text-slate-400 mt-1">
              Detail agents, system integrity, and polling status
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleScan}
              disabled={scanning}
              className="px-4 py-2 text-sm bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 border border-blue-500/20 rounded-lg transition-colors disabled:opacity-50"
            >
              {scanning ? 'Scanning…' : 'Run Scan'}
            </button>
            <button
              onClick={handleTriggerAll}
              disabled={triggering}
              className="px-4 py-2 text-sm bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg transition-colors disabled:opacity-50"
            >
              {triggering ? 'Polling…' : 'Trigger Polls'}
            </button>
          </div>
        </div>

        {/* Health summary */}
        {health && (
          <div className="grid grid-cols-3 gap-4 mb-8">
            <div className="bg-white/5 border border-white/10 rounded-lg p-4">
              <p className="text-xs text-slate-500 uppercase tracking-wide">Issues Found</p>
              <p className={`text-3xl font-semibold mt-1 ${health.totalIssues > 0 ? 'text-yellow-400' : 'text-green-400'}`}>
                {health.totalIssues}
              </p>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-lg p-4">
              <p className="text-xs text-slate-500 uppercase tracking-wide">Auto-Repaired</p>
              <p className="text-3xl font-semibold mt-1 text-cyan-400">{health.totalAutoRepaired}</p>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-lg p-4">
              <p className="text-xs text-slate-500 uppercase tracking-wide">Surfaced</p>
              <p className={`text-3xl font-semibold mt-1 ${health.totalSurfaced > 0 ? 'text-orange-400' : 'text-green-400'}`}>
                {health.totalSurfaced}
              </p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-6">
          {/* Detail Agents */}
          <div>
            <h2 className="text-lg font-medium mb-4">Detail Agents</h2>
            {healthLoading && <p className="text-slate-400">Loading…</p>}
            <div className="space-y-3">
              {health?.agents.map((agent) => (
                <motion.div
                  key={agent.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="bg-white/[0.03] border border-white/10 rounded-lg p-4"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${agent.enabled ? 'bg-green-400' : 'bg-slate-600'}`} />
                      <span className="text-sm font-medium">{agent.name}</span>
                    </div>
                    <span className="text-xs text-slate-500">
                      {agent.lastIssueCount > 0 ? `${agent.lastIssueCount} issue(s)` : 'Clear'}
                    </span>
                  </div>
                  {agent.lastRun && (
                    <p className="text-xs text-slate-600 mt-1">
                      Last run: {new Date(agent.lastRun).toLocaleString()}
                    </p>
                  )}
                </motion.div>
              ))}
            </div>
          </div>

          {/* Polling Status */}
          <div>
            <h2 className="text-lg font-medium mb-4">Polling Sources</h2>
            <div className="space-y-2">
              {polling?.sources.map((source) => (
                <div
                  key={source.source}
                  className="bg-white/[0.03] border border-white/10 rounded-lg p-3 flex items-center justify-between"
                >
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${
                      source.isActive ? 'bg-blue-400 animate-pulse' :
                      source.isOverdue ? 'bg-yellow-400' :
                      source.enabled ? 'bg-green-400' : 'bg-slate-600'
                    }`} />
                    <span className="text-sm font-mono">{source.source}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-slate-500">{source.cadence}</span>
                    {source.isOverdue && (
                      <span className="text-xs text-yellow-400">overdue</span>
                    )}
                    {source.lastPoll && (
                      <span className="text-xs text-slate-600">
                        {new Date(source.lastPoll).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {polling && (
              <div className="mt-4 bg-white/5 border border-white/10 rounded-lg p-3">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-500">
                    Scheduler: {polling.running ? '🟢 Running' : '⚪ Stopped'}
                  </span>
                  <span className="text-slate-500">{polling.totalDiffs} total diffs</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Recent Reports */}
        {reports?.reports && (reports.reports as unknown[]).length > 0 && (
          <div className="mt-8">
            <h2 className="text-lg font-medium mb-4">Recent Reports</h2>
            <div className="space-y-2">
              {(reports.reports as Array<{
                agent: string; runAt: string; durationMs: number;
                issuesFound: number; autoRepaired: number; surfaced: number;
              }>).map((r, i) => (
                <div key={i} className="bg-white/[0.03] border border-white/10 rounded-lg p-3 flex items-center justify-between text-sm">
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-xs text-slate-400">{r.agent}</span>
                    <span className="text-xs text-slate-600">{new Date(r.runAt).toLocaleString()}</span>
                  </div>
                  <div className="flex items-center gap-3 text-xs">
                    <span className="text-slate-400">{r.issuesFound} found</span>
                    {r.autoRepaired > 0 && <span className="text-cyan-400">{r.autoRepaired} repaired</span>}
                    {r.surfaced > 0 && <span className="text-orange-400">{r.surfaced} surfaced</span>}
                    <span className="text-slate-600">{r.durationMs}ms</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Scan result */}
        {scanResult && (
          <div className="mt-6 bg-green-500/10 border border-green-500/20 rounded-lg p-4">
            <p className="text-sm text-green-400">Scan complete</p>
            <pre className="text-xs text-slate-400 mt-2 overflow-x-auto">
              {JSON.stringify(scanResult, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}
