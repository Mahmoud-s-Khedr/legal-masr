import { describe, expect, it } from 'vitest';
import { groupRecoveryKey } from './recoveryKey';

const KEY = '3fa9c0de12b4778a5e61d0c2f9b83a4417de56c0b19a2e8f40d37c61a5b9e208';

describe('groupRecoveryKey', () => {
  it('shows an issued key in eight groups of eight', () => {
    expect(groupRecoveryKey(KEY)).toBe(
      '3fa9c0de 12b4778a 5e61d0c2 f9b83a44 17de56c0 b19a2e8f 40d37c61 a5b9e208',
    );
  });

  it('does not change what the key is: removing the spaces gives the issued key back', () => {
    expect(groupRecoveryKey(KEY).replaceAll(' ', '')).toBe(KEY);
  });

  it('regroups a key that is already grouped or dashed', () => {
    const grouped = groupRecoveryKey(KEY);
    expect(groupRecoveryKey(grouped)).toBe(grouped);
    expect(groupRecoveryKey(grouped.replaceAll(' ', '-'))).toBe(grouped);
  });

  it('leaves anything that is not a hex key exactly as it was', () => {
    expect(groupRecoveryKey('')).toBe('');
    expect(groupRecoveryKey('test-recovery-key')).toBe('test-recovery-key');
  });
});
