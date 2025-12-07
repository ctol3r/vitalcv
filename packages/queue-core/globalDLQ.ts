/**
 * GlobalDLQ
 *
 * Aggregated dead-letter queue across all regions.
 * Stores failed jobs with regionOrigin and retryStrategy metadata.
 */

export type RegionId = string;
export type JobId = string;

export interface RetryStrategy {
	type: 'exponential' | 'fixed' | 'none';
	baseDelayMs?: number;
	maxRetries?: number;
}

export interface DLQItem {
	id: string; // unique dlq id
	jobId: JobId;
	jobType: string;
	regionOrigin: RegionId;
	reason: string;
	firstFailedAt: number;
	lastFailedAt: number;
	failCount: number;
	retryStrategy: RetryStrategy;
	payload?: unknown;
	attributes?: Record<string, string>;
}

export interface DLQAdapter {
	put(item: DLQItem): Promise<void>;
	getByJob(jobId: JobId): Promise<DLQItem | undefined>;
	list(limit: number): Promise<DLQItem[]>;
	delete(id: string): Promise<void>;
}

export class GlobalDLQ {
	private readonly adapter: DLQAdapter;

	constructor(adapter: DLQAdapter) {
		this.adapter = adapter;
	}

	/**
	 * Record a failure into the DLQ. If an entry already exists for the job,
	 * it is updated with incremented failCount and lastFailedAt.
	 */
	async recordFailure(input: Omit<DLQItem, 'id' | 'firstFailedAt' | 'lastFailedAt' | 'failCount'> & { id?: string }): Promise<DLQItem> {
		const existing = await this.adapter.getByJob(input.jobId);
		const now = Date.now();

		const item: DLQItem = existing
			? {
					...existing,
					reason: input.reason,
					retryStrategy: input.retryStrategy,
					payload: input.payload ?? existing.payload,
					attributes: input.attributes ?? existing.attributes,
					failCount: existing.failCount + 1,
					lastFailedAt: now
				}
			: {
					id: input.id ?? `${input.jobId}:${now}`,
					jobId: input.jobId,
					jobType: input.jobType,
					regionOrigin: input.regionOrigin,
					reason: input.reason,
					firstFailedAt: now,
					lastFailedAt: now,
					failCount: 1,
					retryStrategy: input.retryStrategy,
					payload: input.payload,
					attributes: input.attributes
				};

		await this.adapter.put(item);
		return item;
	}

	async list(limit = 100): Promise<DLQItem[]> {
		return this.adapter.list(limit);
	}

	async remove(id: string): Promise<void> {
		await this.adapter.delete(id);
	}
}

/**
 * In-memory adapter for development and tests.
 */
export class InMemoryDLQAdapter implements DLQAdapter {
	private readonly byId = new Map<string, DLQItem>();
	private readonly byJob = new Map<JobId, string>();

	async put(item: DLQItem): Promise<void> {
		this.byId.set(item.id, item);
		this.byJob.set(item.jobId, item.id);
	}

	async getByJob(jobId: JobId): Promise<DLQItem | undefined> {
		const id = this.byJob.get(jobId);
		return id ? this.byId.get(id) : undefined;
	}

	async list(limit: number): Promise<DLQItem[]> {
		return [...this.byId.values()].sort((a, b) => b.lastFailedAt - a.lastFailedAt).slice(0, limit);
	}

	async delete(id: string): Promise<void> {
		const item = this.byId.get(id);
		if (item) {
			this.byId.delete(id);
			this.byJob.delete(item.jobId);
		}
	}
}


