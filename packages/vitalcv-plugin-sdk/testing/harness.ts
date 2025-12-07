import { DomainEvent, PluginAPI, PluginContext } from '../src/types';

export interface HarnessOptions {
	api?: Partial<PluginAPI>;
	context?: PluginContext;
	log?: (msg: string, data?: unknown) => void;
}

export interface LoadedPlugin<TExports = Record<string, unknown>> {
	exports: TExports;
	api: PluginAPI;
	context: PluginContext;
	dispatch(event: DomainEvent): Promise<void>;
	dispose(): void;
}

export function createHarness<TExports = Record<string, unknown>>(
	load: () => Promise<TExports> | TExports,
	options: HarnessOptions = {},
): LoadedPlugin<TExports> {
	const log = options.log ?? (() => {});
	const api: PluginAPI = {
		emit: async (event: DomainEvent) => {
			log('emit', event);
		},
		...options.api,
	};
	const context: PluginContext = options.context ?? {};
	// Load plugin synchronously for tests (caller can pass async if needed)
	const pluginExports = ((): TExports => {
		const maybe = load();
		// @ts-expect-error allow promise or value
		if (typeof maybe?.then === 'function') {
			throw new Error('createHarness expects sync load; wrap your async in sync for tests');
		}
		return maybe as TExports;
	})();

	async function dispatch(_event: DomainEvent): Promise<void> {
		// Test harness no-op; callers can invoke exported handlers directly
	}

	function dispose(): void {
		// nothing to cleanup
	}

	return { exports: pluginExports, api, context, dispatch, dispose };
}


