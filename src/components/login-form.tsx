"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/contexts/auth-context";
import { Bot, AlertCircle } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";

export function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const { signIn, loading, user } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  // Handle redirect after login
  useEffect(() => {
    if (user) {
      const redirectTo = searchParams.get("redirectTo") || "/";
      router.push(redirectTo);
      router.refresh();
    }
  }, [user, router, searchParams]);

  // Handle error from URL (e.g., inactive account)
  useEffect(() => {
    const urlError = searchParams.get("error");
    if (urlError === "inactive") {
      setError("Dein Account ist deaktiviert. Bitte kontaktiere einen Admin.");
    } else if (urlError === "forbidden") {
      setError("Du hast keinen Zugriff auf diese Seite.");
    }
  }, [searchParams]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    const result = await signIn(email, password);

    if (result.error) {
      setError(
        result.error === "Invalid login credentials"
          ? "Ungültige E-Mail oder Passwort"
          : result.error
      );
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0a0a0a] px-4">
      <div className="w-full max-w-xs">
        {/* Logo */}
        <div className="text-center mb-6">
          <div className="w-14 h-14 mx-auto mb-4 rounded-xl bg-gradient-to-br from-red-500 to-orange-500 flex items-center justify-center text-white">
            <Bot className="w-7 h-7" />
          </div>
          <h1 className="text-xl font-bold text-white">Bro Dashboard</h1>
          <p className="text-neutral-500 text-sm">Login</p>
        </div>

        {/* Form */}
        <div className="card p-4">
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="bg-red-900/30 border border-red-800 text-red-400 px-3 py-2 rounded-lg text-sm flex items-center gap-2">
                <AlertCircle className="w-4 h-4" />
                {error}
              </div>
            )}

            <div className="form-group">
              <label htmlFor="email" className="form-label">E-Mail</label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input"
                placeholder="email@example.com"
                autoComplete="email"
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="password" className="form-label">Passwort</label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input"
                placeholder="••••••••"
                autoComplete="current-password"
                required
              />
            </div>

            <button type="submit" disabled={loading} className="btn btn-primary w-full">
              {loading ? <Spinner /> : "Anmelden"}
            </button>
          </form>
        </div>

        <p className="text-center text-neutral-600 text-xs mt-4">BROjekt GmbH</p>
      </div>
    </div>
  );
}
