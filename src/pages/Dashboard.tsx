import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { useUser, useProfile } from '../hooks/useAuth';
import { useRatings, useDeleteRating } from '../hooks/useRatings';
import { useIsAdmin } from '../hooks/useIsAdmin';
import { FormSkeleton } from '../components/Skeleton';
import { RatingStars } from '../components/RatingStars';
import { Button } from '../components/Button';
import { useConfirm } from '../components/ConfirmDialog';
import { useToast } from '../hooks/useToast';
import { ToastContainer } from '../components/ToastContainer';
import { logger } from '../lib/logger';
import type { RatingWithRelations } from '../types';

export default function Dashboard() {
  const navigate = useNavigate();
  const confirm = useConfirm();
  const { toasts, showToast, removeToast } = useToast();
  const { data: user } = useUser();
  const { data: profile, isLoading: profileLoading } = useProfile(user?.id);
  const { data: myRatings, isLoading: ratingsLoading } = useRatings(undefined, user?.id);
  const deleteRatingMutation = useDeleteRating();
  const [deletingRatingId, setDeletingRatingId] = useState<string | null>(null);
  // Shared cached admin check (D6).
  const { data: isAdminUser = false } = useIsAdmin();

  const handleDeleteRating = async (rating: RatingWithRelations) => {
    const confirmed = await confirm({
      title: `Delete your rating for ${rating.teacher?.name ?? 'this teacher'}?`,
      message: "This can't be undone.",
      confirmLabel: 'Delete rating',
      cancelLabel: 'Keep it',
      danger: true,
    });
    if (!confirmed) {
      return;
    }
    
    setDeletingRatingId(rating.id);
    try {
      await deleteRatingMutation.mutateAsync(rating.id);
    } catch (error) {
      logger.error('Failed to delete rating', error);
      showToast("Couldn't delete your rating. Try again.", 'error');
    } finally {
      setDeletingRatingId(null);
    }
  };

  // Profile loading state (user is already guaranteed by ProtectedRoute)
  if (profileLoading) {
    return (
      <div className="max-w-content mx-auto">
        <h1 className="text-2xl font-bold mb-4 text-base-content">Dashboard</h1>
        <FormSkeleton />
      </div>
    );
  }

  // If profile doesn't exist (edge case), wait or show error
  if (!profile) {
    return (
      <div className="max-w-content mx-auto">
        <h1 className="text-2xl font-bold mb-4 text-base-content">Dashboard</h1>
        <div role="alert" className="alert alert-info">
          <span>Setting up your profile...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-content mx-auto">
      <Helmet>
        <title>Dashboard</title>
      </Helmet>
      <ToastContainer toasts={toasts} onRemove={removeToast} />
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-base-content">Dashboard</h1>
      </div>

      <div className="space-y-6">
        <section className="card bg-base-100 shadow">
          <div className="card-body">
            <h2 className="card-title text-base-content">Profile Information</h2>
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <dt className="text-sm font-medium text-base-content/70">Display Name</dt>
                <dd className="mt-1 text-lg text-base-content">{profile.display_name || 'Not set'}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-base-content/70">Email</dt>
                <dd className="mt-1 text-lg text-base-content">{profile.email}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-base-content/70">Role</dt>
                <dd className="mt-1">
                  <span className={`badge capitalize ${profile.role === 'admin' ? 'badge-primary' : 'badge-secondary'}`}>
                    {profile.role || 'user'}
                  </span>
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-base-content/70">Member Since</dt>
                <dd className="mt-1 text-lg text-base-content">
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

        <section className="card bg-base-100 shadow">
          <div className="card-body">
            <h2 className="card-title text-base-content">My Ratings</h2>
            {ratingsLoading ? (
              <div className="flex justify-center py-8">
                <span className="loading loading-spinner loading-md"></span>
              </div>
            ) : myRatings && myRatings.length > 0 ? (
              <>
              <div className="hidden md:block overflow-x-auto">
                <table className="table">
                  <thead>
                    <tr className="border-base-300">
                      <th className="text-base-content bg-base-200">Teacher</th>
                      <th className="text-base-content bg-base-200">Institute</th>
                      <th className="text-base-content bg-base-200">Rating</th>
                      <th className="text-base-content bg-base-200">Comment</th>
                      <th className="text-base-content bg-base-200">Date</th>
                      <th className="text-base-content bg-base-200">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {myRatings.map((rating: RatingWithRelations, index: number) => (
                      <tr key={rating.id} className={`border-base-300 ${index % 2 === 0 ? 'bg-base-100' : 'bg-base-200'} hover:bg-base-200`}>
                        <td className="font-medium text-base-content">{rating.teacher?.name || 'Unknown'}</td>
                        <td className="text-sm text-base-content/70">{rating.teacher?.institute || '—'}</td>
                        <td>
                          <div className="flex items-center gap-2">
                            <RatingStars rating={rating.score} size={16} allowHalf={true} />
                            <span className="text-sm font-semibold text-base-content">{rating.score}</span>
                          </div>
                        </td>
                        <td>
                          <div className="max-w-xs truncate text-base-content" title={rating.comment}>
                            {rating.comment || '—'}
                          </div>
                        </td>
                        <td className="text-sm text-base-content">
                          {new Date(rating.created_at).toLocaleDateString()}
                        </td>
                        <td>
                          <div className="flex gap-2">
                            <Button
                              variant="ghost"
                              size="xs"
                              onClick={() => navigate(`/teacher/${rating.teacher_id}#rate`)}
                            >
                              Edit
                            </Button>
                            <Button
                              variant="ghost"
                              size="xs"
                              className="text-error hover:bg-error hover:text-error-content"
                              onClick={() => handleDeleteRating(rating)}
                              disabled={deletingRatingId === rating.id || deleteRatingMutation.isPending}
                              loading={deletingRatingId === rating.id}
                            >
                              Delete
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile: stacked cards (a 6-column table is awkward to horizontal-scroll on phones) */}
              <ul className="md:hidden space-y-3">
                {myRatings.map((rating: RatingWithRelations) => (
                  <li key={rating.id} className="rounded-lg border border-base-300 bg-base-100 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-medium text-base-content truncate">{rating.teacher?.name || 'Unknown'}</p>
                        <p className="text-sm text-base-content/70 truncate">{rating.teacher?.institute || '—'}</p>
                      </div>
                      <span className="text-xs text-base-content/60 whitespace-nowrap">
                        {new Date(rating.created_at).toLocaleDateString()}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-2">
                      <RatingStars rating={rating.score} size={16} allowHalf={true} />
                      <span className="text-sm font-semibold text-base-content">{rating.score}</span>
                    </div>
                    {rating.comment && (
                      <p className="text-sm text-base-content/80 mt-2">{rating.comment}</p>
                    )}
                    <div className="flex gap-2 mt-3">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="flex-1"
                        onClick={() => navigate(`/teacher/${rating.teacher_id}#rate`)}
                      >
                        Edit
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="flex-1 text-error hover:bg-error hover:text-error-content"
                        onClick={() => handleDeleteRating(rating)}
                        disabled={deletingRatingId === rating.id || deleteRatingMutation.isPending}
                        loading={deletingRatingId === rating.id}
                      >
                        Delete
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
              </>
            ) : (
              <div className="text-center py-8">
                <p className="text-base-content/70 mb-4">You haven't rated any teachers yet.</p>
                <Button
                  variant="primary"
                  onClick={() => navigate('/')}
                >
                  Browse Teachers
                </Button>
              </div>
            )}
          </div>
        </section>

        {isAdminUser && (
          <section className="card bg-base-100 shadow">
            <div className="card-body">
              <h2 className="card-title text-base-content">Admin Tools</h2>
              <p className="text-base-content/70">
                As the administrator, you can manage all teachers in the system.
              </p>
              <div className="card-actions mt-4">
                <Button
                  variant="primary"
                  onClick={() => navigate('/manage-teachers')}
                >
                  Manage Teachers
                </Button>
              </div>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}