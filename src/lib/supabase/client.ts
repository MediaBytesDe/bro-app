"use client";

import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      // Set default database schema
      db: {
        schema: 'public',
      },
      auth: {
        // Optimize authentication settings
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
        flowType: 'pkce',
      },
      global: {
        // Enable HTTP keepalive to prevent connection drops during page navigation
        fetch: (url, options = {}) => {
          return fetch(url, {
            ...options,
            keepalive: true,
          })
        },
      },
    }
  );
}
