import { z } from 'zod';

/**
 * Password requirements — the single source of truth shared by both the Zod
 * schema below and the live <PasswordChecklist> on the sign-up form. Keep the
 * schema's `.min`/`.regex` checks lexically identical to these `test`s.
 */
export const PASSWORD_CRITERIA = [
  { id: 'length', label: 'At least 10 characters', test: (p: string) => p.length >= 10 },
  { id: 'uppercase', label: 'One uppercase letter', test: (p: string) => /[A-Z]/.test(p) },
  { id: 'lowercase', label: 'One lowercase letter', test: (p: string) => /[a-z]/.test(p) },
  { id: 'number', label: 'One number', test: (p: string) => /[0-9]/.test(p) },
] as const;

/**
 * Strong password validation. Rules mirror PASSWORD_CRITERIA (length + upper +
 * lower + number), plus a weak/common-pattern screen. No mandatory special char.
 */
const strongPasswordSchema = z.string()
  .min(10, 'Password must be at least 10 characters long')
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
  .regex(/[0-9]/, 'Password must contain at least one number')
  .refine((password) => {
    // Check for common weak patterns
    const weakPatterns = [
      /^(.)\1+$/, // All same character
      /^(012|123|234|345|456|567|678|789|890)+$/, // Sequential numbers
      /^(abc|bcd|cde|def|efg|fgh|ghi|hij|ijk|jkl|klm|lmn|mno|nop|opq|pqr|qrs|rst|stu|tuv|uvw|vwx|wxy|xyz)+$/i, // Sequential letters
      /^(password|qwerty|admin|letmein|welcome|monkey|dragon|master)/i, // Common passwords
    ];
    return !weakPatterns.some(pattern => pattern.test(password));
  }, 'Password is too common or follows a weak pattern');

/** Normalize a user-typed URL: prepend https:// when no protocol is present (forgiving input). */
export const normalizeUrlInput = (val: string): string => {
  const trimmed = val.trim();
  if (!trimmed) return trimmed;
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
};

export const signUpSchema = z.object({
  email: z.string()
    .email('Invalid email address')
    .toLowerCase()
    .refine((email) => {
      // Additional email validation
      const parts = email.split('@');
      if (parts.length !== 2) return false;
      const [local, domain] = parts;
      
      // Check for valid domain
      if (!domain.includes('.')) return false;
      
      // Check for disposable email domains (basic list)
      const disposableDomains = [
        'tempmail.com', 'throwaway.email', '10minutemail.com',
        'guerrillamail.com', 'mailinator.com', 'trashmail.com'
      ];
      if (disposableDomains.some(d => domain.includes(d))) return false;
      
      return true;
    }, 'Please use a valid, non-disposable email address'),
  password: strongPasswordSchema,
  displayName: z.string()
    .min(2, 'Display name must be at least 2 characters')
    .max(50, 'Display name must be less than 50 characters')
    // \p{L}\p{M}: letters in any script + combining marks (e.g. Hebrew niqqud).
    // ׳ ״ ־ are the Hebrew geresh/gershayim/maqaf — needed for names like
    // ג׳ורג׳ and בן־גוריון. Latin-only validation was rejecting the site's
    // Hebrew-speaking users outright.
    .regex(/^[\p{L}\p{M}\p{N}\s\-.׳״־]+$/u, 'Display name can only contain letters (any language), numbers, spaces, hyphens, and periods')
    .optional(),
});

export const signInSchema = z.object({
  email: z.string()
    .email('Invalid email address')
    .toLowerCase(),
  password: z.string()
    .min(1, 'Password is required'),
});

export const forgotPasswordSchema = z.object({
  email: z.string()
    .email('Invalid email address')
    .toLowerCase(),
});

export const resetPasswordSchema = z.object({
  password: strongPasswordSchema,
});

