import { fireEvent, render, screen } from '@testing-library/react';
import { Link, MemoryRouter } from 'react-router-dom';
import { expect, it, vi } from 'vitest';
import { ScrollToTop } from './ScrollToTop';

it('scrolls to the top when another page opens, not when only the query changes', () => {
  const scrollTo = vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined);
  render(
    <MemoryRouter initialEntries={['/cases']}>
      <ScrollToTop />
      <Link to="/cases/new">new</Link>
      <Link to="/cases/new?tab=2">tab</Link>
    </MemoryRouter>,
  );
  expect(scrollTo).toHaveBeenCalledTimes(1);
  fireEvent.click(screen.getByText('new'));
  expect(scrollTo).toHaveBeenCalledTimes(2);
  fireEvent.click(screen.getByText('tab'));
  expect(scrollTo).toHaveBeenCalledTimes(2);
  scrollTo.mockRestore();
});
