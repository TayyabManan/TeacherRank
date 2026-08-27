import React, { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Button } from './Button'
import { useConfirm } from './ConfirmDialog'
import { ArrowRightIcon } from './icons'
import { supabase } from '../lib/supabaseClient'
import { useUser } from '../hooks/useAuth'
import { useInstitutes } from '../hooks/useTeachersOptimized'
import { invalidateTeacherData } from '../hooks/queryKeys'
import { sendApprovalEmail, sendRejectionEmail, sendNeedsInfoEmail, sendModifiedApprovalEmail } from '../lib/emailService'
import { escapeHtml } from '../lib/emailTemplates'
import { sanitizeSearchInput, normalizeUrlInput } from '../lib/validation'
import { friendlyWriteError } from '../lib/dbErrors'
import { logger } from '../lib/logger'
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

// ---------------------------------------------------------------------------
// Inline translation — Chrome's built-in on-device Translator API (stable
// since Chrome 138; no keys, nothing sent to a third party). Everywhere else,
// or if the API stalls, we fall back to opening Google Translate pre-filled.
// ---------------------------------------------------------------------------

// Minimal typings: the Translator global isn't in TS's lib.dom yet.
interface ChromeTranslator {
  translate(text: string): Promise<string>
}
interface TranslatorCreateMonitor {
  addEventListener(
    type: 'downloadprogress',
    listener: (e: { loaded: number; total?: number }) => void,
  ): void
}
declare const Translator:
  | {
      availability(opts: { sourceLanguage: string; targetLanguage: string }): Promise<string>
      create(opts: {
        sourceLanguage: string
        targetLanguage: string
        monitor?: (m: TranslatorCreateMonitor) => void
      }): Promise<ChromeTranslator>
    }
  | undefined

/** Script sniff for the languages requesters actually use. */
function detectSourceLanguage(text: string): 'he' | 'ar' | null {
  if (/[֐-׿]/.test(text)) return 'he'
  if (/[؀-ۿ]/.test(text)) return 'ar'
  return null
}

/** The API can hang in odd contexts — never leave the admin waiting on it. */
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) => setTimeout(() => reject(new Error('translation timed out')), ms)),
  ])
}

// One translator per source language, shared across request cards; the first
// create() may download the language model, which is why it gets a long leash.
const translatorCache = new Map<string, Promise<ChromeTranslator>>()

async function getTranslator(
  sourceLanguage: string,
  onProgress?: (pct: number) => void,
): Promise<ChromeTranslator> {
  const api = typeof Translator === 'undefined' ? undefined : Translator
  if (!api) throw new Error('Translator API unavailable')
  let cached = translatorCache.get(sourceLanguage)
  if (!cached) {
    cached = (async () => {
      const availability = await withTimeout(
        api.availability({ sourceLanguage, targetLanguage: 'en' }),
        4000,
      )
      if (availability === 'unavailable') throw new Error(`no ${sourceLanguage}->en model`)
      // First use downloads the language model — give it a real budget and
      // surface progress. (An interrupted download usually continues in the
      // background, so a later retry succeeds quickly.)
      return withTimeout(
        api.create({
          sourceLanguage,
          targetLanguage: 'en',
          monitor(m) {
            m.addEventListener('downloadprogress', (e) => {
              const fraction = e.total ? e.loaded / e.total : e.loaded
              onProgress?.(Math.round(Math.min(1, fraction) * 100))
            })
          },
        }),
        120000,
      )
    })()
    // A failed attempt must not poison the cache for the next click.
    cached.catch(() => translatorCache.delete(sourceLanguage))
    translatorCache.set(sourceLanguage, cached)
  }
  return cached
}

