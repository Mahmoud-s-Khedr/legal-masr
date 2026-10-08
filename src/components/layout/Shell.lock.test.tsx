import '../../i18n';
import { act, fireEvent, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../app/router', () => ({ AppRoutes: () => null, NAV_GROUPS: [] }));
vi.mock('../../features/search/components/GlobalSearch', () => ({ GlobalSearch: () => null }));
vi.mock('../../features/settings/api/settingsApi', () => ({
  useSettings: () => ({ data: undefined }),
}));
vi.mock('./LanguageSwitcher', () => ({ LanguageSwitcher: () => null }));
vi.mock('./DeveloperContacts', () => ({ DeveloperContacts: () => null }));
import { Shell } from './Shell';

function advance(minutes: number) {
  act(() => {
    vi.advanceTimersByTime(minutes * 60_000);
  });
}

afterEach(() => vi.useRealTimers());

describe('idle lock with unavailable settings', () => {
  it('uses the 30-minute fallback while settings are unavailable', () => {
    vi.useFakeTimers();
    const lock = vi.fn();
    render(<Shell onLock={lock} />);
    advance(29);
    expect(lock).not.toHaveBeenCalled();
    advance(1);
    expect(lock).toHaveBeenCalledTimes(1);
  });

  it('treats scroll and wheel as activity', () => {
    vi.useFakeTimers();
    const lock = vi.fn();
    render(<Shell onLock={lock} />);
    advance(29);
    fireEvent.scroll(window);
    advance(29);
    fireEvent.wheel(window);
    advance(29);
    expect(lock).not.toHaveBeenCalled();
    advance(1);
    expect(lock).toHaveBeenCalledTimes(1);
  });

  it('keeps the idle deadline across callback changes and calls the latest callback', () => {
    vi.useFakeTimers();
    const oldLock = vi.fn();
    const newLock = vi.fn();
    const view = render(<Shell onLock={oldLock} />);
    advance(29);
    view.rerender(<Shell onLock={newLock} />);
    advance(1);
    expect(oldLock).not.toHaveBeenCalled();
    expect(newLock).toHaveBeenCalledTimes(1);
  });
});
