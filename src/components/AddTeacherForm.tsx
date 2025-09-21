import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { teacherProfileSchema, TeacherProfileFormData } from '../lib/validation';
import { useCreateTeacher } from '../hooks/useTeachers';
import { FormInput, FormTextarea } from './FormInput';
import { logger } from '../lib/logger';

interface AddTeacherFormProps {
  onSuccess?: () => void;
  onCancel?: () => void;
}

export const AddTeacherForm: React.FC<AddTeacherFormProps> = ({ onSuccess, onCancel }) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const createTeacherMutation = useCreateTeacher();

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<TeacherProfileFormData>({
    resolver: zodResolver(teacherProfileSchema),
    defaultValues: {
      name: '',
      institute: '',
      department: '',
      designation: '',
      city: '',
      linkedin_url: '',
      bio: '',
      avatar_url: '',
    },
  });

  const onSubmit = async (data: TeacherProfileFormData) => {
    setIsSubmitting(true);
    try {
      await createTeacherMutation.mutateAsync({
        name: data.name,
        institute: data.institute,
        department: data.department || null,
        designation: data.designation,
        city: data.city,
        linkedin_url: data.linkedin_url || null,
        bio: data.bio || null,
      });
      reset();
      if (onSuccess) onSuccess();
    } catch (error) {
      logger.error('Failed to create teacher', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
      <FormInput
        label="Teacher Name"
        name="name"
        register={register}
        error={errors.name}
        required
        placeholder="Dr. Jane Smith"
      />

      <FormInput
        label="Institute/University"
        name="institute"
        register={register}
        error={errors.institute}
        required
        placeholder="Harvard University"
      />

      <FormInput
        label="Department"
        name="department"
        register={register}
        error={errors.department}
        placeholder="Computer Science"
      />

      <FormInput
        label="Designation"
        name="designation"
        register={register}
        error={errors.designation}
        required
        placeholder="Professor, Assistant Professor, Lecturer, etc."
      />

      <FormInput
        label="City"
        name="city"
        register={register}
        error={errors.city}
        required
        placeholder="New York, London, Tokyo, etc."
      />

      <FormInput
        label="LinkedIn URL"
        name="linkedin_url"
        register={register}
        error={errors.linkedin_url}
      />

      <FormInput
        label="Avatar URL"
        name="avatar_url"
        register={register}
        error={errors.avatar_url}
      />

      <FormTextarea
        label="Biography"
        name="bio"
        register={register}
        error={errors.bio}
        placeholder="Brief description of the teacher's background, expertise, and teaching style..."
        rows={4}
      />

      {createTeacherMutation.error && (
        <div role="alert" className="alert alert-error dark:bg-red-900 dark:border-red-700 dark:text-red-100">
          <span>{(createTeacherMutation.error as Error).message}</span>
        </div>
      )}

      {createTeacherMutation.isSuccess && (
        <div role="alert" className="alert alert-success dark:bg-green-900 dark:border-green-700 dark:text-green-100">
          <span>Teacher added successfully!</span>
        </div>
      )}

      <div className="flex justify-end gap-2">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="btn btn-ghost dark:text-gray-300 dark:hover:bg-gray-700"
            disabled={isSubmitting}
          >
            Cancel
          </button>
        )}
        <button
          type="submit"
          className="btn btn-primary dark:bg-blue-600 dark:hover:bg-blue-700 dark:border-blue-600"
          disabled={isSubmitting || createTeacherMutation.isPending}
        >
          {isSubmitting || createTeacherMutation.isPending ? (
            <>
              <span className="loading loading-spinner loading-sm"></span>
              Adding Teacher...
            </>
          ) : (
            'Add Teacher'
          )}
        </button>
      </div>
    </form>
  );
};