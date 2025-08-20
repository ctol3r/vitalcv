const assert = require('assert');
const { isValidNPI } = require('./validateNpi');

assert.strictEqual(isValidNPI('1234567893'), true);
assert.strictEqual(isValidNPI('1234567890'), false);
assert.strictEqual(isValidNPI('1992757165'), true);
assert.strictEqual(isValidNPI('1992757164'), false);

console.log('validateNpi tests passed');
