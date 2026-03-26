'use client';

import { Loader2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { mutate } from 'swr';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { mutateMatchingIntelligenceResources, mutateIntelligenceResource } from '@/hooks/useIntelligenceResource';

type ButtonSpec = {
  label: string;
  action: string;
  previewStatus: string;
};

function MutationButtonRow({
  buttons,
  pendingAction,
  status,
  compact,
  onRun,
}: {
  buttons: ButtonSpec[];
  pendingAction: string | null;
  status: string;
  compact?: boolean;
  onRun: (button: ButtonSpec) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {buttons.map((button) => {
        const active = status.toLowerCase() === button.previewStatus.toLowerCase();
        return (
          <button
            key={button.action}
            type="button"
            disabled={Boolean(pendingAction)}
            onClick={() => onRun(button)}
            className={cn(
              'rounded-full border px-3 py-1.5 font-medium transition',
              compact ? 'text-xs' : 'text-sm',
              active
                ? 'border-cyan-400/30 bg-cyan-400/10 text-[var(--vt-accent)]'
                : 'border-[var(--vt-border)] bg-[var(--vt-surface-2)] text-[var(--vt-text-2)] hover:bg-[var(--vt-surface-2)] hover:text-[var(--vt-text-1)]',
              pendingAction === button.action ? 'animate-pulse' : '',
            )}
          >
            {pendingAction === button.action ? (
              <span className="inline-flex items-center gap-1.5">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Saving
              </span>
            ) : button.label}
          </button>
        );
      })}
    </div>
  );
}

function revalidateKeys(predicate: (key: string) => boolean) {
  void mutate((key) => typeof key === 'string' && predicate(key));
}

function MutationFailure({
  message,
  onRetry,
}: {
  message: string | null;
  onRetry: (() => void) | null;
}) {
  if (!message) {
    return null;
  }

  return (
    <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-red-200">
      <span>{message}</span>
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="rounded-full border border-red-400/30 bg-red-500/10 px-2.5 py-1 font-medium transition hover:bg-red-500/20"
        >
          Retry
        </button>
      ) : null}
    </div>
  );
}

