import { createLogger } from '@chai-vc/logging-core';
import { getCapability, requiredPermissionsFor } from './capabilityRegistry.js';

const log = createLogger({ service: 'plugins/permissions' });

// Map API method -> required capability
const METHOD_TO_CAPABILITY: Record<string, string> = {
	fetchClinician: 'readTimeline',
	fetchPrivileges: 'readTimeline',
	queryTimeline: 'readTimeline',
	getRisk: 'runAnalysis',
	getCCI: 'runAnalysis',
	runFusion: 'runAnalysis',
	runForecast: 'provideForecasts',
};

export interface EnforcementContext {
	method?: string;
}

export function enforcePermissions(
	manifest: { name: string; capabilities: string[] },
	requiredCapability: string,
	ctx?: EnforcementContext,
): void {
	const has = manifest.capabilities.includes(requiredCapability);
	if (!has) {
		const method = ctx?.method ?? capabilityToMethods(requiredCapability).join(',');
		const requiredPerms = requiredPermissionsFor([requiredCapability]);
		log.warn('Permission violation', {
			plugin: manifest.name,
			method,
			requiredCapability,
			requiredPermissions: requiredPerms,
		});
		throw new Error(`Plugin lacks capability '${requiredCapability}' to call ${method}`);
	}
}

export function capabilityToMethods(capability: string): string[] {
	return Object.entries(METHOD_TO_CAPABILITY)
		.filter(([, cap]) => cap === capability)
		.map(([m]) => m);
}

export function methodToCapability(method: string): string | undefined {
	return METHOD_TO_CAPABILITY[method];
}

export function describeCapability(name: string) {
	return getCapability(name as any);
}

export default {
	enforcePermissions,
	methodToCapability,
	capabilityToMethods,
	describeCapability,
};