export const ratingSchema = z.object({
  score: z.number()
    .min(0.5, 'Rating must be at least 0.5 stars')
    .max(5, 'Rating cannot exceed 5 stars')
    .multipleOf(0.5, 'Rating must be in increments of 0.5 stars')
    .refine((score) => {
      // Ensure valid half-star increments
      const validScores = [0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5];
      return validScores.includes(score);
    }, 'Rating must be a valid half-star increment'),
  comment: z.string()
    .max(500, 'Comment must be less than 500 characters')
    .refine((comment) => {
      // Spam check only applies when a comment is provided
      if (!comment) return true;
      const spamPatterns = [
        /(.)\1{5,}/, // Repeated characters (more than 5 times)
        /(https?:\/\/|www\.)[^\s]+/i, // URLs
        /\b(click here|buy now|limited offer|act now)\b/i, // Spam phrases
      ];
      return !spamPatterns.some(pattern => pattern.test(comment));
    }, 'Comment appears to contain spam or inappropriate content')
    .optional()
    .or(z.literal('')),
}).superRefine((data, ctx) => {
  // A written explanation is required for low ratings (<=2 stars); optional otherwise.
  if (data.score <= 2 && (data.comment ?? '').trim().length < 10) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['comment'],
      message: 'Please add a brief explanation (at least 10 characters) for low ratings.',
    });
  }
});

