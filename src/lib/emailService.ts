import { supabase } from './supabaseClient'
import { emailTemplates } from './emailTemplates'

interface SendEmailOptions {
  to: string
  subject: string
  html: string
  requestId?: string
  action?: string
}

export async function sendEmail(options: SendEmailOptions) {
  try {
    // For now, we'll store email requests in a table for manual processing
    // Later you can set up Supabase Edge Functions or use a service like Resend
    const { error } = await supabase
      .from('email_queue')
      .insert({
        to_email: options.to,
        subject: options.subject,
        html: options.html,  // email_queue's column is `html` (there is no `body` column)
        status: 'pending',
        request_id: options.requestId,
        action: options.action,
        created_at: new Date().toISOString()
      })

    if (error) {
      console.error('Failed to queue email:', error)
      return { success: false, error }
    }

    return { success: true }
  } catch (error) {
    console.error('Email service error:', error)
    return { success: false, error }
  }
}

export async function sendApprovalEmail(
  email: string,
  teacherName: string,
  instituteName: string,
  teacherId?: string,
  requestId?: string
) {
  const template = emailTemplates.approved(teacherName, instituteName, teacherId)
  return sendEmail({
    to: email,
    ...template,
    requestId,
    action: 'approved'
  })
}

export async function sendRejectionEmail(
  email: string,
  teacherName: string,
  reason: string,
  requestId?: string
) {
  const template = emailTemplates.rejected(teacherName, reason)
  return sendEmail({
    to: email,
    ...template,
    requestId,
    action: 'rejected'
  })
}

export async function sendNeedsInfoEmail(
  email: string,
  teacherName: string,
  adminNotes: string,
  requestId?: string
) {
  const template = emailTemplates.needsInfo(teacherName, adminNotes)
  return sendEmail({
    to: email,
    ...template,
    requestId,
    action: 'needs_info'
  })
}

export async function sendModifiedApprovalEmail(
  email: string,
  teacherName: string,
  instituteName: string,
  changes: string,
  teacherId?: string,
  requestId?: string
) {
  const template = emailTemplates.modified(teacherName, instituteName, changes, teacherId)
  return sendEmail({
    to: email,
    ...template,
    requestId,
    action: 'modified'
  })
}