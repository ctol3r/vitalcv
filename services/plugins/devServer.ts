import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadPlugin } from './loader';
import { PluginEventBridge, DefaultPolicy } from './eventBridge';
import { PluginManifestData } from './models/PluginManifest';

function now(): string {
	return new Date().toISOString();
}

function log(...args: unknown[]): void {
	// eslint-disable-next-line no-console
	console.log(`[plugins/devServer ${now()}]`, ...args);
}

function readPluginFile(targetPath: string): string {
	return fs.readFileSync(targetPath, 'utf8');
}

function resolveTarget(input?: string): string {
	const cwd = process.cwd();
	if (!input) throw new Error('No plugin file provided. Pass path as argv[2] or set PLUGIN_FILE.');
	return path.isAbsolute(input) ? input : path.join(cwd, input);
}

async function main(): Promise<void> {
	const argPath = process.env.PLUGIN_FILE ?? process.argv[2];
	const pluginFile = resolveTarget(argPath);
	log('Starting plugin dev server for', pluginFile);

	// The plugin file should export a manifest JSON via a comment block or a sidecar .manifest.json
	// For DX, we support `${file}.manifest.json`.
	const manifestPathCandidates = [
		`${pluginFile}.manifest.json`,
		pluginFile.replace(/\.(ts|js|mjs|cjs)$/, '.manifest.json'),
	];
	let manifestData: PluginManifestData | null = null;
	for (const cand of manifestPathCandidates) {
		if (fs.existsSync(cand)) {
			const raw = fs.readFileSync(cand, 'utf8');
			manifestData = JSON.parse(raw) as PluginManifestData;
			break;
		}
	}
	if (!manifestData) {
		throw new Error(`Manifest not found. Create a sidecar JSON: ${manifestPathCandidates[0]}`);
	}

	const bridge = new PluginEventBridge(new DefaultPolicy());

	let current: {
		dispose: () => void;
		dispatch: (event: Parameters<PluginEventBridge['emit']>[0]) => Promise<void>;
	} | null = null;

	async function reload(): Promise<void> {
		if (current) {
			log('Disposing previous sandbox');
			current.dispose();
			current = null;
		}
		try {
			const code = readPluginFile(pluginFile);
			const loaded = await loadPlugin(manifestData as PluginManifestData, {
				code,
				globals: {},
			});
			const entry = loaded.exports[loaded.manifest.entrypoint];
			if (typeof entry !== 'function') {
				throw new Error(`Entrypoint '${loaded.manifest.entrypoint}' is not a function`);
			}
			// Create dispatch wrapper that calls plugin entry with event
			const dispatch = async (event: any) => {
				try {
					await Promise.resolve(entry(event));
				} catch (e) {
					log('Error during plugin dispatch:', e);
				}
			};
			const handle = {
				manifest: loaded.manifest,
				dispatch,
				allowed: () => true,
			};
			bridge.register(handle as any);
			current = {
				dispose: () => {
					bridge.unregister(handle as any);
					loaded.sandbox.dispose();
				},
				dispatch: async (event) => {
					await bridge.emit(event as any);
				},
			};
			log('Plugin loaded:', loaded.manifest.name, loaded.manifest.version);
		} catch (e) {
			log('Failed to load plugin:', e);
		}
	}

	await reload();

	// Emit sample events for quick feedback
	async function demoEmit(): Promise<void> {
		if (!current) return;
		await current.dispatch({
			type: 'drift',
			payload: { message: 'Hello from dev server' },
		} as any);
	}
	await demoEmit();

	// Hot reload on change
	fs.watch(path.dirname(pluginFile), { persistent: true }, async (evt, fname) => {
		if (!fname) return;
		const full = path.join(path.dirname(pluginFile), fname);
		if (full === pluginFile || full === `${pluginFile}.manifest.json` || full.endsWith('.manifest.json')) {
			log('Change detected:', evt, fname);
			await reload();
			await demoEmit();
		}
	});

	log('Watching for changes. Press Ctrl+C to exit.');
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
	// eslint-disable-next-line @typescript-eslint/no-floating-promises
	main();
}


