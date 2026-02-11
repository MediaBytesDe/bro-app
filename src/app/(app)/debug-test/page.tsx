"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

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
    // Test 1: Basic render
    addLog("✅ React rendering works");

    // Test 2: Supabase client creation
    try {
      const supabase = createClient();
      addLog("✅ Supabase client created");

      // Test 3: getSession
      try {
        addLog("⏳ Calling getSession...");
        const t1 = Date.now();
        const { data: { session }, error } = await supabase.auth.getSession();
        addLog(`✅ getSession done in ${Date.now() - t1}ms: ${session ? "has session" : "no session"} ${error ? "ERROR: " + error.message : ""}`);
      } catch (e) {
        addLog(`❌ getSession crashed: ${e}`);
      }

      // Test 4: getUser
      try {
        addLog("⏳ Calling getUser...");
        const t2 = Date.now();
        const { data: { user }, error } = await supabase.auth.getUser();
        addLog(`✅ getUser done in ${Date.now() - t2}ms: ${user ? user.email : "no user"} ${error ? "ERROR: " + error.message : ""}`);
      } catch (e) {
        addLog(`❌ getUser crashed: ${e}`);
      }

      // Test 5: Simple query
      try {
        addLog("⏳ Querying customers...");
        const t3 = Date.now();
        const { data, error } = await supabase.from("customers").select("id").limit(1);
        addLog(`✅ Query done in ${Date.now() - t3}ms: ${data?.length ?? 0} rows ${error ? "ERROR: " + error.message : ""}`);
      } catch (e) {
        addLog(`❌ Query crashed: ${e}`);
      }

      // Test 6: wawi_quotes
      try {
        addLog("⏳ Querying wawi_quotes...");
        const t4 = Date.now();
        const { data, error } = await supabase.from("wawi_quotes").select("id").limit(1);
        addLog(`✅ wawi_quotes done in ${Date.now() - t4}ms: ${data?.length ?? 0} rows ${error ? "ERROR: " + error.message : ""}`);
      } catch (e) {
        addLog(`❌ wawi_quotes crashed: ${e}`);
      }

    } catch (e) {
      addLog(`❌ Supabase client creation failed: ${e}`);
    }

    addLog("🏁 All tests complete");
  }

  return (
    <div style={{ padding: 20, fontFamily: "monospace", fontSize: 14, color: "#fff", background: "#0a0a0a", minHeight: "100vh" }}>
      <h1 style={{ fontSize: 18, marginBottom: 16 }}>Debug Test Page</h1>
      {log.map((l, i) => (
        <div key={i} style={{ padding: "4px 0", borderBottom: "1px solid #222" }}>{l}</div>
      ))}
    </div>
  );
}
