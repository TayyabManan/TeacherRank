import React from 'react'
import type { Toast } from '../hooks/useToast'

interface ToastContainerProps {
  toasts: Toast[]
  onRemove: (id: string) => void
}

export function ToastContainer({ toasts, onRemove }: ToastContainerProps) {
  const getToastClass = (type: Toast['type']) => {
    const classes = {
      success: 'alert-success',
      error: 'alert-error',
      warning: 'alert-warning',
      info: 'alert-info'
    }
    return classes[type]
  }

  const getIcon = (type: Toast['type']) => {
    const icons = {
      success: '✅',
      error: '❌',
      warning: '⚠️',
      info: 'ℹ️'
    }
    return icons[type]
  }

  return (
    <div className="toast toast-top toast-end z-50 max-w-[90vw] md:max-w-xl">
      {toasts.map(toast => (
        <div
          key={toast.id}
          className={`alert ${getToastClass(toast.type)} shadow-lg cursor-pointer w-auto min-w-[250px] max-w-full`}
          onClick={() => onRemove(toast.id)}
          style={{ maxWidth: 'min(500px, 90vw)' }}
        >
          <div className="flex items-start gap-2 md:gap-3 w-full">
            <span className="text-base md:text-lg flex-shrink-0 mt-0.5">{getIcon(toast.type)}</span>
            <div className="flex-1 text-sm md:text-base break-words" style={{ wordBreak: 'break-word' }}>
              {toast.message}
            </div>
            <button 
              className="btn btn-ghost btn-xs flex-shrink-0"
              onClick={(e) => {
                e.stopPropagation();
                onRemove(toast.id);
              }}
            >
              ✕
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}