export function TeacherRequestManager({ request, onUpdate, onDelete, showToast }: TeacherRequestManagerProps) {
  const { data: user } = useUser()
  const confirm = useConfirm()
  // This component inserts into `teachers` directly through the Supabase client
  // rather than through the mutations in useTeachers, so nothing was clearing
  // the React Query caches on approval. onUpdate() only refreshes Admin's own
  // local useState. See invalidateTeacherData below.
  const queryClient = useQueryClient()
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
  // Canonical institute names for the edit modal's datalist — recognition over
  // recall, so one school never ends up under two spellings.
  const { data: institutes } = useInstitutes()
  // Auto-prefill of the edit form from a Hebrew/Arabic request (on-device).
  const [prefillState, setPrefillState] = useState<'idle' | 'working' | 'done' | 'failed'>('idle')
  const [prefillOriginals, setPrefillOriginals] = useState<{
    institute?: string
    designation?: string
    city?: string
  }>({})
  const [translations, setTranslations] = useState<{ label: string; value: string }[] | null>(null)
  // Why on-device translation isn't showing, when it isn't — rendered in the
  // card with a Google Translate link. Never window.open from this flow: an
  // open() after an await has lost its user activation and gets popup-blocked.
  const [translateFallback, setTranslateFallback] = useState<string | null>(null)
  // Non-null while working; doubles as the button label ("Translating…",
  // "Downloading Hebrew model… 43%").
  const [translateProgress, setTranslateProgress] = useState<string | null>(null)

  // What an admin needs to READ, and all that leaves the browser on the
  // fallback path. Requester name/email are PII and are deliberately kept out
  // of third-party URLs (and out of the translation input).
  const translatableFields = [
    { label: 'Teacher', value: request.teacher_name },
    { label: 'Designation', value: request.designation },
    { label: 'Institute', value: request.institute },
    { label: 'City', value: request.city },
    ...(request.bio ? [{ label: 'Bio', value: request.bio }] : []),
    { label: 'Reason', value: request.reason },
  ]

  const googleTranslateUrl = `https://translate.google.com/?sl=auto&tl=en&op=translate&text=${encodeURIComponent(
    translatableFields.map((f) => `${f.label}: ${f.value}`).join('\n'),
  )}`

  // "Edit & Approve" on a Hebrew/Arabic request: open the modal immediately,
  // then translate the name + facet fields on-device and fill them in. The
  // admin still reviews everything — nothing submits automatically, and a
  // field the admin has already changed is never overwritten (each prefill is
  // guarded by "still equals the original request value").
  const openEditModal = () => {
    setShowEditModal(true)
    void prefillEnglishFromRequest()
  }

  const prefillEnglishFromRequest = async () => {
    if (prefillState === 'working' || prefillState === 'done') return
    const source = detectSourceLanguage(
      [request.teacher_name, request.designation, request.institute, request.city].join('\n'),
    )
    if (!source || typeof Translator === 'undefined') return
    setPrefillState('working')
    try {
      const translator = await getTranslator(source)
      const tr = async (value: string) =>
        detectSourceLanguage(value) ? (await withTimeout(translator.translate(value), 15000)).trim() : value
      // Sequential, like the card panel — one shared translator instance.
      const name = await tr(request.teacher_name)
      const designation = await tr(request.designation)
      const institute = await tr(request.institute)
      const city = await tr(request.city)

      // Name follows the bilingual convention: original first, Latin in parens.
      const nextName = name && name !== request.teacher_name ? `${request.teacher_name} (${name})` : null
      const nextInstitute = institute && institute !== request.institute ? institute : null
      const nextDesignation = designation && designation !== request.designation ? designation : null
      const nextCity = city && city !== request.city ? city : null

      setEditedData((prev) => ({
        ...prev,
        teacher_name: nextName && prev.teacher_name === request.teacher_name ? nextName : prev.teacher_name,
        institute: nextInstitute && prev.institute === request.institute ? nextInstitute : prev.institute,
        designation:
          nextDesignation && prev.designation === request.designation ? nextDesignation : prev.designation,
        city: nextCity && prev.city === request.city ? nextCity : prev.city,
      }))
      setPrefillOriginals({
        ...(nextInstitute ? { institute: request.institute } : {}),
        ...(nextDesignation ? { designation: request.designation } : {}),
        ...(nextCity ? { city: request.city } : {}),
      })
      setPrefillState('done')
    } catch (error) {
      // Fail quiet: the admin simply gets the untranslated form, same as a
      // browser without the Translator API. The card's Translate button and
      // its Google Translate fallback still cover reading the request.
      logger.warn('Auto-prefill translation failed', { error })
      setPrefillState('failed')
    }
  }

  const handleTranslate = async () => {
    if (translations || translateFallback) {
      setTranslations(null) // toggle back off
      setTranslateFallback(null)
      return
    }
    const languageNames: Record<string, string> = { he: 'Hebrew', ar: 'Arabic' }
    const source = detectSourceLanguage(translatableFields.map((f) => f.value).join('\n'))
    if (!source) {
      setTranslateFallback('No Hebrew or Arabic text detected in this request. Nothing to translate on-device.')
      return
    }
    if (typeof Translator === 'undefined') {
      setTranslateFallback("This browser doesn't support on-device translation (Chrome 138+).")
      return
    }
    setTranslateProgress('Translating…')
    try {
      const translator = await getTranslator(source, (pct) =>
        setTranslateProgress(`Downloading ${languageNames[source]} model… ${pct}%`),
      )
      setTranslateProgress('Translating…')
      const out: { label: string; value: string }[] = []
      for (const field of translatableFields) {
        // Leave already-English fields as they are.
        out.push({
          label: field.label,
          value: detectSourceLanguage(field.value)
            ? await withTimeout(translator.translate(field.value), 15000)
            : field.value,
        })
      }
      setTranslations(out)
    } catch (error) {
      logger.warn('On-device translation failed', { error })
      setTranslateFallback(
        error instanceof Error && error.message === 'translation timed out'
          ? `On-device translation timed out. The ${languageNames[source]} model may still be downloading, so try again in a minute or use the link below.`
          : 'On-device translation failed in this browser. Use the link below.',
      )
    } finally {
      setTranslateProgress(null)
    }
  }

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
      logger.error('Error checking duplicates', error)
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
        if (feedbackError) logger.error('Failed to update feedback status', feedbackError)
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
        showToast('Teacher approved and added. Email sent to the requester', 'success')
      } else if (emailResult.timedOut) {
        showToast('Teacher approved and added. The email is taking longer than usual and should still arrive', 'info')
      } else {
        showToast(`Teacher approved and added, but the email to the requester couldn't be sent${emailResult.error ? `: ${emailResult.error.message}` : ''}`, 'warning')
      }
      // The new teacher may introduce a new institute/city/department, and those
      // facet caches hold for 30 min — without this the approved teacher is
      // missing from every filter dropdown and the /institutes directory.
      invalidateTeacherData(queryClient, newTeacher.id)
      onUpdate()
    } catch (error: any) {
      logger.error('Error approving teacher', error)
      if (error?.code === '23505') {
        showToast('A teacher with this name and institute already exists. Reject this request as a duplicate', 'error')
      } else {
        showToast(friendlyWriteError(error) ?? "Couldn't approve this teacher. Try again.", 'error')
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
      // Track changes made. These lines are joined with <br> into the email body,
      // so they reach the template as HTML — escape each value here, at the point
      // it enters the markup, since the originals are anon-submitted request fields.
      const changes = []
      if (editedData.teacher_name !== request.teacher_name) changes.push(`Name: ${escapeHtml(request.teacher_name)} → ${escapeHtml(editedData.teacher_name)}`)
      if (editedData.institute !== request.institute) changes.push(`Institute: ${escapeHtml(request.institute)} → ${escapeHtml(editedData.institute)}`)
      if (editedData.designation !== request.designation) changes.push(`Designation: ${escapeHtml(request.designation)} → ${escapeHtml(editedData.designation)}`)
      if (editedData.city !== request.city) changes.push(`City: ${escapeHtml(request.city)} → ${escapeHtml(editedData.city)}`)

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
        if (feedbackError) logger.error('Failed to update feedback status', feedbackError)
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
        showToast('Teacher approved with changes. Email sent to the requester', 'success')
      } else if (emailResult.timedOut) {
        showToast('Teacher approved with changes. The email is taking longer than usual and should still arrive', 'info')
      } else {
        showToast(`Teacher approved with changes, but the email to the requester couldn't be sent${emailResult.error ? `: ${emailResult.error.message}` : ''}`, 'warning')
      }
      setShowEditModal(false)
      // Same as the plain approve path: clear the teacher/facet/stats caches.
      invalidateTeacherData(queryClient, newTeacher.id)
      onUpdate()
    } catch (error: any) {
      logger.error('Error approving teacher', error)
      if (error?.code === '23505') {
        showToast('A teacher with this name and institute already exists. Reject this request as a duplicate', 'error')
      } else {
        showToast(friendlyWriteError(error) ?? "Couldn't approve this teacher. Try again.", 'error')
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
        if (feedbackError) logger.error('Failed to update feedback status', feedbackError)
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
      } else if (emailResult.timedOut) {
        showToast('Request rejected. The email is taking longer than usual and should still arrive', 'info')
      } else {
        showToast(`Request rejected, but the email to the requester couldn't be sent${emailResult.error ? `: ${emailResult.error.message}` : ''}`, 'warning')
      }
      setShowRejectModal(false)
      onUpdate()
    } catch (error: any) {
      logger.error('Error rejecting request', error)
      showToast(friendlyWriteError(error) ?? "Couldn't reject this request. Try again.", 'error')
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
        if (feedbackError) logger.error('Failed to update feedback status', feedbackError)
      }

      showToast('Request ignored and moved to ignored section.', 'info')
      onUpdate()
    } catch (error: any) {
      logger.error('Error ignoring request', error)
      showToast(friendlyWriteError(error) ?? "Couldn't ignore this request. Try again.", 'error')
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
      } else if (emailResult.timedOut) {
        showToast('Request marked as needing info. The email is taking longer than usual and should still arrive', 'info')
      } else {
        showToast(`Request marked as needing info, but the email to the requester couldn't be sent${emailResult.error ? `: ${emailResult.error.message}` : ''}`, 'warning')
      }
      setShowInfoModal(false)
      onUpdate()
    } catch (error: any) {
      logger.error('Error requesting info', error)
      showToast(friendlyWriteError(error) ?? "Couldn't send the info request. Try again.", 'error')
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
              <h3 dir="auto" className="text-xl font-bold text-base-content">
                {request.teacher_name}
              </h3>
              <p dir="auto" className="text-base-content/70">
                {request.designation} at {request.institute}, {request.city}
              </p>
              <div className="flex flex-wrap items-center gap-x-4">
                {request.linkedin_url && (
                  <a
                    href={request.linkedin_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-info hover:underline text-sm"
                  >
                    LinkedIn Profile
                    <ArrowRightIcon className="w-3.5 h-3.5 -rotate-45" />
                  </a>
                )}
                {/* One-click read for non-English requests (Hebrew is common).
                    Translates ON-DEVICE via Chrome's Translator API and shows
                    the result inline; browsers without it (or a stalled model)
                    fall back to Google Translate in a new tab. */}
                <button
                  type="button"
                  onClick={handleTranslate}
                  disabled={translateProgress !== null}
                  className="inline-flex items-center gap-1 text-info hover:underline text-sm disabled:opacity-60"
                >
                  {translateProgress !== null ? (
                    <>
                      <span className="loading loading-spinner loading-xs" aria-hidden="true" />
                      {translateProgress}
                    </>
                  ) : translations || translateFallback ? (
                    'Hide translation'
                  ) : (
                    'Translate request'
                  )}
                </button>
              </div>
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

          {/* Inline machine translation of the request's content fields */}
          {translations && (
            <div className="bg-info/10 border border-info/30 rounded-lg p-3 mb-4">
              <p className="text-xs font-semibold uppercase text-base-content/70 mb-2">
                English translation (on-device)
              </p>
              <dl className="space-y-1 text-sm">
                {translations.map((t) => (
                  <div key={t.label} className="flex gap-2">
                    <dt className="font-medium text-base-content/70 shrink-0">{t.label}:</dt>
                    <dd className="text-base-content">{t.value}</dd>
                  </div>
                ))}
              </dl>
            </div>
          )}

          {/* On-device translation unavailable — say why and offer the manual
              route as a link the admin clicks directly (no popup blocking). */}
          {translateFallback && (
            <div className="bg-info/10 border border-info/30 rounded-lg p-3 mb-4 text-sm">
              <p className="text-base-content">{translateFallback}</p>
              <a
                href={googleTranslateUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-info hover:underline mt-2"
              >
                Open in Google Translate
                <ArrowRightIcon className="w-3.5 h-3.5 -rotate-45" />
              </a>
            </div>
          )}

          {/* Bio */}
          {request.bio && (
            <div className="mb-4">
              <strong className="text-base-content/80">Bio:</strong>
              <p dir="auto" className="text-base-content/70 mt-1">{request.bio}</p>
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
              <span dir="auto" className="text-base-content/70">{request.reason}</span>
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
                onClick={openEditModal}
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
            {prefillState === 'working' && (
              <div className="flex items-center gap-2 text-sm text-base-content/70 mb-3">
                <span className="loading loading-spinner loading-xs" aria-hidden="true" />
                Translating the request on-device. Fields will fill in…
              </div>
            )}
            {prefillState === 'done' && (
              <div className="bg-info/10 border border-info/30 rounded-lg p-3 mb-3 text-sm text-base-content">
                Fields were auto-translated on-device. Check the name&rsquo;s spelling, and pick the
                institute from the suggestions if this school already exists under another spelling.
              </div>
            )}
            <div className="space-y-4">
              <div>
                <label className="label" htmlFor="edit-teacher-name">
                  <span className="label-text">Name</span>
                </label>
                <input
                  id="edit-teacher-name"
                  type="text"
                  dir="auto"
                  value={editedData.teacher_name}
                  onChange={(e) => setEditedData({ ...editedData, teacher_name: e.target.value })}
                  className="input input-bordered w-full "
                />
              </div>
              <div>
                <label className="label" htmlFor="edit-teacher-institute">
                  <span className="label-text">Institute</span>
                </label>
                <input
                  id="edit-teacher-institute"
                  type="text"
                  dir="auto"
                  value={editedData.institute}
                  onChange={(e) => setEditedData({ ...editedData, institute: e.target.value })}
                  className="input input-bordered w-full "
                  list="edit-institute-options"
                />
                <datalist id="edit-institute-options">
                  {(institutes ?? []).map((name) => (
                    <option key={name} value={name} />
                  ))}
                </datalist>
                {prefillOriginals.institute && (
                  <p dir="auto" className="text-xs text-base-content/70 mt-1">
                    Original: {prefillOriginals.institute}
                  </p>
                )}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label" htmlFor="edit-teacher-designation">
                    <span className="label-text">Designation</span>
                  </label>
                  <input
                    id="edit-teacher-designation"
                    type="text"
                    dir="auto"
                    value={editedData.designation}
                    onChange={(e) => setEditedData({ ...editedData, designation: e.target.value })}
                    className="input input-bordered w-full "
                  />
                  {prefillOriginals.designation && (
                    <p dir="auto" className="text-xs text-base-content/70 mt-1">
                      Original: {prefillOriginals.designation}
                    </p>
                  )}
                </div>
                <div>
                  <label className="label" htmlFor="edit-teacher-city">
                    <span className="label-text">City</span>
                  </label>
                  <input
                    id="edit-teacher-city"
                    type="text"
                    dir="auto"
                    value={editedData.city}
                    onChange={(e) => setEditedData({ ...editedData, city: e.target.value })}
                    className="input input-bordered w-full "
                  />
                  {prefillOriginals.city && (
                    <p dir="auto" className="text-xs text-base-content/70 mt-1">
                      Original: {prefillOriginals.city}
                    </p>
                  )}
                </div>
              </div>
              <div>
                <label className="label" htmlFor="edit-teacher-linkedin">
                  <span className="label-text">LinkedIn URL</span>
                </label>
                <input
                  id="edit-teacher-linkedin"
                  type="url"
                  value={editedData.linkedin_url}
                  onChange={(e) => setEditedData({ ...editedData, linkedin_url: e.target.value })}
                  className="input input-bordered w-full "
                />
              </div>
              <div>
                <label className="label" htmlFor="edit-teacher-bio">
                  <span className="label-text">Bio</span>
                </label>
                <textarea
                  id="edit-teacher-bio"
                  dir="auto"
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
                    maxLength={255}
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