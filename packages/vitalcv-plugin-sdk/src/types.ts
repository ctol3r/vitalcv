export type PluginCapability =
	| 'readTimeline'
	| 'writeEvents'
	| 'runAnalysis'
	| 'validateCredentials'
	| 'provideForecasts';

export interface PluginManifest {
	name: string;
	version: string;
	author: string;
	capabilities: PluginCapability[];
	permissions: string[];
	entrypoint: string;
	signature?: string | null;
}

export interface DomainEvent<T = unknown> {
	type:
		| 'drift'
		| 'oppe'
		| 'privilege'
		| 'quality'
		| 'enrollment';
	payload: T;
	metadata?: Record<string, unknown>;
}

export interface PluginContext {
	// Future: orgId, environment, feature flags, etc.
}

export interface PluginAPI {
	emit(event: DomainEvent): Promise<void>;
	fetchTimeline?(params: { clinicianId: string }): Promise<unknown>;
	validateCredential?(input: unknown): Promise<unknown>;
	runAnalysis?(input: unknown): Promise<unknown>;
}


