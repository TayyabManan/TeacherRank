// Transactional email templates. Colors are the project's light-theme palette
// (tailwind.config.js → daisyui.themes.light) as literal hex — emails can't
// use CSS variables: primary #6D28D9, success #10b981, warning #f59e0b,
// error #ef4444, base-200 #f7f7f6, neutral #374151.
//
// Layout follows transactional-email convention (not marketing style): text
// wordmark, small status eyebrow, left-aligned heading on a white card, one
// tinted panel carrying the email's semantic detail, at most one CTA, and a
// factual footer. The plain-text alternative is derived from this HTML by the
// send-email edge function, so the copy has to read well with tags stripped.

const SITE = "https://teacherrank.vercel.app";

interface LayoutOptions {
  /** Hidden inbox preview line (shown next to the subject in most clients). */
  preheader: string;
  /** Small uppercase status label above the heading. */
  eyebrow: string;
  /** Eyebrow color — use the semantic hex for the email's outcome. */
  eyebrowColor: string;
  heading: string;
  /** Body paragraphs/panels as HTML. */
  body: string;
}

const layout = ({
  preheader,
  eyebrow,
  eyebrowColor,
  heading,
  body,
}: LayoutOptions) => `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { margin: 0; padding: 24px 12px; background: #f7f7f6; font-family: -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #374151; line-height: 1.6; }
            .card { max-width: 560px; margin: 0 auto; background: #ffffff; border: 1px solid #e6e4ee; border-radius: 8px; padding: 32px; }
            .wordmark { font-size: 16px; font-weight: 700; color: #6D28D9; letter-spacing: -0.01em; margin: 0 0 28px; }
            .eyebrow { font-size: 11px; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; margin: 0 0 6px; }
            h1 { font-size: 20px; font-weight: 700; color: #1f2937; letter-spacing: -0.01em; margin: 0 0 16px; }
            p { font-size: 15px; margin: 0 0 16px; }
            .panel { border-radius: 6px; padding: 14px 16px; margin: 0 0 16px; font-size: 15px; }
            .panel-label { display: block; font-size: 12px; font-weight: 600; letter-spacing: 0.05em; text-transform: uppercase; margin-bottom: 4px; }
            .panel-success { background: #ecfdf5; border: 1px solid #a7f3d0; }
            .panel-success .panel-label { color: #047857; }
            .panel-warning { background: #fffbeb; border: 1px solid #fde68a; }
            .panel-warning .panel-label { color: #b45309; }
            .panel-error { background: #fef2f2; border: 1px solid #fecaca; }
            .panel-error .panel-label { color: #b91c1c; }
            .button { display: inline-block; background: #6D28D9; color: #ffffff; font-size: 14px; font-weight: 600; text-decoration: none; padding: 11px 22px; border-radius: 6px; }
            a { color: #6D28D9; }
            .footer { border-top: 1px solid #efefee; margin-top: 28px; padding-top: 16px; }
            .footer p { font-size: 13px; color: #6b7280; margin: 0; }
            .preheader { display: none; max-height: 0; overflow: hidden; }
          </style>
        </head>
        <body>
          <span class="preheader">${preheader}</span>
          <div class="card">
            <p class="wordmark">TeacherRank</p>
            <p class="eyebrow" style="color: ${eyebrowColor};">${eyebrow}</p>
            <h1>${heading}</h1>
            ${body}
            <div class="footer">
              <p>You're receiving this because you submitted a teacher request on <a href="${SITE}">TeacherRank</a>. Questions? Just reply to this email.</p>
            </div>
          </div>
        </body>
      </html>
    `;

export const emailTemplates = {
  approved: (
    teacherName: string,
    instituteName: string,
    teacherId?: string,
  ) => ({
    subject: `${teacherName} is now on TeacherRank`,
    html: layout({
      preheader: "Your request was approved — the profile is live.",
      eyebrow: "Request approved",
      eyebrowColor: "#047857",
      heading: `${teacherName} is now on TeacherRank`,
      body: `
              <p>Your request to add <strong>${teacherName}</strong> from <strong>${instituteName}</strong> was approved, and their profile is live.</p>
              ${
                teacherId
                  ? `
              <p style="margin: 24px 0;">
                <a href="${SITE}/teacher/${teacherId}" class="button">View teacher profile</a>
              </p>`
                  : ""
              }
              <p>You can rate them now and share the profile with other students.</p>`,
    }),
  }),

  modified: (
    teacherName: string,
    instituteName: string,
    changes: string,
    teacherId?: string,
  ) => ({
    subject: `${teacherName} is now on TeacherRank`,
    html: layout({
      preheader:
        "Your request was approved — we tidied a few details before publishing.",
      eyebrow: "Request approved",
      eyebrowColor: "#047857",
      heading: `${teacherName} is now on TeacherRank`,
      body: `
              <p>Your request to add <strong>${teacherName}</strong> from <strong>${instituteName}</strong> was approved, and their profile is live. We tidied a few details before publishing:</p>
              <div class="panel panel-success">
                <span class="panel-label">What changed</span>
                ${changes}
              </div>
              ${
                teacherId
                  ? `
              <p style="margin: 24px 0;">
                <a href="${SITE}/teacher/${teacherId}" class="button">View teacher profile</a>
              </p>`
                  : ""
              }
              <p>If anything we changed looks wrong, reply to this email and we'll fix it.</p>`,
    }),
  }),

  needsInfo: (teacherName: string, adminNotes: string) => ({
    subject: `More details needed to add ${teacherName}`,
    html: layout({
      preheader:
        "Reply with the details below and we’ll pick the review back up.",
      eyebrow: "Action needed",
      eyebrowColor: "#b45309",
      heading: "We need a few more details",
      body: `
              <p>We're reviewing your request to add <strong>${teacherName}</strong>. To finish, we need:</p>
              <div class="panel panel-warning">
                <span class="panel-label">Missing information</span>
                ${adminNotes}
              </div>
              <p><strong>Reply to this email</strong> with the details and we'll pick the review back up.</p>
              <p>Prefer to start over? <a href="${SITE}/feedback">Submit a new request</a>.</p>`,
    }),
  }),

  rejected: (teacherName: string, reason: string) => ({
    subject: `About your request to add ${teacherName}`,
    html: layout({
      preheader: "We reviewed your request and couldn’t approve it.",
      eyebrow: "Request declined",
      eyebrowColor: "#b91c1c",
      heading: `We couldn't add ${teacherName}`,
      body: `
              <p>We reviewed your request to add <strong>${teacherName}</strong> and couldn't approve it.</p>
              <div class="panel panel-error">
                <span class="panel-label">Reason</span>
                ${reason}
              </div>
              <p>If you have details that address this, <a href="${SITE}/feedback">submit a new request</a> and we'll take another look.</p>`,
    }),
  }),
};