export const teacherProfileSchema = z.object({
  name: z.string()
    .min(2, 'Name must be at least 2 characters')
    .max(100, 'Name must be less than 100 characters')
    // Any-script letters + Hebrew punctuation (see displayName note). The
    // convention for non-Latin teachers is a bilingual name — e.g.
    // "שרה לוי (Sarah Levy)" — so parentheses are allowed too; ILIKE search
    // then matches either script with no schema changes.
    .regex(/^[\p{L}\p{M}\s\-'.()׳״־]+$/u, 'Name can only contain letters (any language), spaces, hyphens, apostrophes, periods, and parentheses')
    .transform(val => val.trim()),
  institute: z.string()
    .min(2, 'Institute must be at least 2 characters')
    .max(200, 'Institute must be less than 200 characters')
    .transform(val => val.trim()),
  department: z.string()
    .min(2, 'Department must be at least 2 characters')
    .max(100, 'Department must be less than 100 characters')
    .transform(val => val.trim())
    .optional()
    .or(z.literal('')),
  designation: z.string()
    .min(2, 'Designation must be at least 2 characters')
    .max(100, 'Designation must be less than 100 characters')
    .transform(val => val.trim()),
  city: z.string()
    .min(2, 'City must be at least 2 characters')
    .max(100, 'City must be less than 100 characters')
    // Any-script letters + Hebrew punctuation (see displayName note).
    .regex(/^[\p{L}\p{M}\s\-'.׳״־]+$/u, 'City name can only contain letters (any language), spaces, hyphens, apostrophes, and periods')
    .transform(val => val.trim()),
  linkedin_url: z.string()
    .transform(normalizeUrlInput)
    .pipe(z.string()
      .url('Invalid LinkedIn URL')
      .refine((url) => {
        // Validate LinkedIn URL format
        try {
          const parsed = new URL(url);
          return parsed.hostname === 'linkedin.com' ||
                 parsed.hostname === 'www.linkedin.com' ||
                 parsed.hostname.endsWith('.linkedin.com');
        } catch {
          return false;
        }
      }, 'Must be a valid LinkedIn URL'))
    .optional()
    .or(z.literal('')),
  bio: z.string()
    .max(1000, 'Bio must be less than 1000 characters')
    .refine((bio) => {
      // Basic XSS prevention
      const dangerousPatterns = [
        /<script[\s\S]*?<\/script>/gi,
        /<iframe[\s\S]*?<\/iframe>/gi,
        /javascript:/gi,
        /on\w+\s*=/gi, // Event handlers
      ];
      return !dangerousPatterns.some(pattern => pattern.test(bio));
    }, 'Bio contains potentially dangerous content')
    .optional(),
  avatar_url: z.string()
    .url('Invalid URL')
    .refine((url) => {
      // Any http(s) link is accepted: many real image URLs have no file
      // extension (CDN links), and a non-image link just falls back to the
      // initials placeholder in AvatarImage. Non-web schemes are rejected.
      try {
        const parsed = new URL(url);
        return parsed.protocol === 'http:' || parsed.protocol === 'https:';
      } catch {
        return false;
      }
    }, 'Must be a web link (https://…)')
    .optional()
    .or(z.literal('')),
});

export const searchSchema = z.object({
  query: z.string()
    .max(100, 'Search query too long')
    .refine((query) => {
      // Prevent SQL injection patterns
      const sqlPatterns = [
        /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|EXECUTE|UNION|FROM|WHERE)\b)/i,
        /[';\\-]/,  // Matches single quote, semicolon, backslash, or hyphen
      ];
      return !sqlPatterns.some(pattern => pattern.test(query));
    }, 'Search query contains invalid characters')
    .transform(val => val.trim()),
  institute: z.string()
    .max(200, 'Institute filter too long')
    .optional(),
  // Mirrors TEACHER_SORTS in hooks/useTeachersOptimized.ts (kept literal here
  // to avoid a lib -> hooks import). 'rating_asc' retired 2026-08 — see the
  // comment there before re-adding it.
  sortBy: z.enum(['rating_desc', 'institute_az', 'name_az'])
    .optional(),
  page: z.number()
    .int('Page must be an integer')
    .positive('Page must be positive')
    .max(1000, 'Page number too large')
    .optional(),
  pageSize: z.number()
    .int('Page size must be an integer')
    .positive('Page size must be positive')
    .max(50, 'Page size cannot exceed 50')
    .optional(),
});

// Password strength checker utility
export function checkPasswordStrength(password: string): {
  score: number; // 0-5
  feedback: string[];
} {
  let score = 0;
  const feedback: string[] = [];
  
  // Length check
  if (password.length >= 12) score++;
  if (password.length >= 16) score++;
  else if (password.length < 12) feedback.push('Use at least 12 characters');
  
  // Character variety
  if (/[a-z]/.test(password)) score++;
  else feedback.push('Add lowercase letters');
  
  if (/[A-Z]/.test(password)) score++;
  else feedback.push('Add uppercase letters');
  
  if (/[0-9]/.test(password)) score++;
  else feedback.push('Add numbers');
  
  if (/[^a-zA-Z0-9]/.test(password)) score++;
  else feedback.push('Add special characters');
  
  // Deduct for common patterns
  if (/^[a-zA-Z]+$/.test(password)) {
    score = Math.max(0, score - 1);
    feedback.push('Avoid using only letters');
  }
  if (/^[0-9]+$/.test(password)) {
    score = Math.max(0, score - 1);
    feedback.push('Avoid using only numbers');
  }
  
  return { score: Math.min(5, score), feedback };
}

/**
 * Sanitizes user input for use in Supabase PostgREST filter queries
 * Prevents SQL injection and PostgREST filter injection
 *
 * @param input - User-provided search string
 * @returns Sanitized string safe for use in PostgREST filters
 */
export function sanitizeSearchInput(input: string): string {
  if (!input || typeof input !== 'string') {
    return '';
  }

  // Remove any null bytes
  let sanitized = input.replace(/\0/g, '');

  // Escape special PostgREST characters that could be used for injection
  // These characters have special meaning in PostgREST filter syntax:
  // - Comma (,) separates OR conditions
  // - Period (.) separates column.operator
  // - Asterisk (*) is a wildcard
  // - Parentheses () group conditions
  // - Backslash (\) is escape character
  // - Single quote (') can break out of strings
  // - Semicolon (;) can be used to chain commands
  // - Pipe (|) is used in some operators

  // Replace potentially dangerous characters
  sanitized = sanitized
    .replace(/[,;|()\\']/g, '') // Remove dangerous characters
    .replace(/\*/g, '') // Remove wildcard to prevent pattern injection
    .replace(/\./g, '') // Remove dots to prevent column.operator injection
    .trim();

  // Limit length to prevent DoS
  if (sanitized.length > 100) {
    sanitized = sanitized.substring(0, 100);
  }

  return sanitized;
}

/**
 * Validates and sanitizes a search query
 * @param query - User-provided search query
 * @returns Sanitized query or empty string if invalid
 */
export function validateAndSanitizeSearch(query: string): string {
  try {
    const result = searchSchema.parse({ query });
    return sanitizeSearchInput(result.query);
  } catch {
    return '';
  }
}

export type SignUpFormData = z.infer<typeof signUpSchema>;
export type SignInFormData = z.infer<typeof signInSchema>;
export type ForgotPasswordFormData = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordFormData = z.infer<typeof resetPasswordSchema>;
export type RatingFormData = z.infer<typeof ratingSchema>;
export type TeacherProfileFormData = z.infer<typeof teacherProfileSchema>;
export type SearchParams = z.infer<typeof searchSchema>;