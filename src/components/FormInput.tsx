import React from 'react';
import { UseFormRegister, FieldError } from 'react-hook-form';

interface FormInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  name: string;
  register: UseFormRegister<any>;
  error?: FieldError;
  required?: boolean;
}

export const FormInput: React.FC<FormInputProps> = ({
  label,
  name,
  register,
  error,
  required,
  type = 'text',
  ...props
}) => {
  const inputId = `input-${name}`;
  
  return (
    <div className="form-control w-full">
      <label htmlFor={inputId} className="label">
        <span className="label-text text-base dark:text-gray-300">
          {label}
          {required && <span className="text-error dark:text-red-400 ml-1" aria-label="required">*</span>}
        </span>
      </label>
      <input
        id={inputId}
        type={type}
        {...register(name)}
        className={`input input-bordered w-full dark:bg-gray-700 dark:text-white dark:border-gray-600 dark:focus:border-blue-400 ${error ? 'input-error dark:border-red-500' : ''}`}
        aria-invalid={error ? 'true' : 'false'}
        aria-describedby={error ? `${inputId}-error` : undefined}
        {...props}
      />
      {error && (
        <label id={`${inputId}-error`} className="label">
          <span className="label-text-alt text-error dark:text-red-400">{error.message}</span>
        </label>
      )}
    </div>
  );
};

interface FormTextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string;
  name: string;
  register: UseFormRegister<any>;
  error?: FieldError;
  required?: boolean;
}

export const FormTextarea: React.FC<FormTextareaProps> = ({
  label,
  name,
  register,
  error,
  required,
  ...props
}) => {
  const textareaId = `textarea-${name}`;
  
  return (
    <div className="form-control">
      <label htmlFor={textareaId} className="label dark:text-gray-300">
        <span className="label-text dark:text-gray-300">
          {label}
          {required && <span className="text-error dark:text-red-400 ml-1" aria-label="required">*</span>}
        </span>
      </label>
      <textarea
        id={textareaId}
        {...register(name)}
        className={`textarea textarea-bordered dark:bg-gray-700 dark:text-white dark:border-gray-600 dark:focus:border-blue-400 ${error ? 'textarea-error dark:border-red-500' : ''}`}
        aria-invalid={error ? 'true' : 'false'}
        aria-describedby={error ? `${textareaId}-error` : undefined}
        {...props}
      />
      {error && (
        <label id={`${textareaId}-error`} className="label dark:text-gray-300">
          <span className="label-text-alt text-error dark:text-red-400">{error.message}</span>
        </label>
      )}
    </div>
  );
};

interface FormSelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  name: string;
  register: UseFormRegister<any>;
  error?: FieldError;
  required?: boolean;
  options: Array<{ value: string | number; label: string }>;
}

export const FormSelect: React.FC<FormSelectProps> = ({
  label,
  name,
  register,
  error,
  required,
  options,
  ...props
}) => {
  const selectId = `select-${name}`;
  
  return (
    <div className="form-control w-full">
      <label htmlFor={selectId} className="label">
        <span className="label-text text-base dark:text-gray-300">
          {label}
          {required && <span className="text-error dark:text-red-400 ml-1" aria-label="required">*</span>}
        </span>
      </label>
      <select
        id={selectId}
        {...register(name)}
        className={`select select-bordered w-full dark:bg-gray-700 dark:text-white dark:border-gray-600 dark:focus:border-blue-400 ${error ? 'select-error dark:border-red-500' : ''}`}
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
          <span className="label-text-alt text-error dark:text-red-400">{error.message}</span>
        </label>
      )}
    </div>
  );
};