import { useEffect, useRef } from 'react';
import { useLocation, useNavigationType } from 'react-router-dom';

/**
 * Scroll to the top when the route changes via PUSH/REPLACE; on POP
 * (back/forward) do nothing so the browser restores the previous position.
 * Keyed on pathname only — search-param updates (filters, debounced search)
 * never scroll; in-page pagination handles its own scroll explicitly.
 */
export function ScrollToTop() {
  const { pathname } = useLocation();
  const navigationType = useNavigationType();
  const navTypeRef = useRef(navigationType);
  navTypeRef.current = navigationType;

  useEffect(() => {
    if (navTypeRef.current !== 'POP') {
      window.scrollTo(0, 0);
    }
  }, [pathname]);

  return null;
}
