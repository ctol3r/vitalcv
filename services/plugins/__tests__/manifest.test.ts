import { describe, it, expect } from '@jest/globals';
import { PluginManifestModel } from '../../plugins/models/PluginManifest';

describe('PluginManifestModel', () => {
	it('validates a correct manifest', () => {
		const ok = PluginManifestModel.validate({
			name: 'example',
			version: '1.0.0',
			author: 'unit',
			capabilities: ['readTimeline'],
			permissions: ['timeline:read'],
			entrypoint: 'handler',
			signature: null,
		});
		expect(ok.ok).toBe(true);
	});

	it('fails on unknown capability and missing implied permission', () => {
		const bad = PluginManifestModel.validate({
			name: 'bad',
			version: '0.0.1',
			author: 'unit',
			capabilities: ['readTimeline', 'notRealCap'],
			permissions: [],
			entrypoint: 'handler',
			signature: null,
		});
		expect(bad.ok).toBe(false);
		if (!bad.ok) {
			expect(bad.errors.join(' ')).toContain('unknown capabilities');
			expect(bad.errors.join(' ')).toContain('missing required permission');
		}
	});
});


