import React, { useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useUser } from '../hooks/useAuth'
import { sendApprovalEmail, sendRejectionEmail, sendNeedsInfoEmail, sendModifiedApprovalEmail } from '../lib/emailService'
import { sanitizeSearchInput } from '../lib/validation'
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
  feedback: {
    id: string
    status: string
  }
}

interface TeacherRequestManagerProps {
  request: TeacherRequest
  onUpdate: () => void
  onDelete?: (id: string) => void
  showToast: (message: string, type: 'success' | 'error' | 'info' | 'warning') => void
}

export function TeacherRequestManager({ request, onUpdate, onDelete, showToast }: TeacherRequestManagerProps) {
  const { data: user } = useUser()
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

    const { data, error } = await supabase
      .from('teachers')
      .select('id, name, institute')
      .or(`name.ilike.%${sanitizedName}%,institute.eq.${sanitizedInstitute}`)
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
      showToast('This teacher has already been approved!', 'warning')
      return
    }

    setIsProcessing(true)
    try {
      // Check for duplicates first
      const duplicates = await checkDuplicate()
      if (duplicates.length > 0) {
        showToast(`Found ${duplicates.length} similar teacher(s). Please review before approving.`, 'warning')
        const confirmAdd = window.confirm(
          `Found ${duplicates.length} similar teacher(s). Are you sure you want to add this teacher?\n\n` +
          duplicates.map(d => `- ${d.name} (${d.institute})`).join('\n')
        )
        if (!confirmAdd) {
          setIsProcessing(false)
          return
        }
      }

      // Create teacher
      const { data: newTeacher, error: teacherError } = await supabase
        .from('teachers')
        .insert({
          name: request.teacher_name,
          institute: request.institute,
          designation: request.designation,
          city: request.city,
          linkedin_url: request.linkedin_url,
          bio: request.bio,
          created_by: user?.id,
        })
        .select()
        .single()

      if (teacherError) throw teacherError

      // Update request status
      const { error: updateError } = await supabase
        .from('teacher_submission_requests')
        .update({
          status: 'approved',
          teacher_id: newTeacher.id,
          reviewed_by: user?.id,
          reviewed_at: new Date().toISOString(),
          admin_notes: 'Approved and added to database'
        })
        .eq('id', request.id)

      if (updateError) throw updateError

      // Update feedback status to resolved
      const { error: feedbackError } = await supabase
        .from('feedback')
        .update({
          status: 'resolved',
          resolved_at: new Date().toISOString()
        })
        .eq('id', request.feedback.id)

      if (feedbackError) throw feedbackError

      // Send approval email
      await sendApprovalEmail(
        request.requester_email,
        request.teacher_name,
        request.institute,
        newTeacher.id,
        request.id
      )

      showToast('Teacher approved and added successfully! Email sent to requester.', 'success')
      onUpdate()
    } catch (error) {
      console.error('Error approving teacher:', error)
      showToast('Failed to approve teacher. Please try again.', 'error')
    } finally {
      setIsProcessing(false)
    }
  }

  // Approve with modifications
  const handleEditAndApprove = async () => {
    // Check if already processed
    if (request.status === 'approved' || request.status === 'modified') {
      showToast('This teacher has already been approved!', 'warning')
      setShowEditModal(false)
      return
    }

    setIsProcessing(true)
    try {
      // Create teacher with edited data
      const { data: newTeacher, error: teacherError } = await supabase
        .from('teachers')
        .insert({
          name: editedData.teacher_name,
          institute: editedData.institute,
          designation: editedData.designation,
          city: editedData.city,
          linkedin_url: editedData.linkedin_url || null,
          bio: editedData.bio || null,
          created_by: user?.id,
        })
        .select()
        .single()

      if (teacherError) throw teacherError

      // Track changes made
      const changes = []
      if (editedData.teacher_name !== request.teacher_name) changes.push(`Name: ${request.teacher_name} → ${editedData.teacher_name}`)
      if (editedData.institute !== request.institute) changes.push(`Institute: ${request.institute} → ${editedData.institute}`)
      if (editedData.designation !== request.designation) changes.push(`Designation: ${request.designation} → ${editedData.designation}`)
      if (editedData.city !== request.city) changes.push(`City: ${request.city} → ${editedData.city}`)

      // Update request status
      const { error: updateError } = await supabase
        .from('teacher_submission_requests')
        .update({
          status: 'modified',
          teacher_id: newTeacher.id,
          reviewed_by: user?.id,
          reviewed_at: new Date().toISOString(),
          admin_notes: `Approved with modifications: ${changes.join(', ')}`
        })
        .eq('id', request.id)

      if (updateError) throw updateError

      // Update feedback status to resolved
      const { error: feedbackError } = await supabase
        .from('feedback')
        .update({
          status: 'resolved',
          resolved_at: new Date().toISOString()
        })
        .eq('id', request.feedback.id)

      if (feedbackError) throw feedbackError

      // Send modified approval email
      await sendModifiedApprovalEmail(
        request.requester_email,
        editedData.teacher_name,
        editedData.institute,
        changes.join('<br>'),
        newTeacher.id,
        request.id
      )

      showToast('Teacher approved with modifications! Email sent to requester.', 'success')
      setShowEditModal(false)
      onUpdate()
    } catch (error) {
      console.error('Error approving teacher:', error)
      showToast('Failed to approve teacher. Please try again.', 'error')
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

      // Update feedback status to closed
      const { error: feedbackError } = await supabase
        .from('feedback')
        .update({
          status: 'closed'
        })
        .eq('id', request.feedback.id)

      if (feedbackError) throw feedbackError

      // Send rejection email
      await sendRejectionEmail(
        request.requester_email,
        request.teacher_name,
        finalReason,
        request.id
      )

      showToast('Request rejected. Email sent to requester.', 'info')
      setShowRejectModal(false)
      onUpdate()
    } catch (error) {
      console.error('Error rejecting request:', error)
      showToast('Failed to reject request. Please try again.', 'error')
    } finally {
      setIsProcessing(false)
    }
  }

  // Ignore request
  const handleIgnore = async () => {
    if (!confirm('Are you sure you want to ignore this request? It will be moved to the ignored section.')) {
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

      // Update feedback status to closed
      const { error: feedbackError } = await supabase
        .from('feedback')
        .update({
          status: 'closed'
        })
        .eq('id', request.feedback.id)

      if (feedbackError) throw feedbackError

      showToast('Request ignored and moved to ignored section.', 'info')
      onUpdate()
    } catch (error) {
      console.error('Error ignoring request:', error)
      showToast('Failed to ignore request. Please try again.', 'error')
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
      await sendNeedsInfoEmail(
        request.requester_email,
        request.teacher_name,
        infoRequest,
        request.id
      )

      showToast('Information request sent to requester via email.', 'info')
      setShowInfoModal(false)
      onUpdate()
    } catch (error) {
      console.error('Error requesting info:', error)
      showToast('Failed to send info request. Please try again.', 'error')
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
      <div className="card bg-white dark:bg-gray-800 shadow-xl">
        <div className="card-body">
          {/* Header with status */}
          <div className="flex justify-between items-start mb-4">
            <div>
              <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                {request.teacher_name}
              </h3>
              <p className="text-gray-600 dark:text-gray-400">
                {request.designation} at {request.institute}, {request.city}
              </p>
              {request.linkedin_url && (
                <a
                  href={request.linkedin_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 dark:text-blue-400 hover:underline text-sm"
                >
                  LinkedIn Profile ↗
                </a>
              )}
            </div>
            <div className="flex flex-col items-end gap-2">
              <span className={getStatusBadge(request.status || 'pending')}>
                {(request.status || 'pending').replace('_', ' ')}
              </span>
              <span className="text-sm text-gray-500 dark:text-gray-400">
                {new Date(request.created_at).toLocaleDateString()}
              </span>
            </div>
          </div>

          {/* Bio */}
          {request.bio && (
            <div className="mb-4">
              <strong className="text-gray-700 dark:text-gray-300">Bio:</strong>
              <p className="text-gray-600 dark:text-gray-400 mt-1">{request.bio}</p>
            </div>
          )}

          {/* Requester Info */}
          <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3 mb-4">
            <p className="text-sm text-gray-700 dark:text-gray-300">
              <strong className="text-gray-700 dark:text-gray-300">Requested by:</strong>{' '}
              <span className="text-gray-600 dark:text-gray-400">{request.requester_name || 'Anonymous'} ({request.requester_email})</span>
            </p>
            <p className="text-sm text-gray-700 dark:text-gray-300 mt-2">
              <strong className="text-gray-700 dark:text-gray-300">Reason:</strong>{' '}
              <span className="text-gray-600 dark:text-gray-400">{request.reason}</span>
            </p>
          </div>

          {/* Admin Notes */}
          {request.admin_notes && (
            <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-lg p-3 mb-4">
              <p className="text-sm text-yellow-700 dark:text-yellow-300">
                <strong className="text-yellow-700 dark:text-yellow-400">Admin Notes:</strong>{' '}
                <span className="text-yellow-600 dark:text-yellow-200">{request.admin_notes}</span>
              </p>
            </div>
          )}

          {/* Action Buttons - Only show for pending/needs_info requests */}
          {(!request.status || request.status === 'pending' || request.status === 'needs_info') && request.status !== 'ignored' && (
            <div className="flex flex-wrap gap-2 mt-4">
              <button
                onClick={handleApprove}
                disabled={isProcessing}
                className="btn btn-success btn-sm text-white"
                title="Approve and add teacher as-is"
              >
                ✅ Approve
              </button>
              <button
                onClick={() => setShowEditModal(true)}
                disabled={isProcessing}
                className="btn btn-primary btn-sm"
                title="Edit details before approving"
              >
                ✏️ Edit & Approve
              </button>
              <button
                onClick={() => setShowRejectModal(true)}
                disabled={isProcessing}
                className="btn btn-error btn-sm text-white"
                title="Reject this request"
              >
                ❌ Reject
              </button>
              <button
                onClick={() => setShowInfoModal(true)}
                disabled={isProcessing}
                className="btn btn-warning btn-sm"
                title="Request more information"
              >
                🔍 Request Info
              </button>
              <button
                onClick={handleIgnore}
                disabled={isProcessing}
                className="btn btn-ghost btn-sm"
                title="Ignore this request"
              >
                🚫 Ignore
              </button>
              {onDelete && (
                <button
                  onClick={() => onDelete(request.id)}
                  disabled={isProcessing}
                  className="btn btn-error btn-sm btn-outline"
                  title="Delete this request permanently"
                >
                  🗑️ Delete
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Edit Modal */}
      {showEditModal && (
        <div className="modal modal-open">
          <div className="modal-box max-w-2xl dark:bg-gray-800">
            <h3 className="font-bold text-lg mb-4 dark:text-white">Edit Teacher Details</h3>
            <div className="space-y-4">
              <div>
                <label className="label">
                  <span className="label-text dark:text-gray-300">Name</span>
                </label>
                <input
                  type="text"
                  value={editedData.teacher_name}
                  onChange={(e) => setEditedData({ ...editedData, teacher_name: e.target.value })}
                  className="input input-bordered w-full dark:bg-gray-700 dark:text-white"
                />
              </div>
              <div>
                <label className="label">
                  <span className="label-text dark:text-gray-300">Institute</span>
                </label>
                <input
                  type="text"
                  value={editedData.institute}
                  onChange={(e) => setEditedData({ ...editedData, institute: e.target.value })}
                  className="input input-bordered w-full dark:bg-gray-700 dark:text-white"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">
                    <span className="label-text dark:text-gray-300">Designation</span>
                  </label>
                  <input
                    type="text"
                    value={editedData.designation}
                    onChange={(e) => setEditedData({ ...editedData, designation: e.target.value })}
                    className="input input-bordered w-full dark:bg-gray-700 dark:text-white"
                  />
                </div>
                <div>
                  <label className="label">
                    <span className="label-text dark:text-gray-300">City</span>
                  </label>
                  <input
                    type="text"
                    value={editedData.city}
                    onChange={(e) => setEditedData({ ...editedData, city: e.target.value })}
                    className="input input-bordered w-full dark:bg-gray-700 dark:text-white"
                  />
                </div>
              </div>
              <div>
                <label className="label">
                  <span className="label-text dark:text-gray-300">LinkedIn URL</span>
                </label>
                <input
                  type="url"
                  value={editedData.linkedin_url}
                  onChange={(e) => setEditedData({ ...editedData, linkedin_url: e.target.value })}
                  className="input input-bordered w-full dark:bg-gray-700 dark:text-white"
                />
              </div>
              <div>
                <label className="label">
                  <span className="label-text dark:text-gray-300">Bio</span>
                </label>
                <textarea
                  value={editedData.bio}
                  onChange={(e) => setEditedData({ ...editedData, bio: e.target.value })}
                  className="textarea textarea-bordered w-full h-24 dark:bg-gray-700 dark:text-white"
                />
              </div>
            </div>
            <div className="modal-action">
              <button
                onClick={handleEditAndApprove}
                disabled={isProcessing}
                className="btn btn-primary"
              >
                {isProcessing ? 'Processing...' : 'Save & Approve'}
              </button>
              <button
                onClick={() => setShowEditModal(false)}
                disabled={isProcessing}
                className="btn"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reject Modal */}
      {showRejectModal && (
        <div className="modal modal-open">
          <div className="modal-box dark:bg-gray-800">
            <h3 className="font-bold text-lg mb-4 dark:text-white">Reject Request</h3>
            <div className="space-y-4">
              <div>
                <label className="label">
                  <span className="label-text dark:text-gray-300">Rejection Reason</span>
                </label>
                <select
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  className="select select-bordered w-full dark:bg-gray-700 dark:text-white"
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
                    <span className="label-text dark:text-gray-300">Custom Reason</span>
                  </label>
                  <textarea
                    value={customReason}
                    onChange={(e) => setCustomReason(e.target.value)}
                    className="textarea textarea-bordered w-full h-24 dark:bg-gray-700 dark:text-white"
                    placeholder="Enter the reason for rejection..."
                  />
                </div>
              )}
            </div>
            <div className="modal-action">
              <button
                onClick={handleReject}
                disabled={isProcessing || !rejectionReason || (rejectionReason === 'other' && !customReason)}
                className="btn btn-error text-white"
              >
                {isProcessing ? 'Processing...' : 'Reject & Send Email'}
              </button>
              <button
                onClick={() => setShowRejectModal(false)}
                disabled={isProcessing}
                className="btn"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Request Info Modal */}
      {showInfoModal && (
        <div className="modal modal-open">
          <div className="modal-box dark:bg-gray-800">
            <h3 className="font-bold text-lg mb-4 dark:text-white">Request Additional Information</h3>
            <div className="space-y-4">
              <div>
                <label className="label">
                  <span className="label-text dark:text-gray-300">What information do you need?</span>
                </label>
                <textarea
                  value={infoRequest}
                  onChange={(e) => setInfoRequest(e.target.value)}
                  className="textarea textarea-bordered w-full h-32 dark:bg-gray-700 dark:text-white"
                  placeholder="Please specify what additional information is needed..."
                />
              </div>
            </div>
            <div className="modal-action">
              <button
                onClick={handleRequestInfo}
                disabled={isProcessing || !infoRequest}
                className="btn btn-warning"
              >
                {isProcessing ? 'Processing...' : 'Send Request'}
              </button>
              <button
                onClick={() => setShowInfoModal(false)}
                disabled={isProcessing}
                className="btn"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}