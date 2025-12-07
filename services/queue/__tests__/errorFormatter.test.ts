import { describe, expect, it } from '@jest/globals';
import { formatHandlerError } from '../errorFormatter.js';

describe('queue error formatter', () => {
  it('formats Error instances with stack and type', () => {
    const formatted = formatHandlerError(new TypeError('boom'));
    expect(formatted).toMatchObject({
      name: 'TypeError',
      message: 'boom',
      type: 'TypeError',
    });
    expect(formatted.stack).toBeDefined();
  });

  it('serializes non-error inputs', () => {
    const formatted = formatHandlerError('plain failure');
    expect(formatted).toMatchObject({
      name: 'Error',
      message: 'plain failure',
      type: 'string',
    });
  });
});

