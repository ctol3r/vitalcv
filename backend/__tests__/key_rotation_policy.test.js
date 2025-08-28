"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const assert_1 = __importDefault(require("assert"));
const key_rotation_policy_1 = require("../src/blockchain/key_rotation_policy");
const now = Date.now();
const policy = new key_rotation_policy_1.KeyRotationPolicy('key1');
policy.scheduleRotation('key2', now + 1000);
assert_1.default.strictEqual(policy.getActiveKey(now), 'key1', 'Key should remain the same before time lock');
assert_1.default.strictEqual(policy.getActiveKey(now + 1500), 'key2', 'Key should rotate after time lock');
console.log('KeyRotationPolicy tests passed');
