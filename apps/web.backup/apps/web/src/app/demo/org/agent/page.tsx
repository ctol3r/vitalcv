'use client';

import { useCallback, useMemo, useState } from 'react';
import { DemoHeader } from '@/apps/web/src/components/layout/DemoHeader';
import { RemediationActions } from '@/apps/web/src/components/agent/RemediationActions';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import {
  Activity,
  AlertTriangle,
  Bot,
  CheckCircle2,
  Play,
  ShieldCheck,
  Terminal,
  Zap,
} from 'lucide-react';

type AgentState = 'ready' | 'running' | 'paused';

type AgentLogLevel = 'info' | 'success' | 'warning' | 'error';

type AgentLogEntry = {
  id: string;
  level: AgentLogLevel;
  message: string;
  timestamp: string;
};

type AgentTask = {
  label: string;
  description: string;
  eta: string;
  owner: string;
  blockers: number;
};

type AgentActivity = {
  id: string;
  title: string;
  summary: string;
  phase: 'licensure' | 'quality' | 'enrollment' | 'compliance';
  status: 'completed' | 'warning' | 'failed';
  timestamp: string;
  evidenceCount: number;
};

const STATE_COPY: Record<AgentState, { label: string; badgeClass: string; description: string }> = {
  ready: {
    label: 'Ready',
    badgeClass: 'bg-emerald-500/15 text-emerald-600 border border-emerald-500/40',
    description: 'Agent is idle and monitoring credentialing signals.',
  },
  running: {
    label: 'Running',
    badgeClass: 'bg-primary/15 text-primary border border-primary/40 animate-pulse',
    description: 'Workflows are executing; logs stream in real time.',
  },
  paused: {
    label: 'Paused',
    badgeClass: 'bg-amber-100 text-amber-700 border border-amber-400',
    description: 'Agent is standing by for reviewer input.',
  },
};

const DEFAULT_LOGS: AgentLogEntry[] = [
  {
    id: 'log-1',
    level: 'success',
    message: 'PECOS evidence bundle published to timeline with 4 attachments.',
    timestamp: new Date(Date.now() - 1000 * 60 * 7).toISOString(),
  },
  {
    id: 'log-2',
    level: 'info',
    message: 'Auto-PSV cache warmed. 5 state boards reachable (avg 3.1s).',
    timestamp: new Date(Date.now() - 1000 * 60 * 12).toISOString(),
  },
  {
    id: 'log-3',
    level: 'warning',
    message: 'CAQH attestation stale (93 days). Agent queued remediation task.',
    timestamp: new Date(Date.now() - 1000 * 60 * 18).toISOString(),
  },
];

const DEFAULT_TASK: AgentTask = {
  label: 'Monitor CAQH attestation freshness',
  description: 'Watching CAQH payloads and syncing DEA training certificates before next payer pull.',
  eta: 'Next 15 min',
  owner: 'Credentialing Agent',
  blockers: 0,
};

const DEFAULT_ACTIVITIES: AgentActivity[] = [
  {
    id: 'act-1',
    title: 'Auto-PSV sweep',
    summary: 'Verified 5 active licenses, 1 expiring in 27 days.',
    phase: 'licensure',
    status: 'completed',
    timestamp: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
    evidenceCount: 6,
  },
  {
    id: 'act-2',
    title: 'Compliance drift review',
    summary: 'Filed drift ticket DR-2025-11-A with PECOS deltas.',
    phase: 'compliance',
    status: 'warning',
    timestamp: new Date(Date.now() - 1000 * 60 * 65).toISOString(),
    evidenceCount: 3,
  },
  {
    id: 'act-3',
    title: 'Payer revalidation cross-check',
    summary: 'Aligned Humana + UHC revalidation windows; no blockers.',
    phase: 'enrollment',
    status: 'completed',
    timestamp: new Date(Date.now() - 1000 * 60 * 120).toISOString(),
    evidenceCount: 2,
  },
];

const LOG_LEVEL_COLORS: Record<AgentLogLevel, string> = {
  info: 'text-slate-500 border-slate-200',
  success: 'text-emerald-600 border-emerald-200',
  warning: 'text-amber-600 border-amber-200',
  error: 'text-rose-600 border-rose-200',
};

