import React from 'react';
import { UseFormRegister, FieldError, FieldValues, Path } from 'react-hook-form';

interface FormInputProps<TFieldValues extends FieldValues = FieldValues> extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  name: Path<TFieldValues>;
  register: UseFormRegister<TFieldValues>;
  error?: FieldError;
  required?: boolean;
  /** Existing values to suggest via a <datalist> — recognition over recall. Stays free-text. */
  options?: string[];
}

export function FormInput<TFieldValues extends FieldValues = FieldValues>({
  label,
  name,
  register,
  error,
  required,
  type = 'text',
  options,
  ...props
}: FormInputProps<TFieldValues>) {
  const inputId = `input-${name}`;
  const listId = options && options.length > 0 ? `list-${name}` : undefined;
  const isPassword = type === 'password';
  const [reveal, setReveal] = React.useState(false);
  const effectiveType = isPassword && reveal ? 'text' : type;

  return (
    <div className="form-control w-full">
      <label htmlFor={inputId} className="label">
        <span className="label-text text-base">
          {label}
          {required && <span className="text-error ml-1" aria-label="required">*</span>}
        </span>
      </label>
      <div className="relative">
        <input
          id={inputId}
          type={effectiveType}
          {...register(name)}
          className={`input input-bordered w-full ${isPassword ? 'pr-10' : ''} ${error ? 'input-error' : ''}`}
          aria-invalid={error ? 'true' : 'false'}
          aria-describedby={error ? `${inputId}-error` : undefined}
          list={listId}
          // Bidi-correct typing for RTL scripts (Hebrew/Arabic): direction
          // follows the first strong character. Overridable via props.
          dir="auto"
          {...props}
        />
        {listId && (
          <datalist id={listId}>
            {options!.map((o) => (
              <option key={o} value={o} />
            ))}
          </datalist>
        )}
        {isPassword && (
          <button
            type="button"
            onClick={() => setReveal((r) => !r)}
            aria-label={reveal ? 'Hide password' : 'Show password'}
            aria-pressed={reveal}
            className="absolute inset-y-0 right-0 flex items-center pr-3 text-base-content/50 hover:text-base-content transition-colors"
          >
            {reveal ? (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
            )}
          </button>
        )}
      </div>
      {error && (
        <label id={`${inputId}-error`} className="label">
          <span className="label-text-alt text-error">{error.message}</span>
        </label>
      )}
    </div>
  );
};

interface FormTextareaProps<TFieldValues extends FieldValues = FieldValues> extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string;
  name: Path<TFieldValues>;
  register: UseFormRegister<TFieldValues>;
  error?: FieldError;
  required?: boolean;
}

export function FormTextarea<TFieldValues extends FieldValues = FieldValues>({
  label,
  name,
  register,
  error,
  required,
  ...props
}: FormTextareaProps<TFieldValues>) {
  const textareaId = `textarea-${name}`;
  
  return (
    <div className="form-control">
      <label htmlFor={textareaId} className="label">
        <span className="label-text">
          {label}
          {required && <span className="text-error ml-1" aria-label="required">*</span>}
        </span>
      </label>
      <textarea
        id={textareaId}
        {...register(name)}
        className={`textarea textarea-bordered ${error ? 'textarea-error' : ''}`}
        aria-invalid={error ? 'true' : 'false'}
        aria-describedby={error ? `${textareaId}-error` : undefined}
        // Bidi-correct typing for RTL scripts — see FormInput.
        dir="auto"
        {...props}
      />
      {error && (
        <label id={`${textareaId}-error`} className="label">
          <span className="label-text-alt text-error">{error.message}</span>
        </label>
      )}
    </div>
  );
};

interface FormSelectProps<TFieldValues extends FieldValues = FieldValues> extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  name: Path<TFieldValues>;
  register: UseFormRegister<TFieldValues>;
  error?: FieldError;
  required?: boolean;
  options: Array<{ value: string | number; label: string }>;
}

export function FormSelect<TFieldValues extends FieldValues = FieldValues>({
  label,
  name,
  register,
  error,
  required,
  options,
  ...props
}: FormSelectProps<TFieldValues>) {
  const selectId = `select-${name}`;
  
  return (
    <div className="form-control w-full">
      <label htmlFor={selectId} className="label">
        <span className="label-text text-base">
          {label}
          {required && <span className="text-error ml-1" aria-label="required">*</span>}
        </span>
      </label>
      <select
        id={selectId}
        {...register(name)}
        className={`select select-bordered w-full ${error ? 'select-error' : ''}`}
        aria-invalid={error ? 'true' : 'false'}
        aria-describedby={error ? `${selectId}-error` : undefined}
        {...props}
      >
        {options.map(option => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {error && (
        <label id={`${selectId}-error`} className="label">
          <span className="label-text-alt text-error">{error.message}</span>
        </label>
      )}
    </div>
  );
};