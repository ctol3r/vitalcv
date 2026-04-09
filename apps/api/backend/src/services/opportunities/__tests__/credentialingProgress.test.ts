import { calculateETA } from '../credentialingProgress';

describe('Credentialing ETA', () => {
  test('progress reflects lane states and ETA updates dynamically', () => {
    expect(calculateETA({
      identity: 'complete',
      sanctions: 'pending',
      licensure: 'missing',
      enrollment: 'in_progress'
    })).toBe('45–90 days');

    expect(calculateETA({
      identity: 'complete',
      sanctions: 'complete',
      licensure: 'complete',
      enrollment: 'complete'
    })).toBe('Ready');
  });
});
