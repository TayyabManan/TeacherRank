import { z } from 'zod';

/**
 * Strong password validation
 * Requirements:
 * - At least 12 characters long
 * - Contains at least one uppercase letter
 * - Contains at least one lowercase letter
 * - Contains at least one number
 * - Contains at least one special character
 */
const strongPasswordSchema = z.string()
  .min(12, 'Password must be at least 12 characters long')
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
  .regex(/[0-9]/, 'Password must contain at least one number')
  .regex(/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/, 'Password must contain at least one special character')
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
  confirmPassword: z.string(),
  role: z.enum(['student', 'teacher']),
  displayName: z.string()
    .min(2, 'Display name must be at least 2 characters')
    .max(50, 'Display name must be less than 50 characters')
    .regex(/^[a-zA-Z0-9\s\-\.]+$/, 'Display name can only contain letters, numbers, spaces, hyphens, and periods')
    .optional(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ['confirmPassword'],
});

export const signInSchema = z.object({
  email: z.string()
    .email('Invalid email address')
    .toLowerCase(),
  password: z.string()
    .min(1, 'Password is required'),
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
    .min(10, 'Comment must be at least 10 characters')
    .max(500, 'Comment must be less than 500 characters')
    .refine((comment) => {
      // Check for spam patterns
      const spamPatterns = [
        /(.)\1{5,}/, // Repeated characters (more than 5 times)
        /(https?:\/\/|www\.)[^\s]+/i, // URLs
        /\b(click here|buy now|limited offer|act now)\b/i, // Spam phrases
      ];
      return !spamPatterns.some(pattern => pattern.test(comment));
    }, 'Comment appears to contain spam or inappropriate content'),
});

export const teacherProfileSchema = z.object({
  name: z.string()
    .min(2, 'Name must be at least 2 characters')
    .max(100, 'Name must be less than 100 characters')
    .regex(/^[a-zA-Z\s\-'\.]+$/, 'Name can only contain letters, spaces, hyphens, apostrophes, and periods')
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
    .regex(/^[a-zA-Z\s\-'\.]+$/, 'City name can only contain letters, spaces, hyphens, apostrophes, and periods')
    .transform(val => val.trim()),
  linkedin_url: z.string()
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
    }, 'Must be a valid LinkedIn URL')
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
      // Validate image URL
      try {
        const parsed = new URL(url);
        // Check for image extensions or known image hosting services
        const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg'];
        const imageHosts = ['ui-avatars.com', 'gravatar.com', 'avatars.githubusercontent.com'];
        
        const hasImageExtension = imageExtensions.some(ext => 
          parsed.pathname.toLowerCase().endsWith(ext)
        );
        const isImageHost = imageHosts.some(host => 
          parsed.hostname.includes(host)
        );
        
        return hasImageExtension || isImageHost || parsed.protocol === 'data:';
      } catch {
        return false;
      }
    }, 'Must be a valid image URL')
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
        /[';\\-]/,  // Fixed regex: matches single quote, semicolon, backslash, or hyphen
      ];
      return !sqlPatterns.some(pattern => pattern.test(query));
    }, 'Search query contains invalid characters')
    .transform(val => val.trim()),
  institute: z.string()
    .max(200, 'Institute filter too long')
    .optional(),
  sortBy: z.enum(['rating_desc', 'rating_asc', 'institute_az', 'name_az'])
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

export type SignUpFormData = z.infer<typeof signUpSchema>;
export type SignInFormData = z.infer<typeof signInSchema>;
export type RatingFormData = z.infer<typeof ratingSchema>;
export type TeacherProfileFormData = z.infer<typeof teacherProfileSchema>;
export type SearchParams = z.infer<typeof searchSchema>;