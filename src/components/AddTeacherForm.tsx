import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { teacherProfileSchema, TeacherProfileFormData } from '../lib/validation';
import { useCreateTeacher } from '../hooks/useTeachers';
import { useInstitutes, useCities, useDesignations } from '../hooks/useTeachersOptimized';
import { FormInput, FormTextarea } from './FormInput';
import { AvatarUpload } from './AvatarUpload';
import { logger } from '../lib/logger';
import { Button } from './Button';

interface AddTeacherFormProps {
  onSuccess?: () => void;
  onCancel?: () => void;
}

export const AddTeacherForm: React.FC<AddTeacherFormProps> = ({ onSuccess, onCancel }) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const createTeacherMutation = useCreateTeacher();
  const { data: institutes } = useInstitutes();
  const { data: cities } = useCities();
  const { data: designations } = useDesignations();

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    watch,
    setValue,
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
        avatar_url: data.avatar_url || null,
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
        options={institutes}
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
        options={designations}
      />

      <FormInput
        label="City"
        name="city"
        register={register}
        error={errors.city}
        required
        placeholder="New York, London, Tokyo, etc."
        options={cities}
      />

      <div className="divider text-base-content/60">Additional details (optional)</div>

      <FormInput
        label="LinkedIn URL"
        name="linkedin_url"
        register={register}
        error={errors.linkedin_url}
        placeholder="linkedin.com/in/username"
      />

      <AvatarUpload
        label="Photo"
        previewName={watch('name') || 'Teacher'}
        value={watch('avatar_url') || ''}
        onChange={(url) => setValue('avatar_url', url)}
        formError={errors.avatar_url?.message}
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
        <div role="alert" className="alert alert-error">
          <span>{(createTeacherMutation.error as Error).message}</span>
        </div>
      )}

      {createTeacherMutation.isSuccess && (
        <div role="alert" className="alert alert-success">
          <span>Teacher added</span>
        </div>
      )}

      <div className="flex justify-end gap-2">
        {onCancel && (
          <Button
            variant="ghost"
            type="button"
            onClick={onCancel}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
        )}
        <Button
          variant="primary"
          type="submit"
          loading={isSubmitting || createTeacherMutation.isPending}
        >
          {isSubmitting || createTeacherMutation.isPending ? 'Adding Teacher...' : 'Add Teacher'}
        </Button>
      </div>
    </form>
  );
};