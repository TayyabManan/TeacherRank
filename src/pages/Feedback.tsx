import React, { useCallback, useEffect, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, useSearchParams } from 'react-router-dom'
import { Helmet } from '../components/Meta'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { supabase } from '../lib/supabaseClient'
import { FormInput, FormSelect, FormTextarea } from '../components/FormInput'
import { Button, buttonClasses } from '../components/Button'
import { CheckIcon, InfoIcon } from '../components/icons'
import { logger } from '../lib/logger'
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
  designation: z.string().max(100, 'Designation too long').optional().or(z.literal('')),
  city: z.string().min(1, 'City is required').max(50, 'City name too long'),
  linkedinUrl: z.string().transform(normalizeUrlInput).pipe(z.string().url('Invalid LinkedIn URL')).optional().or(z.literal('')),
  bio: z.string().max(500, 'Bio too long').optional(),
  requesterEmail: z.string().email('Invalid email address'),
  requesterName: z.string().max(50, 'Name too long').optional(),
  reason: z.string().min(10, 'Please explain why this teacher should be added (minimum 10 characters)').max(500, 'Reason too long')
})

type GeneralFeedback = z.infer<typeof generalFeedbackSchema>
type TeacherRequest = z.infer<typeof teacherRequestSchema>

/** The address review emails come from (send-email edge function, Gmail SMTP). */
const SENDER_EMAIL = 'teacherrank.app@gmail.com'

/**
 * Post-submit confirmation shown in place of the form: what happens next +
 * email expectations (spam folder!) — a toast is too transient for that.
 */
function SubmissionSuccess({
  title,
  body,
  emailNote,
  submitAnotherLabel,
  onSubmitAnother,
}: {
  title: string
  body: React.ReactNode
  emailNote?: React.ReactNode
  submitAnotherLabel: string
  onSubmitAnother: () => void
}) {
  return (
    <div role="status" className="card bg-base-100 shadow-sm">
      <div className="card-body items-center text-center">
        <div className="w-16 h-16 bg-success/10 rounded-full flex items-center justify-center mb-2">
          <CheckIcon className="w-8 h-8 text-success" />
        </div>
        <h2 className="text-xl font-bold text-base-content">{title}</h2>
        <p className="text-base-content/80 max-w-md">{body}</p>

        {emailNote && (
          <div className="flex items-start gap-3 text-left bg-info/10 border border-info/30 rounded-lg p-4 mt-2 max-w-md">
            <InfoIcon className="w-5 h-5 text-info flex-shrink-0 mt-0.5" />
            <p className="text-sm text-base-content/80">{emailNote}</p>
          </div>
        )}

        <div className="card-actions mt-4">
          <Button variant="outline" onClick={onSubmitAnother}>
            {submitAnotherLabel}
          </Button>
          <Link to="/" className={buttonClasses({ variant: 'primary' })}>
            Browse teachers
          </Link>
        </div>
      </div>
    </div>
  )
}