export function FindingMutationControls({
  findingId,
  status,
  compact,
  onStatusChange,
}: {
  findingId: string;
  status: string;
  compact?: boolean;
  onStatusChange?: (status: string) => void;
}) {
  const [currentStatus, setCurrentStatus] = useState(status);
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [retryButton, setRetryButton] = useState<ButtonSpec | null>(null);

  useEffect(() => {
    setCurrentStatus(status);
  }, [status]);

  const buttons = useMemo<ButtonSpec[]>(() => [
    { label: 'New', action: 'new', previewStatus: 'new' },
    { label: 'Acknowledged', action: 'acknowledged', previewStatus: 'acknowledged' },
    { label: 'Investigating', action: 'investigating', previewStatus: 'investigating' },
    { label: 'Resolved', action: 'resolved', previewStatus: 'resolved' },
    { label: 'Dismissed', action: 'dismissed', previewStatus: 'dismissed' },
  ], []);

  async function run(button: ButtonSpec) {
    const previousStatus = currentStatus;
    setPendingAction(button.action);
    setFailure(null);
    setRetryButton(button);
    setCurrentStatus(button.previewStatus);

    try {
      mutateIntelligenceResource(`/api/intelligence/findings/${findingId}`, (current: unknown) => {
        if (!current || typeof current !== 'object' || !('finding' in current)) {
          return current;
        }

        return {
          ...(current as Record<string, unknown>),
          finding: {
            ...((current as { finding: Record<string, unknown> }).finding),
            status: button.previewStatus,
            updatedAt: new Date().toISOString(),
          },
        };
      });
      mutateMatchingIntelligenceResources(
        (url) => url.startsWith('/api/intelligence/findings'),
        (current, url) => {
          if (!current || typeof current !== 'object' || !('findings' in current)) {
            return current;
          }

          const filterValue = new URLSearchParams(url.split('?')[1] ?? '').get('status');
          const updatedItems = ((current as { findings: Array<Record<string, unknown>> }).findings ?? []).map((item) => (
            item.id === findingId
              ? { ...item, status: button.previewStatus, updatedAt: new Date().toISOString() }
              : item
          ));

          return {
            ...(current as Record<string, unknown>),
            findings: filterValue
              ? updatedItems.filter((item) => String(item.status).toLowerCase() === filterValue.toLowerCase())
              : updatedItems,
          };
        },
      );

      const response = await fetch(`/api/findings/${encodeURIComponent(findingId)}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: button.previewStatus }),
      });
      const payload = await response.json().catch(() => ({})) as { error?: string; finding?: { findingId: string; status: string; updatedAt?: string } };
      if (!response.ok || !payload.finding) {
        throw new Error(payload.error ?? `Failed to update finding status`);
      }

      const nextStatus = payload.finding.status;
      setCurrentStatus(nextStatus);
      onStatusChange?.(nextStatus);
      mutateIntelligenceResource(`/api/intelligence/findings/${findingId}`, (current: unknown) => {
        if (!current || typeof current !== 'object' || !('finding' in current)) {
          return current;
        }

        return {
          ...(current as Record<string, unknown>),
          finding: {
            ...((current as { finding: Record<string, unknown> }).finding),
            status: nextStatus,
            updatedAt: payload.finding?.updatedAt ?? new Date().toISOString(),
          },
        };
      });
      mutateMatchingIntelligenceResources(
        (url) => url.startsWith('/api/intelligence/findings'),
        (current, url) => {
          if (!current || typeof current !== 'object' || !('findings' in current)) {
            return current;
          }

          const filterValue = new URLSearchParams(url.split('?')[1] ?? '').get('status');
          const updatedItems = ((current as { findings: Array<Record<string, unknown>> }).findings ?? []).map((item) => (
            item.id === findingId
              ? { ...item, status: nextStatus, updatedAt: payload.finding?.updatedAt ?? item.updatedAt }
              : item
          ));

          return {
            ...(current as Record<string, unknown>),
            findings: filterValue
              ? updatedItems.filter((item) => String(item.status).toLowerCase() === filterValue.toLowerCase())
              : updatedItems,
          };
        },
      );

      toast.success(`Finding marked ${nextStatus}.`);
      revalidateKeys((key) => (
        key === `/api/intelligence/findings/${findingId}` ||
        key.startsWith('/api/intelligence/findings')
      ));
    } catch (error) {
      setCurrentStatus(previousStatus);
      setFailure(error instanceof Error ? error.message : 'Mutation failed');
      revalidateKeys((key) => (
        key === `/api/intelligence/findings/${findingId}` ||
        key.startsWith('/api/intelligence/findings')
      ));
      toast.error(error instanceof Error ? error.message : 'Mutation failed');
    } finally {
      setPendingAction(null);
    }
  }

  return (
    <div>
      <MutationButtonRow
        buttons={buttons}
        pendingAction={pendingAction}
        status={currentStatus}
        compact={compact}
        onRun={run}
      />
      <MutationFailure message={failure} onRetry={retryButton ? () => void run(retryButton) : null} />
    </div>
  );
}

export function ActionMutationControls({
  actionId,
  status,
  compact,
  onStatusChange,
}: {
  actionId: string;
  status: string;
  compact?: boolean;
  onStatusChange?: (status: string) => void;
}) {
  const [currentStatus, setCurrentStatus] = useState(status);
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [retryButton, setRetryButton] = useState<ButtonSpec | null>(null);

  useEffect(() => {
    setCurrentStatus(status);
  }, [status]);

  const buttons = useMemo<ButtonSpec[]>(() => [
    { label: 'Pending', action: 'pending', previewStatus: 'pending' },
    { label: 'In Progress', action: 'in_progress', previewStatus: 'in_progress' },
    { label: 'Complete', action: 'completed', previewStatus: 'completed' },
    { label: 'Skip', action: 'skipped', previewStatus: 'skipped' },
  ], []);

  async function run(button: ButtonSpec) {
    const previousStatus = currentStatus;
    setPendingAction(button.action);
    setFailure(null);
    setRetryButton(button);
    setCurrentStatus(button.previewStatus);

    try {
      mutateIntelligenceResource(`/api/actions/${actionId}`, (current: unknown) => {
        if (!current || typeof current !== 'object' || !('action' in current)) {
          return current;
        }

        return {
          ...(current as Record<string, unknown>),
          action: {
            ...((current as { action: Record<string, unknown> }).action),
            status: button.previewStatus,
          },
        };
      });
      mutateMatchingIntelligenceResources(
        (url) => url.startsWith('/api/intelligence/actions'),
        (current, url) => {
          if (!current || typeof current !== 'object' || !('actions' in current)) {
            return current;
          }

          const params = new URLSearchParams(url.split('?')[1] ?? '');
          const filterValue = params.get('status');
          const updatedItems = ((current as { actions: Array<Record<string, unknown>> }).actions ?? []).map((item) => (
            item.id === actionId ? { ...item, status: button.previewStatus } : item
          ));

          return {
            ...(current as Record<string, unknown>),
            actions: filterValue
              ? updatedItems.filter((item) => String(item.status).toLowerCase() === filterValue.toLowerCase())
              : updatedItems,
          };
        },
      );

      const response = await fetch(`/api/actions/${encodeURIComponent(actionId)}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: button.previewStatus }),
      });
      const payload = await response.json().catch(() => ({})) as { error?: string; action?: { actionId: string; status: string } };
      if (!response.ok || !payload.action) {
        throw new Error(payload.error ?? 'Failed to update action status');
      }

      const nextStatus = payload.action.status;
      setCurrentStatus(nextStatus);
      onStatusChange?.(nextStatus);
      mutateIntelligenceResource(`/api/actions/${actionId}`, (current: unknown) => {
        if (!current || typeof current !== 'object' || !('action' in current)) {
          return current;
        }

        return {
          ...(current as Record<string, unknown>),
          action: {
            ...((current as { action: Record<string, unknown> }).action),
            status: nextStatus,
          },
        };
      });
      mutateMatchingIntelligenceResources(
        (url) => url.startsWith('/api/intelligence/actions'),
        (current, url) => {
          if (!current || typeof current !== 'object' || !('actions' in current)) {
            return current;
          }

          const params = new URLSearchParams(url.split('?')[1] ?? '');
          const filterValue = params.get('status');
          const updatedItems = ((current as { actions: Array<Record<string, unknown>> }).actions ?? []).map((item) => (
            item.id === actionId ? { ...item, status: nextStatus } : item
          ));

          return {
            ...(current as Record<string, unknown>),
            actions: filterValue
              ? updatedItems.filter((item) => String(item.status).toLowerCase() === filterValue.toLowerCase())
              : updatedItems,
          };
        },
      );

      toast.success(`Action marked ${nextStatus}.`);
      revalidateKeys((key) => key === `/api/actions/${actionId}` || key.startsWith('/api/intelligence/actions'));
    } catch (error) {
      setCurrentStatus(previousStatus);
      setFailure(error instanceof Error ? error.message : 'Mutation failed');
      revalidateKeys((key) => key === `/api/actions/${actionId}` || key.startsWith('/api/intelligence/actions'));
      toast.error(error instanceof Error ? error.message : 'Mutation failed');
    } finally {
      setPendingAction(null);
    }
  }

  return (
    <div>
      <MutationButtonRow
        buttons={buttons}
        pendingAction={pendingAction}
        status={currentStatus}
        compact={compact}
        onRun={run}
      />
      <MutationFailure message={failure} onRetry={retryButton ? () => void run(retryButton) : null} />
    </div>
  );
}

