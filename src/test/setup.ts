import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// Base UI dispatches PointerEvent for checkbox activation; jsdom exposes only
// MouseEvent in this test environment.
if (!window.PointerEvent) {
  window.PointerEvent = MouseEvent as typeof PointerEvent;
}

// jsdom does not lay out pages, so it cannot scroll them.
window.scrollTo = () => undefined;
Element.prototype.scrollIntoView ??= () => undefined;

afterEach(cleanup);