export default function Feedback() {
  const [activeTab, setActiveTab] = useState<'general' | 'teacher'>('general')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showMoreDetails, setShowMoreDetails] = useState(false)
  // Which form was just submitted (shows the confirmation panel in its place)
  // + the contact email it was submitted with, for the "we'll email you" copy.
  const [submitted, setSubmitted] = useState<'general' | 'teacher' | null>(null)
  const [submittedEmail, setSubmittedEmail] = useState('')
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
  // Also re-applied after a submit resets the forms ("Submit another").
  const { data: user } = useUser()
  const prefillContact = useCallback(() => {
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
  useEffect(() => {
    prefillContact()
  }, [prefillContact])

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

      // Swap the form for the confirmation panel (a toast is too transient
      // for the check-your-spam guidance).
      setSubmittedEmail(data.email || '')
      setSubmitted('general')
      generalForm.reset()
    } catch (error) {
      logger.error('Failed to submit feedback', error)
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
          // Optional in the form; the column is NOT NULL, so blank saves as ''.
          designation: data.designation?.trim() || '',
          city: data.city,
          linkedin_url: data.linkedinUrl || null,
          bio: data.bio || null,
          requester_email: data.requesterEmail,
          requester_name: data.requesterName || null,
          reason: data.reason
        })

      if (requestError) throw requestError

      setSubmittedEmail(data.requesterEmail)
      setSubmitted('teacher')
      teacherForm.reset()
    } catch (error) {
      logger.error('Failed to submit teacher request', error)
      showToast(friendlyWriteError(error) ?? "Couldn't send your request. Try again.", 'error')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="max-w-content mx-auto py-8">
      <Helmet>
        <title>Feedback &amp; Requests</title>
      </Helmet>
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
            onClick={() => { setActiveTab('general'); setSubmitted(null) }}
          >
            General feedback
          </button>
          <button
            className={`tab tab-sm md:tab-lg text-sm md:text-base ${activeTab === 'teacher' ? 'tab-active' : 'text-base-content/70'}`}
            onClick={() => { setActiveTab('teacher'); setSubmitted(null) }}
          >
            Request a teacher
          </button>
        </div>
      </div>

      {/* General Feedback Form */}
      {activeTab === 'general' && submitted === 'general' && (
        <SubmissionSuccess
          title="Feedback received"
          body={
            <>
              Thanks. We read every submission.
              {submittedEmail && <> If we follow up, we&rsquo;ll reach you at <strong>{submittedEmail}</strong>.</>}
            </>
          }
          emailNote={
            submittedEmail ? (
              <>
                Replies come from <strong>{SENDER_EMAIL}</strong> and can land in spam, so check
                there and add us to your contacts.
              </>
            ) : undefined
          }
          submitAnotherLabel="Send more feedback"
          onSubmitAnother={() => {
            setSubmitted(null)
            prefillContact()
          }}
        />
      )}
      {activeTab === 'general' && submitted !== 'general' && (
        <div className="card bg-base-100 shadow-sm">
          <div className="card-body">
            <h2 className="card-title text-primary mb-4">
              Share Your Feedback
            </h2>
            <form onSubmit={generalForm.handleSubmit(handleGeneralFeedback)} className="space-y-4">
              <FormSelect
                label="Feedback Type"
                name="type"
                register={generalForm.register}
                error={generalForm.formState.errors.type}
                options={[
                  { value: 'general', label: 'General Feedback' },
                  { value: 'feature_request', label: 'Feature Request' },
                  { value: 'bug_report', label: 'Bug Report' },
                ]}
              />

              <FormInput
                label="Title"
                name="title"
                register={generalForm.register}
                error={generalForm.formState.errors.title}
                placeholder="Brief summary of your feedback"
                required
              />

              <FormTextarea
                label="Description"
                name="description"
                register={generalForm.register}
                error={generalForm.formState.errors.description}
                placeholder="What's on your mind?"
                required
                rows={5}
              />

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
                {isSubmitting ? 'Submitting...' : 'Submit feedback'}
              </Button>
            </form>
          </div>
        </div>
      )}

      {/* Teacher Request Form */}
      {activeTab === 'teacher' && submitted === 'teacher' && (
        <SubmissionSuccess
          title="Request received"
          body={
            <>
              We review every request before it goes live, usually within a few days. We&rsquo;ll
              email you at <strong>{submittedEmail}</strong> once it&rsquo;s approved, or if we need
              more details.
            </>
          }
          emailNote={
            <>
              Our emails come from <strong>{SENDER_EMAIL}</strong> and sometimes land in spam,
              so check there and add us to your contacts.
            </>
          }
          submitAnotherLabel="Request another teacher"
          onSubmitAnother={() => {
            setSubmitted(null)
            setShowMoreDetails(false)
            prefillContact()
          }}
        />
      )}
      {activeTab === 'teacher' && submitted !== 'teacher' && (
        <div className="card bg-base-100 shadow-sm">
          <div className="card-body">
            <h2 className="card-title text-primary mb-4">
              Request a teacher
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
                  label="Designation (Optional)"
                  name="designation"
                  register={teacherForm.register}
                  error={teacherForm.formState.errors.designation}
                  placeholder="Professor, Associate Professor, etc."
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

                  <FormTextarea
                    label="Bio (Optional)"
                    name="bio"
                    register={teacherForm.register}
                    error={teacherForm.formState.errors.bio}
                    placeholder="Brief bio about the teacher..."
                    rows={4}
                  />
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

              <FormTextarea
                label="Why should we add this teacher?"
                name="reason"
                register={teacherForm.register}
                error={teacherForm.formState.errors.reason}
                placeholder="e.g. Great professor, students keep asking about them"
                required
                rows={5}
              />

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