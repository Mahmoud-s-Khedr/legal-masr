import { describe, expect, it } from 'vitest';
import { assertSafeCaptureFixture, captureModeEnabledFor } from './captureBridge';

describe('capture bridge guardrails', () => {
  it('cannot be activated in a production build', () => {
    expect(captureModeEnabledFor(false, 'true')).toBe(false);
    expect(captureModeEnabledFor(true, undefined)).toBe(false);
    expect(captureModeEnabledFor(true, 'true')).toBe(true);
  });

  it('rejects fixture values that resemble source paths or credentials', () => {
    expect(() => assertSafeCaptureFixture({ source: '/home/person/document.pdf' })).toThrow(
      /paths/i,
    );
    expect(() => assertSafeCaptureFixture({ apiKey: 'not-allowed' })).toThrow(/secrets/i);
    expect(() => assertSafeCaptureFixture({ title: 'fictional capture record' })).not.toThrow();
  });
});
