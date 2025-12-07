import { enforcePermissions, methodToCapability, capabilityToMethods } from '../permissions.js';

describe('PluginPermissionEngine', () => {
	it('maps methods to capabilities', () => {
		expect(methodToCapability('fetchClinician')).toBe('readTimeline');
		expect(methodToCapability('queryTimeline')).toBe('readTimeline');
		expect(methodToCapability('getRisk')).toBe('runAnalysis');
		expect(methodToCapability('getCCI')).toBe('runAnalysis');
		expect(methodToCapability('runFusion')).toBe('runAnalysis');
		expect(methodToCapability('runForecast')).toBe('provideForecasts');
	});

	it('lists methods for a capability', () => {
		const methods = capabilityToMethods('runAnalysis');
		expect(methods).toEqual(expect.arrayContaining(['getRisk', 'getCCI', 'runFusion']));
	});

	it('enforces capability on missing', () => {
		const manifest = { name: 'test', capabilities: ['readTimeline'] };
		expect(() => enforcePermissions(manifest, 'runAnalysis', { method: 'getRisk' })).toThrow(
			/Plugin lacks capability 'runAnalysis'/,
		);
	});

	it('allows when capability present', () => {
		const manifest = { name: 'test', capabilities: ['readTimeline', 'runAnalysis'] };
		expect(() => enforcePermissions(manifest, 'runAnalysis', { method: 'getRisk' })).not.toThrow();
	});
});


