import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import FocusLock from 'react-focus-lock'
import { Button } from './Button'
import { usePresence } from '../hooks/usePresence'
import { MOTION } from '../utils/motion'

export interface ConfirmInput {
  /** Label above the text field, e.g. "Reason for flagging". */
  label: string
  placeholder?: string
  /** When true, the confirm button stays disabled until something is typed. */
  required?: boolean
}

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
  /** Ask for a line of text (replaces window.prompt). Resolves to the entered
      string on confirm, or null on dismiss — instead of a boolean. */
  input?: ConfirmInput
}

interface ConfirmFn {
  (options: ConfirmOptions & { input: ConfirmInput }): Promise<string | null>
  (options: ConfirmOptions & { input?: undefined }): Promise<boolean>
}

const ConfirmContext = createContext<ConfirmFn | null>(null)

/**
 * Imperative, promise-based confirmation that matches the in-app dialog styling.
 * Returns `true` if the user confirms, `false` if they dismiss (button, backdrop,
 * or Escape). Drop-in replacement for `window.confirm`:
 *
 *   const confirm = useConfirm()
 *   if (!(await confirm({ title: 'Delete this review?', danger: true }))) return
 *
 * With `input`, it replaces `window.prompt` and resolves the typed string
 * (or null when dismissed):
 *
 *   const reason = await confirm({ title: 'Flag this review?', input: { label: 'Reason' } })
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
  const [inputValue, setInputValue] = useState('')
  const resolverRef = useRef<((value: boolean | string | null) => void) | null>(null)

  const confirm = useCallback((opts: ConfirmOptions) => {
    setOptions(opts)
    setInputValue('')
    setOpen(true)
    return new Promise<boolean | string | null>((resolve) => {
      resolverRef.current = resolve
    })
  }, []) as ConfirmFn

  const settle = useCallback((confirmed: boolean) => {
    const resolver = resolverRef.current
    resolverRef.current = null
    setOpen(false)
    resolver?.(options.input ? (confirmed ? inputValue.trim() : null) : confirmed)
  }, [options, inputValue])

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
            className={`fixed inset-0 bg-neutral/60 backdrop-blur-sm flex items-center justify-center p-4 z-modal duration-300 ${
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
                {options.input && (
                  <div className="mt-4">
                    <label htmlFor="confirm-dialog-input" className="label">
                      <span className="label-text">
                        {options.input.label}
                        {options.input.required && (
                          <span className="text-error ml-1" aria-label="required">*</span>
                        )}
                      </span>
                    </label>
                    <input
                      id="confirm-dialog-input"
                      type="text"
                      value={inputValue}
                      onChange={(e) => setInputValue(e.target.value)}
                      placeholder={options.input.placeholder}
                      className="input input-bordered w-full"
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !(options.input?.required && !inputValue.trim())) {
                          e.preventDefault()
                          settle(true)
                        }
                      }}
                    />
                  </div>
                )}
                <div className="mt-6 flex justify-end gap-2">
                  <Button variant="ghost" onClick={() => settle(false)}>
                    {options.cancelLabel ?? 'Cancel'}
                  </Button>
                  <Button
                    variant={options.danger ? 'error' : 'primary'}
                    disabled={Boolean(options.input?.required && !inputValue.trim())}
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
