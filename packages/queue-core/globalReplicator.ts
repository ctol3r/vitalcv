/**
 * CrossRegionQueueReplicator
 *
 * Replicates job metadata across regions; resolves race conditions; ensures exactly-once execution.
 *
 * This module is storage-agnostic via the ReplicationAdapter interface. Provide an adapter backed by
 * Redis, CockroachDB, DynamoDB Global Tables, etc. The adapter must offer idempotent upserts and
 * conditional writes to guarantee exactly-once semantics under concurrent writers.
 */

export type RegionId = string;

export interface HybridLogicalClockTimestamp {
	physicalMs: number;
	logical: number;
	nodeId: string;
}

export interface Clock {
	now(): HybridLogicalClockTimestamp;
	merge(remote: HybridLogicalClockTimestamp): HybridLogicalClockTimestamp;
	compare(a: HybridLogicalClockTimestamp, b: HybridLogicalClockTimestamp): number; // -1,0,1
}

export type JobId = string;

export interface JobMetadata {
	id: JobId;
	type: string;
	regionOrigin: RegionId;
	status: 'queued' | 'running' | 'completed' | 'failed' | 'canceled';
	attempt: number;
	execKey?: string; // dedupe key for exactly-once
	payloadChecksum?: string;
	updatedAtHLC: HybridLogicalClockTimestamp;
}

export interface ReplicationAdapter {
	/**
	 * Atomically insert-or-merge job metadata based on conflict resolver.
	 * Returns the committed record.
	 */
	upsert(job: JobMetadata): Promise<JobMetadata>;

	/**
	 * Fetch the current replica state for a job id.
	 */
	get(jobId: JobId): Promise<JobMetadata | undefined>;

	/**
	 * Attempt to acquire an execution lock for the provided execKey.
	 * Implementations must be idempotent and TTL-based to avoid deadlocks.
	 * Returns true if lock was acquired by this caller.
	 */
	tryAcquireExecLock(execKey: string, holderId: string, ttlMs: number): Promise<boolean>;
	releaseExecLock(execKey: string, holderId: string): Promise<void>;
}

export interface ReplicatorOptions {
	region: RegionId;
	holderId: string; // unique worker identity within region (e.g., pod name + PID)
	execLockTtlMs?: number;
}

export class CrossRegionQueueReplicator {
	private readonly adapter: ReplicationAdapter;
	private readonly clock: Clock;
	private readonly opts: Required<ReplicatorOptions>;

	constructor(adapter: ReplicationAdapter, clock: Clock, options: ReplicatorOptions) {
		this.adapter = adapter;
		this.clock = clock;
		this.opts = {
			execLockTtlMs: options.execLockTtlMs ?? 30_000,
			holderId: options.holderId,
			region: options.region
		};
	}

	/**
	 * Replicate new or updated job metadata across regions.
	 * Uses HLC timestamps to deterministically resolve conflicts.
	 */
	async replicateJobMetadata(partial: Omit<Partial<JobMetadata>, 'updatedAtHLC'> & { id: JobId }): Promise<JobMetadata> {
		const current = await this.adapter.get(partial.id);
		const localTime = this.clock.now();

		const next: JobMetadata = {
			id: partial.id,
			type: partial.type ?? current?.type ?? 'unknown',
			regionOrigin: partial.regionOrigin ?? current?.regionOrigin ?? this.opts.region,
			status: partial.status ?? current?.status ?? 'queued',
			attempt: partial.attempt ?? current?.attempt ?? 0,
			execKey: partial.execKey ?? current?.execKey,
			payloadChecksum: partial.payloadChecksum ?? current?.payloadChecksum,
			updatedAtHLC: current ? this.clock.merge(current.updatedAtHLC) : localTime
		};

		// Ensure monotonic advance of HLC if caller provided a remote clock
		if (partial as any && (partial as any).updatedAtHLC) {
			next.updatedAtHLC = this.clock.merge((partial as any).updatedAtHLC);
		} else {
			// bump logical to reflect a local write
			next.updatedAtHLC = this.clock.merge(localTime);
		}

		return await this.adapter.upsert(next);
	}

	/**
	 * Resolve race conditions between competing writers:
	 * The record with the greater HLC timestamp wins; ties break by lexical nodeId.
	 */
	resolveRace(a: JobMetadata, b: JobMetadata): JobMetadata {
		const c = this.clock.compare(a.updatedAtHLC, b.updatedAtHLC);
		if (c > 0) return a;
		if (c < 0) return b;
		// deterministic tie-breaker
		return a.updatedAtHLC.nodeId >= b.updatedAtHLC.nodeId ? a : b;
	}

	/**
	 * Ensures exactly-once execution semantics for a job using a distributed execution lock.
	 * Returns true if the caller is the sole executor for the given execKey.
	 */
	async ensureExactlyOnce(execKey: string): Promise<boolean> {
		if (!execKey) return false;
		return this.adapter.tryAcquireExecLock(execKey, this.opts.holderId, this.opts.execLockTtlMs);
	}

	/**
	 * Release the execution lock after completion or terminal failure.
	 */
	async releaseExecution(execKey: string): Promise<void> {
		if (!execKey) return;
		await this.adapter.releaseExecLock(execKey, this.opts.holderId);
	}
}

/**
 * A simple in-memory adapter useful for local development and tests.
 * Not safe for production.
 */
export class InMemoryReplicationAdapter implements ReplicationAdapter {
	private readonly store = new Map<JobId, JobMetadata>();
	private readonly locks = new Map<string, { holderId: string; expiresAt: number }>();

	async upsert(job: JobMetadata): Promise<JobMetadata> {
		const existing = this.store.get(job.id);
		if (!existing) {
			this.store.set(job.id, job);
			return job;
		}
		// last-writer-wins by HLC
		const winner = this.compareHLC(existing.updatedAtHLC, job.updatedAtHLC) >= 0 ? existing : job;
		this.store.set(job.id, winner);
		return winner;
	}

	async get(jobId: JobId): Promise<JobMetadata | undefined> {
		return this.store.get(jobId);
	}

	async tryAcquireExecLock(execKey: string, holderId: string, ttlMs: number): Promise<boolean> {
		const now = Date.now();
		const current = this.locks.get(execKey);
		if (!current || current.expiresAt <= now) {
			this.locks.set(execKey, { holderId, expiresAt: now + ttlMs });
			return true;
		}
		return current.holderId === holderId; // re-entrant for same holder
	}

	async releaseExecLock(execKey: string, holderId: string): Promise<void> {
		const current = this.locks.get(execKey);
		if (current && current.holderId === holderId) {
			this.locks.delete(execKey);
		}
	}

	private compareHLC(a: HybridLogicalClockTimestamp, b: HybridLogicalClockTimestamp): number {
		if (a.physicalMs !== b.physicalMs) return a.physicalMs > b.physicalMs ? 1 : -1;
		if (a.logical !== b.logical) return a.logical > b.logical ? 1 : -1;
		if (a.nodeId === b.nodeId) return 0;
		return a.nodeId > b.nodeId ? 1 : -1;
	}
}


