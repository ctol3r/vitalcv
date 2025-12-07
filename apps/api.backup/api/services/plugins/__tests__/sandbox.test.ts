import { describe, it, expect } from '@jest/globals';
import { createSandbox } from '../../plugins/runtime/sandbox';

describe('Plugin Sandbox', () => {
	it('executes simple code and returns exports', () => {
		const sandbox = createSandbox();
		const result = sandbox.run<{ x: number }>(`
(() => {
  const mod = { x: 42 };
  return mod;
})()
		`);
		expect(result.x).toBe(42);
		sandbox.dispose();
	});

	it('does not expose process or require by default', () => {
		const sandbox = createSandbox();
		const result = sandbox.run<{ hasProcess: boolean; hasRequire: boolean }>(`
(() => {
  // eslint-disable-next-line no-undef
  const hasProcess = typeof process !== 'undefined';
  // eslint-disable-next-line no-undef
  const hasRequire = typeof require !== 'undefined';
  return { hasProcess, hasRequire };
})()
		`);
		expect(result.hasProcess).toBe(false);
		expect(result.hasRequire).toBe(false);
		sandbox.dispose();
	});
});


