import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { loadPlugin } from '../../plugins/loader';
import { PluginEventBridge } from '../../plugins/eventBridge';

const PLUGIN_CODE = `
module.exports = {
  handler: {
    onEvent: (event) => {
      if (!event || !event.type) throw new Error('bad event');
      // return nothing
    }
  }
}
`;

describe('Plugin Loader + EventBridge', () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	it('loads plugin and dispatches events when policy allows', async () => {
		const { manifest, exports } = await loadPlugin(
			{
				name: 'evt-plugin',
				version: '0.1.0',
				author: 'unit',
				capabilities: ['readTimeline'],
				permissions: ['timeline:read'],
				entrypoint: 'handler',
			},
			{ code: PLUGIN_CODE },
		);

		// Wire into event bridge
		const bridge = new PluginEventBridge();
		const spy = jest.fn();
		const dispatch = async (event: any) => {
			spy(event);
			// @ts-expect-error runtime value
			await exports.handler.onEvent(event);
		};
		bridge.register({
			manifest,
			dispatch,
			allowed: () => true,
		});

		await bridge.emit({ type: 'drift', payload: { foo: 1 } });
		await bridge.emit({ type: 'quality', payload: { bar: 2 } });
		expect(spy).toHaveBeenCalledTimes(2);
	});
});


