import { supabase } from './supabaseClient'
import { emailTemplates } from './emailTemplates'
import { logger } from './logger'

interface SendEmailOptions {
  to: string
  subject: string
  html: string
  requestId?: string
  action?: string
}

// A stalled SMTP connection would otherwise pin the admin on a spinner for the
// edge function's full wall-clock limit; past this point we stop waiting and
// let the (possibly still in-flight) send land or die on its own. Generous
// because a COLD edge function routinely needs 10-20s: module fetch from
// esm.sh/deno.land plus the full Gmail TLS + AUTH + DATA handshake.
const SEND_TIMEOUT_MS = 30000

class EmailTimeoutError extends Error {
  constructor() {
    super('Stopped waiting for the email service. The send may still complete')
  }
}

export interface SendEmailResult {
  success: boolean
  /** True when we stopped waiting — the email may still arrive. */
  timedOut?: boolean
  error?: Error
}

/** One attempt against the send-email edge function (Gmail SMTP — see
 *  supabase/functions/send-email/README.md for the one-time setup). */
async function invokeSendFunction(options: SendEmailOptions): Promise<{ sendError: Error | null; timedOut: boolean }> {
  let sendError: Error | null = null
  let timedOut = false
  try {
    const timeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new EmailTimeoutError()), SEND_TIMEOUT_MS)
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
    timedOut = error instanceof EmailTimeoutError
    sendError = error instanceof Error ? error : new Error(String(error))
  }

  if (sendError) {
    // FunctionsHttpError's own message is a fixed generic string; the real
    // reason (bad app password, missing secrets, SMTP rejection) is in the
    // function's JSON response body. Best-effort: parsing the body must never
    // replace the error we already have.
    try {
      const ctx = (sendError as { context?: Response }).context
      if (ctx && typeof ctx.json === 'function') {
        const body = await ctx.json().catch(() => null)
        if (body?.error) sendError = new Error(body.error)
      }
    } catch {
      // keep the original sendError
    }

    // A TypeError out of the invoke path (seen in prod as "Cannot read
    // properties of undefined (reading 'catch')") means the request never left
    // the browser: ad-blockers/privacy shields patch `fetch` and return
    // nothing for calls they block, and supabase-js trips over the missing
    // promise. Data reads use a different path such blockers often allow, so
    // the rest of the app works while every email "fails". Store a diagnosis
    // instead of the stack noise. (Verified 2026-08-26: the same call from an
    // unshielded browser reaches the edge function fine.)
    if (
      sendError instanceof TypeError ||
      sendError.name === 'FunctionsFetchError' ||
      sendError.message.includes("reading 'catch'")
    ) {
      sendError = new Error(
        "The email request was blocked before it left the browser, usually by an ad-blocker or privacy extension blocking supabase.co. Allow it for this site (or use another browser profile) and try again.",
      )
    }

    logger.error('Failed to send email', sendError)
  }

  return { sendError, timedOut }
}

export async function sendEmail(options: SendEmailOptions): Promise<SendEmailResult> {
  const { sendError, timedOut } = await invokeSendFunction(options)

  // email_queue is an outbox LOG of the attempt, not a pending queue — nothing
  // retries it and no UI reads it (the Admin outbox tab was tried 2026-08 and
  // removed by request). Failures surface in the admin flows' warning toasts,
  // which include the reason. Logging failures don't change the send result.
  const { error: logError } = await supabase
    .from('email_queue')
    .insert({
      to_email: options.to,
      subject: options.subject,
      html: options.html,  // email_queue's column is `html` (there is no `body` column)
      // A timeout isn't a known failure — the send usually still lands.
      status: sendError && !timedOut ? 'failed' : timedOut ? 'pending' : 'sent',
      request_id: options.requestId,
      action: options.action,
      attempts: 1,
      sent_at: sendError ? null : new Date().toISOString(),
      error_message: sendError ? sendError.message : null,
      created_at: new Date().toISOString()
    })
  if (logError) logger.error('Failed to log email to email_queue', logError)

  return sendError ? { success: false, timedOut, error: sendError } : { success: true }
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