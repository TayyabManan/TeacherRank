import React from 'react'
import type { Toast } from '../hooks/useToast'
import { Button } from './Button'

interface ToastContainerProps {
  toasts: Toast[]
  onRemove: (id: string) => void
}

const ICON_PATHS: Record<Toast['type'], string> = {
  success: 'M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z',
  error: 'M9.75 9.75l4.5 4.5m0-4.5l-4.5 4.5M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z',
  warning:
    'M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z',
  info: 'm11.25 11.25.041-.02a.75.75 0 0 1 1.063.852l-.708 2.836a.75.75 0 0 0 1.063.853l.041-.021M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9-3.75h.008v.008H12V8.25Z',
}

const ToastIcon = ({ type }: { type: Toast['type'] }) => (
  <svg aria-hidden="true" className="w-5 h-5 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d={ICON_PATHS[type]} />
  </svg>
)

export function ToastContainer({ toasts, onRemove }: ToastContainerProps) {
  const getToastClass = (type: Toast['type']) =>
    ({ success: 'alert-success', error: 'alert-error', warning: 'alert-warning', info: 'alert-info' }[type])

  return (
    <div
      className="toast toast-top toast-end z-toast md:max-w-xl"
      aria-live="polite"
      aria-atomic="false"
    >
      {toasts.map((toast, index) => (
        <div
          key={toast.id}
          role={toast.type === 'error' || toast.type === 'warning' ? 'alert' : 'status'}
          className={`alert ${getToastClass(toast.type)} shadow-lg cursor-pointer w-auto min-w-[250px] max-w-full max-w-[min(500px,90vw)] transition-transform duration-200 ${
            toast.exiting ? 'toast-exit' : 'toast-enter'
          }`}
          // Stagger stacked toasts as they enter (capped so it never feels slow).
          style={!toast.exiting && index > 0 ? { animationDelay: `${Math.min(index, 4) * 50}ms` } : undefined}
          onClick={() => onRemove(toast.id)}
        >
          <div className="flex items-start gap-2 md:gap-3 w-full">
            <ToastIcon type={toast.type} />
            <div className="flex-1 text-sm md:text-base break-words" style={{ wordBreak: 'break-word' }}>
              {toast.message}
            </div>
            <Button
              variant="ghost"
              size="xs"
              className="flex-shrink-0"
              aria-label="Close notification"
              onClick={(e) => {
                e.stopPropagation();
                onRemove(toast.id);
              }}
            >
              <svg aria-hidden="true" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
              </svg>
            </Button>
          </div>
        </div>
      ))}
    </div>
  )
}
