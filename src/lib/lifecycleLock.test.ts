import { describe, expect, it } from 'vitest';
import { LIFECYCLE_LOCK_GAP_MS, shouldLockForLifecycleGap } from './lifecycleLock';

describe('lifecycle lock gap detection', () => {
  it('does not lock during normal scheduler intervals', () => {
    expect(shouldLockForLifecycleGap(1_000, 2_000)).toBe(false);
  });

  it('locks after a substantial wall-clock pause such as device sleep', () => {
    expect(shouldLockForLifecycleGap(1_000, 1_000 + LIFECYCLE_LOCK_GAP_MS)).toBe(true);
  });
});