export function StorylineMutationControls({
  storylineId,
  status,
  compact,
  onStatusChange,
}: {
  storylineId: string;
  status: string;
  compact?: boolean;
  onStatusChange?: (status: string) => void;
}) {
  const [currentStatus, setCurrentStatus] = useState(status);
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [retryButton, setRetryButton] = useState<ButtonSpec | null>(null);

  useEffect(() => {
    setCurrentStatus(status);
  }, [status]);

  const buttons = useMemo<ButtonSpec[]>(() => [
    { label: 'Acknowledge', action: 'acknowledge', previewStatus: 'quiet' },
    { label: 'Escalate', action: 'escalate', previewStatus: 'escalated' },
    { label: 'Archive', action: 'archive', previewStatus: 'archived' },
    { label: 'Save Investigation', action: 'save-investigation', previewStatus: status },
  ], [status]);

  async function run(button: ButtonSpec) {
    const previousStatus = currentStatus;
    setPendingAction(button.action);
    setFailure(null);
    setRetryButton(button);
    setCurrentStatus(button.previewStatus);

    try {
      const response = await fetch(`/api/storylines/${encodeURIComponent(storylineId)}/${button.action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const payload = await response.json().catch(() => ({})) as { error?: string; storyline?: { storylineId: string; status: string } };
      if (!response.ok || !payload.storyline) {
        throw new Error(payload.error ?? `Failed to ${button.action} storyline`);
      }

      const nextStatus = payload.storyline.status;
      setCurrentStatus(nextStatus);
      onStatusChange?.(nextStatus);
      mutateIntelligenceResource(`/api/storylines/${storylineId}`, (current: unknown) => {
        if (!current || typeof current !== 'object' || !('storyline' in current)) {
          return current;
        }

        return {
          ...(current as Record<string, unknown>),
          storyline: {
            ...((current as { storyline: Record<string, unknown> }).storyline),
            status: nextStatus,
          },
        };
      });
      mutateMatchingIntelligenceResources(
        (url) => url.startsWith('/api/intelligence/storylines'),
        (current, url) => {
          if (!current || typeof current !== 'object' || !('storylines' in current)) {
            return current;
          }

          const params = new URLSearchParams(url.split('?')[1] ?? '');
          const filterValue = params.get('status');
          const updatedItems = ((current as { storylines: Array<Record<string, unknown>> }).storylines ?? []).map((item) => (
            item.id === storylineId ? { ...item, status: nextStatus } : item
          ));

          return {
            ...(current as Record<string, unknown>),
            storylines: filterValue
              ? updatedItems.filter((item) => String(item.status).toLowerCase() === filterValue.toLowerCase())
              : updatedItems,
          };
        },
      );

      toast.success(`Storyline marked ${nextStatus}.`);
      revalidateKeys((key) => key === `/api/storylines/${storylineId}` || key.startsWith('/api/intelligence/storylines'));
    } catch (error) {
      setCurrentStatus(previousStatus);
      setFailure(error instanceof Error ? error.message : 'Mutation failed');
      revalidateKeys((key) => key === `/api/storylines/${storylineId}` || key.startsWith('/api/intelligence/storylines'));
      toast.error(error instanceof Error ? error.message : 'Mutation failed');
    } finally {
      setPendingAction(null);
    }
  }

  return (
    <div>
      <MutationButtonRow
        buttons={buttons}
        pendingAction={pendingAction}
        status={currentStatus}
        compact={compact}
        onRun={run}
      />
      <MutationFailure message={failure} onRetry={retryButton ? () => void run(retryButton) : null} />
    </div>
  );
}
