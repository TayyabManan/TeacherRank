import { describe, it, expect } from 'vitest';
import { jsonLd } from '../jsonLd';

describe('jsonLd', () => {
  it('escapes < so a value cannot close the script element', () => {
    // The realistic payload: `institute` is copied verbatim from the public
    // "request a teacher" form into the teachers table on admin approval, and
    // has no character restriction.
    const out = jsonLd({ name: 'Ofek School</script><script>alert(1)</script>' });

    expect(out).not.toContain('</script>');
    expect(out).not.toContain('<');
    expect(out).toContain('\\u003c');
  });

  it('round-trips to the original value, so consumers read it unchanged', () => {
    const value = { name: 'A</script>B', nested: { bio: '<img src=x onerror=1>' } };
    expect(JSON.parse(jsonLd(value))).toEqual(value);
  });

  it('leaves ordinary content alone apart from the escape', () => {
    const value = { '@type': 'Person', name: 'Dr. Raja Ali Riaz', ratingCount: 1 };
    expect(JSON.parse(jsonLd(value))).toEqual(value);
    expect(jsonLd(value)).toBe(JSON.stringify(value)); // nothing to escape
  });

  it('handles undefined and nested arrays the way JSON.stringify does', () => {
    expect(jsonLd({ a: undefined, b: [1, '<'] })).toBe('{"b":[1,"\\u003c"]}');
  });
});
