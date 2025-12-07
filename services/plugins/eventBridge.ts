import { PluginManifestModel } from './models/PluginManifest';

export type DomainEventType =
	| 'drift'
	| 'oppe'
	| 'privilege'
	| 'quality'
	| 'enrollment';

export interface DomainEvent<T = unknown> {
	type: DomainEventType;
	payload: T;
	metadata?: Record<string, unknown>;
}

export interface PluginHandle {
	manifest: PluginManifestModel;
	dispatch: (event: DomainEvent) => Promise<void> | void;
	allowed: (event: DomainEvent) => boolean;
}

export interface Policy {
	allow: (plugin: PluginManifestModel, event: DomainEvent) => boolean;
}

export class DefaultPolicy implements Policy {
	allow(plugin: PluginManifestModel, _event: DomainEvent): boolean {
		// Minimal policy: read-only events require capability 'readTimeline'
		// Emitting new events would be checked at emission time via 'writeEvents'
		return plugin.capabilities.includes('readTimeline');
	}
}

export class PluginEventBridge {
	private readonly policy: Policy;
	private readonly plugins: Set<PluginHandle>;

	constructor(policy: Policy = new DefaultPolicy()) {
		this.policy = policy;
		this.plugins = new Set();
	}

	register(handle: PluginHandle): void {
		this.plugins.add(handle);
	}

	unregister(handle: PluginHandle): void {
		this.plugins.delete(handle);
	}

	async emit(event: DomainEvent): Promise<void> {
		const deliveries: Promise<void>[] = [];
		for (const plugin of this.plugins) {
			if (plugin.allowed(event) && this.policy.allow(plugin.manifest, event)) {
				const result = Promise.resolve().then(() => plugin.dispatch(event));
				deliveries.push(result);
			}
		}
		await Promise.allSettled(deliveries);
	}
}


