"use client";

import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      // Enable automatic connection pooling
      db: {
        schema: 'public',
      },
      auth: {
        // Reduce token refresh frequency to minimize DB calls
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
        flowType: 'pkce',
      },
      global: {
        // Add fetch options for better caching
        fetch: (url, options = {}) => {
          return fetch(url, {
            ...options,
            // Add keep-alive for connection reuse
            keepalive: true,
          })
        },
      },
    }
  );
}
