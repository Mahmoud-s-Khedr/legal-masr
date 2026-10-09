import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

/**
 * Opening another page starts at its top, so a just-saved record's title is in view.
 * Changes within a page (a tab, a filter in the address) keep the scroll position.
 */
export function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  }, [pathname]);
  return null;
}
