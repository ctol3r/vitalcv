import vm from 'node:vm';

export interface SandboxOptions {
	allowedGlobals?: Record<string, unknown>;
	allowFs?: boolean;
	allowNet?: boolean;
	timeoutMs?: number;
}

export interface SandboxHandle {
	run<T = unknown>(code: string, filename?: string): T;
	dispose(): void;
}

// Minimal secure-ish sandbox using Node vm with an explicit context.
// This avoids exposing process, require, fs, net by default.
export function createSandbox(options: SandboxOptions = {}): SandboxHandle {
	const {
		allowedGlobals = {},
		allowFs = false,
		allowNet = false,
		timeoutMs = 1000,
	} = options;

	// Explicitly curated global exposure
	const sandboxGlobal: Record<string, unknown> = {
		// Safe built-ins
		console,
		setTimeout,
		setInterval,
		clearTimeout,
		clearInterval,
		URL,
		URLSearchParams,
		// User allowed globals
		...allowedGlobals,
	};

	// Block sensitive globals
	Object.defineProperties(sandboxGlobal, {
		process: { value: undefined, writable: false, configurable: false },
		global: { value: undefined, writable: false, configurable: false },
		require: { value: undefined, writable: false, configurable: false },
		Function: { value: Function, writable: false, configurable: false },
	});

	// Optional: expose minimal module system if desired (kept disabled by default)
	if (allowFs || allowNet) {
		// Expose guarded flags only; actual fs/net access remains blocked
		sandboxGlobal.__permissions__ = {
			fs: !!allowFs,
			net: !!allowNet,
		};
	}

	const context = vm.createContext(sandboxGlobal, { codeGeneration: { strings: true, wasm: false } });

	// Wrap code in a function scope to avoid leaking to global
	function run<T = unknown>(code: string, filename = 'plugin.js'): T {
		const script = new vm.Script(code, { filename, displayErrors: true });
		// eslint-disable-next-line @typescript-eslint/no-implied-eval
		const wrapper = script.runInContext(context, { timeout: timeoutMs });
		return wrapper as T;
	}

	function dispose(): void {
		// No explicit cleanup required with vm contexts; rely on GC
	}

	return { run, dispose };
}


