/**
 * DistributedSupervisorState
 *
 * SupervisorAgent state stored in distributed KV with conflict resolution.
 * Uses hybrid logical clocks (HLC) for deterministic merges under concurrency.
 */

export interface HybridLogicalClockTimestamp {
	physicalMs: number;
	logical: number;
	nodeId: string;
}

export interface Clock {
	now(): HybridLogicalClockTimestamp;
	merge(remote: HybridLogicalClockTimestamp): HybridLogicalClockTimestamp;
	compare(a: HybridLogicalClockTimestamp, b: HybridLogicalClockTimestamp): number;
}

export type SupervisorId = string;
export type RegionId = string;

export interface SupervisorState {
	id: SupervisorId;
	region: RegionId;
	status: 'idle' | 'assigning' | 'draining' | 'maintenance';
	activeWorkers: number;
	pendingJobs: number;
	notes?: string;
	updatedAtHLC: HybridLogicalClockTimestamp;
}

export interface DistributedKV {
	get<T>(key: string): Promise<T | undefined>;
	set<T>(key: string, value: T): Promise<void>;
	cas<T>(key: string, expectedVersion: number, value: T): Promise<{ ok: boolean; version: number }>;
	version(key: string): Promise<number>;
}

export class DistributedSupervisorState {
	private readonly kv: DistributedKV;
	private readonly clock: Clock;
	private readonly keyPrefix: string;

	constructor(kv: DistributedKV, clock: Clock, keyPrefix = 'supervisor/state') {
		this.kv = kv;
		this.clock = clock;
		this.keyPrefix = keyPrefix;
	}

	private key(id: SupervisorId): string {
		return `${this.keyPrefix}/${id}`;
	}

	async get(id: SupervisorId): Promise<SupervisorState | undefined> {
		return this.kv.get<SupervisorState>(this.key(id));
	}

	/**
	 * Merge-and-set with HLC last-writer-wins and deterministic tiebreaker on nodeId.
	 */
	async upsert(incoming: Omit<SupervisorState, 'updatedAtHLC'> & { updatedAtHLC?: HybridLogicalClockTimestamp }): Promise<SupervisorState> {
		const key = this.key(incoming.id);
		const existing = await this.kv.get<SupervisorState>(key);
		const version = await this.kv.version(key);

		const now = this.clock.now();
		const stamped: SupervisorState = {
			...incoming,
			updatedAtHLC: incoming.updatedAtHLC ? this.clock.merge(incoming.updatedAtHLC) : this.clock.merge(now)
		} as SupervisorState;

		if (!existing) {
			const res = await this.kv.cas<SupervisorState>(key, version, stamped);
			if (!res.ok) {
				// retry once by refetching and resolving; caller can retry again if needed
				return this.upsert(incoming);
			}
			return stamped;
		}

		const winner = this.resolve(existing, stamped);
		const res = await this.kv.cas<SupervisorState>(key, version, winner);
		if (!res.ok) {
			return this.upsert(incoming);
		}
		return winner;
	}

	private resolve(a: SupervisorState, b: SupervisorState): SupervisorState {
		const c = this.clock.compare(a.updatedAtHLC, b.updatedAtHLC);
		if (c > 0) return a;
		if (c < 0) return b;
		// tie-breaker
		return a.updatedAtHLC.nodeId >= b.updatedAtHLC.nodeId ? a : b;
	}
}

/**
 * In-memory KV with naive versioning for development and tests.
 */
export class InMemoryKV implements DistributedKV {
	private readonly data = new Map<string, { v: number; value: unknown }>();

	async get<T>(key: string): Promise<T | undefined> {
		const rec = this.data.get(key);
		return rec?.value as T | undefined;
	}

	async set<T>(key: string, value: T): Promise<void> {
		const rec = this.data.get(key);
		if (!rec) {
			this.data.set(key, { v: 1, value });
		} else {
			rec.v += 1;
			rec.value = value;
		}
	}

	async cas<T>(key: string, expectedVersion: number, value: T): Promise<{ ok: boolean; version: number }> {
		const rec = this.data.get(key);
		if (!rec) {
			if (expectedVersion !== 0) return { ok: false, version: 0 };
			this.data.set(key, { v: 1, value });
			return { ok: true, version: 1 };
		}
		if (rec.v !== expectedVersion) {
			return { ok: false, version: rec.v };
		}
		rec.v += 1;
		rec.value = value;
		return { ok: true, version: rec.v };
	}

	async version(key: string): Promise<number> {
		const rec = this.data.get(key);
		return rec?.v ?? 0;
	}
}


