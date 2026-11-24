"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleGoogleLogin() {
    setLoading(true);
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) {
      setError(error.message);
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#F6F7F5] text-[#17211E] flex items-center justify-center p-6">
      <div className="w-full max-w-sm bg-white border border-[#E2E7E4] rounded-3xl p-8 text-center space-y-6">
        <div className="w-12 h-12 mx-auto rounded-2xl bg-[#17211E] text-white flex items-center justify-center font-bold text-sm tracking-tight">
          M
        </div>
        <div className="space-y-2">
          <h1 className="text-xl font-semibold tracking-tight">Monkthetics</h1>
          <p className="text-sm text-[#5B6863] leading-relaxed">
            What you do in a day makes you who you are. One goal. One step at a time.
          </p>
        </div>

        {error && (
          <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-xl p-2.5">{error}</p>
        )}

        <button
          type="button"
          onClick={handleGoogleLogin}
          disabled={loading}
          className="w-full py-3 rounded-xl bg-[#17211E] hover:bg-[#256453] disabled:opacity-50 text-white text-sm font-medium transition"
        >
          {loading ? "Connecting…" : "Continue with Google"}
        </button>
      </div>
    </main>
  );
}