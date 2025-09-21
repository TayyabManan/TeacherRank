import React, { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { useUpdateTeacher } from '../hooks/useTeachers';
import { FormInput, FormTextarea } from './FormInput';
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
    reset();
    clearErrors();
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black dark:bg-black bg-opacity-50 dark:bg-opacity-70 flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Edit Teacher</h2>
            <button
              onClick={handleCancel}
              className="text-gray-400 hover:text-gray-600 dark:text-gray-300 dark:hover:text-gray-100 text-2xl font-bold"
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
              />

              <FormInput
                label="Institute"
                name="institute"
                type="text"
                register={register}
                error={errors.institute}
                required
                placeholder="e.g., University of Punjab"
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
              />
            </div>

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

            <div className="flex justify-end gap-3 pt-6 border-t dark:border-gray-600">
              <button
                type="button"
                onClick={handleCancel}
                className="btn btn-outline dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
                disabled={updateTeacherMutation.isPending}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-primary dark:bg-blue-600 dark:hover:bg-blue-700 dark:border-blue-600"
                disabled={updateTeacherMutation.isPending}
              >
                {updateTeacherMutation.isPending ? (
                  <>
                    <span className="loading loading-spinner loading-sm"></span>
                    Updating...
                  </>
                ) : (
                  'Save Changes'
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}