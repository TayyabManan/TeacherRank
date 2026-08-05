/**
 * Environment Variable Configuration and Validation
 * Ensures all required environment variables are present and valid
 */

// The authoritative list of client env vars is ImportMetaEnv in src/vite-env.d.ts
// — a local duplicate lived here and drifted. Every VITE_-prefixed var is inlined
// into the public bundle at build time, so that list is "things we are happy to
// publish"; anything private needs a non-VITE_ name read on the server.
//
// VITE_ADMIN_EMAIL was validated here until it was found published in shipped JS
// (the operator's personal address, extractable with a curl + grep). Nothing read
// it for any decision — isAdmin() resolves the role from `profiles`, and the
// legacy isAdminEmail() is deprecated and hardcoded to false — so it was deleted
// rather than kept and validated.

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
  const missing: string[] = [];
  const invalid: string[] = [];

  // Reference each var STATICALLY. A computed lookup (`import.meta.env[varName]`)
  // is opaque to Vite's define-replacement, so it emits the entire env record
  // into the bundle instead of one substituted value — which is how every
  // VITE_ var, referenced or not, ended up published verbatim in shipped JS.
  const required = {
    VITE_SUPABASE_URL: import.meta.env.VITE_SUPABASE_URL,
    VITE_SUPABASE_ANON_KEY: import.meta.env.VITE_SUPABASE_ANON_KEY,
  };

  for (const [varName, value] of Object.entries(required)) {
    if (!value) {
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

// getEnvVar() was removed here. It was exported but never called, and its
// generic `import.meta.env[key]` lookup was the second construct forcing Vite
// to serialize the whole env record into the bundle. Anything added back must
// reference `import.meta.env.VITE_X` statically.

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
  getEnvironment,
  isProduction,
  isDevelopment,
  getPublicConfig,
};