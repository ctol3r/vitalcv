import TokenPriorityQueue, { VerificationRequest } from '../src/queues/token_priority_queue';

describe('TokenPriorityQueue', () => {
  test('should enqueue and dequeue tokens by priority', () => {
    const queue = new TokenPriorityQueue();
    
    queue.enqueue({ token: 'low', priority: 1 });
    queue.enqueue({ token: 'high', priority: 10 });
    queue.enqueue({ token: 'medium', priority: 5 });
    
    expect(queue.size()).toBe(3);
    
    const first = queue.dequeue();
    expect(first?.token).toBe('high');
    
    const second = queue.dequeue();
    expect(second?.token).toBe('medium');
    
    const third = queue.dequeue();
    expect(third?.token).toBe('low');
    
    expect(queue.size()).toBe(0);
  });
});
