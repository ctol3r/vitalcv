import { randomUUID, createHash } from 'crypto';
import fetch from 'node-fetch';

interface DidcommJob {
  id: string;
  endpoint: string;
  payload: any;
  attempts: number;
}

interface FailoverOptions {
  maxRetries?: number;
  baseDelayMs?: number;
}

const DEFAULT_MAX_RETRIES = Number(process.env.DIDCOMM_MAX_RETRIES || 5);
const DEFAULT_BASE_DELAY = Number(process.env.DIDCOMM_BACKOFF_MS || 1_000);

export class DidcommFailoverQueue {
  private readonly pending = new Map<string, NodeJS.Timeout>();
  private readonly options: Required<FailoverOptions>;

  constructor(options: FailoverOptions = {}) {
    this.options = {
      maxRetries: options.maxRetries ?? DEFAULT_MAX_RETRIES,
      baseDelayMs: options.baseDelayMs ?? DEFAULT_BASE_DELAY,
    };
  }

  async send(endpoint: string, payload: any): Promise<Response> {
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        throw new Error(`ACA-Py responded with ${response.status}`);
      }
      return response;
    } catch (error) {
      const job: DidcommJob = {
        id: randomUUID(),
        endpoint,
        payload,
        attempts: 1,
      };
      this.scheduleRetry(job, error instanceof Error ? error.message : String(error));
      throw error;
    }
  }

  private scheduleRetry(job: DidcommJob, reason: string) {
    if (job.attempts > this.options.maxRetries) {
      console.error('[didcomm:fallback] dropping job after max retries', {
        endpoint: job.endpoint,
        reason,
      });
      logOutageEvent(job.endpoint, reason);
      return;
    }

    const delay = this.options.baseDelayMs * Math.pow(2, job.attempts - 1);
    console.warn('[didcomm:fallback] queuing retry', {
      jobId: job.id,
      attempt: job.attempts,
      delay,
      reason,
    });

    const timeout = setTimeout(async () => {
      this.pending.delete(job.id);
      try {
        await fetch(job.endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(job.payload),
        });
        console.info('[didcomm:fallback] retry succeeded', { jobId: job.id });
      } catch (error) {
        job.attempts += 1;
        this.scheduleRetry(job, error instanceof Error ? error.message : String(error));
      }
    }, delay);

    this.pending.set(job.id, timeout);
  }
}

function logOutageEvent(endpoint: string, reason: string) {
  const anchor = createHash('sha256')
    .update(`${endpoint}:${reason}:${Date.now()}`)
    .digest('hex');
  console.error('[didcomm:outage]', {
    endpoint,
    reason,
    anchor: `0x${anchor}`,
  });
}

export const didcommFailover = new DidcommFailoverQueue();











