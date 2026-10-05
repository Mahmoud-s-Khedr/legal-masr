import assert from 'node:assert/strict';
import test from 'node:test';
import { hostGraphicsLibraries, preferWaylandBackend } from './normalize-appimage-runtime.mjs';

test('AppImage normalization keeps compositor libraries on the host', () => {
  assert.deepEqual(hostGraphicsLibraries, ['libwayland-client.so.0', 'libxkbcommon.so.0']);
});

test('AppImage normalization prefers Wayland with an X11 fallback', () => {
  const hook = '# generated\nexport GDK_BACKEND=x11 # Crash with Wayland backend\n';
  assert.equal(
    preferWaylandBackend(hook),
    '# generated\n' +
      '# Prefer the active Wayland session and use X11 only when Wayland is unavailable.\n' +
      'export GDK_BACKEND="${GDK_BACKEND:-wayland,x11}"\n',
  );
});

test('AppImage normalization refuses an unknown generated launcher hook', () => {
  assert.throws(
    () => preferWaylandBackend('export GDK_BACKEND=wayland\n'),
    /expected forced X11 backend/,
  );
});
