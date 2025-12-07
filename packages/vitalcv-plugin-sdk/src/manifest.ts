import { PluginCapability, PluginManifest } from './types';
import { RequiredPermissions } from './capabilities';

export interface CreateManifestOptions {
	name: string;
	version: string;
	author: string;
	entrypoint: string;
	capabilities: PluginCapability[];
	permissions?: string[];
	signature?: string | null;
}

export function createManifest(opts: CreateManifestOptions): PluginManifest {
	const implied = new Set<string>();
	for (const cap of opts.capabilities) {
		for (const perm of RequiredPermissions[cap]) {
			implied.add(perm);
		}
	}
	const explicit = new Set<string>(opts.permissions ?? []);
	const permissions = Array.from(new Set<string>([...implied, ...explicit]));
	return {
		name: opts.name,
		version: opts.version,
		author: opts.author,
		entrypoint: opts.entrypoint,
		capabilities: opts.capabilities,
		permissions,
		signature: opts.signature ?? null,
	};
}


