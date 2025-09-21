import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useUser } from '../hooks/useAuth'
import { Navigate } from 'react-router-dom'
import { TeacherRequestManager } from '../components/TeacherRequestManager'
import { useToast } from '../hooks/useToast'
import { ToastContainer } from '../components/ToastContainer'

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
  feedback: Feedback
}

const ADMIN_EMAIL = import.meta.env.VITE_ADMIN_EMAIL || 'admin@example.com'

export default function Admin() {
  const { data: user } = useUser()
  const { toasts, showToast, removeToast } = useToast()
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
      
      console.log('Loading admin data for user:', user.email)
      
      // Load general feedback
      const { data: feedbackData, error: feedbackError } = await supabase
        .from('feedback')
        .select('*')
        .order('created_at', { ascending: false })

      if (feedbackError) {
        console.error('Error loading feedback:', feedbackError)
        if (feedbackError.code === '42P01') {
          showToast('Feedback table not found. Please run fix-admin-permissions-complete.sql', 'error')
        } else if (feedbackError.message.includes('permission denied')) {
          showToast('Permission denied for feedback. Please check admin email.', 'error')
        } else {
          showToast(`Feedback error: ${feedbackError.message}`, 'error')
        }
        hasErrors = true
      } else {
        setFeedbacks(feedbackData || [])
        console.log(`Loaded ${feedbackData?.length || 0} feedback items`)
      }

      // Load teacher requests
      const { data: teacherData, error: teacherError } = await supabase
        .from('teacher_submission_requests')
        .select('*')
        .order('created_at', { ascending: false })

      if (teacherError) {
        console.error('Error loading teacher requests:', teacherError)
        if (teacherError.code === '42P01') {
          showToast('Teacher requests table not found. Please run fix-admin-permissions-complete.sql', 'error')
        } else if (teacherError.message.includes('permission denied')) {
          showToast('Permission denied for teacher requests. Please check admin email.', 'error')
        } else {
          showToast(`Teacher requests error: ${teacherError.message}`, 'error')
        }
        hasErrors = true
      } else {
        setTeacherRequests(teacherData || [])
        console.log(`Loaded ${teacherData?.length || 0} teacher requests`)
      }

      // Load reviews with details
      let reviewsQuery = supabase
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
        console.error('Error loading reviews:', reviewsError)
        
        // Try simpler query without flagged columns
        if (reviewsError.message.includes('column "flagged"')) {
          console.log('Flagged columns not found, trying basic query')
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
            console.error('Basic reviews query also failed:', basicError)
            showToast('Could not load reviews. Please check database.', 'error')
            hasErrors = true
          } else {
            setReviews(basicReviews?.map(r => ({ ...r, flagged: false })) || [])
            console.log(`Loaded ${basicReviews?.length || 0} reviews (without flag data)`)
            showToast('Review flagging not available. Run admin-delete-reviews.sql to enable.', 'info')
          }
        } else if (reviewsError.message.includes('permission denied')) {
          showToast('Permission denied for reviews. Please check admin access.', 'error')
          hasErrors = true
        } else {
          showToast(`Reviews error: ${reviewsError.message}`, 'error')
          hasErrors = true
        }
      } else {
        // Add student info if available
        const reviewsWithStudents = await Promise.all(
          (reviewsData || []).map(async (review) => {
            if (review.student_id) {
              const { data: profile } = await supabase
                .from('profiles')
                .select('display_name, email')
                .eq('id', review.student_id)
                .single()
              
              return {
                ...review,
                student: profile || null
              }
            }
            return { ...review, student: null }
          })
        )
        
        setReviews(reviewsWithStudents)
        console.log(`Loaded ${reviewsWithStudents.length} reviews`)
      }
      
      if (!hasErrors) {
        showToast('Admin data loaded successfully', 'success')
      } else {
        showToast('Some data could not be loaded. Check console for details.', 'warning')
      }
    } catch (error: any) {
      console.error('Unexpected error loading admin data:', error)
      showToast(`Unexpected error: ${error?.message || 'Unknown error'}`, 'error')
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
      
      showToast('Status updated successfully', 'success')
    } catch (error) {
      console.error('Error updating status:', error)
      showToast('Failed to update status', 'error')
    }
  }

  const deleteFeedback = async (id: string) => {
    if (!confirm('Are you sure you want to delete this feedback? This action cannot be undone.')) {
      return
    }

    try {
      const { data, error } = await supabase
        .from('feedback')
        .delete()
        .eq('id', id)
        .select()

      if (error) {
        console.error('Delete error details:', error)
        if (error.message.includes('policy')) {
          showToast('Permission denied: RLS policy prevents deletion. Please check database policies.', 'error')
        } else {
          showToast(`Failed to delete: ${error.message}`, 'error')
        }
        return
      }

      // Only update local state if deletion was successful
      if (data) {
        setFeedbacks(prev => prev.filter(f => f.id !== id))
        showToast('Feedback deleted successfully', 'success')
      } else {
        showToast('No data returned - item may not have been deleted', 'warning')
        // Reload to check actual state
        loadData()
      }
    } catch (error: any) {
      console.error('Error deleting feedback:', error)
      showToast(`Failed to delete feedback: ${error?.message || 'Unknown error'}`, 'error')
    }
  }

  const deleteReview = async (id: string) => {
    if (!confirm('Are you sure you want to delete this review? This action cannot be undone.')) {
      return
    }

    try {
      // Try using the safe admin function first
      const { data: funcResult, error: funcError } = await supabase
        .rpc('admin_delete_review', { review_id: id })

      if (!funcError && funcResult) {
        setReviews(prev => prev.filter(r => r.id !== id))
        showToast('Review deleted successfully', 'success')
        return
      }

      // Fallback to direct delete if function doesn't exist
      const { data, error } = await supabase
        .from('ratings')
        .delete()
        .eq('id', id)
        .select()

      if (error) {
        console.error('Delete review error:', error)
        if (error.message.includes('permission denied for table users')) {
          showToast('Permission error: Please run fix-review-delete-permissions.sql script in Supabase', 'error')
        } else if (error.message.includes('policy')) {
          showToast('Permission denied: Please run the admin delete scripts', 'error')
        } else {
          showToast(`Failed to delete review: ${error.message}`, 'error')
        }
        return
      }

      if (data) {
        setReviews(prev => prev.filter(r => r.id !== id))
        showToast('Review deleted successfully', 'success')
      }
    } catch (error: any) {
      console.error('Error deleting review:', error)
      showToast(`Failed to delete review: ${error?.message || 'Unknown error'}`, 'error')
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
      showToast('Review flagged successfully', 'success')
    } catch (error: any) {
      console.error('Error flagging review:', error)
      showToast(`Failed to flag review: ${error?.message}`, 'error')
    }
  }

  const deleteTeacherRequest = async (id: string) => {
    if (!confirm('Are you sure you want to delete this teacher request? This action cannot be undone.')) {
      return
    }

    try {
      const { data, error } = await supabase
        .from('teacher_submission_requests')
        .delete()
        .eq('id', id)
        .select()

      if (error) {
        console.error('Delete error details:', error)
        if (error.message.includes('policy')) {
          showToast('Permission denied: RLS policy prevents deletion. Please check database policies.', 'error')
        } else {
          showToast(`Failed to delete: ${error.message}`, 'error')
        }
        return
      }

      // Only update local state if deletion was successful
      if (data) {
        setTeacherRequests(prev => prev.filter(r => r.id !== id))
        showToast('Teacher request deleted successfully', 'success')
      } else {
        showToast('No data returned - item may not have been deleted', 'warning')
        // Reload to check actual state
        loadData()
      }
    } catch (error: any) {
      console.error('Error deleting teacher request:', error)
      showToast(`Failed to delete teacher request: ${error?.message || 'Unknown error'}`, 'error')
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
      <div className="min-h-screen flex items-center justify-center">
        <span className="loading loading-spinner loading-lg"></span>
      </div>
    )
  }

  return (
    <>
      <ToastContainer toasts={toasts} onRemove={removeToast} />
      <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
          Admin Panel
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Manage feedback and teacher submission requests
        </p>
      </div>

      {/* Tabs */}
      <div className="tabs tabs-boxed mb-6 bg-gray-100 dark:bg-gray-700">
        <button 
          className={`tab tab-lg ${activeTab === 'feedback' ? 'tab-active' : 'dark:text-gray-300'}`}
          onClick={() => setActiveTab('feedback')}
        >
          Feedback ({feedbacks.length})
        </button>
        <button 
          className={`tab tab-lg ${activeTab === 'teachers' ? 'tab-active' : 'dark:text-gray-300'}`}
          onClick={() => setActiveTab('teachers')}
        >
          Teacher Requests ({teacherRequests.length})
        </button>
        <button 
          className={`tab tab-lg ${activeTab === 'reviews' ? 'tab-active' : 'dark:text-gray-300'}`}
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

      {/* Feedback Tab */}
      {activeTab === 'feedback' && (
        <div>
          {/* Filters */}
          <div className="mb-6 flex flex-wrap gap-2">
            <button 
              className={`btn btn-sm ${filter === 'all' ? 'btn-primary' : 'btn-outline dark:text-gray-300'}`}
              onClick={() => setFilter('all')}
            >
              All ({feedbacks.length})
            </button>
            <button 
              className={`btn btn-sm ${filter === 'new' ? 'btn-primary' : 'btn-outline dark:text-gray-300'}`}
              onClick={() => setFilter('new')}
            >
              New ({feedbacks.filter(f => f.status === 'new').length})
            </button>
            <button 
              className={`btn btn-sm ${filter === 'pending' ? 'btn-primary' : 'btn-outline dark:text-gray-300'}`}
              onClick={() => setFilter('pending')}
            >
              In Progress ({feedbacks.filter(f => f.status === 'in_progress').length})
            </button>
            <button 
              className={`btn btn-sm ${filter === 'feature_request' ? 'btn-primary' : 'btn-outline dark:text-gray-300'}`}
              onClick={() => setFilter('feature_request')}
            >
              Features ({feedbacks.filter(f => f.type === 'feature_request').length})
            </button>
            <button 
              className={`btn btn-sm ${filter === 'bug_report' ? 'btn-primary' : 'btn-outline dark:text-gray-300'}`}
              onClick={() => setFilter('bug_report')}
            >
              Bugs ({feedbacks.filter(f => f.type === 'bug_report').length})
            </button>
          </div>

          {/* Feedback List */}
          <div className="space-y-4">
            {filteredFeedbacks.map((feedback) => (
              <div key={feedback.id} className="card bg-white dark:bg-gray-800 shadow-lg">
                <div className="card-body">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                        {feedback.title}
                      </h3>
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
                    <div className="text-sm text-gray-500 dark:text-gray-400">
                      {new Date(feedback.created_at).toLocaleDateString()}
                    </div>
                  </div>

                  <p className="text-gray-700 dark:text-gray-300 mb-4">
                    {feedback.description}
                  </p>

                  {(feedback.email || feedback.name) && (
                    <div className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                      <strong className="dark:text-white">From:</strong> {feedback.name || 'Anonymous'} 
                      {feedback.email && ` (${feedback.email})`}
                    </div>
                  )}

                  <div className="flex flex-wrap gap-2">
                    <select 
                      className="select select-sm select-bordered dark:bg-gray-700 dark:text-white dark:border-gray-600"
                      value={feedback.status}
                      onChange={(e) => updateFeedbackStatus(feedback.id, e.target.value)}
                    >
                      <option value="new">New</option>
                      <option value="in_progress">In Progress</option>
                      <option value="resolved">Resolved</option>
                      <option value="closed">Closed</option>
                    </select>

                    <select 
                      className="select select-sm select-bordered dark:bg-gray-700 dark:text-white dark:border-gray-600"
                      value={feedback.priority}
                      onChange={(e) => updateFeedbackStatus(feedback.id, feedback.status, e.target.value)}
                    >
                      <option value="low">Low Priority</option>
                      <option value="medium">Medium Priority</option>
                      <option value="high">High Priority</option>
                      <option value="urgent">Urgent</option>
                    </select>

                    <button 
                      className="btn btn-sm btn-error"
                      onClick={() => deleteFeedback(feedback.id)}
                      title="Delete this feedback"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                      Delete
                    </button>
                  </div>

                  {feedback.admin_notes && (
                    <div className="mt-4 p-3 bg-gray-100 dark:bg-gray-700 rounded dark:text-gray-300">
                      <strong className="dark:text-white">Admin Notes:</strong> {feedback.admin_notes}
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
        <div>
          {/* Filter buttons for teacher requests */}
          <div className="mb-6 flex flex-wrap gap-2">
            <button 
              className={`btn btn-sm ${filter === 'all' ? 'btn-primary' : 'btn-outline dark:text-gray-300'}`}
              onClick={() => setFilter('all')}
            >
              All ({teacherRequests.length})
            </button>
            <button 
              className={`btn btn-sm ${filter === 'pending' ? 'btn-primary' : 'btn-outline dark:text-gray-300'}`}
              onClick={() => setFilter('pending')}
            >
              Pending ({teacherRequests.filter(r => !r.status || r.status === 'pending').length})
            </button>
            <button 
              className={`btn btn-sm ${filter === 'needs_info' ? 'btn-primary' : 'btn-outline dark:text-gray-300'}`}
              onClick={() => setFilter('needs_info')}
            >
              Needs Info ({teacherRequests.filter(r => r.status === 'needs_info').length})
            </button>
            <button 
              className={`btn btn-sm ${filter === 'approved' ? 'btn-primary' : 'btn-outline dark:text-gray-300'}`}
              onClick={() => setFilter('approved')}
            >
              Approved ({teacherRequests.filter(r => r.status === 'approved' || r.status === 'modified').length})
            </button>
            <button 
              className={`btn btn-sm ${filter === 'rejected' ? 'btn-primary' : 'btn-outline dark:text-gray-300'}`}
              onClick={() => setFilter('rejected')}
            >
              Rejected ({teacherRequests.filter(r => r.status === 'rejected').length})
            </button>
            <button 
              className={`btn btn-sm ${filter === 'ignored' ? 'btn-primary' : 'btn-outline dark:text-gray-300'}`}
              onClick={() => setFilter('ignored')}
            >
              Ignored ({teacherRequests.filter(r => r.status === 'ignored').length})
            </button>
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
        <div className="text-center py-12">
          <p className="text-gray-500 dark:text-gray-400">No feedback found.</p>
        </div>
      )}

      {activeTab === 'teachers' && teacherRequests.length === 0 && (
        <div className="text-center py-12">
          <p className="text-gray-500 dark:text-gray-400">No teacher requests found.</p>
        </div>
      )}

      {/* Reviews Tab */}
      {activeTab === 'reviews' && (
        <div>
          {/* Filter buttons for reviews */}
          <div className="mb-6 flex flex-wrap gap-2">
            <button 
              className={`btn btn-sm ${reviewFilter === 'all' ? 'btn-primary' : 'btn-outline dark:text-gray-300'}`}
              onClick={() => setReviewFilter('all')}
            >
              All Reviews ({reviews.length})
            </button>
            <button 
              className={`btn btn-sm ${reviewFilter === 'flagged' ? 'btn-error' : 'btn-outline dark:text-gray-300'}`}
              onClick={() => setReviewFilter('flagged')}
            >
              Flagged ({reviews.filter(r => r.flagged).length})
            </button>
            <button 
              className={`btn btn-sm ${reviewFilter === 'suspicious' ? 'btn-warning' : 'btn-outline dark:text-gray-300'}`}
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
            </button>
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
                <div key={review.id} className="card bg-white dark:bg-gray-800 shadow-lg">
                  <div className="card-body">
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                          {review.teacher?.name || 'Unknown Teacher'}
                        </h3>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
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
                        <label tabIndex={0} className="btn btn-ghost btn-sm text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700">
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                          </svg>
                        </label>
                        <ul tabIndex={0} className="dropdown-content menu p-2 shadow-lg bg-white dark:bg-gray-800 rounded-box w-52 border border-gray-200 dark:border-gray-700">
                          {!review.flagged && (
                            <li>
                              <a 
                                onClick={() => {
                                  const reason = prompt('Reason for flagging this review:')
                                  if (reason) flagReview(review.id, reason)
                                }}
                                className="text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
                              >
                                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9" />
                                </svg>
                                Flag as Inappropriate
                              </a>
                            </li>
                          )}
                          <li>
                            <a 
                              onClick={() => deleteReview(review.id)} 
                              className="text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30"
                            >
                              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                              Delete Review
                            </a>
                          </li>
                        </ul>
                      </div>
                    </div>

                    <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                      <p className="text-gray-800 dark:text-gray-200 whitespace-pre-wrap">
                        {review.comment || 'No comment provided'}
                      </p>
                      {review.flagged_reason && (
                        <div className="mt-2 text-sm text-red-600 dark:text-red-400">
                          <strong>Flag reason:</strong> {review.flagged_reason}
                        </div>
                      )}
                    </div>

                    <div className="flex justify-between items-center mt-4 text-sm">
                      <div className="text-gray-500 dark:text-gray-400">
                        <strong>Reviewer:</strong> {review.student?.display_name || review.student?.email || 'Anonymous'}
                      </div>
                      <div className="text-gray-500 dark:text-gray-400">
                        {new Date(review.created_at).toLocaleString()}
                      </div>
                    </div>

                    {isSuspicious && (
                      <div className="mt-4 p-3 bg-yellow-50 dark:bg-yellow-900/30 border border-yellow-200 dark:border-yellow-700 rounded-lg">
                        <p className="text-sm text-yellow-800 dark:text-yellow-200 font-semibold">
                          ⚠️ Potential Issues Detected:
                        </p>
                        <ul className="text-xs text-yellow-700 dark:text-yellow-300 mt-1">
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
            <div className="text-center py-12">
              <p className="text-gray-500 dark:text-gray-400">No reviews found matching your filter.</p>
            </div>
          )}
        </div>
      )}
      </div>
    </>
  )
}