import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUser, useProfile } from '../hooks/useAuth';
import { useRatings, useDeleteRating } from '../hooks/useRatings';
import { FormSkeleton } from '../components/Skeleton';
import { RatingStars } from '../components/RatingStars';
import { isAdmin } from '../lib/auth';
import { logger } from '../lib/logger';
import type { RatingWithRelations } from '../types';

export default function Dashboard() {
  const navigate = useNavigate();
  const { data: user } = useUser();
  const { data: profile, isLoading: profileLoading } = useProfile(user?.id);
  const { data: myRatings, isLoading: ratingsLoading } = useRatings(undefined, user?.id);
  const deleteRatingMutation = useDeleteRating();
  const [deletingRatingId, setDeletingRatingId] = useState<string | null>(null);
  const [isAdminUser, setIsAdminUser] = useState(false);

  // Check admin status
  useEffect(() => {
    const checkAdminStatus = async () => {
      try {
        if (user) {
          const adminStatus = await isAdmin();
          setIsAdminUser(adminStatus);
        } else {
          setIsAdminUser(false);
        }
      } catch (error) {
        console.error('Error checking admin status:', error);
        setIsAdminUser(false);
      }
    };
    checkAdminStatus();
  }, [user]);

  const handleDeleteRating = async (rating: RatingWithRelations) => {
    if (!window.confirm(`Are you sure you want to delete your rating for ${rating.teacher?.name}? This action cannot be undone.`)) {
      return;
    }
    
    setDeletingRatingId(rating.id);
    try {
      await deleteRatingMutation.mutateAsync(rating.id);
    } catch (error) {
      logger.error('Failed to delete rating', error);
      alert('Failed to delete rating. Please try again.');
    } finally {
      setDeletingRatingId(null);
    }
  };

  // Profile loading state (user is already guaranteed by ProtectedRoute)
  if (profileLoading) {
    return (
      <div className="max-w-4xl mx-auto p-4">
        <h1 className="text-2xl font-bold mb-4 text-gray-900 dark:text-white">Dashboard</h1>
        <FormSkeleton />
      </div>
    );
  }

  // If profile doesn't exist (edge case), wait or show error
  if (!profile) {
    return (
      <div className="max-w-4xl mx-auto p-4">
        <h1 className="text-2xl font-bold mb-4 text-gray-900 dark:text-white">Dashboard</h1>
        <div role="alert" className="alert alert-info">
          <span>Setting up your profile...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-4">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Dashboard</h1>
      </div>

      <div className="space-y-6">
        <section className="card bg-base-100 dark:bg-gray-800 shadow dark:shadow-gray-900/50">
          <div className="card-body">
            <h2 className="card-title text-gray-900 dark:text-white">Profile Information</h2>
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Display Name</dt>
                <dd className="mt-1 text-lg text-gray-900 dark:text-white">{profile.display_name || 'Not set'}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Email</dt>
                <dd className="mt-1 text-lg text-gray-900 dark:text-white">{profile.email}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Role</dt>
                <dd className="mt-1">
                  <span className={`badge ${profile.role === 'teacher' ? 'badge-primary' : 'badge-secondary'}`}>
                    {profile.role}
                  </span>
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Member Since</dt>
                <dd className="mt-1 text-lg text-gray-900 dark:text-white">
                  {new Date(profile.created_at).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}
                </dd>
              </div>
            </dl>
          </div>
        </section>

        <section className="card bg-base-100 dark:bg-gray-800 shadow dark:shadow-gray-900/50">
          <div className="card-body">
            <h2 className="card-title text-gray-900 dark:text-white">My Ratings</h2>
            {ratingsLoading ? (
              <div className="flex justify-center py-8">
                <span className="loading loading-spinner loading-md"></span>
              </div>
            ) : myRatings && myRatings.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="table">
                  <thead>
                    <tr className="border-gray-200 dark:border-gray-700">
                      <th className="text-gray-900 dark:text-white bg-gray-50 dark:bg-gray-900">Teacher</th>
                      <th className="text-gray-900 dark:text-white bg-gray-50 dark:bg-gray-900">Institute</th>
                      <th className="text-gray-900 dark:text-white bg-gray-50 dark:bg-gray-900">Rating</th>
                      <th className="text-gray-900 dark:text-white bg-gray-50 dark:bg-gray-900">Comment</th>
                      <th className="text-gray-900 dark:text-white bg-gray-50 dark:bg-gray-900">Date</th>
                      <th className="text-gray-900 dark:text-white bg-gray-50 dark:bg-gray-900">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {myRatings.map((rating: RatingWithRelations, index: number) => (
                      <tr key={rating.id} className={`border-gray-200 dark:border-gray-700 ${index % 2 === 0 ? 'bg-white dark:bg-gray-800' : 'bg-gray-50 dark:bg-gray-800/50'} hover:bg-gray-100 dark:hover:bg-gray-700`}>
                        <td className="font-medium text-gray-900 dark:text-white">{rating.teacher?.name || 'Unknown'}</td>
                        <td className="text-sm text-gray-500 dark:text-gray-400">{rating.teacher?.institute || '—'}</td>
                        <td>
                          <div className="flex items-center gap-2">
                            <RatingStars rating={rating.score} size={16} allowHalf={true} />
                            <span className="text-sm font-semibold text-gray-900 dark:text-white">{rating.score}</span>
                          </div>
                        </td>
                        <td>
                          <div className="max-w-xs truncate text-gray-900 dark:text-white" title={rating.comment}>
                            {rating.comment || '—'}
                          </div>
                        </td>
                        <td className="text-sm text-gray-900 dark:text-white">
                          {new Date(rating.created_at).toLocaleDateString()}
                        </td>
                        <td>
                          <div className="flex gap-2">
                            <button
                              className="btn btn-ghost btn-xs hover:bg-gray-100 dark:hover:bg-gray-700 dark:text-gray-300"
                              onClick={() => navigate(`/teacher/${rating.teacher_id}#rate`))
                            >
                              Edit
                            </button>
                            <button
                              className="btn btn-ghost btn-xs text-error hover:bg-error hover:text-error-content dark:text-red-400 dark:hover:bg-red-600 dark:hover:text-white"
                              onClick={() => handleDeleteRating(rating)}
                              disabled={deletingRatingId === rating.id || deleteRatingMutation.isPending}
                            >
                              {deletingRatingId === rating.id ? (
                                <span className="loading loading-spinner loading-xs"></span>
                              ) : (
                                'Delete'
                              )}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-8">
                <p className="text-gray-500 dark:text-gray-400 mb-4">You haven't rated any teachers yet.</p>
                <button
                  className="btn btn-primary"
                  onClick={() => navigate('/')}
                >
                  Browse Teachers
                </button>
              </div>
            )}
          </div>
        </section>

        {isAdminUser && (
          <section className="card bg-base-100 dark:bg-gray-800 shadow dark:shadow-gray-900/50">
            <div className="card-body">
              <h2 className="card-title text-gray-900 dark:text-white">Admin Tools</h2>
              <p className="text-gray-600 dark:text-gray-400">
                As the administrator, you can manage all teachers in the system.
              </p>
              <div className="card-actions mt-4">
                <button 
                  className="btn btn-primary"
                  onClick={() => navigate('/manage-teachers')}
                >
                  Manage Teachers
                </button>
              </div>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}