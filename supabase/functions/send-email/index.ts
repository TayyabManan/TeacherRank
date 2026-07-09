import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { SMTPClient } from 'https://deno.land/x/denomailer@1.6.0/mod.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface EmailRequest {
  to: string
  subject: string
  html: string
  requestId?: string
  action?: string
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    status,
  })

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    )

    // Verify the user is authenticated
    const {
      data: { user },
    } = await supabaseClient.auth.getUser()

    if (!user) {
      return json({ error: 'Unauthorized' }, 401)
    }

    // Admin = profiles.role, the same source of truth the app (src/lib/auth.ts)
    // and the RLS policies (is_admin) use. Reading own profile row works under
    // the profiles RLS the app already relies on.
    const { data: profile, error: profileError } = await supabaseClient
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profileError) {
      // A transient DB failure must not read as "you are not an admin".
      return json({ error: 'Could not verify permissions — try again' }, 500)
    }
    if (profile?.role !== 'admin') {
      return json({ error: 'Forbidden - Admin only' }, 403)
    }

    let payload: EmailRequest
    try {
      payload = await req.json() as EmailRequest
    } catch {
      return json({ error: 'Invalid JSON body' }, 400)
    }
    const { to, subject, html, requestId, action } = payload
    if (!to || !subject || !html) {
      return json({ error: 'to, subject and html are required' }, 400)
    }

    const gmailUser = Deno.env.get('GMAIL_USER')
    const gmailAppPassword = Deno.env.get('GMAIL_APP_PASSWORD')
    if (!gmailUser || !gmailAppPassword) {
      return json(
        { error: 'Email is not configured — set the GMAIL_USER and GMAIL_APP_PASSWORD function secrets' },
        500
      )
    }

    // Gmail SMTP with an App Password (requires 2-Step Verification on the
    // Google account). The From address must be the authenticated account (or
    // a configured send-as alias) — Gmail rewrites anything else.
    const client = new SMTPClient({
      connection: {
        hostname: 'smtp.gmail.com',
        port: 465,
        tls: true,
        auth: {
          username: gmailUser,
          password: gmailAppPassword,
        },
      },
    })

    try {
      await client.send({
        from: `TeacherRank <${gmailUser}>`,
        to,
        subject,
        content: 'auto', // derive the plain-text part from the html
        html,
      })
    } finally {
      // close() can hang on a stalled connection (known denomailer failure
      // mode) — never let the QUIT handshake hold the response hostage.
      await Promise.race([
        client.close().catch(() => {}),
        new Promise((resolve) => setTimeout(resolve, 2000)),
      ])
    }

    // Log to the request audit trail (best-effort — the email is already out).
    if (requestId) {
      const { error: auditError } = await supabaseClient
        .from('teacher_request_audit')
        .insert({
          request_id: requestId,
          action: `email_sent_${action || 'notification'}`,
          notes: `Email sent to ${to}`,
          performed_by: user.id,
        })
      if (auditError) console.error('Audit log insert failed:', auditError)
    }

    return json({ success: true })
  } catch (error) {
    console.error('send-email error:', error)
    return json({ error: error instanceof Error ? error.message : String(error) }, 500)
  }
})
