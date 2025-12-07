'use client';

/**
 * AutopilotContext
 * React context for Autopilot Engine integration
 */

import { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { AutopilotEngine } from '@/lib/autopilot';
import {
  AutopilotStatus,
  type AutopilotIssue,
  type AutopilotConfig,
  type AutopilotHealthSummary,
  type AutopilotTask,
} from '@/lib/autopilot/types';

interface AutopilotContextValue {
  engine: AutopilotEngine | null;
  status: AutopilotStatus;
  lastRun: Date | null;
  pendingIssues: AutopilotIssue[];
  healthSummary: AutopilotHealthSummary | null;
  run: () => Promise<void>;
  registerTask: (task: AutopilotTask) => void;
  getMostImportantTask: () => AutopilotTask | null;
  clearIssues: () => void;
}

const AutopilotContext = createContext<AutopilotContextValue | null>(null);

export function AutopilotProvider({
  children,
  config,
}: {
  children: React.ReactNode;
  config?: Partial<AutopilotConfig>;
}) {
  const [engine] = useState<AutopilotEngine | null>(() => {
    const defaultConfig: AutopilotConfig = {
      enabled: true,
      trustCheckIntervalHours: 4,
      compactSyncIntervalHours: 24,
      quietModeEnabled: true,
      batterySaverMode: false,
      ...config,
    };
    return new AutopilotEngine(defaultConfig);
  });

  const [status, setStatus] = useState<AutopilotStatus>(AutopilotStatus.Idle);
  const [lastRun, setLastRun] = useState<Date | null>(null);
  const [pendingIssues, setPendingIssues] = useState<AutopilotIssue[]>([]);
  const [healthSummary, setHealthSummary] = useState<AutopilotHealthSummary | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // Subscribe to engine state changes
  useEffect(() => {
    if (!engine) return;

    const unsubscribeStatus = engine.onStatusChange((newStatus) => {
      setStatus(newStatus);
      setHealthSummary(engine.getHealthSummary());
    });

    const unsubscribeIssues = engine.onIssuesChange((issues) => {
      setPendingIssues(issues);
      setHealthSummary(engine.getHealthSummary());
    });

    // Initial health summary
    setHealthSummary(engine.getHealthSummary());
    setLastRun(engine.lastRun);

    // Auto-run check every 5 minutes
    intervalRef.current = setInterval(() => {
      if (engine.shouldRun()) {
        void engine.run();
      }
      setLastRun(engine.lastRun);
      setHealthSummary(engine.getHealthSummary());
    }, 5 * 60 * 1000);

    return () => {
      unsubscribeStatus();
      unsubscribeIssues();
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [engine]);

  const run = useCallback(async () => {
    if (!engine) return;
    await engine.run();
    setLastRun(engine.lastRun);
    setHealthSummary(engine.getHealthSummary());
  }, [engine]);

  const registerTask = useCallback(
    (task: AutopilotTask) => {
      if (!engine) return;
      engine.registerTask(task);
      setHealthSummary(engine.getHealthSummary());
    },
    [engine],
  );

  const getMostImportantTask = useCallback(() => {
    if (!engine) return null;
    return engine.getMostImportantTask();
  }, [engine]);

  const clearIssues = useCallback(() => {
    if (!engine) return;
    engine.clearIssues();
    setPendingIssues([]);
    setHealthSummary(engine.getHealthSummary());
  }, [engine]);

  return (
    <AutopilotContext.Provider
      value={{
        engine,
        status,
        lastRun,
        pendingIssues,
        healthSummary,
        run,
        registerTask,
        getMostImportantTask,
        clearIssues,
      }}
    >
      {children}
    </AutopilotContext.Provider>
  );
}

export function useAutopilot(): AutopilotContextValue {
  const context = useContext(AutopilotContext);
  if (!context) {
    throw new Error('useAutopilot must be used within AutopilotProvider');
  }
  return context;
}

