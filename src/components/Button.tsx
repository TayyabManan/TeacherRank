import React, { forwardRef } from 'react';

type Variant =
  | 'primary'
  | 'secondary'
  | 'ghost'
  | 'outline'
  | 'error'
  | 'success'
  | 'warning'
  | 'info'
  | 'neutral'
  | 'link'
  | 'default';
type Size = 'xs' | 'sm' | 'md' | 'lg';
type Touch = 'default' | 'tall';

// DaisyUI class for each variant — the app's button look lives here, once.
// `default` is a plain DaisyUI `btn` with no colour (e.g. inactive pagination).
const VARIANT: Record<Variant, string> = {
  primary: 'btn-primary',
  secondary: 'btn-secondary',
  ghost: 'btn-ghost',
  outline: 'btn-outline',
  error: 'btn-error',
  success: 'btn-success',
  warning: 'btn-warning',
  info: 'btn-info',
  neutral: 'btn-neutral',
  link: 'btn-link',
  default: '',
};

const SIZE: Record<Size, string> = {
  xs: 'btn-xs',
  sm: 'btn-sm',
  md: '', // DaisyUI default
  lg: 'btn-lg',
};

// Spinner size tracks the button size so it never looks oversized on small buttons.
const SPINNER: Record<Size, string> = {
  xs: 'loading-xs',
  sm: 'loading-sm',
  md: 'loading-sm',
  lg: 'loading-md',
};

// Mobile tap-target helpers (defined in styles.css / mobile.css)
const TOUCH: Record<Touch, string> = {
  default: 'touch-target touch-manipulation',
  tall: 'touch-target-tall touch-manipulation',
};

export interface ButtonClassOptions {
  variant?: Variant;
  size?: Size;
  block?: boolean;
  wide?: boolean;
  circle?: boolean;
  touch?: Touch;
  className?: string;
}

/**
 * Build the DaisyUI button class string. Use this for elements that should look
 * like a button but aren't a `<button>` — e.g. an `<a>` or react-router `<Link>`.
 */
export function buttonClasses({
  variant = 'primary',
  size = 'md',
  block = false,
  wide = false,
  circle = false,
  touch,
  className,
}: ButtonClassOptions = {}): string {
  return [
    'btn',
    VARIANT[variant],
    SIZE[size],
    block && 'btn-block',
    wide && 'btn-wide',
    circle && 'btn-circle',
    touch && TOUCH[touch],
    className,
  ]
    .filter(Boolean)
    .join(' ');
}

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    Omit<ButtonClassOptions, 'className'> {
  loading?: boolean;
}

/**
 * App-wide button primitive wrapping DaisyUI `btn`. Variants, sizes, the loading
 * spinner and tap-target sizing are defined once here so buttons stay consistent.
 * Extra classes passed via `className` are merged last. For links styled as
 * buttons, use `buttonClasses()` instead of forcing them through `<button>`.
 */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant,
    size,
    block,
    wide,
    circle,
    touch,
    loading = false,
    disabled,
    type = 'button',
    className,
    children,
    ...rest
  },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={buttonClasses({ variant, size, block, wide, circle, touch, className })}
      {...rest}
    >
      {loading && (
        <span className={`loading loading-spinner ${SPINNER[size ?? 'md']}`} aria-hidden="true" />
      )}
      {children}
    </button>
  );
});
