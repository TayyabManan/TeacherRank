import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface EmailRequest {
  to: string;
  subject: string;
  html: string;
  requestId?: string;
  action?: string;
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
    status,
  });

// ---------------------------------------------------------------------------
// denomailer 1.6.0's own encoders are broken and unmaintained (quoted-
// printable double-encodes its trailing-space markers into literal "=3d20"
// garbage, and non-ASCII subjects become one overlong RFC 2047 word that gets
// truncated — upstream issue #90; no fixed release exists). Both are bypassed:
// body parts go through `mimeContent` as self-encoded base64 (passed to the
// wire untouched), and the subject is pre-encoded below.
// ---------------------------------------------------------------------------

const textEncoder = new TextEncoder();

/** UTF-8 → base64 without blowing the stack on large bodies. */
function b64(s: string): string {
  const bytes = textEncoder.encode(s);
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {
    bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(bin);
}

/** RFC 2045 caps body lines at 78 chars; denomailer doesn't fold mimeContent. */
const base64Body = (s: string) => b64(s).replace(/(.{76})(?=.)/g, "$1\r\n");

/**
 * RFC 2047 B-encoded subject, split into ≤75-char encoded-words on whole
 * characters (45 input bytes → 60 base64 chars → 72-char word). The leading
 * space keeps denomailer's `startsWith('=?')` check from re-encoding the
 * result; leading folding whitespace is ignored by decoders.
 */
function encodeSubject(subject: string): string {
  if (!/[^\x00-\x7f]/.test(subject) && !subject.startsWith("=?"))
    return subject;
  const words: string[] = [];
  let chunk = "";
  for (const ch of subject) {
    if (textEncoder.encode(chunk + ch).length > 45) {
      words.push(chunk);
      chunk = ch;
    } else {
      chunk += ch;
    }
  }
  if (chunk) words.push(chunk);
  return " " + words.map((w) => `=?utf-8?B?${b64(w)}?=`).join(" ");
}

/** Plain-text alternative derived from the html (replaces content: 'auto'). */
const htmlToText = (html: string) =>
  html
    .replace(/<head[\s\S]*?<\/head>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

serve(async (req) => {
  // Handle CORS
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      {
        global: {
          headers: { Authorization: req.headers.get("Authorization")! },
        },
      },
    );

    // Verify the user is authenticated
    const {
      data: { user },
    } = await supabaseClient.auth.getUser();

    if (!user) {
      return json({ error: "Unauthorized" }, 401);
    }

    // Admin = profiles.role, the same source of truth the app (src/lib/auth.ts)
    // and the RLS policies (is_admin) use. Reading own profile row works under
    // the profiles RLS the app already relies on.
    const { data: profile, error: profileError } = await supabaseClient
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profileError) {
      // A transient DB failure must not read as "you are not an admin".
      return json({ error: "Could not verify permissions — try again" }, 500);
    }
    if (profile?.role !== "admin") {
      return json({ error: "Forbidden - Admin only" }, 403);
    }

    let payload: EmailRequest;
    try {
      payload = (await req.json()) as EmailRequest;
    } catch {
      return json({ error: "Invalid JSON body" }, 400);
    }
    const { to, subject, html, requestId, action } = payload;
    if (!to || !subject || !html) {
      return json({ error: "to, subject and html are required" }, 400);
    }
    // `to` and `subject` become SMTP header values. A CR or LF in either lets a
    // caller append their own headers (e.g. "\r\nBcc: ...") and turn this into a
    // bulk mailer. Admin-gated above, so this is defence in depth — but it costs
    // one check and does not depend on the SMTP library sanitizing for us.
    if (/[\r\n]/.test(to) || /[\r\n]/.test(subject)) {
      return json({ error: "to and subject must be single-line" }, 400);
    }

    const gmailUser = Deno.env.get("GMAIL_USER");
    const gmailAppPassword = Deno.env.get("GMAIL_APP_PASSWORD");
    if (!gmailUser || !gmailAppPassword) {
      return json(
        {
          error:
            "Email is not configured — set the GMAIL_USER and GMAIL_APP_PASSWORD function secrets",
        },
        500,
      );
    }

    // Gmail SMTP with an App Password (requires 2-Step Verification on the
    // Google account). The From address must be the authenticated account (or
    // a configured send-as alias) — Gmail rewrites anything else.
    const client = new SMTPClient({
      connection: {
        hostname: "smtp.gmail.com",
        port: 465,
        tls: true,
        auth: {
          username: gmailUser,
          password: gmailAppPassword,
        },
      },
    });

    try {
      await client.send({
        from: `TeacherRank <${gmailUser}>`, // display name must stay ASCII — denomailer writes it raw
        to,
        subject: encodeSubject(subject),
        mimeContent: [
          {
            mimeType: 'text/plain; charset="utf-8"',
            content: base64Body(htmlToText(html)),
            transferEncoding: "base64",
          },
          {
            mimeType: 'text/html; charset="utf-8"',
            content: base64Body(html),
            transferEncoding: "base64",
          },
        ],
        // No `content`/`html` keys: those would append denomailer's broken
        // quoted-printable parts alongside the base64 ones.
      });
    } finally {
      // close() can hang on a stalled connection (known denomailer failure
      // mode) — never let the QUIT handshake hold the response hostage.
      await Promise.race([
        client.close().catch(() => {}),
        new Promise((resolve) => setTimeout(resolve, 2000)),
      ]);
    }

    // Log to the request audit trail (best-effort — the email is already out).
    if (requestId) {
      const { error: auditError } = await supabaseClient
        .from("teacher_request_audit")
        .insert({
          request_id: requestId,
          action: `email_sent_${action || "notification"}`,
          notes: `Email sent to ${to}`,
          performed_by: user.id,
        });
      if (auditError) console.error("Audit log insert failed:", auditError);
    }

    return json({ success: true });
  } catch (error) {
    // Log the detail, return a fixed string. This `try` opens before the auth
    // check above, so anything thrown while building the Supabase client or
    // reading the caller's JWT reaches an UNAUTHENTICATED caller — and an SMTP
    // failure surfaces the provider's message, which names the sending account.
    console.error("send-email error:", error);
    return json({ error: "Could not send the email — try again" }, 500);
  }
});
