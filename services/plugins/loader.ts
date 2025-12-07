import crypto from 'node:crypto';
import { PluginManifestModel, PluginManifestData } from './models/PluginManifest';
import { validateCapabilities } from './capabilityRegistry';
import { createSandbox, SandboxHandle } from './runtime/sandbox';

export interface LoadResult {
	manifest: PluginManifestModel;
	sandbox: SandboxHandle;
	exports: Record<string, unknown>;
}

export interface LoaderOptions {
	code: string; // JS code string of the plugin module
	codeHashAlgorithm?: 'sha256';
	verifySignature?: (payload: string, signature: string) => Promise<boolean> | boolean;
	globals?: Record<string, unknown>;
}

function computeHash(code: string, alg: 'sha256' = 'sha256'): string {
	const h = crypto.createHash(alg);
	h.update(code, 'utf8');
	return `${alg}:${h.digest('hex')}`;
}

export function validateManifest(manifest: PluginManifestData): void {
	const result = PluginManifestModel.validate(manifest);
	if (!result.ok) {
		throw new Error(`Invalid manifest: ${result.errors.join('; ')}`);
	}
	const caps = validateCapabilities(manifest.capabilities);
	if (!caps.ok) {
		throw new Error(`Unknown capabilities: ${caps.unknown.join(', ')}`);
	}
}

export async function loadPlugin(
	manifestData: PluginManifestData,
	options: LoaderOptions,
): Promise<LoadResult> {
	validateManifest(manifestData);
	const manifest = PluginManifestModel.from(manifestData);

	// Signature verification (optional)
	if (manifest.signature && options.verifySignature) {
		const codeHash = computeHash(options.code, options.codeHashAlgorithm ?? 'sha256');
		const payload = JSON.stringify({ manifest, codeHash });
		const ok = await options.verifySignature(payload, manifest.signature);
		if (!ok) {
			throw new Error('Signature verification failed');
		}
	}

	// Initialize sandbox with minimal globals
	const sandbox = createSandbox({
		allowedGlobals: {
			exports: {},
			module: { exports: {} },
			// Provide a minimal CommonJS-like export pattern for simplicity
			require: undefined,
			...options.globals,
		},
		timeoutMs: 1000,
	});

	// Execute code and extract exports from the context
	// The vm.run returns last evaluated expression. We rely on module.exports pattern.
	const wrapperCode = `
(() => {
  ${options.code}
  return typeof module !== 'undefined' && module.exports ? module.exports : (typeof exports !== 'undefined' ? exports : {});
})()
`;
	const exportsObj = sandbox.run<Record<string, unknown>>(wrapperCode, `${manifest.name}.js`);

	// Validate entrypoint exists
	const exported = exportsObj?.[manifest.entrypoint];
	if (typeof exported !== 'function' && typeof exported !== 'object') {
		sandbox.dispose();
		throw new Error(`Entrypoint '${manifest.entrypoint}' not found in plugin exports`);
	}

	return { manifest, sandbox, exports: exportsObj ?? {} };
}


