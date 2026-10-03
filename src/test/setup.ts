import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// Base UI dispatches PointerEvent for checkbox activation; jsdom exposes only
// MouseEvent in this test environment.
if (!window.PointerEvent) {
  window.PointerEvent = MouseEvent as typeof PointerEvent;
}

afterEach(cleanup);
