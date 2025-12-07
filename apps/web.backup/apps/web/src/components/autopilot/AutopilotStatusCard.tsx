'use client';

/**
 * Autopilot Status Card - One-Page Mode
 * Shows "You're Ready" or "Fix One Thing" based on autopilot status
 */

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, AlertCircle, Loader2, Sparkles, ArrowRight } from 'lucide-react';
import { getAutopilotStatus, getNextTasks, executeTask, type AutopilotStatus, type AutopilotTask } from '@/lib/autopilot/api';
import { useRouter } from 'next/navigation';

interface AutopilotStatusCardProps {
  npi: string;
  onTaskClick?: (task: AutopilotTask) => void;
}

export function AutopilotStatusCard({ npi, onTaskClick }: AutopilotStatusCardProps) {
  const [status, setStatus] = useState<AutopilotStatus | null>(null);
  const [nextTask, setNextTask] = useState<AutopilotTask | null>(null);
  const [loading, setLoading] = useState(true);
  const [executing, setExecuting] = useState(false);
  const router = useRouter();

  useEffect(() => {
    loadStatus();
  }, [npi]);

  const loadStatus = async () => {
    try {
      setLoading(true);
      const [statusData, tasksData] = await Promise.all([
        getAutopilotStatus(npi),
        getNextTasks(npi),
      ]);
      setStatus(statusData);
      // Get the highest priority task
      if (tasksData.tasks.length > 0) {
        setNextTask(tasksData.tasks[0]);
      }
    } catch (error) {
      console.error('Failed to load autopilot status:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleExecuteTask = async () => {
    if (!nextTask) return;

    try {
      setExecuting(true);
      await executeTask(nextTask.id, npi);
      // Reload status after execution
      await loadStatus();
    } catch (error) {
      console.error('Failed to execute task:', error);
    } finally {
      setExecuting(false);
    }
  };

  const handleTaskClick = () => {
    if (nextTask) {
      onTaskClick?.(nextTask);
      // Navigate to appropriate page based on task
      // This is a placeholder - adjust based on your routing
      router.push(`/documents?task=${nextTask.id}`);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-sm text-muted-foreground">Loading autopilot status...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!status) {
    return null;
  }

  const isReady = status.health.criticalIssues === 0 && status.health.expiredCredentials === 0;
  const trustScore = Math.round(status.health.trustScore * 100);

  if (isReady) {
    return (
      <Card className="border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950">
        <CardHeader>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
            <CardTitle className="text-green-900 dark:text-green-100">You're Ready</CardTitle>
          </div>
          <CardDescription className="text-green-700 dark:text-green-300">
            All credentials are up to date and verified
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-sm font-medium text-green-900 dark:text-green-100">
                Trust Score: {trustScore}%
              </p>
              <p className="text-xs text-green-700 dark:text-green-300">
                Last checked: {new Date(status.lastRun).toLocaleTimeString()}
              </p>
            </div>
            <Badge variant="outline" className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
              <Sparkles className="h-3 w-3 mr-1" />
              Ready
            </Badge>
          </div>
        </CardContent>
      </Card>
    );
  }

  // "Fix One Thing" mode
  return (
    <Card className="border-yellow-200 bg-yellow-50 dark:border-yellow-900 dark:bg-yellow-950">
      <CardHeader>
        <div className="flex items-center gap-2">
          <AlertCircle className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
          <CardTitle className="text-yellow-900 dark:text-yellow-100">Fix One Thing</CardTitle>
        </div>
        <CardDescription className="text-yellow-700 dark:text-yellow-300">
          {nextTask?.description || 'One action needed to improve your credential status'}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {nextTask && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-yellow-900 dark:text-yellow-100">
                {nextTask.name}
              </p>
              <Badge variant="outline" className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">
                Priority {nextTask.priority}
              </Badge>
            </div>
            <p className="text-xs text-yellow-700 dark:text-yellow-300">
              {nextTask.description}
            </p>
          </div>
        )}
        <div className="flex gap-2">
          <Button
            onClick={handleTaskClick}
            variant="outline"
            className="flex-1 border-yellow-300 text-yellow-900 hover:bg-yellow-100 dark:border-yellow-700 dark:text-yellow-100 dark:hover:bg-yellow-900"
          >
            View Details
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
          {nextTask && (
            <Button
              onClick={handleExecuteTask}
              disabled={executing}
              className="flex-1 bg-yellow-600 text-white hover:bg-yellow-700 dark:bg-yellow-700 dark:hover:bg-yellow-600"
            >
              {executing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Executing...
                </>
              ) : (
                <>
                  <Sparkles className="mr-2 h-4 w-4" />
                  Auto-Fix
                </>
              )}
            </Button>
          )}
        </div>
        <div className="text-xs text-yellow-700 dark:text-yellow-300">
          <p>Trust Score: {trustScore}%</p>
          <p>Critical Issues: {status.health.criticalIssues}</p>
        </div>
      </CardContent>
    </Card>
  );
}

