import React, { useState } from 'react'
import { Button } from './Button'
import { useConfirm } from './ConfirmDialog'
import { supabase } from '../lib/supabaseClient'
import { useUser } from '../hooks/useAuth'
import { sendApprovalEmail, sendRejectionEmail, sendNeedsInfoEmail, sendModifiedApprovalEmail } from '../lib/emailService'
import { sanitizeSearchInput, normalizeUrlInput } from '../lib/validation'
import type { Teacher } from '../types'

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
  created_at: string
  feedback_id?: string
}

interface TeacherRequestManagerProps {
  request: TeacherRequest
  onUpdate: () => void
  onDelete?: (id: string) => void
  showToast: (message: string, type: 'success' | 'error' | 'info' | 'warning') => void
}

export function TeacherRequestManager({ request, onUpdate, onDelete, showToast }: TeacherRequestManagerProps) {
  const { data: user } = useUser()
  const confirm = useConfirm()
  const [isProcessing, setIsProcessing] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [showRejectModal, setShowRejectModal] = useState(false)
  const [showInfoModal, setShowInfoModal] = useState(false)
  const [editedData, setEditedData] = useState({
    teacher_name: request.teacher_name,
    institute: request.institute,
    designation: request.designation,
    city: request.city,
    linkedin_url: request.linkedin_url || '',
    bio: request.bio || '',
  })
  const [rejectionReason, setRejectionReason] = useState('')
  const [infoRequest, setInfoRequest] = useState('')
  const [customReason, setCustomReason] = useState('')

  // Check for duplicate teachers
  const checkDuplicate = async () => {
    const sanitizedName = sanitizeSearchInput(request.teacher_name);
    const sanitizedInstitute = sanitizeSearchInput(request.institute);

    if (!sanitizedName && !sanitizedInstitute) {
      return [];
    }

    // Build the OR from only non-empty terms, and match institute with a
    // case-insensitive partial — exact `.eq` on a punctuation-stripped value
    // almost never matched the unstripped stored institute.
    const filters: string[] = []
    if (sanitizedName) filters.push(`name.ilike.%${sanitizedName}%`)
    if (sanitizedInstitute) filters.push(`institute.ilike.%${sanitizedInstitute}%`)

    const { data, error } = await supabase
      .from('teachers')
      .select('id, name, institute')
      .or(filters.join(','))
      .limit(5)

    if (error) {
      console.error('Error checking duplicates:', error)
      return []
    }

    return data || []
  }

  // Approve and add teacher
  const handleApprove = async () => {
    // Check if already processed
    if (request.status === 'approved' || request.status === 'modified') {
      showToast('This teacher is already approved', 'warning')
      return
    }

    setIsProcessing(true)
    try {
      // Check for duplicates first
      const duplicates = await checkDuplicate()
      if (duplicates.length > 0) {
        showToast(`Found ${duplicates.length} similar teacher(s). Please review before approving.`, 'warning')
        const confirmAdd = await confirm({
          title: `${duplicates.length} similar teacher${duplicates.length > 1 ? 's' : ''} already exist${duplicates.length > 1 ? '' : 's'}`,
          message: 'Add this teacher anyway?\n\n' + duplicates.map(d => `• ${d.name} (${d.institute})`).join('\n'),
          confirmLabel: 'Add anyway',
          cancelLabel: 'Review first',
        })
        if (!confirmAdd) {
          setIsProcessing(false)
          return
        }
      }

      // Atomically claim the request first: the status transition is the guard,
      // so two admins (or tabs) can't both pass a stale check and both insert a
      // teacher. Only one update can flip it out of pending/needs_info.
      const { data: claimed, error: claimError } = await supabase
        .from('teacher_submission_requests')
        .update({
          status: 'approved',
          reviewed_by: user?.id,
          reviewed_at: new Date().toISOString(),
          admin_notes: 'Approved and added to database'
        })
        .eq('id', request.id)
        .in('status', ['pending', 'needs_info'])
        .select()

      if (claimError) throw claimError
      if (!claimed || claimed.length === 0) {
        showToast('This request was already handled.', 'warning')
        onUpdate()
        return
      }

      // Create teacher; revert the claim if this fails so it can be retried.
      const { data: newTeacher, error: teacherError } = await supabase
        .from('teachers')
        .insert({
          name: request.teacher_name,
          institute: request.institute,
          designation: request.designation,
          city: request.city,
          linkedin_url: request.linkedin_url ? normalizeUrlInput(request.linkedin_url) : null,
          bio: request.bio || null,
          created_by: user?.id,
        })
        .select()
        .single()

      if (teacherError) {
        await supabase
          .from('teacher_submission_requests')
          .update({ status: request.status || 'pending', reviewed_by: null, reviewed_at: null, admin_notes: null })
          .eq('id', request.id)
        throw teacherError
      }

      // Link the created teacher to the request.
      await supabase
        .from('teacher_submission_requests')
        .update({ teacher_id: newTeacher.id })
        .eq('id', request.id)

      // Resolve the linked feedback (secondary — don't fail the approval on it).
      if (request.feedback_id) {
        const { error: feedbackError } = await supabase
          .from('feedback')
          .update({ status: 'resolved', resolved_at: new Date().toISOString() })
          .eq('id', request.feedback_id)
        if (feedbackError) console.error('Failed to update feedback status:', feedbackError)
      }

      // Send approval email
      const emailResult = await sendApprovalEmail(
        request.requester_email,
        request.teacher_name,
        request.institute,
        newTeacher.id,
        request.id
      )

      if (emailResult.success) {
        showToast('Teacher approved and added — email sent to requester', 'success')
      } else {
        showToast("Teacher approved and added — but the email to the requester couldn't be queued", 'warning')
      }
      onUpdate()
    } catch (error: any) {
      console.error('Error approving teacher:', error)
      if (error?.code === '23505') {
        showToast('A teacher with this name and institute already exists — reject this request as a duplicate', 'error')
      } else {
        showToast(`Failed to approve teacher: ${error?.message || 'Unknown error'}`, 'error')
      }
    } finally {
      setIsProcessing(false)
    }
  }

  // Approve with modifications
  const handleEditAndApprove = async () => {
    // Check if already processed
    if (request.status === 'approved' || request.status === 'modified') {
      showToast('This teacher is already approved', 'warning')
      setShowEditModal(false)
      return
    }

    setIsProcessing(true)
    try {
      // Track changes made
      const changes = []
      if (editedData.teacher_name !== request.teacher_name) changes.push(`Name: ${request.teacher_name} → ${editedData.teacher_name}`)
      if (editedData.institute !== request.institute) changes.push(`Institute: ${request.institute} → ${editedData.institute}`)
      if (editedData.designation !== request.designation) changes.push(`Designation: ${request.designation} → ${editedData.designation}`)
      if (editedData.city !== request.city) changes.push(`City: ${request.city} → ${editedData.city}`)

      // Atomically claim the request first (status transition is the guard).
      const { data: claimed, error: claimError } = await supabase
        .from('teacher_submission_requests')
        .update({
          status: 'modified',
          reviewed_by: user?.id,
          reviewed_at: new Date().toISOString(),
          admin_notes: `Approved with modifications: ${changes.join(', ')}`
        })
        .eq('id', request.id)
        .in('status', ['pending', 'needs_info'])
        .select()

      if (claimError) throw claimError
      if (!claimed || claimed.length === 0) {
        showToast('This request was already handled.', 'warning')
        setShowEditModal(false)
        onUpdate()
        return
      }

      // Create teacher with edited data; revert the claim if this fails.
      const { data: newTeacher, error: teacherError } = await supabase
        .from('teachers')
        .insert({
          name: editedData.teacher_name,
          institute: editedData.institute,
          designation: editedData.designation,
          city: editedData.city,
          linkedin_url: editedData.linkedin_url ? normalizeUrlInput(editedData.linkedin_url) : null,
          bio: editedData.bio || null,
          created_by: user?.id,
        })
        .select()
        .single()

      if (teacherError) {
        await supabase
          .from('teacher_submission_requests')
          .update({ status: request.status || 'pending', reviewed_by: null, reviewed_at: null, admin_notes: null })
          .eq('id', request.id)
        throw teacherError
      }

      // Link the created teacher to the request.
      await supabase
        .from('teacher_submission_requests')
        .update({ teacher_id: newTeacher.id })
        .eq('id', request.id)

      // Resolve the linked feedback (secondary — don't fail the approval on it).
      if (request.feedback_id) {
        const { error: feedbackError } = await supabase
          .from('feedback')
          .update({ status: 'resolved', resolved_at: new Date().toISOString() })
          .eq('id', request.feedback_id)
        if (feedbackError) console.error('Failed to update feedback status:', feedbackError)
      }

      // Send modified approval email
      const emailResult = await sendModifiedApprovalEmail(
        request.requester_email,
        editedData.teacher_name,
        editedData.institute,
        changes.join('<br>'),
        newTeacher.id,
        request.id
      )

      if (emailResult.success) {
        showToast('Teacher approved with changes — email sent to requester', 'success')
      } else {
        showToast("Teacher approved with changes — but the email to the requester couldn't be queued", 'warning')
      }
      setShowEditModal(false)
      onUpdate()
    } catch (error: any) {
      console.error('Error approving teacher:', error)
      if (error?.code === '23505') {
        showToast('A teacher with this name and institute already exists — reject this request as a duplicate', 'error')
      } else {
        showToast(`Failed to approve teacher: ${error?.message || 'Unknown error'}`, 'error')
      }
    } finally {
      setIsProcessing(false)
    }
  }

  // Reject request
  const handleReject = async () => {
    setIsProcessing(true)
    try {
      const finalReason = rejectionReason === 'other' ? customReason : rejectionReason

      // Update request status
      const { error: updateError } = await supabase
        .from('teacher_submission_requests')
        .update({
          status: 'rejected',
          rejection_reason: finalReason,
          reviewed_by: user?.id,
          reviewed_at: new Date().toISOString(),
          admin_notes: `Rejected: ${finalReason}`
        })
        .eq('id', request.id)

      if (updateError) throw updateError

      // Close the linked feedback (secondary — don't fail the rejection on it).
      if (request.feedback_id) {
        const { error: feedbackError } = await supabase
          .from('feedback')
          .update({ status: 'closed' })
          .eq('id', request.feedback_id)
        if (feedbackError) console.error('Failed to update feedback status:', feedbackError)
      }

      // Send rejection email
      const emailResult = await sendRejectionEmail(
        request.requester_email,
        request.teacher_name,
        finalReason,
        request.id
      )

      if (emailResult.success) {
        showToast('Request rejected. Email sent to requester.', 'info')
      } else {
        showToast("Request rejected — but the email to the requester couldn't be queued", 'warning')
      }
      setShowRejectModal(false)
      onUpdate()
    } catch (error: any) {
      console.error('Error rejecting request:', error)
      showToast(`Failed to reject request: ${error?.message || 'Unknown error'}`, 'error')
    } finally {
      setIsProcessing(false)
    }
  }

  // Ignore request
  const handleIgnore = async () => {
    const confirmed = await confirm({
      title: 'Ignore this request?',
      message: 'It will move to the ignored section. You can review it there later.',
      confirmLabel: 'Ignore request',
      cancelLabel: 'Keep it',
    })
    if (!confirmed) {
      return
    }

    setIsProcessing(true)
    try {
      // Update request status
      const { error: updateError } = await supabase
        .from('teacher_submission_requests')
        .update({
          status: 'ignored',
          reviewed_by: user?.id,
          reviewed_at: new Date().toISOString(),
          admin_notes: 'Request ignored by admin'
        })
        .eq('id', request.id)

      if (updateError) throw updateError

      // Close the linked feedback (secondary — don't fail the ignore on it).
      if (request.feedback_id) {
        const { error: feedbackError } = await supabase
          .from('feedback')
          .update({ status: 'closed' })
          .eq('id', request.feedback_id)
        if (feedbackError) console.error('Failed to update feedback status:', feedbackError)
      }

      showToast('Request ignored and moved to ignored section.', 'info')
      onUpdate()
    } catch (error: any) {
      console.error('Error ignoring request:', error)
      showToast(`Failed to ignore request: ${error?.message || 'Unknown error'}`, 'error')
    } finally {
      setIsProcessing(false)
    }
  }

  // Request more info
  const handleRequestInfo = async () => {
    setIsProcessing(true)
    try {
      // Update request status
      const { error: updateError } = await supabase
        .from('teacher_submission_requests')
        .update({
          status: 'needs_info',
          reviewed_by: user?.id,
          reviewed_at: new Date().toISOString(),
          admin_notes: `Additional information requested: ${infoRequest}`
        })
        .eq('id', request.id)

      if (updateError) throw updateError

      // Send needs info email
      const emailResult = await sendNeedsInfoEmail(
        request.requester_email,
        request.teacher_name,
        infoRequest,
        request.id
      )

      if (emailResult.success) {
        showToast('Info request sent to requester', 'info')
      } else {
        showToast("Request marked as needing info — but the email to the requester couldn't be queued", 'warning')
      }
      setShowInfoModal(false)
      onUpdate()
    } catch (error: any) {
      console.error('Error requesting info:', error)
      showToast(`Failed to send info request: ${error?.message || 'Unknown error'}`, 'error')
    } finally {
      setIsProcessing(false)
    }
  }

  const getStatusBadge = (status?: string) => {
    const statusMap = {
      pending: 'badge-primary',
      under_review: 'badge-warning',
      needs_info: 'badge-info',
      approved: 'badge-success',
      rejected: 'badge-error',
      modified: 'badge-success',
      ignored: 'badge-ghost'
    }
    return `badge ${statusMap[status as keyof typeof statusMap] || 'badge-neutral'}`
  }

  return (
    <>
      <div className="card bg-base-100 shadow-sm">
        <div className="card-body">
          {/* Header with status */}
          <div className="flex justify-between items-start mb-4">
            <div>
              <h3 className="text-xl font-bold text-base-content">
                {request.teacher_name}
              </h3>
              <p className="text-base-content/70">
                {request.designation} at {request.institute}, {request.city}
              </p>
              {request.linkedin_url && (
                <a
                  href={request.linkedin_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-info hover:underline text-sm"
                >
                  LinkedIn Profile ↗
                </a>
              )}
            </div>
            <div className="flex flex-col items-end gap-2">
              <span className={getStatusBadge(request.status || 'pending')}>
                {(request.status || 'pending').replace('_', ' ')}
              </span>
              <span className="text-sm text-base-content/70">
                {new Date(request.created_at).toLocaleDateString()}
              </span>
            </div>
          </div>

          {/* Bio */}
          {request.bio && (
            <div className="mb-4">
              <strong className="text-base-content/80">Bio:</strong>
              <p className="text-base-content/70 mt-1">{request.bio}</p>
            </div>
          )}

          {/* Requester Info */}
          <div className="bg-base-200 rounded-lg p-3 mb-4">
            <p className="text-sm text-base-content/80">
              <strong className="text-base-content/80">Requested by:</strong>{' '}
              <span className="text-base-content/70">{request.requester_name || 'Anonymous'} ({request.requester_email})</span>
            </p>
            <p className="text-sm text-base-content/80 mt-2">
              <strong className="text-base-content/80">Reason:</strong>{' '}
              <span className="text-base-content/70">{request.reason}</span>
            </p>
          </div>

          {/* Admin Notes */}
          {request.admin_notes && (
            <div className="bg-warning/10 rounded-lg p-3 mb-4">
              <p className="text-sm text-warning">
                <strong className="text-warning">Admin Notes:</strong>{' '}
                <span className="text-warning">{request.admin_notes}</span>
              </p>
            </div>
          )}

          {/* Action Buttons - Only show for pending/needs_info requests */}
          {(!request.status || request.status === 'pending' || request.status === 'needs_info') && request.status !== 'ignored' && (
            <div className="flex flex-wrap gap-2 mt-4">
              <Button
                variant="success"
                size="sm"
                onClick={handleApprove}
                disabled={isProcessing}
                title="Approve and add teacher as-is"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                </svg>
                Approve
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={() => setShowEditModal(true)}
                disabled={isProcessing}
                title="Edit details before approving"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Z" />
                </svg>
                Edit &amp; Approve
              </Button>
              <Button
                variant="error"
                size="sm"
                onClick={() => setShowRejectModal(true)}
                disabled={isProcessing}
                title="Reject this request"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 9.75l4.5 4.5m0-4.5l-4.5 4.5M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                </svg>
                Reject
              </Button>
              <Button
                variant="warning"
                size="sm"
                onClick={() => setShowInfoModal(true)}
                disabled={isProcessing}
                title="Request more information"
              >
                Request Info
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleIgnore}
                disabled={isProcessing}
                title="Ignore this request"
              >
                Ignore
              </Button>
              {onDelete && (
                <Button
                  variant="error"
                  size="sm"
                  onClick={() => onDelete(request.id)}
                  disabled={isProcessing}
                  className="btn-outline"
                  title="Delete this request permanently"
                >
                  Delete
                </Button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Edit Modal */}
      {showEditModal && (
        <div className="modal modal-open">
          <div className="modal-box max-w-2xl ">
            <h3 className="font-bold text-lg mb-4 text-base-content">Edit Teacher Details</h3>
            <div className="space-y-4">
              <div>
                <label className="label">
                  <span className="label-text">Name</span>
                </label>
                <input
                  type="text"
                  value={editedData.teacher_name}
                  onChange={(e) => setEditedData({ ...editedData, teacher_name: e.target.value })}
                  className="input input-bordered w-full "
                />
              </div>
              <div>
                <label className="label">
                  <span className="label-text">Institute</span>
                </label>
                <input
                  type="text"
                  value={editedData.institute}
                  onChange={(e) => setEditedData({ ...editedData, institute: e.target.value })}
                  className="input input-bordered w-full "
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">
                    <span className="label-text">Designation</span>
                  </label>
                  <input
                    type="text"
                    value={editedData.designation}
                    onChange={(e) => setEditedData({ ...editedData, designation: e.target.value })}
                    className="input input-bordered w-full "
                  />
                </div>
                <div>
                  <label className="label">
                    <span className="label-text">City</span>
                  </label>
                  <input
                    type="text"
                    value={editedData.city}
                    onChange={(e) => setEditedData({ ...editedData, city: e.target.value })}
                    className="input input-bordered w-full "
                  />
                </div>
              </div>
              <div>
                <label className="label">
                  <span className="label-text">LinkedIn URL</span>
                </label>
                <input
                  type="url"
                  value={editedData.linkedin_url}
                  onChange={(e) => setEditedData({ ...editedData, linkedin_url: e.target.value })}
                  className="input input-bordered w-full "
                />
              </div>
              <div>
                <label className="label">
                  <span className="label-text">Bio</span>
                </label>
                <textarea
                  value={editedData.bio}
                  onChange={(e) => setEditedData({ ...editedData, bio: e.target.value })}
                  className="textarea textarea-bordered w-full h-24 "
                />
              </div>
            </div>
            <div className="modal-action">
              <Button
                variant="primary"
                onClick={handleEditAndApprove}
                disabled={isProcessing}
              >
                {isProcessing ? 'Processing...' : 'Save & Approve'}
              </Button>
              <Button
                variant="default"
                onClick={() => setShowEditModal(false)}
                disabled={isProcessing}
              >
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Reject Modal */}
      {showRejectModal && (
        <div className="modal modal-open">
          <div className="modal-box ">
            <h3 className="font-bold text-lg mb-4 text-base-content">Reject Request</h3>
            <div className="space-y-4">
              <div>
                <label className="label">
                  <span className="label-text">Rejection Reason</span>
                </label>
                <select
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  className="select select-bordered w-full "
                >
                  <option value="">Select a reason...</option>
                  <option value="Duplicate teacher already exists">Duplicate teacher already exists</option>
                  <option value="Invalid or spam submission">Invalid or spam submission</option>
                  <option value="Insufficient information provided">Insufficient information provided</option>
                  <option value="Teacher not verifiable">Teacher not verifiable</option>
                  <option value="Does not meet quality guidelines">Does not meet quality guidelines</option>
                  <option value="other">Other (specify)</option>
                </select>
              </div>
              {rejectionReason === 'other' && (
                <div>
                  <label className="label">
                    <span className="label-text">Custom Reason</span>
                  </label>
                  <textarea
                    value={customReason}
                    onChange={(e) => setCustomReason(e.target.value)}
                    className="textarea textarea-bordered w-full h-24 "
                    placeholder="Enter the reason for rejection..."
                  />
                </div>
              )}
            </div>
            <div className="modal-action">
              <Button
                variant="error"
                onClick={handleReject}
                disabled={isProcessing || !rejectionReason || (rejectionReason === 'other' && !customReason)}
              >
                {isProcessing ? 'Processing...' : 'Reject & Send Email'}
              </Button>
              <Button
                variant="default"
                onClick={() => setShowRejectModal(false)}
                disabled={isProcessing}
              >
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Request Info Modal */}
      {showInfoModal && (
        <div className="modal modal-open">
          <div className="modal-box ">
            <h3 className="font-bold text-lg mb-4 text-base-content">Request Additional Information</h3>
            <div className="space-y-4">
              <div>
                <label className="label">
                  <span className="label-text">What information do you need?</span>
                </label>
                <textarea
                  value={infoRequest}
                  onChange={(e) => setInfoRequest(e.target.value)}
                  className="textarea textarea-bordered w-full h-32 "
                  placeholder="Please specify what additional information is needed..."
                />
              </div>
            </div>
            <div className="modal-action">
              <Button
                variant="warning"
                onClick={handleRequestInfo}
                disabled={isProcessing || !infoRequest}
              >
                {isProcessing ? 'Processing...' : 'Send Request'}
              </Button>
              <Button
                variant="default"
                onClick={() => setShowInfoModal(false)}
                disabled={isProcessing}
              >
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}