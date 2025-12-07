/**
 * Autopilot API Client
 * Handles communication with backend autopilot endpoints
 */

const API_BASE = (process.env.NEXT_PUBLIC_BACKEND_URL || '').replace(/\/+$/, '');
const base = API_BASE || ''; // same-origin fallback if unset

export interface AutopilotStatus {
  enabled: boolean;
  lastRun: string;
  nextScheduledRun: string;
  health: {
    trustScore: number;
    totalCredentials: number;
    expiredCredentials: number;
    criticalIssues: number;
  };
  tasksCompleted: number;
  tasksPending: number;
}

export interface AutopilotTask {
  id: string;
  name: string;
  priority: number;
  description: string;
  category: string;
  estimatedDuration?: number;
}

export interface AutopilotNextTasksResponse {
  ok: boolean;
  tasks: AutopilotTask[];
  totalTasks: number;
  estimatedTotalDuration: number;
}

export interface AutopilotStatusResponse {
  ok: boolean;
  status: AutopilotStatus;
}

/**
 * Get autopilot status
 */
export async function getAutopilotStatus(npi: string): Promise<AutopilotStatus> {
  const response = await fetch(`${base}/api/autopilot/status?npi=${encodeURIComponent(npi)}`, {
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error(`Failed to get autopilot status: ${response.statusText}`);
  }

  const data: AutopilotStatusResponse = await response.json();
  return data.status;
}

/**
 * Get next autopilot tasks
 */
export async function getNextTasks(npi: string): Promise<AutopilotNextTasksResponse> {
  const response = await fetch(`${base}/api/autopilot/nextTasks?npi=${encodeURIComponent(npi)}`, {
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error(`Failed to get next tasks: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Execute an autopilot task
 */
export async function executeTask(
  taskId: string,
  npi: string,
): Promise<{ ok: boolean; result: any }> {
  const response = await fetch(`${base}/api/autopilot/execute`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ taskId, npi }),
  });

  if (!response.ok) {
    throw new Error(`Failed to execute task: ${response.statusText}`);
  }

  return response.json();
}
