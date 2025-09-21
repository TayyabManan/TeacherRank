import React, { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { supabase } from '../lib/supabaseClient'
import { FormInput } from '../components/FormInput'

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
  linkedinUrl: z.string().url('Invalid LinkedIn URL').optional().or(z.literal('')),
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

  const generalForm = useForm<GeneralFeedback>({
    resolver: zodResolver(generalFeedbackSchema),
    defaultValues: {
      type: 'general'
    }
  })

  const teacherForm = useForm<TeacherRequest>({
    resolver: zodResolver(teacherRequestSchema)
  })

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

      alert('Thank you for your feedback! We\'ll review it soon.')
      generalForm.reset()
    } catch (error) {
      console.error('Error submitting feedback:', error)
      alert('Failed to submit feedback. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleTeacherRequest = async (data: TeacherRequest) => {
    setIsSubmitting(true)
    try {
      // First create the feedback entry
      const { data: feedbackData, error: feedbackError } = await supabase
        .from('feedback')
        .insert({
          type: 'teacher_request',
          title: `Add Teacher: ${data.teacherName}`,
          description: `Request to add ${data.teacherName} from ${data.institute}. Reason: ${data.reason}`,
          email: data.requesterEmail,
          name: data.requesterName || null
        })
        .select()
        .single()

      if (feedbackError) throw feedbackError

      // Then create the detailed teacher request
      const { error: requestError } = await supabase
        .from('teacher_submission_requests')
        .insert({
          feedback_id: feedbackData.id,
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

      alert('Teacher submission request sent! We\'ll review and add them soon.')
      teacherForm.reset()
    } catch (error) {
      console.error('Error submitting teacher request:', error)
      alert('Failed to submit request. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
          Feedback & Requests
        </h1>
        <p className="text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
          Help us improve TeacherRank by sharing your feedback, reporting bugs, requesting features, 
          or suggesting teachers to add to our platform.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex justify-center mb-8">
        <div className="tabs tabs-boxed bg-gray-100 dark:bg-gray-700">
          <button 
            className={`tab tab-sm md:tab-lg text-sm md:text-base ${activeTab === 'general' ? 'tab-active' : 'dark:text-gray-300'}`}
            onClick={() => setActiveTab('general')}
          >
            General Feedback
          </button>
          <button 
            className={`tab tab-sm md:tab-lg text-sm md:text-base ${activeTab === 'teacher' ? 'tab-active' : 'dark:text-gray-300'}`}
            onClick={() => setActiveTab('teacher')}
          >
            Request Teacher
          </button>
        </div>
      </div>

      {/* General Feedback Form */}
      {activeTab === 'general' && (
        <div className="card bg-white dark:bg-gray-800 shadow-xl">
          <div className="card-body">
            <h2 className="card-title text-purple-600 dark:text-purple-400 mb-4">
              Share Your Feedback
            </h2>
            <form onSubmit={generalForm.handleSubmit(handleGeneralFeedback)} className="space-y-4">
              <div>
                <label className="label">
                  <span className="label-text font-medium dark:text-gray-200">Feedback Type</span>
                </label>
                <select 
                  {...generalForm.register('type')}
                  className="select select-bordered w-full dark:bg-gray-700 dark:text-white dark:border-gray-600"
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
                <label className="label">
                  <span className="label-text font-medium dark:text-gray-200">Description *</span>
                </label>
                <textarea
                  {...generalForm.register('description')}
                  className="textarea textarea-bordered w-full h-32 dark:bg-gray-700 dark:text-white dark:border-gray-600"
                  placeholder="Please provide detailed feedback..."
                />
                {generalForm.formState.errors.description && (
                  <p className="text-red-500 text-sm mt-1">
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

              <button
                type="submit"
                disabled={isSubmitting}
                className="btn btn-primary w-full dark:bg-purple-600 dark:hover:bg-purple-700"
              >
                {isSubmitting ? (
                  <>
                    <span className="loading loading-spinner loading-sm"></span>
                    Submitting...
                  </>
                ) : (
                  'Submit Feedback'
                )}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Teacher Request Form */}
      {activeTab === 'teacher' && (
        <div className="card bg-white dark:bg-gray-800 shadow-xl">
          <div className="card-body">
            <h2 className="card-title text-purple-600 dark:text-purple-400 mb-4">
              Request Teacher Addition
            </h2>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
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
                />

                <FormInput
                  label="City"
                  name="city"
                  register={teacherForm.register}
                  error={teacherForm.formState.errors.city}
                  placeholder="New York"
                  required
                />
              </div>

              <FormInput
                label="LinkedIn Profile (Optional)"
                name="linkedinUrl"
                type="url"
                register={teacherForm.register}
                error={teacherForm.formState.errors.linkedinUrl}
                placeholder="https://linkedin.com/in/teacher-profile"
              />

              <div>
                <label className="label">
                  <span className="label-text font-medium dark:text-gray-200">Bio (Optional)</span>
                </label>
                <textarea
                  {...teacherForm.register('bio')}
                  className="textarea textarea-bordered w-full h-24 dark:bg-gray-700 dark:text-white dark:border-gray-600"
                  placeholder="Brief bio about the teacher..."
                />
                {teacherForm.formState.errors.bio && (
                  <p className="text-red-500 text-sm mt-1">
                    {teacherForm.formState.errors.bio.message}
                  </p>
                )}
              </div>

              <div className="divider dark:before:bg-gray-600 dark:after:bg-gray-600">
                <span className="text-gray-700 dark:text-gray-300 font-medium">Your Information</span>
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
                <label className="label">
                  <span className="label-text font-medium dark:text-gray-200">Why should we add this teacher? *</span>
                </label>
                <textarea
                  {...teacherForm.register('reason')}
                  className="textarea textarea-bordered w-full h-32 dark:bg-gray-700 dark:text-white dark:border-gray-600"
                  placeholder="Please explain why this teacher would be a valuable addition to TeacherRank..."
                />
                {teacherForm.formState.errors.reason && (
                  <p className="text-red-500 text-sm mt-1">
                    {teacherForm.formState.errors.reason.message}
                  </p>
                )}
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="btn btn-primary w-full dark:bg-purple-600 dark:hover:bg-purple-700"
              >
                {isSubmitting ? (
                  <>
                    <span className="loading loading-spinner loading-sm"></span>
                    Submitting Request...
                  </>
                ) : (
                  'Submit Teacher Request'
                )}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}