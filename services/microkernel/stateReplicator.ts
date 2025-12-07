/**
 * MicrokernelStateReplicator
 *
 * Replicates module registration, health status, and capability graph across regions.
 * Storage and transport are abstracted via the provided adapters.
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

export type ModuleId = string;
export type RegionId = string;

export interface ModuleRegistration {
	id: ModuleId;
	region: RegionId;
	version: string;
	endpoint?: string;
	health: 'healthy' | 'degraded' | 'unhealthy' | 'unknown';
	capabilities: string[]; // simple capability identifiers
	updatedAtHLC: HybridLogicalClockTimestamp;
}

export interface RegistryAdapter {
	get(moduleId: ModuleId): Promise<ModuleRegistration | undefined>;
	upsert(module: ModuleRegistration): Promise<ModuleRegistration>;
	listByCapability(capability: string): Promise<ModuleRegistration[]>;
}

export interface BroadcastAdapter {
	publish(topic: string, message: unknown): Promise<void>;
	subscribe(topic: string, handler: (message: unknown) => void): Promise<() => void>;
}

export class MicrokernelStateReplicator {
	private readonly registry: RegistryAdapter;
	private readonly bus: BroadcastAdapter;
	private readonly clock: Clock;
	private readonly topic: string;

	constructor(registry: RegistryAdapter, bus: BroadcastAdapter, clock: Clock, topic = 'microkernel/state') {
		this.registry = registry;
		this.bus = bus;
		this.clock = clock;
		this.topic = topic;
	}

	async start(): Promise<() => void> {
		// Subscribe to incoming state updates from other regions
		const unsubscribe = await this.bus.subscribe(this.topic, async (msg) => {
			const incoming = msg as ModuleRegistration;
			const current = await this.registry.get(incoming.id);
			if (!current) {
				await this.registry.upsert(incoming);
				return;
			}
			const winner = this.resolve(current, incoming);
			if (winner !== current) {
				await this.registry.upsert(winner);
			}
		});
		return unsubscribe;
	}

	/**
	 * Register or update local module state and broadcast to other regions.
	 */
	async registerOrUpdate(input: Omit<ModuleRegistration, 'updatedAtHLC'> & { updatedAtHLC?: HybridLogicalClockTimestamp }): Promise<ModuleRegistration> {
		const stamped: ModuleRegistration = {
			...input,
			updatedAtHLC: input.updatedAtHLC ? this.clock.merge(input.updatedAtHLC) : this.clock.now()
		};
		const committed = await this.registry.upsert(stamped);
		await this.bus.publish(this.topic, committed);
		return committed;
	}

	/**
	 * Simple resolver favoring greater HLC; ties break on nodeId.
	 */
	private resolve(a: ModuleRegistration, b: ModuleRegistration): ModuleRegistration {
		const c = this.clock.compare(a.updatedAtHLC, b.updatedAtHLC);
		if (c > 0) return a;
		if (c < 0) return b;
		return a.updatedAtHLC.nodeId >= b.updatedAtHLC.nodeId ? a : b;
	}
}

/**
 * In-memory dev adapters.
 */
export class InMemoryRegistryAdapter implements RegistryAdapter {
	private readonly store = new Map<ModuleId, ModuleRegistration>();

	async get(moduleId: ModuleId): Promise<ModuleRegistration | undefined> {
		return this.store.get(moduleId);
	}

	async upsert(module: ModuleRegistration): Promise<ModuleRegistration> {
		const cur = this.store.get(module.id);
		if (!cur) {
			this.store.set(module.id, module);
			return module;
		}
		this.store.set(module.id, module);
		return module;
	}

	async listByCapability(capability: string): Promise<ModuleRegistration[]> {
		return [...this.store.values()].filter((m) => m.capabilities.includes(capability));
	}
}

export class InMemoryBroadcastAdapter implements BroadcastAdapter {
	private handlers = new Map<string, Set<(m: unknown) => void>>();

	async publish(topic: string, message: unknown): Promise<void> {
		const set = this.handlers.get(topic);
		if (!set) return;
		for (const h of set) {
			// fire-and-forget to keep the contract simple
			Promise.resolve().then(() => h(message));
		}
	}

	async subscribe(topic: string, handler: (message: unknown) => void): Promise<() => void> {
		if (!this.handlers.has(topic)) this.handlers.set(topic, new Set());
		this.handlers.get(topic)!.add(handler);
		return () => {
			this.handlers.get(topic)?.delete(handler);
		};
	}
}


