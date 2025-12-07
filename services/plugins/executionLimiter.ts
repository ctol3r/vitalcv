import { moduleRegistry } from '../microkernel/registry.js';

export interface ExecutionLimits {
	timeoutMs: number;
	maxHeapIncreaseBytes: number; // soft cap
	label?: string;
}

export async function withLimits<T>(limits: ExecutionLimits, fn: () => Promise<T>): Promise<T> {
	const start = process.hrtime.bigint();
	const startMem = process.memoryUsage().heapUsed;

	let timeoutId: NodeJS.Timeout | undefined;
	let timedOut = false;
	const timeoutPromise = new Promise<never>((_, reject) => {
		timeoutId = setTimeout(() => {
			timedOut = true;
			reject(new Error(`Execution timed out after ${limits.timeoutMs}ms`));
		}, limits.timeoutMs);
	});

	try {
		const result = await Promise.race([fn(), timeoutPromise]);
		return result as T;
	} finally {
		if (timeoutId) clearTimeout(timeoutId);

		const end = process.hrtime.bigint();
		const elapsedMs = Number(end - start) / 1_000_000;
		const endMem = process.memoryUsage().heapUsed;
		const deltaMem = endMem - startMem;

		// Update health (best-effort, no throw)
		try {
			const label = limits.label ?? 'plugin';
			moduleRegistry.updateHealth(label, {
				uptime: 0, // not tracked here
				latency: elapsedMs,
				failureRate: timedOut ? 1 : 0,
				lastError: timedOut ? 'timeout' : undefined,
				lastErrorAt: timedOut ? new Date() : undefined,
				eventThroughput: 0,
				lastChecked: new Date(),
			});
		} catch {
			// ignore registry errors
		}

		// Soft memory cap warning
		if (deltaMem > limits.maxHeapIncreaseBytes) {
			// eslint-disable-next-line no-console
			console.warn('[plugins/executionLimiter] memory increase exceeded soft cap', {
				deltaMem,
				max: limits.maxHeapIncreaseBytes,
			});
		}
	}
}


