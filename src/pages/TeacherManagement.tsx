import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUser, useProfile } from '../hooks/useAuth';
import { useUpdateTeacher, useDeleteTeacher } from '../hooks/useTeachers';
import { useTeachersOptimized } from '../hooks/useTeachersOptimized';
import { AddTeacherForm } from '../components/AddTeacherForm';
import { EditTeacherModal } from '../components/EditTeacherModal';
import { TeacherListSkeleton } from '../components/Skeleton';
import { RatingStars } from '../components/RatingStars';
import { AvatarImage } from '../components/AvatarImage';
import { Button } from '../components/Button';
import { Pagination } from '../components/Pagination';
import { useConfirm } from '../components/ConfirmDialog';
import { isAdmin } from '../lib/auth';
import { logger } from '../lib/logger';
import { useToast } from '../hooks/useToast';
import { ToastContainer } from '../components/ToastContainer';
import { useHaptic } from '../lib/haptic';
import { useMobileDetection } from '../lib/mobile';
import type { TeacherWithStats } from '../types';

export default function TeacherManagement() {
  const navigate = useNavigate();
  const { data: user } = useUser();
  const { data: profile } = useProfile(user?.id);
  const { toasts, showToast, removeToast } = useToast();
  const updateTeacherMutation = useUpdateTeacher();
  const deleteTeacherMutation = useDeleteTeacher();
  const haptic = useHaptic();
  const { mobile } = useMobileDetection();
  const confirm = useConfirm();
  
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingTeacher, setEditingTeacher] = useState<TeacherWithStats | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(1);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);

  const { data: teachersData, isLoading, refetch } = useTeachersOptimized({ page, pageSize: 20, search: debouncedSearch });

  // Check admin/moderator status
  useEffect(() => {
    const checkAuthStatus = async () => {
      if (user) {
        const { isModerator } = await import('../lib/auth');
        const hasAccess = await isModerator();
        setIsAuthorized(hasAccess);
      } else {
        setIsAuthorized(false);
      }
      setCheckingAuth(false);
    };
    checkAuthStatus();
  }, [user]);

  // Debounce the search box and drive it server-side so it reaches ALL teachers,
  // not just the current page. Reset to page 1 whenever the query changes.
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchQuery), 300);
    return () => clearTimeout(t);
  }, [searchQuery]);
  useEffect(() => {
    setPage(1);
  }, [debouncedSearch]);

  if (checkingAuth) {
    return (
      <div className="max-w-wide mx-auto">
        <div className="flex justify-center py-8">
          <span className="loading loading-spinner loading-lg"></span>
        </div>
      </div>
    );
  }

  // ProtectedRoute already handles authentication and admin check
  // This is just a fallback for edge cases
  if (!isAuthorized && user) {
    return (
      <div className="max-w-wide mx-auto">
        <div role="alert" className="alert alert-warning">
          <span>Only the administrator can manage teachers.</span>
        </div>
        <Button variant="primary" className="mt-4" onClick={() => navigate('/')}>
          Back to Home
        </Button>
      </div>
    );
  }

  // Search is applied server-side via the hook, so `teachers` is the current page.
  const teachers: TeacherWithStats[] = teachersData?.data || [];

  const handleAddSuccess = () => {
    haptic.success();
    setShowAddForm(false);
    showToast('Teacher added', 'success');
    refetch();
  };

  const handleEditSuccess = () => {
    haptic.success();
    setEditingTeacher(null);
    showToast('Teacher updated', 'success');
    refetch();
  };

  const handleDeleteTeacher = async (teacherId: string, teacherName: string) => {
    haptic.medium(); // Medium feedback for delete confirmation
    const confirmed = await confirm({
      title: `Remove ${teacherName}?`,
      message: "Their ratings will be deleted too. This can't be undone.",
      confirmLabel: 'Remove teacher',
      cancelLabel: 'Keep teacher',
      danger: true,
    });
    if (!confirmed) {
      return;
    }
    
    try {
      await deleteTeacherMutation.mutateAsync(teacherId);
      haptic.success();
      showToast(`${teacherName} removed`, 'success');
      refetch();
    } catch (error: any) {
      haptic.error();
      logger.error('Failed to delete teacher', error);
      // Show the specific error message from the mutation
      const errorMessage = error?.message || 'Failed to delete teacher. Please try again.';
      showToast(errorMessage, 'error');
    }
  };

  return (
    <>
      {/* Mobile Teacher Card Component */}
      {mobile && (
        <div className="md:hidden">
          {/* Mobile layout will be rendered here */}
        </div>
      )}
      <ToastContainer toasts={toasts} onRemove={removeToast} />
      <div className="max-w-wide mx-auto">
      <div className={`flex justify-between items-center mb-4 md:mb-6 ${
        mobile ? 'flex-col gap-4' : ''
      }`}>
        <div className={mobile ? 'text-center' : ''}>
          <h1 className={`font-bold text-base-content ${
            mobile ? 'text-2xl' : 'text-3xl'
          }`}>Teacher Management</h1>
          <p className={`text-base-content/70 mt-1 ${
            mobile ? 'text-sm' : ''
          }`}>Add and manage teachers in the system</p>
        </div>
        <Button
          variant="primary"
          block={mobile}
          touch={mobile ? 'tall' : undefined}
          onClick={() => {
            haptic.light();
            setShowAddForm(!showAddForm);
          }}
        >
          {showAddForm ? 'Cancel' : '+ Add Teacher'}
        </Button>
      </div>

      {showAddForm && (
        <div className={`card bg-base-100 shadow-lg mb-4 md:mb-6 ${
          mobile ? 'mx-2' : ''
        }`}>
          <div className={`card-body ${
            mobile ? 'p-4' : ''
          }`}>
            <h2 className={`card-title mb-4 ${
              mobile ? 'text-lg' : ''
            }`}>Add New Teacher</h2>
            <AddTeacherForm
              onSuccess={handleAddSuccess}
              onCancel={() => {
                haptic.light();
                setShowAddForm(false);
              }}
            />
          </div>
        </div>
      )}

      <div className={`card bg-base-100 shadow ${
        mobile ? 'mx-2' : ''
      }`}>
        <div className={`card-body ${
          mobile ? 'p-4' : ''
        }`}>
          <div className={`flex justify-between items-center mb-4 ${
            mobile ? 'flex-col gap-3' : ''
          }`}>
            <h2 className={`card-title ${
              mobile ? 'text-lg' : ''
            }`}>All Teachers</h2>
            <input
              type="text"
              placeholder="Search teachers..."
              className={`input input-bordered  ${
                mobile ? 'w-full text-base touch-manipulation' : 'w-64'
              }`}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          {isLoading ? (
            <TeacherListSkeleton count={4} />
          ) : (
            <>
              {/* Desktop Table View */}
              {!mobile && (
                <div className="overflow-x-auto">
                  <table className="table">
                    <thead>
                      <tr className="border-base-300">
                        <th className="text-base-content/70 bg-base-200">Avatar</th>
                        <th className="text-base-content/70 bg-base-200">Name</th>
                        <th className="text-base-content/70 bg-base-200">Institute</th>
                        <th className="text-base-content/70 bg-base-200">Designation</th>
                        <th className="text-base-content/70 bg-base-200">City</th>
                        <th className="text-base-content/70 bg-base-200">LinkedIn</th>
                        <th className="text-base-content/70 bg-base-200">Rating</th>
                        <th className="text-base-content/70 bg-base-200">Reviews</th>
                        <th className="text-base-content/70 bg-base-200">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {teachers.map((teacher: TeacherWithStats, index: number) => (
                        <tr key={teacher.id} className={`border-base-300 ${index % 2 === 0 ? 'bg-base-100' : 'bg-base-200'} hover:bg-base-200`}>
                          <td>
                            <div className="avatar">
                              <AvatarImage
                                src={teacher.avatar_url || undefined}
                                name={teacher.name}
                                size={48}
                                className=""
                              />
                            </div>
                          </td>
                          <td className="font-medium">{teacher.name}</td>
                          <td>{teacher.institute || '—'}</td>
                          <td>{teacher.designation || '—'}</td>
                          <td>{teacher.city || '—'}</td>
                          <td>
                            {teacher.linkedin_url ? (
                              <a
                                href={teacher.linkedin_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-info hover:text-info text-xs"
                              >
                                LinkedIn
                              </a>
                            ) : (
                              '—'
                            )}
                          </td>
                          <td>
                            {teacher.average_rating ? (
                              <div className="flex items-center gap-2">
                                <RatingStars rating={teacher.average_rating} size={14} allowHalf={true} />
                                <span className="text-sm text-base-content/80">{teacher.average_rating.toFixed(2)}</span>
                              </div>
                            ) : (
                              '—'
                            )}
                          </td>
                          <td>{teacher.ratings_count || 0}</td>
                          <td>
                            <div className="flex gap-2">
                              <Button
                                variant="ghost"
                                size="xs"
                                onClick={() => {
                                  haptic.light();
                                  navigate(`/teacher/${teacher.id}`);
                                }}
                              >
                                View
                              </Button>
                              <Button
                                variant="ghost"
                                size="xs"
                                className="text-info hover:bg-base-300"
                                onClick={() => {
                                  haptic.light();
                                  setEditingTeacher(teacher);
                                }}
                              >
                                Edit
                              </Button>
                              <Button
                                variant="ghost"
                                size="xs"
                                className="text-error hover:bg-base-300"
                                onClick={() => handleDeleteTeacher(teacher.id, teacher.name)}
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
              )}

              {/* Mobile Card View */}
              {mobile && (
                <div className="space-y-4">
                  {teachers.map((teacher: TeacherWithStats) => (
                    <div key={teacher.id} className="bg-base-100 rounded-lg p-4 shadow border border-base-300">
                      <div className="flex items-start gap-3 mb-3">
                        <AvatarImage
                          src={teacher.avatar_url || undefined}
                          name={teacher.name}
                          size={56}
                          className="flex-shrink-0"
                        />
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-base-content text-base mb-1 truncate">
                            {teacher.name}
                          </h3>
                          <p className="text-sm text-base-content/70 truncate mb-1">
                            {teacher.institute || 'No institute'}
                          </p>
                          {teacher.designation && (
                            <p className="text-xs text-base-content/70 truncate">
                              {teacher.designation}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3 mb-3 text-xs">
                        <div>
                          <span className="text-base-content/70">Location:</span>
                          <p className="text-base-content font-medium">{teacher.city || 'Not specified'}</p>
                        </div>
                        <div>
                          <span className="text-base-content/70">Reviews:</span>
                          <p className="text-base-content font-medium">{teacher.ratings_count || 0}</p>
                        </div>
                      </div>

                      {teacher.average_rating && (
                        <div className="flex items-center gap-2 mb-3">
                          <RatingStars rating={teacher.average_rating} size={16} allowHalf={true} />
                          <span className="text-sm font-semibold text-base-content">
                            {teacher.average_rating.toFixed(1)}
                          </span>
                        </div>
                      )}

                      {teacher.linkedin_url && (
                        <div className="mb-3">
                          <a
                            href={teacher.linkedin_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-info hover:text-info text-xs font-medium"
                            onClick={() => haptic.light()}
                          >
                            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                              <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                            </svg>
                            LinkedIn Profile
                          </a>
                        </div>
                      )}

                      <div className="flex gap-2">
                        <Button
                          variant="default"
                          touch="default"
                          className="flex-1 text-sm"
                          onClick={() => {
                            haptic.light();
                            navigate(`/teacher/${teacher.id}`);
                          }}
                        >
                          View
                        </Button>
                        <Button
                          variant="info"
                          touch="default"
                          className="flex-1 text-sm"
                          onClick={() => {
                            haptic.light();
                            setEditingTeacher(teacher);
                          }}
                        >
                          Edit
                        </Button>
                        <Button
                          variant="error"
                          touch="default"
                          className="flex-1 text-sm"
                          onClick={() => handleDeleteTeacher(teacher.id, teacher.name)}
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {teachers.length === 0 && (
            <div className="text-center py-8">
              <p className="text-base-content/70">No teachers found</p>
            </div>
          )}

          {teachersData && teachersData.totalPages > 1 && (
            <div className="mt-4">
              <Pagination
                currentPage={page}
                totalPages={teachersData.totalPages}
                onPageChange={setPage}
                className="justify-center"
              />
            </div>
          )}

          <div className={`mt-4 text-base-content/70 ${
            mobile ? 'text-center text-xs' : 'text-sm'
          }`}>
            Total: {teachersData?.total ?? 0} teachers
          </div>
        </div>
      </div>

      <div className={`card bg-base-200 mt-4 md:mt-6 ${
        mobile ? 'mx-2' : ''
      }`}>
        <div className={`card-body ${
          mobile ? 'p-4' : ''
        }`}>
          <h3 className={`font-semibold text-base-content ${
            mobile ? 'text-sm' : ''
          }`}>Quick Add Methods</h3>
          <div className={`space-y-2 text-base-content/80 ${
            mobile ? 'text-xs' : 'text-sm'
          }`}>
            <p>• Use the form above to add teachers through the web interface</p>
            <p>• Bulk import: Contact your administrator to add multiple teachers via SQL</p>
            <p>• API: Teachers can also be added programmatically (requires API access)</p>
          </div>
        </div>
      </div>

      {editingTeacher && (
        <EditTeacherModal
          teacher={editingTeacher}
          isOpen={true}
          onClose={() => setEditingTeacher(null)}
          onSuccess={handleEditSuccess}
          onError={(message) => showToast(message, 'error')}
        />
      )}
      </div>
    </>
  );
}