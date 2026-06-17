import { ReactNode } from 'react'
import { useScrollReveal } from '../hooks/useScrollReveal'

interface RevealProps {
  className?: string
  children: ReactNode
}

/**
 * Wraps a block so it fades + rises into view once when scrolled near (~15%
 * visible). Reduced-motion safe and degrades to "always visible" without JS
 * (see useScrollReveal). Use sparingly — callouts, feature blocks, section heads.
 */
export function Reveal({ className = '', children }: RevealProps) {
  const ref = useScrollReveal<HTMLDivElement>()
  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  )
}
