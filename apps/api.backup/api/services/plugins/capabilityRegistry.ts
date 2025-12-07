export type PluginCapability =
	| 'readTimeline'
	| 'writeEvents'
	| 'runAnalysis'
	| 'validateCredentials'
	| 'provideForecasts';

export interface CapabilityDefinition {
	name: PluginCapability;
	description: string;
	minimumPermissions: string[]; // e.g. ['timeline:read']
}

// Registry of allowed capabilities. Extendable at runtime if needed.
const capabilityRegistry: Record<PluginCapability, CapabilityDefinition> = {
	readTimeline: {
		name: 'readTimeline',
		description:
			'Allows reading credential timeline data and domain events for context.',
		minimumPermissions: ['timeline:read'],
	},
	writeEvents: {
		name: 'writeEvents',
		description:
			'Allows emitting new domain events through the platform event bus.',
		minimumPermissions: ['events:write'],
	},
	runAnalysis: {
		name: 'runAnalysis',
		description:
			'Allows performing compute-bound analytics using platform-provided data APIs.',
		minimumPermissions: [],
	},
	validateCredentials: {
		name: 'validateCredentials',
		description:
			'Allows validating credentials and producing structured validation results.',
		minimumPermissions: ['credentials:read'],
	},
	provideForecasts: {
		name: 'provideForecasts',
		description:
			'Allows producing forecasts (e.g., workforce demand/safety risk) from provided inputs.',
		minimumPermissions: [],
	},
};

export function listCapabilities(): CapabilityDefinition[] {
	return Object.values(capabilityRegistry);
}

export function hasCapability(name: string): name is PluginCapability {
	return (Object.keys(capabilityRegistry) as PluginCapability[]).includes(
		name as PluginCapability,
	);
}

export function getCapability(
	name: PluginCapability,
): CapabilityDefinition | undefined {
	return capabilityRegistry[name];
}

export function validateCapabilities(
	capabilities: string[],
): { ok: true } | { ok: false; unknown: string[] } {
	const unknown = capabilities.filter((c) => !hasCapability(c));
	return unknown.length === 0 ? { ok: true } : { ok: false, unknown };
}

export function requiredPermissionsFor(
	capabilities: string[],
): string[] {
	const perms = new Set<string>();
	for (const cap of capabilities) {
		if (hasCapability(cap)) {
			for (const p of capabilityRegistry[cap].minimumPermissions) {
				perms.add(p);
			}
		}
	}
	return Array.from(perms);
}


