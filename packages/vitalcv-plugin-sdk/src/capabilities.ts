import { PluginCapability } from './types';

export const Capabilities: Record<PluginCapability, PluginCapability> = {
	readTimeline: 'readTimeline',
	writeEvents: 'writeEvents',
	runAnalysis: 'runAnalysis',
	validateCredentials: 'validateCredentials',
	provideForecasts: 'provideForecasts',
};

export const RequiredPermissions: Record<PluginCapability, string[]> = {
	readTimeline: ['timeline:read'],
	writeEvents: ['events:write'],
	runAnalysis: [],
	validateCredentials: ['credentials:read'],
	provideForecasts: [],
};


