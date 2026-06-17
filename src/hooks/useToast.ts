import { useState, useCallback } from 'react'
import { MOTION } from '../utils/motion'

export interface Toast {
  id: string
  message: string
  type: 'success' | 'error' | 'info' | 'warning'
  /** Set during the exit animation, just before the toast unmounts. */
  exiting?: boolean
}

export function useToast() {
  const [toasts, setToasts] = useState<Toast[]>([])

  // Two-phase removal: mark `exiting` so the container can play the exit
  // animation, then actually unmount after it completes.
  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.map(t => (t.id === id ? { ...t, exiting: true } : t)))
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id))
    }, MOTION.toastOut)
  }, [])

  const showToast = useCallback((message: string, type: Toast['type'] = 'info') => {
    // Unique id even when two toasts fire in the same millisecond.
    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`
    const newToast: Toast = { id, message, type }

    setToasts(prev => [...prev, newToast])

    // Auto-dismiss after 5 seconds (routes through the exit animation).
    setTimeout(() => removeToast(id), 5000)
  }, [removeToast])

  return { toasts, showToast, removeToast }
}