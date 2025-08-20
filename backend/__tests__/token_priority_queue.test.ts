import assert from 'assert';
import TokenPriorityQueue, { VerificationRequest } from '../src/queues/token_priority_queue';

const queue = new TokenPriorityQueue();

queue.enqueue({ token: 'low', priority: 1 });
queue.enqueue({ token: 'high', priority: 10 });
queue.enqueue({ token: 'medium', priority: 5 });

assert.strictEqual(queue.size(), 3, 'queue should contain 3 items');

const first = queue.dequeue();
assert.strictEqual(first?.token, 'high', 'highest priority token should dequeue first');

const second = queue.dequeue();
assert.strictEqual(second?.token, 'medium', 'medium priority token should dequeue second');

const third = queue.dequeue();
assert.strictEqual(third?.token, 'low', 'lowest priority token should dequeue last');

assert.strictEqual(queue.size(), 0, 'queue should be empty after dequeues');

console.log('TokenPriorityQueue tests passed.');
