import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import FocusLock from 'react-focus-lock'
import { Button } from './Button'
import { usePresence } from '../hooks/usePresence'
import { MOTION } from '../utils/motion'

export interface ConfirmOptions {
  /** Stated as an action, not a question prompt — e.g. "Delete this review?" */
  title: string
  /** Consequences the user might not expect. Supports line breaks. */
  message?: string
  /** Primary button label — repeat the action verb, e.g. "Delete review". */
  confirmLabel?: string
  /** Secondary button label — the safe alternative, e.g. "Keep it". */
  cancelLabel?: string
  /** Destructive actions get error styling on the primary button. */
  danger?: boolean
}

type ConfirmFn = (options: ConfirmOptions) => Promise<boolean>

const ConfirmContext = createContext<ConfirmFn | null>(null)

/**
 * Imperative, promise-based confirmation that matches the in-app dialog styling.
 * Returns `true` if the user confirms, `false` if they dismiss (button, backdrop,
 * or Escape). Drop-in replacement for `window.confirm`:
 *
 *   const confirm = useConfirm()
 *   if (!(await confirm({ title: 'Delete this review?', danger: true }))) return
 */
export function useConfirm(): ConfirmFn {
  const ctx = useContext(ConfirmContext)
  if (!ctx) throw new Error('useConfirm must be used within a <ConfirmProvider>')
  return ctx
}

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  // Kept across the exit animation so the dialog content doesn't blank out mid-close.
  const [options, setOptions] = useState<ConfirmOptions>({ title: '' })
  const resolverRef = useRef<((value: boolean) => void) | null>(null)

  const confirm = useCallback<ConfirmFn>((opts) => {
    setOptions(opts)
    setOpen(true)
    return new Promise<boolean>((resolve) => {
      resolverRef.current = resolve
    })
  }, [])

  const settle = useCallback((result: boolean) => {
    resolverRef.current?.(result)
    resolverRef.current = null
    setOpen(false)
  }, [])

  const { shouldRender, status, ref } = usePresence(open, { duration: MOTION.modal })
  const exiting = status === 'exiting'

  // Escape dismisses (as "cancel") and body scroll locks while the dialog is up.
  useEffect(() => {
    if (!shouldRender) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') settle(false)
    }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = 'unset'
    }
  }, [shouldRender, settle])

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {shouldRender && (
        <FocusLock returnFocus={true}>
          <div
            role="presentation"
            onClick={() => settle(false)}
            className={`fixed inset-0 bg-black bg-opacity-50 dark:bg-opacity-70 flex items-center justify-center p-4 z-modal duration-300 ${
              exiting ? 'animate-out fade-out' : 'animate-in fade-in'
            }`}
          >
            <div
              ref={ref}
              role="alertdialog"
              aria-modal="true"
              aria-labelledby="confirm-dialog-title"
              aria-describedby={options.message ? 'confirm-dialog-desc' : undefined}
              onClick={(e) => e.stopPropagation()}
              className={`bg-base-100 rounded-lg shadow-sm max-w-md w-full duration-300 ${
                exiting ? 'animate-out zoom-out-95' : 'animate-in zoom-in-95'
              }`}
            >
              <div className="p-6">
                <h2 id="confirm-dialog-title" className="text-lg font-bold text-base-content">
                  {options.title}
                </h2>
                {options.message && (
                  <p
                    id="confirm-dialog-desc"
                    className="mt-2 text-sm text-base-content/70 whitespace-pre-line"
                  >
                    {options.message}
                  </p>
                )}
                <div className="mt-6 flex justify-end gap-2">
                  <Button variant="ghost" onClick={() => settle(false)}>
                    {options.cancelLabel ?? 'Cancel'}
                  </Button>
                  <Button
                    variant={options.danger ? 'error' : 'primary'}
                    onClick={() => settle(true)}
                  >
                    {options.confirmLabel ?? 'Confirm'}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </FocusLock>
      )}
    </ConfirmContext.Provider>
  )
}
