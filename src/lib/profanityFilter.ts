/**
 * Profanity Filter and Content Moderation
 * Detects and filters inappropriate content in user reviews
 */

// Common variations and leetspeak patterns
const leetReplacements: Record<string, string[]> = {
  'a': ['@', '4', 'æ', 'ä', 'á', 'à'],
  'e': ['3', '€', 'ë', 'é', 'è'],
  'i': ['1', '!', 'í', 'ì', 'ï'],
  'o': ['0', 'ø', 'ö', 'ó', 'ò'],
  'u': ['µ', 'ü', 'ú', 'ù'],
  's': ['$', '5', 'z'],
  'g': ['9'],
  'l': ['1', '|'],
  'c': ['k', '('],
  'b': ['8'],
  't': ['7', '+'],
};

// Basic list of inappropriate words (expandable)
// In production, consider using a more comprehensive API service
const inappropriatePatterns = [
  // Profanity patterns (keeping list minimal for example)
  /\b(hate|stupid|dumb|idiot|moron|suck|awful|terrible|horrible|worst|trash|garbage|useless|pathetic)\b/gi,
  
  // Personal attacks
  /\b(kill|die|kys|threat|harm|hurt|attack)\b/gi,
  
  // Discriminatory language patterns
  /\b(racist|sexist|discrimination)\b/gi,
];

// Positive words to encourage
const positiveWords = [
  'helpful', 'knowledgeable', 'patient', 'understanding', 'clear',
  'organized', 'inspiring', 'dedicated', 'professional', 'excellent',
  'good', 'great', 'amazing', 'wonderful', 'supportive', 'encouraging'
];

// Educational constructive criticism terms
const constructiveWords = [
  'could improve', 'suggestion', 'recommend', 'perhaps', 'maybe',
  'consider', 'opportunity', 'potential', 'development', 'growth'
];

export interface ModerationResult {
  isClean: boolean;
  issues: string[];
  suggestions: string[];
  score: number; // 0-100, higher is better
  hasPositiveContent: boolean;
  hasConstructiveCriticism: boolean;
}

/**
 * Normalize text to detect leetspeak and variations
 */
