export interface VerificationRequest {
  token: string;
  priority: number;
}

/**
 * TokenPriorityQueue implements a simple priority queue for
 * verification requests. Higher priority values are processed first.
 */
export default class TokenPriorityQueue {
  private queue: VerificationRequest[] = [];

  /**
   * Enqueue a new request. The queue is kept sorted in descending
   * priority so dequeue() always returns the highest priority item.
   */
  enqueue(request: VerificationRequest): void {
    const index = this.queue.findIndex(r => request.priority > r.priority);
    if (index === -1) {
      this.queue.push(request);
    } else {
      this.queue.splice(index, 0, request);
    }
  }

  /**
   * Remove and return the highest priority request.
   */
  dequeue(): VerificationRequest | undefined {
    return this.queue.shift();
  }

  /**
   * Inspect the queue length.
   */
  size(): number {
    return this.queue.length;
  }
}
