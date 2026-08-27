import React, { useState, useEffect } from 'react'
import { Helmet } from '../components/Meta'
import { supabase } from '../lib/supabaseClient'
import { useUser } from '../hooks/useAuth'
import { Navigate } from 'react-router-dom'
import { TeacherRequestManager } from '../components/TeacherRequestManager'
import { useToast } from '../hooks/useToast'
import { ToastContainer } from '../components/ToastContainer'
import { Button } from '../components/Button'
import { useConfirm } from '../components/ConfirmDialog'
import { EmptyState } from '../components/EmptyState'
import { Skeleton } from '../components/Skeleton'
import { SectionErrorBoundary } from '../components/SectionErrorBoundary'
import { friendlyWriteError } from '../lib/dbErrors'
import { TrashIcon, FlagIcon, AlertTriangleIcon } from '../components/icons'
import { logger } from '../lib/logger'

interface Feedback {
  id: string
  type: 'teacher_request' | 'feature_request' | 'bug_report' | 'general'
  title: string
  description: string
  email?: string
  name?: string
  status: 'new' | 'in_progress' | 'resolved' | 'closed'
  priority: 'low' | 'medium' | 'high' | 'urgent'
  admin_notes?: string
  created_at: string
  updated_at: string
}

interface TeacherRequest {
  id: string
  teacher_name: string
  institute: string
  designation: string
  city: string
  linkedin_url?: string
  bio?: string
  requester_email: string
  requester_name?: string
  reason: string
  status?: string
  admin_notes?: string
  rejection_reason?: string
  teacher_id?: string
  reviewed_by?: string
  reviewed_at?: string
  created_at: string
  feedback_id?: string
}

