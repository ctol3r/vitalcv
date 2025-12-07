import { DomainEvent, PluginAPI } from './types';

export interface PluginAPIClientOptions {
	baseUrl?: string;
	fetchImpl?: typeof fetch;
}

export class PluginAPIClient implements PluginAPI {
	private readonly baseUrl: string;
	private readonly fetchImpl: typeof fetch;

	constructor(options: PluginAPIClientOptions = {}) {
		this.baseUrl = options.baseUrl ?? '';
		this.fetchImpl = options.fetchImpl ?? fetch;
	}

	async emit(event: DomainEvent): Promise<void> {
		if (!this.baseUrl) {
			// No-op client; useful for tests
			return;
		}
		await this.fetchImpl(`${this.baseUrl}/events`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(event),
		});
	}
}


