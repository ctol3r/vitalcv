import assert from 'assert';
import { KeyRotationPolicy } from '../src/blockchain/key_rotation_policy';

const now = Date.now();
const policy = new KeyRotationPolicy('key1');
policy.scheduleRotation('key2', now + 1000);

assert.strictEqual(policy.getActiveKey(now), 'key1', 'Key should remain the same before time lock');
assert.strictEqual(policy.getActiveKey(now + 1500), 'key2', 'Key should rotate after time lock');

console.log('KeyRotationPolicy tests passed');