function formatRelative(timestamp: string) {
  const now = Date.now();
  const diffMs = now - new Date(timestamp).getTime();
  const minutes = Math.floor(diffMs / (1000 * 60));
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export default function OrgAgentConsolePage() {
  const [agentState, setAgentState] = useState<AgentState>('ready');
  const [progress, setProgress] = useState(62);
  const [currentTask, setCurrentTask] = useState<AgentTask>(DEFAULT_TASK);
  const [logs, setLogs] = useState<AgentLogEntry[]>(DEFAULT_LOGS);
  const [activities, setActivities] = useState<AgentActivity[]>(DEFAULT_ACTIVITIES);

  const stateCopy = STATE_COPY[agentState];

  const addLog = useCallback((entry: Omit<AgentLogEntry, 'id'>) => {
    setLogs((prev) => [{ id: `log-${Date.now()}`, ...entry }, ...prev].slice(0, 25));
  }, []);

  const prependActivity = useCallback((activity: Omit<AgentActivity, 'id' | 'timestamp'> & { timestamp?: string }) => {
    setActivities((prev) => [{ id: `act-${Date.now()}`, timestamp: activity.timestamp ?? new Date().toISOString(), ...activity }, ...prev].slice(0, 6));
  }, []);

  const runWorkflow = useCallback(
    async (mode: 'autoPsv' | 'compliance') => {
      if (agentState === 'running') return;
      setAgentState('running');
      setProgress(12);
      setCurrentTask({
        label: mode === 'autoPsv' ? 'Auto-PSV sweep in progress' : 'Compliance cross-check running',
        description:
          mode === 'autoPsv'
            ? 'Querying state boards, NPDB cache, and PECOS drift before stamping timeline.'
            : 'Comparing payer rosters, sanctions, and PECOS data for compliance gaps.',
        eta: '90 seconds',
        owner: 'Credentialing Agent',
        blockers: 0,
      });

      addLog({
        level: 'info',
        message: `${mode === 'autoPsv' ? 'Auto-PSV' : 'Compliance review'} kicked off at ${new Date().toLocaleTimeString()}.`,
        timestamp: new Date().toISOString(),
      });

      await wait(600);
      setProgress(54);
      addLog({
        level: 'info',
        message: 'Evidence retrieved; drafting immutable timeline event.',
        timestamp: new Date().toISOString(),
      });

      await wait(600);
      setProgress(100);
      addLog({
        level: mode === 'autoPsv' ? 'success' : 'warning',
        message:
          mode === 'autoPsv'
            ? 'Auto-PSV artifacts saved with 6 references.'
            : 'Compliance drift flagged; remediation queued automatically.',
        timestamp: new Date().toISOString(),
      });

      prependActivity({
        title: mode === 'autoPsv' ? 'Auto-PSV sweep' : 'Stacked compliance check',
        summary:
          mode === 'autoPsv'
            ? '5 licenses verified, 1 warning pushed to remediation queue.'
            : 'Compared PECOS, CAQH, NPDB for sanctions; 1 warning created.',
        phase: mode === 'autoPsv' ? 'licensure' : 'compliance',
        status: mode === 'autoPsv' ? 'completed' : 'warning',
        evidenceCount: mode === 'autoPsv' ? 6 : 3,
      });

      setAgentState('ready');
      setProgress(68);
      setCurrentTask(DEFAULT_TASK);
    },
    [addLog, agentState, prependActivity]
  );

  const handleRemediationLaunch = useCallback(
    (actionTitle: string) => {
      addLog({
        level: 'info',
        message: `${actionTitle} workflow dispatched; awaiting confirmation from source system.`,
        timestamp: new Date().toISOString(),
      });
    },
    [addLog]
  );

  const vitals = useMemo(
    () => [
      { label: 'Active playbooks', value: '4', hint: 'Auto-PSV, PECOS, Remediation, Drift watch' },
      { label: 'Artifacts today', value: '18', hint: 'PDF + JSON bundles posted' },
      { label: 'Escalations', value: '0', hint: 'No analyst intervention required' },
    ],
    []
  );

  return (
    <div className="container mx-auto max-w-6xl space-y-6 py-8">
      <DemoHeader
        title="Credentialing Agent Console"
        description="Real-time view of the autonomous agent that keeps licenses, PECOS, and payer evidence synchronized for the org."
      />

      <div className="grid gap-6 lg:grid-cols-[2fr,1fr]">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bot className="h-5 w-5" aria-hidden="true" />
                Agent status
              </CardTitle>
              <CardDescription>Control Auto-PSV and compliance playbooks.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <Badge className={cn('text-xs uppercase tracking-wide', stateCopy.badgeClass)}>{stateCopy.label}</Badge>
                <div className="flex flex-wrap gap-3">
                  <Button size="sm" onClick={() => runWorkflow('autoPsv')} disabled={agentState === 'running'}>
                    <Play className="mr-2 h-4 w-4" /> Run Auto-PSV Now
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => runWorkflow('compliance')}
                    disabled={agentState === 'running'}
                  >
                    <ShieldCheck className="mr-2 h-4 w-4" /> Run Compliance Check
                  </Button>
                </div>
              </div>
              <p className="text-sm text-muted-foreground">{stateCopy.description}</p>
              <Separator />
              <dl className="grid gap-4 text-sm sm:grid-cols-3" aria-label="Agent vitals">
                {vitals.map((vital) => (
                  <div key={vital.label}>
                    <dt className="text-muted-foreground">{vital.label}</dt>
                    <dd className="text-lg font-semibold">{vital.value}</dd>
                    <p className="text-xs text-muted-foreground">{vital.hint}</p>
                  </div>
                ))}
              </dl>
            </CardContent>
          </Card>

          <Card aria-live="polite">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5" aria-hidden="true" />
                Current task
              </CardTitle>
              <CardDescription>Shows what the agent is doing right now.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-lg border bg-muted/40 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Now executing</p>
                    <h3 className="text-lg font-semibold">{currentTask.label}</h3>
                  </div>
                  <Badge variant="outline" className="text-xs">
                    ETA {currentTask.eta}
                  </Badge>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">{currentTask.description}</p>
                <dl className="mt-4 grid gap-4 text-sm sm:grid-cols-2">
                  <div>
                    <dt className="text-muted-foreground">Owner</dt>
                    <dd className="font-medium">{currentTask.owner}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Blocking issues</dt>
                    <dd className="font-medium">{currentTask.blockers === 0 ? 'None' : currentTask.blockers}</dd>
                  </div>
                </dl>
                <div className="mt-4">
                  <Progress value={progress} aria-label="Current task progress" />
                  <p className="mt-2 text-right text-xs text-muted-foreground">{progress}% complete</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <RemediationActions onActionLaunched={(action) => handleRemediationLaunch(action.title)} />
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Terminal className="h-5 w-5" aria-hidden="true" />
                Agent log
              </CardTitle>
              <CardDescription>Last 25 entries streamed from the agent sandbox.</CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[320px] pr-4" type="auto">
                <ul className="space-y-3">
                  {logs.map((log) => (
                    <li key={log.id} className="flex items-start gap-3 text-sm">
                      <span className="font-mono text-xs text-muted-foreground w-28">
                        {new Date(log.timestamp).toLocaleTimeString()}
                      </span>
                      <span className={cn('rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wide', LOG_LEVEL_COLORS[log.level])}>
                        {log.level}
                      </span>
                      <p className="flex-1">{log.message}</p>
                    </li>
                  ))}
                </ul>
              </ScrollArea>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="h-5 w-5" aria-hidden="true" />
                Latest agent actions
              </CardTitle>
              <CardDescription>Every workflow writes a timeline event with evidence links.</CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-4">
                {activities.map((activity) => (
                  <li key={activity.id} className="flex gap-3">
                    <div className="mt-1 h-10 w-10 rounded-full bg-primary/10 text-primary flex items-center justify-center">
                      <CheckCircle2 className="h-5 w-5" aria-hidden="true" />
                    </div>
                    <div className="flex-1">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <p className="text-sm font-semibold">{activity.title}</p>
                          <p className="text-sm text-muted-foreground">{activity.summary}</p>
                        </div>
                        <span className="text-xs text-muted-foreground">{formatRelative(activity.timestamp)}</span>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground">
                        <Badge variant="outline" className="capitalize">
                          {activity.phase}
                        </Badge>
                        <Badge variant="secondary">{activity.evidenceCount} evidence refs</Badge>
                        {activity.status === 'warning' && (
                          <Badge variant="outline" className="text-amber-600 border-amber-400">
                            <AlertTriangle className="mr-1 h-3 w-3" /> Needs review
                          </Badge>
                        )}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