function normalizeText(text: string): string {
  let normalized = text.toLowerCase();
  
  // Replace leetspeak
  Object.entries(leetReplacements).forEach(([letter, replacements]) => {
    replacements.forEach(replacement => {
      const regex = new RegExp(replacement.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
      normalized = normalized.replace(regex, letter);
    });
  });
  
  // Remove extra spaces and special characters between letters
  normalized = normalized.replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ');
  
  return normalized;
}

/**
 * Check for repeated characters (like "stuuuuupid")
 */
function removeRepeatedChars(text: string): string {
  return text.replace(/(.)\1{2,}/g, '$1$1');
}

/**
 * Main profanity and content moderation check
 */
export function moderateContent(text: string): ModerationResult {
  const issues: string[] = [];
  const suggestions: string[] = [];
  let score = 100;
  
  // Normalize text for checking
  const normalized = normalizeText(text);
  const withoutRepeats = removeRepeatedChars(normalized);
  
  // Check for inappropriate content
  inappropriatePatterns.forEach(pattern => {
    if (pattern.test(normalized) || pattern.test(withoutRepeats)) {
      issues.push('Contains potentially inappropriate language');
      score -= 30;
    }
  });
  
  // Check for ALL CAPS (considered shouting)
  const capsRatio = (text.match(/[A-Z]/g) || []).length / text.length;
  if (capsRatio > 0.7 && text.length > 10) {
    issues.push('Excessive use of capital letters');
    suggestions.push('Please avoid using all caps as it appears aggressive');
    score -= 10;
  }
  
  // Check for excessive punctuation (!!!! or ????)
  if (/[!?]{4,}/.test(text)) {
    issues.push('Excessive punctuation');
    suggestions.push('Please use punctuation moderately');
    score -= 5;
  }
  
  // Check for very short reviews that might be spam
  if (text.trim().length < 10) {
    issues.push('Review is too short');
    suggestions.push('Please provide more detailed feedback (at least 10 characters)');
    score -= 20;
  }
  
  // Check for repeated words (spam pattern)
  const words = text.toLowerCase().split(/\s+/);
  const wordCount = words.reduce((acc: Record<string, number>, word) => {
    if (word.length > 2) {
      acc[word] = (acc[word] || 0) + 1;
    }
    return acc;
  }, {});
  
  const hasSpamPattern = Object.values(wordCount).some(count => count > 5);
  if (hasSpamPattern) {
    issues.push('Detected spam patterns');
    suggestions.push('Please avoid repeating the same words excessively');
    score -= 15;
  }
  
  // Check for positive content
  const hasPositiveContent = positiveWords.some(word => 
    new RegExp(`\\b${word}\\b`, 'i').test(text)
  );
  
  // Check for constructive criticism
  const hasConstructiveCriticism = constructiveWords.some(word => 
    new RegExp(`\\b${word}\\b`, 'i').test(text)
  );
  
  // Bonus points for constructive feedback
  if (hasConstructiveCriticism) {
    score += 10;
    suggestions.push('Thank you for providing constructive feedback!');
  }
  
  // Encourage balanced reviews
  if (!hasPositiveContent && score < 70) {
    suggestions.push('Consider mentioning something positive along with your criticism');
  }
  
  return {
    isClean: issues.length === 0,
    issues,
    suggestions,
    score: Math.max(0, Math.min(100, score)),
    hasPositiveContent,
    hasConstructiveCriticism
  };
}

/**
 * Get suggestions for improving a review
 */
export function getReviewSuggestions(rating: number, text: string): string[] {
  const suggestions: string[] = [];
  const wordCount = text.split(/\s+/).length;
  
  if (rating <= 2 && wordCount < 20) {
    suggestions.push('Please provide specific examples of what could be improved');
  }
  
  if (rating >= 4 && wordCount < 15) {
    suggestions.push('Share what made this teacher exceptional');
  }
  
  if (!text.includes('because') && !text.includes('when') && !text.includes('how')) {
    suggestions.push('Consider adding specific examples or situations');
  }
  
  return suggestions;
}

/**
 * Clean text by removing inappropriate content
 */
export function cleanText(text: string): string {
  let cleaned = text;
  
  // Replace inappropriate words with asterisks
  inappropriatePatterns.forEach(pattern => {
    cleaned = cleaned.replace(pattern, (match) => '*'.repeat(match.length));
  });
  
  return cleaned;
}

/**
 * Generate encouraging placeholder based on rating
 */
export function getPlaceholderText(rating: number): string {
  if (rating >= 4) {
    return "Share what made this teacher exceptional! What did you enjoy most about their teaching style?";
  } else if (rating >= 3) {
    return "Describe your experience with this teacher. What worked well and what could be improved?";
  } else {
    return "Please provide constructive feedback. What specific areas could this teacher improve? Remember to be respectful.";
  }
}

/**
 * Check if review meets minimum quality standards
 */
export function validateReviewQuality(text: string, rating: number): {
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];
  const words = text.trim().split(/\s+/).filter(w => w.length > 0);
  
  // Minimum length check
  if (words.length < 3) {
    errors.push('Please write at least 3 words');
  }
  
  // Check for substance (not just "good good good")
  const uniqueWords = new Set(words.map(w => w.toLowerCase()));
  if (uniqueWords.size < Math.min(3, words.length * 0.5)) {
    errors.push('Please provide more varied feedback');
  }
  
  // For low ratings, require a brief explanation. Keep this in CHARACTERS to match
  // the zod schema (validation.ts) and the submit button, which both use 10 chars —
  // otherwise a comment the UI accepts gets rejected by a hidden word-count rule.
  if (rating <= 2 && text.trim().length < 10) {
    errors.push('Please add a brief explanation (at least 10 characters) for a low rating');
  }
  
  // Check for keyboard mashing (asdfasdf)
  const keyboardMash = /([asdf]{4,}|[qwer]{4,}|[zxcv]{4,})/i;
  if (keyboardMash.test(text)) {
    errors.push('Please provide meaningful feedback');
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}