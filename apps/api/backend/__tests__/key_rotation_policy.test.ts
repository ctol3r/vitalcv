import { KeyRotationPolicy } from '../src/blockchain/key_rotation_policy';

describe('KeyRotationPolicy', () => {
  it('keeps the current key active until a scheduled transition', () => {
    const policy = new KeyRotationPolicy('key-current');
    const transitionTime = Date.now() + 60_000;

    policy.scheduleRotation('key-next', transitionTime);

    expect(policy.hasPendingRotation()).toBe(true);
    expect(policy.getActiveKey(transitionTime - 1)).toBe('key-current');
    expect(policy.getActiveKey(transitionTime)).toBe('key-next');
    expect(policy.hasPendingRotation()).toBe(false);
  });

  it('rejects a transition that is not in the future', () => {
    const policy = new KeyRotationPolicy('key-current');

    expect(() => policy.scheduleRotation('key-next', Date.now())).toThrow(
      'transitionTime must be in the future',
    );
  });
});
