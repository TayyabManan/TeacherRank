import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

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
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 401,
        }
      )
    }

    // Check if user is admin (you should implement your own admin check)
    const isAdmin = user.email === Deno.env.get('ADMIN_EMAIL')
    
    if (!isAdmin) {
      return new Response(
        JSON.stringify({ error: 'Forbidden - Admin only' }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 403,
        }
      )
    }

    const { to, subject, html, requestId, action } = await req.json() as EmailRequest

    // Send email using Resend API (free tier available)
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${Deno.env.get('RESEND_API_KEY')}`,
      },
      body: JSON.stringify({
        from: 'TeacherRank <notifications@teacherrank.app>',
        to: [to],
        subject: subject,
        html: html,
        reply_to: 'teacherrank.app@gmail.com'
      }),
    })

    if (!res.ok) {
      throw new Error(`Email service error: ${await res.text()}`)
    }

    const data = await res.json()

    // Log the email sent
    if (requestId) {
      await supabaseClient
        .from('teacher_request_audit')
        .insert({
          request_id: requestId,
          action: `email_sent_${action || 'notification'}`,
          notes: `Email sent to ${to}`,
          performed_by: user.id
        })
    }

    return new Response(
      JSON.stringify({ success: true, id: data.id }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    )
  }
})