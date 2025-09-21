// Alternative: Direct Google Sign-In Implementation
// This bypasses Supabase OAuth and uses Google directly

import React, { useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';

declare global {
  interface Window {
    google: any;
  }
}

export function GoogleSignInDirect() {
  useEffect(() => {
    // Load Google Sign-In script
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    document.body.appendChild(script);

    script.onload = () => {
      window.google.accounts.id.initialize({
        client_id: 'YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com',
        callback: handleGoogleResponse,
        auto_select: false,
        cancel_on_tap_outside: true,
      });

      // Render the button
      window.google.accounts.id.renderButton(
        document.getElementById('googleSignInButton'),
        { 
          theme: 'outline',
          size: 'large',
          width: '100%',
          text: 'continue_with',
          shape: 'rectangular',
        }
      );
    };

    return () => {
      document.body.removeChild(script);
    };
  }, []);

  const handleGoogleResponse = async (response: any) => {
    // Get the JWT token from Google
    const googleToken = response.credential;

    // Decode the JWT to get user info (or use Google API)
    const base64Url = googleToken.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    const googleUser = JSON.parse(jsonPayload);

    // Now you have user info: googleUser.email, googleUser.name, googleUser.picture
    
    // Option 1: Create a user in Supabase with email/password (generated)
    // Option 2: Use Supabase's admin API to create a session
    // Option 3: Store in your own database
    
    // Example: Sign in or create user in Supabase
    try {
      // Check if user exists
      const { data: existingUser } = await supabase
        .from('profiles')
        .select('*')
        .eq('email', googleUser.email)
        .single();

      if (existingUser) {
        // User exists, create a session
        // Note: This requires additional backend setup
        console.log('User exists:', existingUser);
      } else {
        // Create new user
        // This would require a backend function
        console.log('Create new user:', googleUser);
      }

      // Redirect to dashboard
      window.location.href = '/dashboard';
    } catch (error) {
      console.error('Sign in error:', error);
    }
  };

  return (
    <div>
      {/* Google's own button - won't show Supabase URL! */}
      <div id="googleSignInButton"></div>
      
      {/* OR Custom button that triggers Google One Tap */}
      <button
        onClick={() => window.google.accounts.id.prompt()}
        className="btn btn-outline w-full"
      >
        Continue with Google (Direct)
      </button>
    </div>
  );
}