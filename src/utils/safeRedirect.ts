/**
 * Is `path` safe to hand to `navigate()` as an internal destination?
 *
 * The app stashes a "where the user was headed" path across sign-in (router
 * state in Auth.tsx, sessionStorage across the OAuth full-page redirect in
 * useAuth.ts) and navigates to it afterwards. Both sites previously guarded
 * with `startsWith('/') && !startsWith('//')`, which misses the backslash form:
 * browsers normalize `\` to `/` when resolving, so `/\evil.com` resolves the
 * same way `//evil.com` does — protocol-relative, off-site.
 *
 * That is the same class as the open-redirect advisory still open against
 * react-router 6.x (`Open redirect via backslash in <Link> and useNavigate`),
 * which upstream only fixes in v7. Guarding here does not depend on that
 * upgrade.
 */
/**
 * True if the string contains a C0 control character or DEL. Written as a scan
 * rather than a regex because a control-character class trips `no-control-regex`
 * — and the rule is right in general; this is the deliberate exception.
 */
function hasControlChars(value: string): boolean {
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i);
    if (code < 0x20 || code === 0x7f) return true;
  }
  return false;
}

export function isSafeInternalPath(path: unknown): path is string {
  if (typeof path !== 'string' || path.length === 0) return false;

  // Must be rooted...
  if (path[0] !== '/') return false;

  // ...and not protocol-relative, in either slash form.
  if (path[1] === '/' || path[1] === '\\') return false;

  // Control characters (CR, LF, TAB, NUL) are stripped or re-interpreted by URL
  // parsers, so a path containing them cannot be reasoned about safely.
  if (hasControlChars(path)) return false;

  return true;
}
