import { ReactNode } from 'react'
import { useLocation } from 'react-router-dom'
import { useReducedMotion } from '../hooks/useReducedMotion'

/**
 * Subtle page transition. Keying the wrapper on the pathname forces React to
 * remount a fresh node on each navigation, which re-triggers the CSS
 * `route-enter` animation (a fade + small rise).
 *
 * Lives INSIDE the route <Suspense> so the PageLoader fallback is not itself
 * wrapped/animated — only the resolved page content fades in. Under reduced
 * motion the children render with no wrapper at all (nothing is hidden by JS).
 */
export function RouteTransition({ children }: { children: ReactNode }) {
  const location = useLocation()
  const reduced = useReducedMotion()

  if (reduced) return <>{children}</>

  return (
    <div key={location.pathname} className="route-enter">
      {children}
    </div>
  )
}
