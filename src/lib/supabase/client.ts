"use client";

import { createBrowserClient } from "@supabase/ssr";

// No-op lock: bypasses navigator.locks which deadlocks on Chrome Android
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const lockNoOp = async (_name: string, _timeout: number, fn: () => any) => await fn();

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        lock: lockNoOp as any,
      },
    }
  );
}
