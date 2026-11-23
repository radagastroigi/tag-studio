'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const supabase = createClient();

  async function signInWithGoogle() {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/` },
    });
    if (error) setMessage(error.message);
  }

  async function sendMagicLink(e: React.FormEvent) {
    e.preventDefault();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/` },
    });
    setMessage(error ? error.message : 'Magic link sent. Check your inbox.');
  }

  return (
    <main className="mx-auto max-w-md p-6 space-y-6">
      <h1 className="text-2xl font-bold">Sign in to TAG Studio</h1>
      <button
        type="button"
        onClick={signInWithGoogle}
        className="w-full rounded bg-[#17211E] px-4 py-2 text-white"
      >
        Continue with Google
      </button>
      <form onSubmit={sendMagicLink} className="space-y-3">
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          className="w-full rounded border px-3 py-2 bg-white"
        />
        <button
          type="submit"
          className="w-full rounded border border-[#17211E] px-4 py-2"
        >
          Send Magic Link
        </button>
      </form>
      {message && <p className="text-sm">{message}</p>}
    </main>
  );
}
