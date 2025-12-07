'use client';

/**
 * Desktop One-Page Autopilot View
 * Three-panel layout: Identity | Actions | Status
 */

import { AutopilotProvider, useAutopilot } from '@/contexts/AutopilotContext';
import { AutopilotStatus } from '@/lib/autopilot/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ShieldCheck, ShieldAlert, Timer, CheckCircle2, AlertCircle } from 'lucide-react';
import { useMemo, useEffect } from 'react';
import { getDefaultTasks } from '@/lib/autopilot/tasks';

function AutopilotViewContent() {
  const {
    status,
    lastRun,
    pendingIssues,
    healthSummary,
    run,
    getMostImportantTask,
    clearIssues,
    registerTask,
  } = useAutopilot();

  // Register default tasks on mount
  useEffect(() => {
    getDefaultTasks().forEach((task) => {
      registerTask(task);
    });
  }, [registerTask]);

  const mostImportantTask = getMostImportantTask();
  const hasCriticalIssues = pendingIssues.some((issue) => issue.isCritical);

  // Mock snapshot data - in production, this would come from LumenContext or API
  const snapshot = useMemo(
    () => ({
      hasCriticalIssues,
      trustScore: healthSummary?.confidence ?? 100,
      compliance: 85,
      credentials: [
        { id: '1', status: 'active' as const, expirationDate: '2026-12-31' },
        { id: '2', status: 'expiring' as const, expirationDate: '2025-12-15' },
        { id: '3', status: 'active' as const },
      ],
      chainAnchors: [
        { id: '1', status: 'active' as const, lastUpdated: new Date().toISOString() },
        { id: '2', status: 'stale' as const, lastUpdated: new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString() },
      ],
    }),
    [hasCriticalIssues, healthSummary],
  );

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Compliance Sky Overlay */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(16,185,129,0.1),transparent_70%)] pointer-events-none" />

      <div className="flex h-full">
        {/* Left Panel - Identity */}
        <div className="flex w-80 flex-col border-r border-white/10 bg-slate-900/50 p-6">
          <div className="mb-8 flex flex-col items-center">
            {/* Lumen Orb */}
            <div className="mb-4 h-32 w-32 rounded-full bg-gradient-to-br from-emerald-400 via-emerald-500 to-emerald-600 shadow-lg shadow-emerald-500/50 ring-4 ring-emerald-500/20" />
            <h2 className="text-xl font-semibold text-white">Vital Identity</h2>
          </div>

          <div className="space-y-4">
            {/* Trust Score */}
            <Card className="border-white/10 bg-slate-800/50">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-white/80">Trust Score</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-bold text-white">{snapshot.trustScore}</span>
                  <span className="text-sm text-white/60">/100</span>
                </div>
                <Progress value={snapshot.trustScore} className="mt-2 h-2" />
              </CardContent>
            </Card>

            {/* Telemedicine Readiness */}
            <Card className="border-white/10 bg-slate-800/50">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-white/80">Telemedicine</CardTitle>
              </CardHeader>
              <CardContent>
                <Badge className="bg-emerald-500/20 text-emerald-300">
                  <CheckCircle2 className="mr-1 h-3 w-3" />
                  Ready
                </Badge>
              </CardContent>
            </Card>

            {/* Compliance Climate */}
            <Card className="border-white/10 bg-slate-800/50">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-white/80">Compliance</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-bold text-white">{snapshot.compliance}%</span>
                </div>
                <Progress value={snapshot.compliance} className="mt-2 h-2" />
              </CardContent>
            </Card>
          </div>

          {lastRun && (
            <div className="mt-auto pt-4 text-xs text-white/60">
              Last run: {new Date(lastRun).toLocaleTimeString()}
            </div>
          )}
        </div>

        {/* Center Panel - Actions */}
        <div className="flex flex-1 flex-col items-center justify-center border-r border-white/10 bg-slate-900/30 p-8">
          {snapshot.hasCriticalIssues && mostImportantTask ? (
            <div className="flex max-w-md flex-col items-center space-y-6 text-center">
              <div className="rounded-full bg-amber-500/20 p-4">
                <AlertCircle className="h-12 w-12 text-amber-400" />
              </div>
              <div>
                <h3 className="mb-2 text-2xl font-semibold text-white">Fix This Issue</h3>
                <p className="mb-4 text-white/80">{mostImportantTask.description || mostImportantTask.name}</p>
                <Button
                  onClick={() => run()}
                  disabled={status === AutopilotStatus.Running}
                  size="lg"
                  className="bg-emerald-600 hover:bg-emerald-700"
                >
                  {status === AutopilotStatus.Running ? 'Running...' : 'Fix This One Thing'}
                </Button>
              </div>
            </div>
          ) : status === AutopilotStatus.Ready ? (
            <div className="flex max-w-md flex-col items-center space-y-6 text-center">
              <div className="rounded-full bg-emerald-500/20 p-4">
                <CheckCircle2 className="h-12 w-12 text-emerald-400" />
              </div>
              <div>
                <h3 className="mb-2 text-2xl font-semibold text-white">You're Ready</h3>
                <p className="text-white/80">All systems operational. No action needed.</p>
              </div>
            </div>
          ) : status === AutopilotStatus.AttentionNeeded ? (
            <div className="flex max-w-md flex-col items-center space-y-6 text-center">
              <div className="rounded-full bg-amber-500/20 p-4">
                <Timer className="h-12 w-12 text-amber-400" />
              </div>
              <div>
                <h3 className="mb-2 text-2xl font-semibold text-white">Attention Needed</h3>
                <p className="mb-4 text-white/80">
                  {pendingIssues.length} issue{pendingIssues.length !== 1 ? 's' : ''} detected
                </p>
                <Button onClick={() => run()} size="lg" variant="outline" className="border-white/20 text-white">
                  Review Issues
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex max-w-md flex-col items-center space-y-6 text-center">
              <div className="rounded-full bg-slate-700/50 p-4">
                <ShieldCheck className="h-12 w-12 text-white/60" />
              </div>
              <div>
                <h3 className="mb-2 text-2xl font-semibold text-white">Autopilot Idle</h3>
                <p className="mb-4 text-white/80">Click to start autopilot cycle</p>
                <Button onClick={() => run()} size="lg" variant="outline" className="border-white/20 text-white">
                  Start Autopilot
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Right Panel - Status */}
        <div className="flex w-80 flex-col border-l border-white/10 bg-slate-900/50 p-6">
          <h2 className="mb-6 text-xl font-semibold text-white">Status</h2>

          <div className="space-y-4">
            {/* Credentials */}
            <Card className="border-white/10 bg-slate-800/50">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-white/80">Credentials</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {snapshot.credentials.map((cred) => (
                  <div key={cred.id} className="flex items-center justify-between text-sm">
                    <span className="text-white/80">
                      {cred.status === 'active' && <ShieldCheck className="mr-1 inline h-3 w-3 text-emerald-400" />}
                      {cred.status === 'expiring' && <Timer className="mr-1 inline h-3 w-3 text-amber-400" />}
                      {cred.status === 'expired' && <ShieldAlert className="mr-1 inline h-3 w-3 text-red-400" />}
                      License {cred.id}
                    </span>
                    <Badge
                      variant={
                        cred.status === 'active'
                          ? 'default'
                          : cred.status === 'expiring'
                          ? 'secondary'
                          : 'destructive'
                      }
                      className="text-xs"
                    >
                      {cred.status}
                    </Badge>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Chain Anchors */}
            <Card className="border-white/10 bg-slate-800/50">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-white/80">Chain Anchors</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {snapshot.chainAnchors.map((anchor) => (
                  <div key={anchor.id} className="flex items-center justify-between text-sm">
                    <span className="text-white/80">
                      {anchor.status === 'active' && <ShieldCheck className="mr-1 inline h-3 w-3 text-emerald-400" />}
                      {anchor.status === 'stale' && <Timer className="mr-1 inline h-3 w-3 text-amber-400" />}
                      {anchor.status === 'missing' && <ShieldAlert className="mr-1 inline h-3 w-3 text-red-400" />}
                      Anchor {anchor.id}
                    </span>
                    <Badge
                      variant={
                        anchor.status === 'active'
                          ? 'default'
                          : anchor.status === 'stale'
                          ? 'secondary'
                          : 'destructive'
                      }
                      className="text-xs"
                    >
                      {anchor.status}
                    </Badge>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Compact Coverage */}
            <Card className="border-white/10 bg-slate-800/50">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-white/80">Compact Coverage</CardTitle>
              </CardHeader>
              <CardContent>
                <Badge className="bg-emerald-500/20 text-emerald-300">Active</Badge>
                <p className="mt-2 text-xs text-white/60">IMLC, NLC, PSYPACT</p>
              </CardContent>
            </Card>

            {/* Privileges */}
            <Card className="border-white/10 bg-slate-800/50">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-white/80">Privileges</CardTitle>
              </CardHeader>
              <CardContent>
                <Badge className="bg-emerald-500/20 text-emerald-300">Clear</Badge>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function DesktopOnePageView() {
  return (
    <AutopilotProvider>
      <AutopilotViewContent />
    </AutopilotProvider>
  );
}

