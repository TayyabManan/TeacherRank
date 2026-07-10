import { describe, it, expect } from 'vitest';
import {
  normalizeUrlInput,
  sanitizeSearchInput,
  validateAndSanitizeSearch,
  searchSchema,
  signUpSchema,
  resetPasswordSchema,
  ratingSchema,
  checkPasswordStrength,
} from '../validation';

// strongPasswordSchema is module-local; exercise it via resetPasswordSchema.
const password = (pw: string) => resetPasswordSchema.safeParse({ password: pw });

describe('strongPasswordSchema (via resetPasswordSchema)', () => {
  it('accepts a strong 10+ char password with upper/lower/number', () => {
    expect(password('MyStr0ngPass').success).toBe(true);
  });

  it('rejects when shorter than 10 characters', () => {
    expect(password('Ab1cdef').success).toBe(false); // 7 chars
  });

  it('rejects when missing an uppercase letter', () => {
    expect(password('lowercase123').success).toBe(false);
  });

  it('rejects when missing a lowercase letter', () => {
    expect(password('UPPERCASE123').success).toBe(false);
  });

  it('rejects when missing a number', () => {
    expect(password('NoDigitsHere').success).toBe(false);
  });

  it('rejects a common-password weak pattern that otherwise passes base rules', () => {
    // passes length + upper + lower + number, but starts with "password"/"qwerty"
    expect(password('Password12').success).toBe(false);
    expect(password('Qwerty1234').success).toBe(false);
  });

  it('accepts a non-weak password that looks alphabetical but has trailing digits', () => {
    // sequential-letter regex is ^...$ anchored, so trailing digits dodge it
    expect(password('Abcdefgh12').success).toBe(true);
  });
});

describe('signUpSchema', () => {
  const base = { password: 'ValidPass123' };

  it('lowercases and accepts a normal email', () => {
    const r = signUpSchema.safeParse({ ...base, email: 'User@Example.COM' });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.email).toBe('user@example.com');
  });

  it('rejects disposable email domains', () => {
    expect(signUpSchema.safeParse({ ...base, email: 'x@mailinator.com' }).success).toBe(false);
    expect(signUpSchema.safeParse({ ...base, email: 'x@guerrillamail.com' }).success).toBe(false);
  });

  it('rejects a domain with no dot', () => {
    expect(signUpSchema.safeParse({ ...base, email: 'x@localhost' }).success).toBe(false);
  });

  it('accepts a valid displayName and allows it to be omitted', () => {
    expect(signUpSchema.safeParse({ ...base, email: 'a@b.com', displayName: 'John Doe' }).success).toBe(true);
    expect(signUpSchema.safeParse({ ...base, email: 'a@b.com' }).success).toBe(true);
  });

  it('rejects a displayName with illegal characters', () => {
    expect(signUpSchema.safeParse({ ...base, email: 'a@b.com', displayName: 'John@Doe!' }).success).toBe(false);
  });
});

describe('ratingSchema', () => {
  it('accepts a valid half-star score with no comment for 3 stars and up', () => {
    expect(ratingSchema.safeParse({ score: 3 }).success).toBe(true);
    expect(ratingSchema.safeParse({ score: 4.5, comment: '' }).success).toBe(true);
    expect(ratingSchema.safeParse({ score: 0.5 }).success).toBe(false); // 0.5 needs a comment (<= 2)
  });

  it('rejects non half-star increments and out-of-range scores', () => {
    expect(ratingSchema.safeParse({ score: 0.7 }).success).toBe(false); // not multipleOf 0.5
    expect(ratingSchema.safeParse({ score: 0 }).success).toBe(false);   // below min
    expect(ratingSchema.safeParse({ score: 6 }).success).toBe(false);   // above max
  });

  it('requires a >=10 char comment when score <= 2', () => {
    const short = ratingSchema.safeParse({ score: 2, comment: 'too short' }); // 9 chars
    expect(short.success).toBe(false);
    if (!short.success) {
      expect(short.error.issues.some((i) => i.path[0] === 'comment')).toBe(true);
    }
    expect(ratingSchema.safeParse({ score: 1 }).success).toBe(false); // no comment at all
  });

  it('accepts a low score once a sufficient explanation is given', () => {
    expect(
      ratingSchema.safeParse({ score: 2, comment: 'Often unprepared for lectures.' }).success,
    ).toBe(true);
  });

  it('flags spammy comments', () => {
    expect(ratingSchema.safeParse({ score: 5, comment: 'Visit http://spam.example now' }).success).toBe(false);
    expect(ratingSchema.safeParse({ score: 5, comment: 'click here to win' }).success).toBe(false);
  });
});

