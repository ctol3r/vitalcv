import { validateCapabilities, requiredPermissionsFor } from '../capabilityRegistry';

export interface PluginManifestData {
	name: string;
	version: string;
	author: string;
	capabilities: string[];
	permissions: string[];
	entrypoint: string;
	signature?: string | null;
}

export class PluginManifestModel {
	readonly name: string;
	readonly version: string;
	readonly author: string;
	readonly capabilities: string[];
	readonly permissions: string[];
	readonly entrypoint: string;
	readonly signature?: string | null;

	private constructor(data: PluginManifestData) {
		this.name = data.name;
		this.version = data.version;
		this.author = data.author;
		this.capabilities = data.capabilities;
		this.permissions = data.permissions;
		this.entrypoint = data.entrypoint;
		this.signature = data.signature ?? null;
	}

	static validate(data: PluginManifestData): { ok: true } | { ok: false; errors: string[] } {
		const errors: string[] = [];

		if (!data.name || typeof data.name !== 'string') errors.push('name is required');
		if (!data.version || typeof data.version !== 'string') errors.push('version is required');
		if (!data.author || typeof data.author !== 'string') errors.push('author is required');
		if (!Array.isArray(data.capabilities)) errors.push('capabilities must be a string[]');
		if (!Array.isArray(data.permissions)) errors.push('permissions must be a string[]');
		if (!data.entrypoint || typeof data.entrypoint !== 'string') errors.push('entrypoint is required');

		if (Array.isArray(data.capabilities)) {
			const capRes = validateCapabilities(data.capabilities);
			if (!capRes.ok) {
				errors.push(`unknown capabilities: ${capRes.unknown.join(', ')}`);
			}
		}

		// Ensure required permissions implied by capabilities are present
		if (Array.isArray(data.capabilities) && Array.isArray(data.permissions)) {
			const implied = requiredPermissionsFor(data.capabilities);
			for (const perm of implied) {
				if (!data.permissions.includes(perm)) {
					errors.push(`missing required permission '${perm}' for declared capabilities`);
				}
			}
		}

		return errors.length ? { ok: false, errors } : { ok: true };
	}

	static from(data: PluginManifestData): PluginManifestModel {
		const v = this.validate(data);
		if (!v.ok) {
			throw new Error(`Invalid PluginManifest: ${v.errors.join('; ')}`);
		}
		return new PluginManifestModel(data);
	}
}


