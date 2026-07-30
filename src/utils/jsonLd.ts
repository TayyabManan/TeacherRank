/**
 * Serialize a value for embedding in `<script type="application/ld+json">`.
 *
 * `JSON.stringify` escapes `"` and `\` but NOT `<`. A `<script>` element's
 * contents are raw text, so a literal `</script>` inside any string value ends
 * the block early and everything after it is parsed as HTML — script injection
 * in a tag that exists purely to describe the page.
 *
 * This matters here because teacher `institute`, `designation` and `bio` reach
 * the JSON-LD on the profile page and have no character restriction, and
 * TeacherRequestManager copies those three fields verbatim from the public
 * "request a teacher" form into the teachers table when an admin approves a
 * request. That is a public-input -> admin-approval -> script-context path.
 *
 * Escaping `<` is sufficient and is what closes the breakout. The escaped form
 * is valid JSON and parses back to `<`, so consumers (Google et al.) still read
 * the intended value. (U+2028/U+2029 need no special handling: an ld+json block
 * is parsed as JSON, not evaluated as JavaScript, and both are legal in JSON.)
 */
export function jsonLd(value: unknown): string {
  return JSON.stringify(value).replace(/</g, '\\u003c');
}