describe('normalizeUrlInput', () => {
  it('prepends https:// when no protocol is present', () => {
    expect(normalizeUrlInput('example.com')).toBe('https://example.com');
  });
  it('leaves existing http/https untouched (case-insensitive)', () => {
    expect(normalizeUrlInput('http://a.com')).toBe('http://a.com');
    expect(normalizeUrlInput('HTTPS://a.com')).toBe('HTTPS://a.com');
  });
  it('trims and returns empty for blank input', () => {
    expect(normalizeUrlInput('   ')).toBe('');
    expect(normalizeUrlInput('  example.com  ')).toBe('https://example.com');
  });
});

describe('sanitizeSearchInput', () => {
  it('returns empty for non-string / empty input', () => {
    expect(sanitizeSearchInput('')).toBe('');
    // @ts-expect-error deliberately wrong type
    expect(sanitizeSearchInput(null)).toBe('');
  });
  it('strips null bytes and PostgREST-special characters', () => {
    expect(sanitizeSearchInput("Rob\0ert; DROP, (x)|y\\'*.")).toBe('Robert DROP xy');
  });
  it('does NOT strip hyphens (documents the layering vs searchSchema)', () => {
    expect(sanitizeSearchInput('math-101')).toBe('math-101');
  });
  it('caps length at 100 characters', () => {
    expect(sanitizeSearchInput('a'.repeat(250)).length).toBe(100);
  });
});

describe('searchSchema', () => {
  it('accepts a clean query and trims it', () => {
    const r = searchSchema.safeParse({ query: '  John Smith  ' });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.query).toBe('John Smith');
  });
  it('rejects SQL keywords and dangerous characters', () => {
    expect(searchSchema.safeParse({ query: 'SELECT * FROM users' }).success).toBe(false);
    expect(searchSchema.safeParse({ query: "a'; DROP" }).success).toBe(false);
    expect(searchSchema.safeParse({ query: 'math-101' }).success).toBe(false); // hyphen
  });
  it('rejects an over-long query and validates enum/page bounds', () => {
    expect(searchSchema.safeParse({ query: 'a'.repeat(101) }).success).toBe(false);
    expect(searchSchema.safeParse({ query: 'x', sortBy: 'nonsense' }).success).toBe(false);
    expect(searchSchema.safeParse({ query: 'x', page: 0 }).success).toBe(false);
    expect(searchSchema.safeParse({ query: 'x', pageSize: 999 }).success).toBe(false);
  });
});

describe('validateAndSanitizeSearch', () => {
  it('passes a clean query through both layers', () => {
    expect(validateAndSanitizeSearch('John Smith')).toBe('John Smith');
  });
  it('returns empty when the schema rejects the input', () => {
    expect(validateAndSanitizeSearch("Robert'); DROP TABLE")).toBe('');
    expect(validateAndSanitizeSearch('a'.repeat(200))).toBe('');
  });
  it('strips commas that the schema allows but PostgREST treats as OR', () => {
    // comma passes searchSchema (not in its reject set) but is sanitized out
    expect(validateAndSanitizeSearch('a,b')).toBe('ab');
  });
});

describe('checkPasswordStrength', () => {
  it('scores a strong password highly and a weak one low', () => {
    expect(checkPasswordStrength('MyStr0ng!Passw0rd').score).toBeGreaterThanOrEqual(4);
    const weak = checkPasswordStrength('abc');
    expect(weak.score).toBeLessThanOrEqual(2);
    expect(weak.feedback.length).toBeGreaterThan(0);
  });
});
