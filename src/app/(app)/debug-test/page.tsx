"use client";

import { useState, useEffect } from "react";

export default function DebugTestPage() {
  const [log, setLog] = useState<string[]>(["Page mounted"]);
  
  const addLog = (msg: string) => {
    setLog(prev => [...prev, `${new Date().toISOString().slice(11,19)} ${msg}`]);
  };

  useEffect(() => {
    addLog("useEffect running");
    runTests();
  }, []);

  async function runTests() {
    addLog("✅ React rendering works");

    // Test 1: localStorage
    try {
      const keys = Object.keys(localStorage).filter(k => k.includes('supabase') || k.includes('sb-') || k.includes('auth'));
      addLog(`✅ localStorage keys: ${keys.length > 0 ? keys.join(', ') : 'none found'}`);
      for (const k of keys) {
        const v = localStorage.getItem(k);
        addLog(`  ${k}: ${v ? v.substring(0, 80) + '...' : 'null'}`);
      }
    } catch (e) {
      addLog(`❌ localStorage error: ${e}`);
    }

    // Test 2: Direct fetch to Supabase (bypass client entirely)
    try {
      addLog("⏳ Direct fetch to Supabase auth...");
      const t1 = Date.now();
      const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/user`, {
        headers: {
          'apikey': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
          'Authorization': `Bearer ${getAccessToken()}`,
        },
      });
      const data = await res.json();
      addLog(`✅ Direct fetch done in ${Date.now() - t1}ms: ${res.status} ${data.email || data.msg || 'no email'}`);
    } catch (e) {
      addLog(`❌ Direct fetch error: ${e}`);
    }

    // Test 3: Create supabase client and test getUser with timeout
    try {
      addLog("⏳ Creating supabase client...");
      const { createClient } = await import("@supabase/supabase-js");
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        { auth: { autoRefreshToken: false, persistSession: false } }
      );
      addLog("✅ Client created (no persist, no auto-refresh)");

      addLog("⏳ Calling getUser with 5s timeout...");
      const t2 = Date.now();
      const result = await Promise.race([
        supabase.auth.getUser(getAccessToken()),
        new Promise((_, reject) => setTimeout(() => reject(new Error("TIMEOUT after 5s")), 5000))
      ]) as any;
      addLog(`✅ getUser done in ${Date.now() - t2}ms: ${result.data?.user?.email || 'no user'}`);
    } catch (e) {
      addLog(`❌ getUser error: ${e}`);
    }

    // Test 4: Simple data fetch
    try {
      addLog("⏳ Fetching customers via REST...");
      const t3 = Date.now();
      const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/customers?select=id&limit=1`, {
        headers: {
          'apikey': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
          'Authorization': `Bearer ${getAccessToken()}`,
        },
      });
      const data = await res.json();
      addLog(`✅ Customers fetch done in ${Date.now() - t3}ms: ${JSON.stringify(data).substring(0, 100)}`);
    } catch (e) {
      addLog(`❌ Customers fetch error: ${e}`);
    }

    addLog("🏁 All tests complete");
  }

  return (
    <div style={{ padding: 20, fontFamily: "monospace", fontSize: 12, color: "#fff", background: "#0a0a0a", minHeight: "100vh" }}>
      <h1 style={{ fontSize: 16, marginBottom: 16 }}>Debug Test Page</h1>
      {log.map((l, i) => (
        <div key={i} style={{ padding: "3px 0", borderBottom: "1px solid #222", wordBreak: "break-all" }}>{l}</div>
      ))}
    </div>
  );
}

function getAccessToken(): string {
  try {
    // Try different storage keys
    for (const key of Object.keys(localStorage)) {
      if (key.includes('auth-token') || key.includes('sb-') || key.includes('supabase')) {
        const raw = localStorage.getItem(key);
        if (raw) {
          try {
            const parsed = JSON.parse(raw);
            if (parsed.access_token) return parsed.access_token;
            if (parsed.currentSession?.access_token) return parsed.currentSession.access_token;
          } catch {}
        }
      }
    }
  } catch {}
  return '';
}