export default function Admin() {
  const { data: user } = useUser()
  const { toasts, showToast, removeToast } = useToast()
  const confirm = useConfirm()
  const [feedbacks, setFeedbacks] = useState<Feedback[]>([])
  const [teacherRequests, setTeacherRequests] = useState<TeacherRequest[]>([])
  const [reviews, setReviews] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'feedback' | 'teachers' | 'reviews'>('feedback')
  const [filter, setFilter] = useState<string>('all')
  const [reviewFilter, setReviewFilter] = useState<'all' | 'flagged' | 'suspicious'>('all')

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    setLoading(true)
    let hasErrors = false
    
    try {
      // Check if user is authenticated and is admin
      const { data: { user }, error: authError } = await supabase.auth.getUser()
      
      if (authError || !user) {
        showToast('Authentication error: Please login again', 'error')
        setLoading(false)
        return
      }

      // Load general feedback
      const { data: feedbackData, error: feedbackError } = await supabase
        .from('feedback')
        .select('*')
        .order('created_at', { ascending: false })

      if (feedbackError) {
        logger.error('Failed to load feedback', feedbackError)
        if (feedbackError.message.includes('permission denied')) {
          showToast("You don't have permission to view feedback.", 'error')
        } else {
          showToast(friendlyWriteError(feedbackError) ?? "Couldn't load feedback. Try refreshing.", 'error')
        }
        hasErrors = true
      } else {
        setFeedbacks(feedbackData || [])
      }

      // Load teacher requests
      const { data: teacherData, error: teacherError } = await supabase
        .from('teacher_submission_requests')
        .select('*')
        .order('created_at', { ascending: false })

      if (teacherError) {
        logger.error('Failed to load teacher requests', teacherError)
        if (teacherError.message.includes('permission denied')) {
          showToast("You don't have permission to view teacher requests.", 'error')
        } else {
          showToast(friendlyWriteError(teacherError) ?? "Couldn't load teacher requests. Try refreshing.", 'error')
        }
        hasErrors = true
      } else {
        setTeacherRequests(teacherData || [])
      }

      // Load reviews with details
      const reviewsQuery = supabase
        .from('ratings')
        .select(`
          id,
          teacher_id,
          student_id,
          score,
          comment,
          created_at,
          updated_at,
          flagged,
          flagged_reason,
          flagged_at,
          teacher:teachers!inner (
            id,
            name,
            institute
          )
        `)
        .order('created_at', { ascending: false })
        .limit(100) // Limit to prevent timeout
      
      const { data: reviewsData, error: reviewsError } = await reviewsQuery

      if (reviewsError) {
        logger.error('Failed to load reviews', reviewsError)

        // Try simpler query without flagged columns
        if (reviewsError.message.includes('column "flagged"')) {
          const { data: basicReviews, error: basicError } = await supabase
            .from('ratings')
            .select(`
              id,
              teacher_id,
              student_id,
              score,
              comment,
              created_at,
              updated_at,
              teacher:teachers!inner (
                id,
                name,
                institute
              )
            `)
            .order('created_at', { ascending: false })
            .limit(100)
          
          if (basicError) {
            logger.error('Basic reviews query also failed', basicError)
            showToast('Could not load reviews. Please check database.', 'error')
            hasErrors = true
          } else {
            setReviews(basicReviews?.map(r => ({ ...r, flagged: false })) || [])
            showToast("Review flagging isn't set up yet.", 'info')
          }
        } else if (reviewsError.message.includes('permission denied')) {
          showToast("You don't have permission to view reviews.", 'error')
          hasErrors = true
        } else {
          showToast(friendlyWriteError(reviewsError) ?? "Couldn't load reviews. Try refreshing.", 'error')
          hasErrors = true
        }
      } else {
        // One batched lookup for reviewer identities. This was a Promise.all of
        // per-review single-row queries — with the .limit(100) above, up to 100
        // concurrent requests on every Admin mount. Same fix already applied in
        // useRatings.ts:44-61.
        //
        // Unlike that one, this select keeps `email`: the reviewer cell below
        // falls back to it when display_name is empty (see "Reviewer:" in the
        // reviews table), so dropping it would silently turn those rows into
        // "Anonymous". Admins are authorized to see it; the public ratings path
        // in useRatings deliberately does not select it.
        const studentIds = Array.from(
          new Set((reviewsData || []).map(r => r.student_id).filter(Boolean))
        ) as string[]

        type ReviewerProfile = { id: string; display_name: string | null; email: string | null }
        const profilesById = new Map<string, ReviewerProfile>()

        if (studentIds.length > 0) {
          const { data: profiles, error: profilesError } = await supabase
            .from('profiles')
            .select('id, display_name, email')
            .in('id', studentIds)

          if (profilesError) {
            logger.warn('Could not fetch reviewer profiles', { error: profilesError })
          }
          for (const profile of profiles || []) {
            profilesById.set(profile.id, profile)
          }
        }

        setReviews(
          (reviewsData || []).map(review => ({
            ...review,
            student: review.student_id
              ? profilesById.get(review.student_id) ?? null
              : null,
          }))
        )
      }
      
      if (hasErrors) {
        showToast("Some data couldn't be loaded. Try refreshing.", 'warning')
      }
    } catch (error: any) {
      logger.error('Unexpected error loading admin data', error)
      showToast(friendlyWriteError(error) ?? 'Something went wrong loading admin data. Try refreshing.', 'error')
    } finally {
      setLoading(false)
    }
  }

  const updateFeedbackStatus = async (id: string, status: string, priority?: string, adminNotes?: string) => {
    try {
      const updates: any = { status }
      if (priority) updates.priority = priority
      if (adminNotes !== undefined) updates.admin_notes = adminNotes
      if (status === 'resolved') updates.resolved_at = new Date().toISOString()

      const { error } = await supabase
        .from('feedback')
        .update(updates)
        .eq('id', id)

      if (error) throw error

      // Update local state
      setFeedbacks(prev => 
        prev.map(f => f.id === id ? { ...f, ...updates } : f)
      )
      
      showToast('Status updated', 'success')
    } catch (error) {
      logger.error('Failed to update feedback status', error)
      showToast(friendlyWriteError(error) ?? "Couldn't update the status. Try again.", 'error')
    }
  }

  const deleteFeedback = async (id: string) => {
    const confirmed = await confirm({
      title: 'Delete this feedback?',
      message: "This can't be undone.",
      confirmLabel: 'Delete feedback',
      cancelLabel: 'Keep it',
      danger: true,
    })
    if (!confirmed) {
      return
    }

    try {
      const { data, error } = await supabase
        .from('feedback')
        .delete()
        .eq('id', id)
        .select()

      if (error) {
        logger.error('Failed to delete feedback', error)
        if (error.message.includes('policy')) {
          showToast("You don't have permission to delete this.", 'error')
        } else {
          showToast(friendlyWriteError(error) ?? "Couldn't delete this feedback. Try again.", 'error')
        }
        return
      }

      // Only update local state if deletion was successful
      if (data) {
        setFeedbacks(prev => prev.filter(f => f.id !== id))
        showToast('Feedback deleted', 'success')
      } else {
        showToast('Nothing was deleted. Try refreshing.', 'warning')
        // Reload to check actual state
        loadData()
      }
    } catch (error: any) {
      logger.error('Failed to delete feedback', error)
      showToast(friendlyWriteError(error) ?? "Couldn't delete this feedback. Try again.", 'error')
    }
  }

  const deleteReview = async (id: string) => {
    const confirmed = await confirm({
      title: 'Delete this review?',
      message: "This permanently removes the review. This can't be undone.",
      confirmLabel: 'Delete review',
      cancelLabel: 'Keep it',
      danger: true,
    })
    if (!confirmed) {
      return
    }

    try {
      // Try using the safe admin function first
      const { data: funcResult, error: funcError } = await supabase
        .rpc('admin_delete_review', { review_id: id })

      if (!funcError && funcResult) {
        setReviews(prev => prev.filter(r => r.id !== id))
        showToast('Review deleted', 'success')
        return
      }

      // Fallback to direct delete if function doesn't exist.
      // Explicit column, not a bare .select(): migration 019 limits which
      // ratings columns `authenticated` may SELECT, and a bare select means `*`,
      // which 42501s under column-level grants — DELETE ... RETURNING included.
      const { data, error } = await supabase
        .from('ratings')
        .delete()
        .eq('id', id)
        .select('id')

      if (error) {
        logger.error('Failed to delete review', error)
        if (error.message.includes('permission denied for table users')) {
          showToast("You don't have permission to delete reviews.", 'error')
        } else if (error.message.includes('policy')) {
          showToast("You don't have permission to delete this.", 'error')
        } else {
          showToast(friendlyWriteError(error) ?? "Couldn't delete this review. Try again.", 'error')
        }
        return
      }

      // An empty array is truthy, so a bare `if (data)` reported success even
      // when RLS filtered the delete to zero rows — same check the feedback and
      // teacher-request deletes above already use.
      if (data && data.length > 0) {
        setReviews(prev => prev.filter(r => r.id !== id))
        showToast('Review deleted', 'success')
      } else {
        showToast('Nothing was deleted. Try refreshing.', 'warning')
        loadData()
      }
    } catch (error: any) {
      logger.error('Failed to delete review', error)
      showToast(friendlyWriteError(error) ?? "Couldn't delete this review. Try again.", 'error')
    }
  }

  const flagReview = async (id: string, reason: string) => {
    try {
      const { error } = await supabase
        .from('ratings')
        .update({ 
          flagged: true, 
          flagged_reason: reason,
          flagged_at: new Date().toISOString()
        })
        .eq('id', id)

      if (error) throw error

      setReviews(prev => prev.map(r => 
        r.id === id 
          ? { ...r, flagged: true, flagged_reason: reason }
          : r
      ))
      showToast('Review flagged', 'success')
    } catch (error: any) {
      logger.error('Failed to flag review', error)
      showToast(friendlyWriteError(error) ?? "Couldn't flag this review. Try again.", 'error')
    }
  }

  const deleteTeacherRequest = async (id: string) => {
    const confirmed = await confirm({
      title: 'Delete this teacher request?',
      message: "This can't be undone.",
      confirmLabel: 'Delete request',
      cancelLabel: 'Keep it',
      danger: true,
    })
    if (!confirmed) {
      return
    }

    try {
      const { data, error } = await supabase
        .from('teacher_submission_requests')
        .delete()
        .eq('id', id)
        .select()

      if (error) {
        logger.error('Failed to delete teacher request', error)
        if (error.message.includes('policy')) {
          showToast("You don't have permission to delete this.", 'error')
        } else {
          showToast(friendlyWriteError(error) ?? "Couldn't delete this request. Try again.", 'error')
        }
        return
      }

      // Only update local state if deletion was successful
      if (data) {
        setTeacherRequests(prev => prev.filter(r => r.id !== id))
        showToast('Teacher request deleted', 'success')
      } else {
        showToast('Nothing was deleted. Try refreshing.', 'warning')
        // Reload to check actual state
        loadData()
      }
    } catch (error: any) {
      logger.error('Failed to delete teacher request', error)
      showToast(friendlyWriteError(error) ?? "Couldn't delete this request. Try again.", 'error')
    }
  }

  const getStatusBadge = (status: string) => {
    const colors = {
      new: 'badge-primary',
      in_progress: 'badge-warning',
      resolved: 'badge-success',
      closed: 'badge-neutral'
    }
    return `badge ${colors[status as keyof typeof colors] || 'badge-neutral'}`
  }


  const getPriorityBadge = (priority: string) => {
    const colors = {
      low: 'badge-success',
      medium: 'badge-warning',
      high: 'badge-error',
      urgent: 'badge-error badge-lg'
    }
    return `badge ${colors[priority as keyof typeof colors] || 'badge-neutral'}`
  }

  const filteredFeedbacks = feedbacks.filter(f => {
    if (filter === 'all') return true
    if (filter === 'new') return f.status === 'new'
    if (filter === 'pending') return f.status === 'in_progress'
    return f.type === filter
  })

  const filteredReviews = reviews.filter(r => {
    if (reviewFilter === 'all') return true
    if (reviewFilter === 'flagged') return r.flagged === true
    if (reviewFilter === 'suspicious') {
      // Check for potentially inappropriate content
      const comment = r.comment?.toLowerCase() || ''
      const hasShortComment = comment.length < 10
      const hasProfanity = /fuck|shit|damn|ass|bitch|bastard|crap|piss|dick|cock|pussy|fag|retard|cunt/i.test(comment)
      const hasRepeatedChars = /(.)\1{5,}/.test(comment)
      const hasUrls = /(https?:\/\/|www\.)/i.test(comment)
      return hasShortComment || hasProfanity || hasRepeatedChars || hasUrls
    }
    return true
  })

  // ProtectedRoute already handles authentication and admin check

  if (loading) {
    return (
      <div className="max-w-wide mx-auto py-8">
        <Helmet>
          <title>Admin</title>
        </Helmet>
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-base-content mb-2">
            Admin
          </h1>
          <p className="text-base-content/70">
            Manage feedback and teacher submission requests
          </p>
        </div>
        <Skeleton variant="rectangular" height={56} className="mb-6" />
        <div className="space-y-4">
          <Skeleton variant="rectangular" height={160} />
          <Skeleton variant="rectangular" height={160} />
          <Skeleton variant="rectangular" height={160} />
        </div>
      </div>
    )
  }

  return (
    <>
      <Helmet>
        <title>Admin</title>
      </Helmet>
      <ToastContainer toasts={toasts} onRemove={removeToast} />
      <div className="max-w-wide mx-auto py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-base-content mb-2">
          Admin
        </h1>
        <p className="text-base-content/70">
          Manage feedback and teacher submission requests
        </p>
      </div>

      {/* Tabs — ARIA tablist with arrow-key navigation */}
      <div
        role="tablist"
        aria-label="Admin sections"
        className="tabs tabs-boxed mb-6 bg-base-200"
        onKeyDown={(e) => {
          const tabIds = ['feedback', 'teachers', 'reviews'] as const;
          const idx = tabIds.indexOf(activeTab);
          let next: (typeof tabIds)[number] | null = null;
          if (e.key === 'ArrowRight') next = tabIds[(idx + 1) % tabIds.length];
          else if (e.key === 'ArrowLeft') next = tabIds[(idx - 1 + tabIds.length) % tabIds.length];
          else if (e.key === 'Home') next = tabIds[0];
          else if (e.key === 'End') next = tabIds[tabIds.length - 1];
          if (next) {
            e.preventDefault();
            setActiveTab(next);
            if (next !== 'reviews') setFilter('all');
            document.getElementById(`admin-tab-${next}`)?.focus();
          }
        }}
      >
        <button
          role="tab"
          id="admin-tab-feedback"
          aria-selected={activeTab === 'feedback'}
          aria-controls="admin-panel-feedback"
          tabIndex={activeTab === 'feedback' ? 0 : -1}
          className={`tab tab-lg ${activeTab === 'feedback' ? 'tab-active' : 'text-base-content/70'}`}
          onClick={() => { setActiveTab('feedback'); setFilter('all'); }}
        >
          Feedback ({feedbacks.length})
        </button>
        <button
          role="tab"
          id="admin-tab-teachers"
          aria-selected={activeTab === 'teachers'}
          aria-controls="admin-panel-teachers"
          tabIndex={activeTab === 'teachers' ? 0 : -1}
          className={`tab tab-lg ${activeTab === 'teachers' ? 'tab-active' : 'text-base-content/70'}`}
          onClick={() => { setActiveTab('teachers'); setFilter('all'); }}
        >
          Teacher Requests ({teacherRequests.length})
        </button>
        <button
          role="tab"
          id="admin-tab-reviews"
          aria-selected={activeTab === 'reviews'}
          aria-controls="admin-panel-reviews"
          tabIndex={activeTab === 'reviews' ? 0 : -1}
          className={`tab tab-lg ${activeTab === 'reviews' ? 'tab-active' : 'text-base-content/70'}`}
          onClick={() => setActiveTab('reviews')}
        >
          Reviews ({reviews.length})
          {filteredReviews.filter(r => r.flagged || reviewFilter === 'suspicious').length > 0 && (
            <span className="ml-2 badge badge-error badge-sm">
              {filteredReviews.filter(r => r.flagged || reviewFilter === 'suspicious').length}
            </span>
          )}
        </button>
      </div>

      <SectionErrorBoundary
        resetKey={activeTab}
        title="This tab failed to load"
        message="The other admin tabs still work. Switch tabs or try this one again."
      >
      {/* Feedback Tab */}
      {activeTab === 'feedback' && (
        <div role="tabpanel" id="admin-panel-feedback" aria-labelledby="admin-tab-feedback">
          {/* Filters */}
          <div className="mb-6 flex flex-wrap gap-2">
            <Button
              variant={filter === 'all' ? 'primary' : 'outline'}
              size="sm"
              onClick={() => setFilter('all')}
            >
              All ({feedbacks.length})
            </Button>
            <Button
              variant={filter === 'new' ? 'primary' : 'outline'}
              size="sm"
              onClick={() => setFilter('new')}
            >
              New ({feedbacks.filter(f => f.status === 'new').length})
            </Button>
            <Button
              variant={filter === 'pending' ? 'primary' : 'outline'}
              size="sm"
              onClick={() => setFilter('pending')}
            >
              In Progress ({feedbacks.filter(f => f.status === 'in_progress').length})
            </Button>
            <Button
              variant={filter === 'feature_request' ? 'primary' : 'outline'}
              size="sm"
              onClick={() => setFilter('feature_request')}
            >
              Features ({feedbacks.filter(f => f.type === 'feature_request').length})
            </Button>
            <Button
              variant={filter === 'bug_report' ? 'primary' : 'outline'}
              size="sm"
              onClick={() => setFilter('bug_report')}
            >
              Bugs ({feedbacks.filter(f => f.type === 'bug_report').length})
            </Button>
          </div>

          {/* Feedback List */}
          <div className="space-y-4">
            {filteredFeedbacks.map((feedback) => (
              <div key={feedback.id} className="card bg-base-100 shadow-lg">
                <div className="card-body">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h2 dir="auto" className="text-lg font-semibold text-base-content">
                        {feedback.title}
                      </h2>
                      <div className="flex items-center gap-2 mt-2">
                        <span className={getStatusBadge(feedback.status)}>
                          {feedback.status.replace('_', ' ')}
                        </span>
                        <span className={getPriorityBadge(feedback.priority)}>
                          {feedback.priority}
                        </span>
                        <span className="badge badge-outline">
                          {feedback.type.replace('_', ' ')}
                        </span>
                      </div>
                    </div>
                    <div className="text-sm text-base-content/70">
                      {new Date(feedback.created_at).toLocaleDateString()}
                    </div>
                  </div>

                  <p dir="auto" className="text-base-content/80 mb-4">
                    {feedback.description}
                  </p>

                  {(feedback.email || feedback.name) && (
                    <div className="text-sm text-base-content/70 mb-4">
                      <strong className="text-base-content">From:</strong> {feedback.name || 'Anonymous'} 
                      {feedback.email && ` (${feedback.email})`}
                    </div>
                  )}

                  <div className="flex flex-wrap gap-2">
                    <select 
                      className="select select-sm select-bordered "
                      value={feedback.status}
                      onChange={(e) => updateFeedbackStatus(feedback.id, e.target.value)}
                    >
                      <option value="new">New</option>
                      <option value="in_progress">In Progress</option>
                      <option value="resolved">Resolved</option>
                      <option value="closed">Closed</option>
                    </select>

                    <select 
                      className="select select-sm select-bordered "
                      value={feedback.priority}
                      onChange={(e) => updateFeedbackStatus(feedback.id, feedback.status, e.target.value)}
                    >
                      <option value="low">Low Priority</option>
                      <option value="medium">Medium Priority</option>
                      <option value="high">High Priority</option>
                      <option value="urgent">Urgent</option>
                    </select>

                    <Button
                      variant="error"
                      size="sm"
                      onClick={() => deleteFeedback(feedback.id)}
                      title="Delete this feedback"
                    >
                      <TrashIcon className="h-4 w-4" />
                      Delete
                    </Button>
                  </div>

                  {feedback.admin_notes && (
                    <div className="mt-4 p-3 bg-base-200 rounded text-base-content/70">
                      <strong className="text-base-content">Admin Notes:</strong> {feedback.admin_notes}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Teacher Requests Tab */}
      {activeTab === 'teachers' && (
        <div role="tabpanel" id="admin-panel-teachers" aria-labelledby="admin-tab-teachers">
          {/* Filter buttons for teacher requests */}
          <div className="mb-6 flex flex-wrap gap-2">
            <Button
              variant={filter === 'all' ? 'primary' : 'outline'}
              size="sm"
              onClick={() => setFilter('all')}
            >
              All ({teacherRequests.length})
            </Button>
            <Button
              variant={filter === 'pending' ? 'primary' : 'outline'}
              size="sm"
              onClick={() => setFilter('pending')}
            >
              Pending ({teacherRequests.filter(r => !r.status || r.status === 'pending').length})
            </Button>
            <Button
              variant={filter === 'needs_info' ? 'primary' : 'outline'}
              size="sm"
              onClick={() => setFilter('needs_info')}
            >
              Needs Info ({teacherRequests.filter(r => r.status === 'needs_info').length})
            </Button>
            <Button
              variant={filter === 'approved' ? 'primary' : 'outline'}
              size="sm"
              onClick={() => setFilter('approved')}
            >
              Approved ({teacherRequests.filter(r => r.status === 'approved' || r.status === 'modified').length})
            </Button>
            <Button
              variant={filter === 'rejected' ? 'primary' : 'outline'}
              size="sm"
              onClick={() => setFilter('rejected')}
            >
              Rejected ({teacherRequests.filter(r => r.status === 'rejected').length})
            </Button>
            <Button
              variant={filter === 'ignored' ? 'primary' : 'outline'}
              size="sm"
              onClick={() => setFilter('ignored')}
            >
              Ignored ({teacherRequests.filter(r => r.status === 'ignored').length})
            </Button>
          </div>

          {/* Teacher Request Cards */}
          <div className="space-y-4">
            {teacherRequests
              .filter(request => {
                if (filter === 'all') return true
                if (filter === 'pending') return !request.status || request.status === 'pending'
                if (filter === 'needs_info') return request.status === 'needs_info'
                if (filter === 'approved') return request.status === 'approved' || request.status === 'modified'
                if (filter === 'rejected') return request.status === 'rejected'
                if (filter === 'ignored') return request.status === 'ignored'
                return true
              })
              .map((request) => (
                <TeacherRequestManager
                  key={request.id}
                  request={request}
                  onUpdate={loadData}
                  onDelete={deleteTeacherRequest}
                  showToast={showToast}
                />
              ))}
          </div>
        </div>
      )}

      {/* Empty States */}
      {activeTab === 'feedback' && filteredFeedbacks.length === 0 && (
        <EmptyState
          title="No feedback found"
          description={
            filter === 'all'
              ? 'Feedback submitted through the public form will show up here.'
              : 'Nothing matches this filter.'
          }
          action={
            filter !== 'all' ? (
              <Button variant="outline" size="sm" onClick={() => setFilter('all')}>
                Show all feedback
              </Button>
            ) : undefined
          }
        />
      )}

      {activeTab === 'teachers' && teacherRequests.length === 0 && (
        <EmptyState
          title="No teacher requests yet"
          description="Requests from the public “Request a teacher” form will show up here."
        />
      )}

      {/* Reviews Tab */}
      {activeTab === 'reviews' && (
        <div role="tabpanel" id="admin-panel-reviews" aria-labelledby="admin-tab-reviews">
          {/* Filter buttons for reviews */}
          <div className="mb-6 flex flex-wrap gap-2">
            <Button
              variant={reviewFilter === 'all' ? 'primary' : 'outline'}
              size="sm"
              onClick={() => setReviewFilter('all')}
            >
              All Reviews ({reviews.length})
            </Button>
            <Button
              variant={reviewFilter === 'flagged' ? 'error' : 'outline'}
              size="sm"
              onClick={() => setReviewFilter('flagged')}
            >
              Flagged ({reviews.filter(r => r.flagged).length})
            </Button>
            <Button
              variant={reviewFilter === 'suspicious' ? 'warning' : 'outline'}
              size="sm"
              onClick={() => setReviewFilter('suspicious')}
            >
              Suspicious ({reviews.filter(r => {
                const comment = r.comment?.toLowerCase() || ''
                const hasShortComment = comment.length < 10
                const hasProfanity = /fuck|shit|damn|ass|bitch|bastard|crap|piss|dick|cock|pussy|fag|retard|cunt/i.test(comment)
                const hasRepeatedChars = /(.)\1{5,}/.test(comment)
                const hasUrls = /(https?:\/\/|www\.)/i.test(comment)
                return hasShortComment || hasProfanity || hasRepeatedChars || hasUrls
              }).length})
            </Button>
          </div>

          {/* Reviews List */}
          <div className="space-y-4">
            {filteredReviews.map((review) => {
              const comment = review.comment?.toLowerCase() || ''
              const hasShortComment = comment.length < 10
              const hasProfanity = /fuck|shit|damn|ass|bitch|bastard|crap|piss|dick|cock|pussy|fag|retard|cunt/i.test(comment)
              const hasRepeatedChars = /(.)\1{5,}/.test(comment)
              const hasUrls = /(https?:\/\/|www\.)/i.test(comment)
              const isSuspicious = hasShortComment || hasProfanity || hasRepeatedChars || hasUrls

              return (
                <div key={review.id} className="card bg-base-100 shadow-lg">
                  <div className="card-body">
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <h2 dir="auto" className="text-lg font-semibold text-base-content">
                          {review.teacher?.name || 'Unknown Teacher'}
                        </h2>
                        <p className="text-sm text-base-content/70">
                          {review.teacher?.institute || 'No institute'}
                        </p>
                        <div className="flex items-center gap-2 mt-2">
                          <div className="badge badge-neutral">
                            {review.score} stars
                          </div>
                          {review.flagged && (
                            <div className="badge badge-error">Flagged</div>
                          )}
                          {isSuspicious && !review.flagged && (
                            <div className="badge badge-warning">Suspicious</div>
                          )}
                        </div>
                      </div>
                      <div className="dropdown dropdown-end">
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm text-base-content/70 hover:bg-base-200"
                          aria-haspopup="menu"
                          aria-label="Review actions"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                          </svg>
                        </button>
                        <ul role="menu" aria-label="Review actions" tabIndex={0} className="dropdown-content menu p-2 shadow-lg bg-base-100 rounded-box w-52 border border-base-300">
                          {!review.flagged && (
                            <li>
                              <button
                                type="button"
                                role="menuitem"
                                onClick={async (e) => {
                                  e.currentTarget.blur() // close the focus-driven dropdown
                                  const reason = await confirm({
                                    title: 'Flag this review?',
                                    message: 'Flagged reviews stay visible and are marked for follow-up.',
                                    confirmLabel: 'Flag review',
                                    cancelLabel: 'Cancel',
                                    input: {
                                      label: 'Reason for flagging',
                                      placeholder: 'e.g. spam, harassment, fake review',
                                      required: true,
                                    },
                                  })
                                  if (reason) flagReview(review.id, reason)
                                }}
                                className="text-base-content/80 hover:bg-base-200"
                              >
                                <FlagIcon className="w-4 h-4 mr-2" />
                                Flag as Inappropriate
                              </button>
                            </li>
                          )}
                          <li>
                            <button
                              type="button"
                              role="menuitem"
                              onClick={(e) => {
                                e.currentTarget.blur() // close the focus-driven dropdown
                                deleteReview(review.id)
                              }}
                              className="text-error hover:bg-error/10"
                            >
                              <TrashIcon className="w-4 h-4 mr-2" />
                              Delete Review
                            </button>
                          </li>
                        </ul>
                      </div>
                    </div>

                    <div className="bg-base-200 rounded-lg p-4">
                      <p dir="auto" className="text-base-content/80 whitespace-pre-wrap">
                        {review.comment || 'No comment provided'}
                      </p>
                      {review.flagged_reason && (
                        <div className="mt-2 text-sm text-error">
                          <strong>Flag reason:</strong> {review.flagged_reason}
                        </div>
                      )}
                    </div>

                    <div className="flex justify-between items-center mt-4 text-sm">
                      <div className="text-base-content/70">
                        <strong>Reviewer:</strong> {review.student?.display_name || review.student?.email || 'Anonymous'}
                      </div>
                      <div className="text-base-content/70">
                        {new Date(review.created_at).toLocaleString()}
                      </div>
                    </div>

                    {isSuspicious && (
                      <div className="mt-4 p-3 bg-warning/10 border border-warning/30 rounded-lg">
                        <p className="text-sm text-warning font-semibold flex items-center gap-1.5">
                          <AlertTriangleIcon className="w-4 h-4 flex-shrink-0" />
                          Potential Issues Detected:
                        </p>
                        <ul className="text-xs text-warning mt-1">
                          {hasShortComment && <li>• Comment too short (less than 10 characters)</li>}
                          {hasProfanity && <li>• Contains potentially inappropriate language</li>}
                          {hasRepeatedChars && <li>• Contains repeated characters (possible spam)</li>}
                          {hasUrls && <li>• Contains URLs (possible spam)</li>}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          {filteredReviews.length === 0 && (
            <EmptyState
              title="No reviews found"
              description={
                reviewFilter === 'all'
                  ? 'Student reviews will show up here as they come in.'
                  : 'Nothing matches this filter.'
              }
              action={
                reviewFilter !== 'all' ? (
                  <Button variant="outline" size="sm" onClick={() => setReviewFilter('all')}>
                    Show all reviews
                  </Button>
                ) : undefined
              }
            />
          )}
        </div>
      )}

      </SectionErrorBoundary>
      </div>
    </>
  )
}
