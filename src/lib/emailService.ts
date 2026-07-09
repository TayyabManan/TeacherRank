import { supabase } from './supabaseClient'
import { emailTemplates } from './emailTemplates'

interface SendEmailOptions {
  to: string
  subject: string
  html: string
  requestId?: string
  action?: string
}

// A stalled SMTP connection would otherwise pin the admin on a spinner for the
// edge function's full wall-clock limit; past this point we report failure and
// let the (possibly still in-flight) send land or die on its own.
const SEND_TIMEOUT_MS = 15000

export async function sendEmail(options: SendEmailOptions) {
  // Send through the send-email edge function (Gmail SMTP — see
  // supabase/functions/send-email/README.md for the one-time setup).
  let sendError: Error | null = null
  try {
    const timeout = new Promise<never>((_, reject) =>
      setTimeout(
        () => reject(new Error('Timed out waiting for the email service')),
        SEND_TIMEOUT_MS
      )
    )
    const { error } = await Promise.race([
      supabase.functions.invoke('send-email', {
        body: {
          to: options.to,
          subject: options.subject,
          html: options.html,
          requestId: options.requestId,
          action: options.action,
        },
      }),
      timeout,
    ])
    if (error) sendError = error
  } catch (error) {
    sendError = error instanceof Error ? error : new Error(String(error))
  }

  if (sendError) {
    // FunctionsHttpError's own message is a fixed generic string; the real
    // reason (bad app password, missing secrets, SMTP rejection) is in the
    // function's JSON response body.
    const ctx = (sendError as { context?: Response }).context
    if (ctx && typeof ctx.json === 'function') {
      const body = await ctx.json().catch(() => null)
      if (body?.error) sendError = new Error(body.error)
    }
    console.error('Failed to send email:', sendError)
  }

  // email_queue is an outbox LOG of the attempt, not a pending queue — nothing
  // processes it. Logging failures don't change the send result.
  const { error: logError } = await supabase
    .from('email_queue')
    .insert({
      to_email: options.to,
      subject: options.subject,
      html: options.html,  // email_queue's column is `html` (there is no `body` column)
      status: sendError ? 'failed' : 'sent',
      request_id: options.requestId,
      action: options.action,
      attempts: 1,
      sent_at: sendError ? null : new Date().toISOString(),
      error_message: sendError ? sendError.message : null,
      created_at: new Date().toISOString()
    })
  if (logError) console.error('Failed to log email to email_queue:', logError)

  return sendError ? { success: false, error: sendError } : { success: true }
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