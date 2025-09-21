/**
 * Environment Variable Configuration and Validation
 * Ensures all required environment variables are present and valid
 */

interface EnvironmentVariables {
  VITE_SUPABASE_URL: string;
  VITE_SUPABASE_ANON_KEY: string;
  VITE_ADMIN_EMAIL?: string;
  VITE_SENTRY_DSN?: string;
  VITE_ENV?: 'development' | 'production' | 'test';
}

class EnvironmentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EnvironmentError';
  }
}

/**
 * Validates that all required environment variables are present
 * @throws {EnvironmentError} if any required variables are missing or invalid
 */
export function validateEnvironment(): void {
  const requiredVars = [
    'VITE_SUPABASE_URL',
    'VITE_SUPABASE_ANON_KEY'
  ] as const;

  const missing: string[] = [];
  const invalid: string[] = [];

  // Check for missing required variables
  for (const varName of requiredVars) {
    if (!import.meta.env[varName]) {
      missing.push(varName);
    }
  }

  // Validate Supabase URL format
  if (import.meta.env.VITE_SUPABASE_URL) {
    try {
      const url = new URL(import.meta.env.VITE_SUPABASE_URL);
      if (!url.hostname.includes('supabase')) {
        invalid.push('VITE_SUPABASE_URL must be a valid Supabase URL');
      }
    } catch {
      invalid.push('VITE_SUPABASE_URL must be a valid URL');
    }
  }

  // Validate Supabase Anon Key format (basic check for JWT structure)
  if (import.meta.env.VITE_SUPABASE_ANON_KEY) {
    const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
    if (!key.includes('.') || key.split('.').length !== 3) {
      invalid.push('VITE_SUPABASE_ANON_KEY must be a valid JWT token');
    }
  }

  // Validate email format if provided
  if (import.meta.env.VITE_ADMIN_EMAIL) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(import.meta.env.VITE_ADMIN_EMAIL)) {
      invalid.push('VITE_ADMIN_EMAIL must be a valid email address');
    }
  }

  // Validate environment type
  if (import.meta.env.VITE_ENV) {
    const validEnvs = ['development', 'production', 'test'];
    if (!validEnvs.includes(import.meta.env.VITE_ENV)) {
      invalid.push(`VITE_ENV must be one of: ${validEnvs.join(', ')}`);
    }
  }

  // Throw error if there are any issues
  if (missing.length > 0 || invalid.length > 0) {
    let errorMessage = 'Environment configuration error:\n';
    
    if (missing.length > 0) {
      errorMessage += `\nMissing required variables:\n${missing.map(v => `  - ${v}`).join('\n')}`;
    }
    
    if (invalid.length > 0) {
      errorMessage += `\n\nInvalid variables:\n${invalid.map(v => `  - ${v}`).join('\n')}`;
    }
    
    errorMessage += '\n\nPlease check your .env file and ensure all required variables are set correctly.';
    errorMessage += '\nRefer to .env.example for the required format.';
    
    throw new EnvironmentError(errorMessage);
  }
}

/**
 * Safe getter for environment variables with fallback
 */
export function getEnvVar<K extends keyof EnvironmentVariables>(
  key: K,
  fallback?: EnvironmentVariables[K]
): EnvironmentVariables[K] {
  const value = import.meta.env[key];
  
  if (!value && !fallback) {
    throw new EnvironmentError(`Environment variable ${key} is not defined`);
  }
  
  return (value || fallback) as EnvironmentVariables[K];
}

/**
 * Get the current environment
 */
export function getEnvironment(): 'development' | 'production' | 'test' {
  return (import.meta.env.VITE_ENV || import.meta.env.MODE || 'development') as 'development' | 'production' | 'test';
}

/**
 * Check if running in production
 */
export function isProduction(): boolean {
  return getEnvironment() === 'production';
}

/**
 * Check if running in development
 */
export function isDevelopment(): boolean {
  return getEnvironment() === 'development';
}

/**
 * Get sanitized environment config for client use
 * Never exposes sensitive data
 */
export function getPublicConfig() {
  return {
    environment: getEnvironment(),
    supabaseUrl: import.meta.env.VITE_SUPABASE_URL,
    // Never expose the actual keys, just indicate if they're configured
    hasSupabaseKey: !!import.meta.env.VITE_SUPABASE_ANON_KEY,
    hasSentryDSN: !!import.meta.env.VITE_SENTRY_DSN,
  };
}

// Auto-validate on module load in development
if (isDevelopment()) {
  try {
    validateEnvironment();
    console.log('✅ Environment variables validated successfully');
  } catch (error) {
    if (error instanceof EnvironmentError) {
      console.error('❌', error.message);
      // In development, show a warning but don't crash the app
      console.warn('⚠️ Running with invalid environment configuration. Some features may not work.');
    } else {
      throw error;
    }
  }
}

export default {
  validateEnvironment,
  getEnvVar,
  getEnvironment,
  isProduction,
  isDevelopment,
  getPublicConfig,
};