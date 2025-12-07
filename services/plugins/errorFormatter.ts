export interface FormattedPluginError {
	name: string;
	message: string;
	stack?: string;
	code?: string | number;
}

/**
 * Normalize errors thrown from sandboxed plugins so they are safe to expose.
 */
export function formatPluginError(error: unknown): FormattedPluginError {
	if (error instanceof Error) {
		return {
			name: sanitize(error.name || 'Error'),
			message: sanitize(error.message || 'Unknown error'),
			stack: sanitizeStack(error.stack),
			// @ts-expect-error code may or may not exist
			code: typeof (error as any).code !== 'undefined' ? (error as any).code : undefined,
		};
	}
	if (typeof error === 'string') {
		return { name: 'Error', message: sanitize(error) };
	}
	try {
		return { name: 'Error', message: sanitize(JSON.stringify(error)) };
	} catch {
		return { name: 'Error', message: 'Unknown error' };
	}
}

function sanitizeStack(stack?: string): string | undefined {
	if (!stack) return undefined;
	// Strip absolute paths and internal VM filenames; keep function names and line numbers loosely
	return stack
		.split('\n')
		.map((line) =>
			line
				.replace(/file:\/\/\/?[^\s)]+/g, 'file://sandbox.js')
				.replace(/\((?:internal|node:vm)[^)]+\)/g, '(sandbox)')
				.replace(/at ([^\(]+) \(([^)]+)\)/, 'at $1 (sandbox)'),
		)
		.join('\n');
}

function sanitize(value: string): string {
	// Remove control chars
	return value.replace(/[\u0000-\u001F\u007F-\u009F]/g, '').slice(0, 10_000);
}


