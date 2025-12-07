/**
 * DistributedTimestampResolver
 *
 * Solves clock drift across regions using Hybrid Logical Clocks (HLC).
 * The resolver provides monotonic timestamps and a merge operation for
 * reconciling remote events.
 */

export interface HybridLogicalClockTimestamp {
	physicalMs: number;
	logical: number;
	nodeId: string;
}

export class DistributedTimestampResolver {
	private last: HybridLogicalClockTimestamp;

	constructor(private readonly nodeId: string, private readonly nowFn: () => number = () => Date.now()) {
		const now = this.nowFn();
		this.last = { physicalMs: now, logical: 0, nodeId };
	}

	now(): HybridLogicalClockTimestamp {
		const now = this.nowFn();
		if (now > this.last.physicalMs) {
			this.last = { physicalMs: now, logical: 0, nodeId: this.nodeId };
		} else {
			// same or regressed wall clock; bump logical
			this.last = { physicalMs: this.last.physicalMs, logical: this.last.logical + 1, nodeId: this.nodeId };
		}
		return { ...this.last };
	}

	merge(remote: HybridLogicalClockTimestamp): HybridLogicalClockTimestamp {
		const localNowMs = this.nowFn();
		const localPhysical = Math.max(localNowMs, this.last.physicalMs);
		if (localPhysical > this.last.physicalMs && localPhysical > remote.physicalMs) {
			// local wall clock jumped ahead of both -> reset logical
			this.last = { physicalMs: localPhysical, logical: 0, nodeId: this.nodeId };
			return { ...this.last };
		}

		if (this.last.physicalMs === remote.physicalMs) {
			// equal physical, take max logical + 1
			const logical = Math.max(this.last.logical, remote.logical) + 1;
			this.last = { physicalMs: this.last.physicalMs, logical, nodeId: this.nodeId };
			return { ...this.last };
		}

		if (this.last.physicalMs > remote.physicalMs) {
			// local leads physical; bump logical
			this.last = { physicalMs: this.last.physicalMs, logical: this.last.logical + 1, nodeId: this.nodeId };
			return { ...this.last };
		}

		// remote leads physical; adopt remote physical and bump logical
		this.last = { physicalMs: remote.physicalMs, logical: remote.logical + 1, nodeId: this.nodeId };
		return { ...this.last };
	}

	compare(a: HybridLogicalClockTimestamp, b: HybridLogicalClockTimestamp): number {
		if (a.physicalMs !== b.physicalMs) return a.physicalMs > b.physicalMs ? 1 : -1;
		if (a.logical !== b.logical) return a.logical > b.logical ? 1 : -1;
		if (a.nodeId === b.nodeId) return 0;
		return a.nodeId > b.nodeId ? 1 : -1;
	}
}


