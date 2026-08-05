import { describe, it, expect } from 'vitest'
import { emailTemplates, escapeHtml } from '../emailTemplates'

// These templates interpolate anon-submitted request fields (teacher name,
// institute, and the admin's notes/reason) into HTML that is then mailed from
// the platform's own authenticated account. Unescaped, an attacker who files a
// teacher request with a victim's email address gets the admin's routine
// approval to deliver attacker-authored markup inside a branded, SPF/DKIM-
// passing message. Every assertion below is that boundary.

const PAYLOAD = `Ali</strong></p><a href="https://evil.tld/verify">Verify your account</a><p><strong>`

describe('escapeHtml', () => {
  it('neutralizes every character that can break out of an HTML text node', () => {
    expect(escapeHtml('<script>')).toBe('&lt;script&gt;')
    expect(escapeHtml('"quoted"')).toBe('&quot;quoted&quot;')
    expect(escapeHtml("it's")).toBe('it&#39;s')
  })

  it('escapes ampersands first so entities are not double-decoded', () => {
    // Naive ordering turns "&lt;" into "&amp;lt;" -> renders as literal "&lt;".
    // Correct ordering makes "&" -> "&amp;" happen before "<" -> "&lt;".
    expect(escapeHtml('a & b < c')).toBe('a &amp; b &lt; c')
    expect(escapeHtml('&lt;')).toBe('&amp;lt;')
  })

  it('handles null/undefined without throwing', () => {
    expect(escapeHtml(undefined as unknown as string)).toBe('')
    expect(escapeHtml(null as unknown as string)).toBe('')
  })
})

describe('email templates escape untrusted values', () => {
  it('approved(): neither teacher name nor institute can inject markup', () => {
    const { html } = emailTemplates.approved(PAYLOAD, PAYLOAD, 'abc-123')
    expect(html).not.toContain('<a href="https://evil.tld/verify">')
    expect(html).not.toContain('</strong></p>')
    expect(html).toContain('&lt;a href=&quot;https://evil.tld/verify&quot;&gt;')
  })

  it('modified(): escapes the name/institute but preserves intentional <br> in changes', () => {
    const changes = 'Name: A → B<br>City: C → D'
    const { html } = emailTemplates.modified(PAYLOAD, 'Inst', changes, 'abc-123')
    expect(html).not.toContain('<a href="https://evil.tld/verify">')
    // `changes` is documented as pre-escaped HTML — its separators must survive.
    expect(html).toContain('Name: A → B<br>City: C → D')
  })

  it('needsInfo(): escapes admin notes', () => {
    const { html } = emailTemplates.needsInfo('Dr Ali', PAYLOAD)
    expect(html).not.toContain('<a href="https://evil.tld/verify">')
  })

  it('rejected(): escapes the rejection reason', () => {
    const { html } = emailTemplates.rejected('Dr Ali', PAYLOAD)
    expect(html).not.toContain('<a href="https://evil.tld/verify">')
  })

  it('leaves the template’s own trusted markup intact', () => {
    const { html } = emailTemplates.approved('Dr Ali', 'Bahria University (E-8)', 'abc-123')
    expect(html).toContain('<strong>Dr Ali</strong>')
    expect(html).toContain('class="button"')
    // Parentheses and hyphens in real institute names must not be mangled.
    expect(html).toContain('Bahria University (E-8)')
  })
})

describe('subject lines are header-safe', () => {
  it('strips tags rather than entity-escaping them', () => {
    // A Subject header is plain text: "&lt;b&gt;" would be shown literally to
    // the recipient, so tags are removed instead of escaped.
    const { subject } = emailTemplates.approved('<b>Ali</b>', 'Inst')
    expect(subject).toBe('Ali is now on TeacherRank')
  })

  it('collapses CR/LF so a name cannot inject additional mail headers', () => {
    const { subject } = emailTemplates.rejected('Ali\r\nBcc: victim@example.com', 'nope')
    expect(subject).not.toMatch(/[\r\n]/)
    expect(subject).toBe('About your request to add Ali Bcc: victim@example.com')
  })
})
