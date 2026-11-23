import { Suspense } from 'react';
import { connection } from 'next/server';
import Link from 'next/link';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { BottomNav } from '@/components/BottomNav';
import { QuickCapture } from '@/components/QuickCapture';
import { FocusTimer } from '@/components/FocusTimer';
import { Heatmap } from '@/components/Heatmap';
import { GoalEtaCard } from '@/components/GoalEtaCard';

async function DashboardContent() {
  await connection();
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <main className="mx-auto max-w-xl p-8 space-y-4">
        <h1 className="text-2xl font-bold">TAG Studio</h1>
        <p className="text-sm opacity-80">
          Sign in to access your tasks, activity logs, and goal forecasts.
        </p>
        <Link
          href="/login"
          className="inline-block rounded bg-[#17211E] px-4 py-2 text-white text-sm"
        >
          Go to Sign In
        </Link>
      </main>
    );
  }

  return (
    <div className="min-h-screen flex flex-col justify-between">
      <main className="mx-auto w-full max-w-3xl p-6 space-y-4">
        <h1 className="text-2xl font-bold">TAG Studio — {user.email}</h1>
        <QuickCapture />
        <FocusTimer />
        <Heatmap />
        <GoalEtaCard />
      </main>
      <BottomNav />
    </div>
  );
}

export default function HomePage() {
  return (
    <Suspense fallback={<div className="p-8 text-sm">Loading TAG Studio...</div>}>
      <DashboardContent />
    </Suspense>
  );
}