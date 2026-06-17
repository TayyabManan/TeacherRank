import React, { useEffect } from 'react';
import FocusLock from 'react-focus-lock';
import { usePresence } from '../hooks/usePresence';
import { MOTION } from '../utils/motion';
import { useForm } from 'react-hook-form';
import { useUpdateTeacher } from '../hooks/useTeachers';
import { useInstitutes, useCities, useDesignations } from '../hooks/useTeachersOptimized';
import { FormInput, FormTextarea } from './FormInput';
import { Button } from './Button';
import { logger } from '../lib/logger';
import type { TeacherWithStats } from '../types';

interface EditTeacherModalProps {
  teacher: TeacherWithStats;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  onError?: (message: string) => void;
}

interface FormData {
  name: string;
  designation: string;
  institute: string;
  department?: string;
  city: string;
  bio: string;
  avatar_url: string;
  linkedin_url: string;
}

export function EditTeacherModal({ teacher, isOpen, onClose, onSuccess, onError }: EditTeacherModalProps) {
  const updateTeacherMutation = useUpdateTeacher();
  const { data: institutes } = useInstitutes();
  const { data: cities } = useCities();
  const { data: designations } = useDesignations();

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    setValue,
    setError,
    clearErrors,
  } = useForm<FormData>({
    defaultValues: {
      name: teacher.name || '',
      designation: teacher.designation || '',
      institute: teacher.institute || '',
      department: teacher.department || '',
      city: teacher.city || '',
      bio: teacher.bio || '',
      avatar_url: teacher.avatar_url || '',
      linkedin_url: teacher.linkedin_url || '',
    },
  });

  // Keep the modal mounted through its exit animation; reset the form only
  // after it has fully unmounted so fields don't visibly clear during fade-out.
  const { shouldRender, status, ref: presenceRef } = usePresence(isOpen, {
    duration: MOTION.modal,
    onExited: () => {
      reset();
      clearErrors();
    },
  });
  const exiting = status === 'exiting';

  // Reset form when teacher changes
  useEffect(() => {
    reset({
      name: teacher.name || '',
      designation: teacher.designation || '',
      institute: teacher.institute || '',
      department: teacher.department || '',
      city: teacher.city || '',
      bio: teacher.bio || '',
      avatar_url: teacher.avatar_url || '',
      linkedin_url: teacher.linkedin_url || '',
    });
  }, [teacher, reset]);

  const onSubmit = async (data: FormData) => {
    // Custom validation for URLs
    if (data.linkedin_url && !data.linkedin_url.includes('linkedin.com')) {
      setError('linkedin_url', { message: 'Please enter a valid LinkedIn URL' });
      return;
    }

    if (data.avatar_url) {
      try {
        new URL(data.avatar_url);
      } catch {
        setError('avatar_url', { message: 'Please enter a valid image URL' });
        return;
      }
    }

    try {
      await updateTeacherMutation.mutateAsync({
        id: teacher.id,
        ...data,
        // Convert empty strings to null for optional fields
        department: data.department?.trim() || null,
        bio: data.bio.trim() || null,
        avatar_url: data.avatar_url.trim() || null,
        linkedin_url: data.linkedin_url.trim() || null,
      });
      
      onSuccess();
      onClose();
    } catch (error) {
      logger.error('Failed to update teacher', error);
      if (onError) {
        onError('Failed to update teacher. Please try again.');
      }
    }
  };

  const handleCancel = () => {
    // Form reset/clearErrors run in usePresence's onExited, after the exit animation.
    onClose();
  };

  // Escape to close + lock body scroll; stays active through the exit animation.
  useEffect(() => {
    if (!shouldRender) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleCancel();
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = 'unset';
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shouldRender]);

  if (!shouldRender) return null;

  return (
    <FocusLock returnFocus={true}>
    <div className={`fixed inset-0 bg-black bg-opacity-50 dark:bg-opacity-70 flex items-center justify-center p-4 z-modal duration-300 ${exiting ? 'animate-out fade-out' : 'animate-in fade-in'}`}>
      <div ref={presenceRef} role="dialog" aria-modal="true" aria-labelledby="edit-teacher-title" className={`bg-base-100 rounded-lg shadow-sm max-w-2xl w-full max-h-[90vh] overflow-y-auto duration-300 ${exiting ? 'animate-out zoom-out-95' : 'animate-in zoom-in-95'}`}>
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 id="edit-teacher-title" className="text-2xl font-bold text-base-content">Edit Teacher</h2>
            <button
              onClick={handleCancel}
              aria-label="Close"
              className="text-base-content/40 hover:text-base-content/70 text-2xl font-bold"
              disabled={updateTeacherMutation.isPending}
            >
              ×
            </button>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormInput
                label="Full Name"
                name="name"
                type="text"
                register={register}
                error={errors.name}
                required
                placeholder="e.g., Dr. John Smith"
              />

              <FormInput
                label="Designation"
                name="designation"
                type="text"
                register={register}
                error={errors.designation}
                required
                placeholder="e.g., Professor, Assistant Professor"
                options={designations}
              />

              <FormInput
                label="Institute"
                name="institute"
                type="text"
                register={register}
                error={errors.institute}
                required
                placeholder="e.g., University of Punjab"
                options={institutes}
              />

              <FormInput
                label="Department (optional)"
                name="department"
                type="text"
                register={register}
                error={errors.department}
                placeholder="e.g., Computer Science"
              />

              <FormInput
                label="City"
                name="city"
                type="text"
                register={register}
                error={errors.city}
                required
                placeholder="e.g., Lahore"
                options={cities}
              />
            </div>

            <div className="divider text-base-content/60">Additional details (optional)</div>

            <FormInput
              label="Avatar URL (optional)"
              name="avatar_url"
              type="url"
              register={register}
              error={errors.avatar_url}
              placeholder="https://example.com/avatar.jpg"
            />

            <FormInput
              label="LinkedIn Profile (optional)"
              name="linkedin_url"
              type="url"
              register={register}
              error={errors.linkedin_url}
              placeholder="https://linkedin.com/in/username"
            />

            <FormTextarea
              label="Bio (optional)"
              name="bio"
              register={register}
              error={errors.bio}
              rows={4}
              placeholder="Brief description about the teacher..."
            />

            <div className="flex justify-end gap-3 pt-6 border-t border-base-300">
              <Button
                variant="outline"
                type="button"
                onClick={handleCancel}
                disabled={updateTeacherMutation.isPending}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                type="submit"
                loading={updateTeacherMutation.isPending}
              >
                {updateTeacherMutation.isPending ? 'Updating...' : 'Save Changes'}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
    </FocusLock>
  );
}