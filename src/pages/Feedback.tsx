import React, { useEffect, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { useSearchParams } from 'react-router-dom'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { supabase } from '../lib/supabaseClient'
import { FormInput } from '../components/FormInput'
import { Button } from '../components/Button'
import { useToast } from '../hooks/useToast'
import { ToastContainer } from '../components/ToastContainer'
import { useUser } from '../hooks/useAuth'
import { useInstitutes, useCities, useDesignations } from '../hooks/useTeachersOptimized'
import { normalizeUrlInput } from '../lib/validation'
import { friendlyWriteError } from '../lib/dbErrors'

// Validation schemas
const generalFeedbackSchema = z.object({
  type: z.enum(['feature_request', 'bug_report', 'general']),
  title: z.string().min(1, 'Title is required').max(100, 'Title too long'),
  description: z.string().min(10, 'Please provide more details (minimum 10 characters)').max(1000, 'Description too long'),
  email: z.string().email('Invalid email').optional().or(z.literal('')),
  name: z.string().max(50, 'Name too long').optional()
})

const teacherRequestSchema = z.object({
  teacherName: z.string().min(1, 'Teacher name is required').max(100, 'Name too long'),
  institute: z.string().min(1, 'Institute is required').max(100, 'Institute name too long'),
  designation: z.string().min(1, 'Designation is required').max(100, 'Designation too long'),
  city: z.string().min(1, 'City is required').max(50, 'City name too long'),
  linkedinUrl: z.string().transform(normalizeUrlInput).pipe(z.string().url('Invalid LinkedIn URL')).optional().or(z.literal('')),
  bio: z.string().max(500, 'Bio too long').optional(),
  requesterEmail: z.string().email('Invalid email address'),
  requesterName: z.string().max(50, 'Name too long').optional(),
  reason: z.string().min(10, 'Please explain why this teacher should be added (minimum 10 characters)').max(500, 'Reason too long')
})

type GeneralFeedback = z.infer<typeof generalFeedbackSchema>
type TeacherRequest = z.infer<typeof teacherRequestSchema>

export default function Feedback() {
  const [activeTab, setActiveTab] = useState<'general' | 'teacher'>('general')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showMoreDetails, setShowMoreDetails] = useState(false)
  const { toasts, showToast, removeToast } = useToast()

  const generalForm = useForm<GeneralFeedback>({
    resolver: zodResolver(generalFeedbackSchema),
    defaultValues: {
      type: 'general'
    }
  })

  const teacherForm = useForm<TeacherRequest>({
    resolver: zodResolver(teacherRequestSchema)
  })

  const { data: institutes } = useInstitutes()
  const { data: cities } = useCities()
  const { data: designations } = useDesignations()

  // Pre-fill contact details for signed-in users so they don't retype them.
  const { data: user } = useUser()
  useEffect(() => {
    if (!user?.email) return
    const name = (user.user_metadata?.display_name
      || user.user_metadata?.full_name
      || user.user_metadata?.name) as string | undefined
    generalForm.setValue('email', user.email)
    teacherForm.setValue('requesterEmail', user.email)
    if (name) {
      generalForm.setValue('name', name)
      teacherForm.setValue('requesterName', name)
    }
  }, [user, generalForm, teacherForm])

  // Deep link from the listing's empty state: ?tab=request&name=… opens the
  // Request tab with the searched name pre-filled. Run once so it can't clobber
  // a user who is already typing.
  const [searchParams] = useSearchParams()
  const deepLinkApplied = useRef(false)
  useEffect(() => {
    if (deepLinkApplied.current) return
    const tab = searchParams.get('tab')
    const name = searchParams.get('name')
    if (tab === 'request' || name) {
      deepLinkApplied.current = true
      setActiveTab('teacher')
      if (name) teacherForm.setValue('teacherName', name)
    }
  }, [searchParams, teacherForm])

  const handleGeneralFeedback = async (data: GeneralFeedback) => {
    setIsSubmitting(true)
    try {
      const { error } = await supabase
        .from('feedback')
        .insert({
          type: data.type,
          title: data.title,
          description: data.description,
          email: data.email || null,
          name: data.name || null
        })

      if (error) throw error

      showToast("Feedback received — we'll review it soon.", 'success')
      generalForm.reset()
    } catch (error) {
      console.error('Error submitting feedback:', error)
      showToast(friendlyWriteError(error) ?? "Couldn't send your feedback. Try again.", 'error')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleTeacherRequest = async (data: TeacherRequest) => {
    setIsSubmitting(true)
    try {
      // First create the feedback entry. The id is generated client-side:
      // feedback is insert-only for the public role, so an insert-returning
      // (.select()) would be blocked by RLS.
      const feedbackId = crypto.randomUUID()
      const { error: feedbackError } = await supabase
        .from('feedback')
        .insert({
          id: feedbackId,
          type: 'teacher_request',
          title: `Add Teacher: ${data.teacherName}`,
          description: `Request to add ${data.teacherName} from ${data.institute}. Reason: ${data.reason}`,
          email: data.requesterEmail,
          name: data.requesterName || null
        })

      if (feedbackError) throw feedbackError

      // Then create the detailed teacher request
      const { error: requestError } = await supabase
        .from('teacher_submission_requests')
        .insert({
          feedback_id: feedbackId,
          teacher_name: data.teacherName,
          institute: data.institute,
          designation: data.designation,
          city: data.city,
          linkedin_url: data.linkedinUrl || null,
          bio: data.bio || null,
          requester_email: data.requesterEmail,
          requester_name: data.requesterName || null,
          reason: data.reason
        })

      if (requestError) throw requestError

      showToast("Request sent — we'll review and add them.", 'success')
      teacherForm.reset()
    } catch (error) {
      console.error('Error submitting teacher request:', error)
      showToast(friendlyWriteError(error) ?? "Couldn't send your request. Try again.", 'error')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="max-w-content mx-auto py-8">
      <ToastContainer toasts={toasts} onRemove={removeToast} />
      {/* Header */}
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-base-content mb-4">
          Feedback & Requests
        </h1>
        <p className="text-base-content/70 max-w-2xl mx-auto">
          Help us improve TeacherRank by sharing your feedback, reporting bugs, requesting features, 
          or suggesting teachers to add to our platform.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex justify-center mb-8">
        <div className="tabs tabs-boxed bg-base-200">
          <button 
            className={`tab tab-sm md:tab-lg text-sm md:text-base ${activeTab === 'general' ? 'tab-active' : 'text-base-content/70'}`}
            onClick={() => setActiveTab('general')}
          >
            General Feedback
          </button>
          <button 
            className={`tab tab-sm md:tab-lg text-sm md:text-base ${activeTab === 'teacher' ? 'tab-active' : 'text-base-content/70'}`}
            onClick={() => setActiveTab('teacher')}
          >
            Request Teacher
          </button>
        </div>
      </div>

      {/* General Feedback Form */}
      {activeTab === 'general' && (
        <div className="card bg-base-100 shadow-sm">
          <div className="card-body">
            <h2 className="card-title text-primary mb-4">
              Share Your Feedback
            </h2>
            <form onSubmit={generalForm.handleSubmit(handleGeneralFeedback)} className="space-y-4">
              <div>
                <label htmlFor="feedback-type" className="label">
                  <span className="label-text font-medium">Feedback Type</span>
                </label>
                <select
                  id="feedback-type"
                  {...generalForm.register('type')}
                  className="select select-bordered w-full "
                >
                  <option value="general">General Feedback</option>
                  <option value="feature_request">Feature Request</option>
                  <option value="bug_report">Bug Report</option>
                </select>
              </div>

              <FormInput
                label="Title"
                name="title"
                register={generalForm.register}
                error={generalForm.formState.errors.title}
                placeholder="Brief summary of your feedback"
                required
              />

              <div>
                <label htmlFor="feedback-description" className="label">
                  <span className="label-text font-medium">Description *</span>
                </label>
                <textarea
                  id="feedback-description"
                  {...generalForm.register('description')}
                  className="textarea textarea-bordered w-full h-32 "
                  placeholder="What's on your mind?"
                  aria-invalid={Boolean(generalForm.formState.errors.description)}
                  aria-describedby={generalForm.formState.errors.description ? 'feedback-description-error' : undefined}
                />
                {generalForm.formState.errors.description && (
                  <p id="feedback-description-error" role="alert" className="text-error text-sm mt-1">
                    {generalForm.formState.errors.description.message}
                  </p>
                )}
              </div>

              <FormInput
                label="Email (Optional)"
                name="email"
                type="email"
                register={generalForm.register}
                error={generalForm.formState.errors.email}
                placeholder="your.email@example.com"
              />

              <FormInput
                label="Name (Optional)"
                name="name"
                register={generalForm.register}
                error={generalForm.formState.errors.name}
                placeholder="Your name"
              />

              <Button
                type="submit"
                variant="primary"
                loading={isSubmitting}
                className="w-full"
              >
                {isSubmitting ? 'Submitting...' : 'Submit Feedback'}
              </Button>
            </form>
          </div>
        </div>
      )}

      {/* Teacher Request Form */}
      {activeTab === 'teacher' && (
        <div className="card bg-base-100 shadow-sm">
          <div className="card-body">
            <h2 className="card-title text-primary mb-4">
              Request Teacher Addition
            </h2>
            <p className="text-base-content/70 mb-6">
              Know a great teacher who should be on TeacherRank? Let us know and we'll add them to our platform!
            </p>
            
            <form onSubmit={teacherForm.handleSubmit(handleTeacherRequest)} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormInput
                  label="Teacher Name"
                  name="teacherName"
                  register={teacherForm.register}
                  error={teacherForm.formState.errors.teacherName}
                  placeholder="Dr. John Smith"
                  required
                />

                <FormInput
                  label="Institute"
                  name="institute"
                  register={teacherForm.register}
                  error={teacherForm.formState.errors.institute}
                  placeholder="University of Example"
                  required
                  options={institutes}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormInput
                  label="Designation"
                  name="designation"
                  register={teacherForm.register}
                  error={teacherForm.formState.errors.designation}
                  placeholder="Professor, Associate Professor, etc."
                  required
                  options={designations}
                />

                <FormInput
                  label="City"
                  name="city"
                  register={teacherForm.register}
                  error={teacherForm.formState.errors.city}
                  placeholder="New York"
                  required
                  options={cities}
                />
              </div>

              <div>
                <button
                  type="button"
                  onClick={() => setShowMoreDetails((v) => !v)}
                  aria-expanded={showMoreDetails}
                  className="flex items-center gap-1 cursor-pointer text-sm font-medium text-primary hover:text-primary-focus"
                >
                  <svg className={`w-4 h-4 transition-transform ${showMoreDetails ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                  Add more details (optional)
                </button>
                {showMoreDetails && (
                <div className="mt-4 space-y-4">
                  <FormInput
                    label="LinkedIn Profile (Optional)"
                    name="linkedinUrl"
                    type="url"
                    register={teacherForm.register}
                    error={teacherForm.formState.errors.linkedinUrl}
                    placeholder="https://linkedin.com/in/teacher-profile"
                  />

                  <div>
                    <label htmlFor="tr-bio" className="label">
                      <span className="label-text font-medium">Bio (Optional)</span>
                    </label>
                    <textarea
                      id="tr-bio"
                      {...teacherForm.register('bio')}
                      className="textarea textarea-bordered w-full h-24 "
                      placeholder="Brief bio about the teacher..."
                      aria-invalid={Boolean(teacherForm.formState.errors.bio)}
                      aria-describedby={teacherForm.formState.errors.bio ? 'tr-bio-error' : undefined}
                    />
                    {teacherForm.formState.errors.bio && (
                      <p id="tr-bio-error" role="alert" className="text-error text-sm mt-1">
                        {teacherForm.formState.errors.bio.message}
                      </p>
                    )}
                  </div>
                </div>
                )}
              </div>

              <div className="divider">
                <span className="text-base-content/80 font-medium">Your Information</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormInput
                  label="Your Email"
                  name="requesterEmail"
                  type="email"
                  register={teacherForm.register}
                  error={teacherForm.formState.errors.requesterEmail}
                  placeholder="your.email@example.com"
                  required
                />

                <FormInput
                  label="Your Name (Optional)"
                  name="requesterName"
                  register={teacherForm.register}
                  error={teacherForm.formState.errors.requesterName}
                  placeholder="Your name"
                />
              </div>

              <div>
                <label htmlFor="tr-reason" className="label">
                  <span className="label-text font-medium">Why should we add this teacher? *</span>
                </label>
                <textarea
                  id="tr-reason"
                  {...teacherForm.register('reason')}
                  className="textarea textarea-bordered w-full h-32 "
                  placeholder="Why should we add this teacher?"
                  aria-invalid={Boolean(teacherForm.formState.errors.reason)}
                  aria-describedby={teacherForm.formState.errors.reason ? 'tr-reason-error' : undefined}
                />
                {teacherForm.formState.errors.reason && (
                  <p id="tr-reason-error" role="alert" className="text-error text-sm mt-1">
                    {teacherForm.formState.errors.reason.message}
                  </p>
                )}
              </div>

              <Button
                type="submit"
                variant="primary"
                loading={isSubmitting}
                className="w-full"
              >
                {isSubmitting ? 'Submitting Request...' : 'Submit Teacher Request'}
              </Button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}