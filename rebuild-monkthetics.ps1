<#
.SYNOPSIS
  Monkthetics Clean-Slate Rebuild Script (v1.0)
.DESCRIPTION
  Run inside E:\AI_ML_COURSE\projects\tag-studio.
  Wipes stale src/ files completely and writes ONLY the clean, unified 4-flow Monkthetics codebase.
  Preserves .env.local, node_modules, package.json, and public/.
#>

$ErrorActionPreference = "Stop"

function Write-CleanFile {
    param(
        [Parameter(Mandatory=$true)][string]$Path,
        [Parameter(Mandatory=$true)][string]$Content
    )
    $dir = Split-Path -Parent $Path
    if ($dir -and -not (Test-Path $dir)) {
        New-Item -ItemType Directory -Path $dir -Force | Out-Null
    }
    $utf8NoBom = New-Object System.Text.UTF8Encoding $false
    [System.IO.File]::WriteAllText((Join-Path (Get-Location) $Path), $Content.TrimStart("`r", "`n"), $utf8NoBom)
    Write-Host "  [+] $Path" -ForegroundColor Green
}

Write-Host "`n=== 1. Cleaning stale src/ and .next/ ===" -ForegroundColor Yellow
if (Test-Path "src") { Remove-Item -Recurse -Force "src" }
if (Test-Path ".next") { Remove-Item -Recurse -Force ".next" }
if (Test-Path "app") { Remove-Item -Recurse -Force "app" }

Write-Host "`n=== 2. Writing Unified Monkthetics 4-Flow Codebase ===" -ForegroundColor Cyan

# next.config.ts
Write-CleanFile -Path "next.config.ts" -Content @'
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  eslint: {
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
'@

# src/types/monk.ts
Write-CleanFile -Path "src/types/monk.ts" -Content @'
export interface MonkProfile {
  user_id: string;
  display_name: string;
  age: number | null;
  location: string;
  domain: string;
  industry: string;
  growth_aspect: string;
  onboarding_step: number;
}

export interface CoreGoal {
  id: string;
  horizon: "long_term" | "short_term";
  title: string;
  why_statement: string;
  target_hours: number;
  target_date: string;
}

export interface Milestone {
  id: string;
  goal_id: string;
  title: string;
  due_date: string | null;
  is_completed: boolean;
}

export interface DailyActivity {
  id: string;
  goal_id: string;
  title: string;
  scheduled_time: string | null;
  daily_target_mins: number;
}

export interface WorkSession {
  id: string;
  activity_id: string;
  session_date: string;
  started_at: string | null;
  ended_at: string | null;
  duration_mins: number;
  status: "running" | "done" | "partly" | "skipped";
}
'@

# src/lib/supabase/client.ts
Write-CleanFile -Path "src/lib/supabase/client.ts" -Content @'
import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
'@

# src/lib/supabase/server.ts
Write-CleanFile -Path "src/lib/supabase/server.ts" -Content @'
import { cookies } from "next/headers";
import { createServerClient, type CookieOptions } from "@supabase/ssr";

type CookieToSet = { name: string; value: string; options?: CookieOptions };

export async function createServerSupabaseClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: CookieToSet[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          } catch {
            // Safe in Server Components
          }
        },
      },
    }
  );
}
'@

# src/middleware.ts
Write-CleanFile -Path "src/middleware.ts" -Content @'
import { NextResponse, type NextRequest } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";

type CookieToSet = { name: string; value: string; options?: CookieOptions };

export async function middleware(request: NextRequest) {
  const response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet: CookieToSet[]) => {
          cookiesToSet.forEach(({ name, value, options }) => {
            request.cookies.set(name, value);
            response.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();
  const path = request.nextUrl.pathname;

  if (!user && !path.startsWith("/login") && !path.startsWith("/auth")) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (user && path.startsWith("/login")) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|manifest.json|icon.svg).*)"],
};
'@

# src/app/globals.css & layout.tsx
Write-CleanFile -Path "src/app/globals.css" -Content @'
@tailwind base;
@tailwind components;
@tailwind utilities;

body {
  background-color: #F6F7F5;
  color: #17211E;
}
'@

Write-CleanFile -Path "src/app/layout.tsx" -Content @'
import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Monkthetics — Daily Goal Execution",
  description: "One long-term goal. One short-term goal. Quiet daily focus.",
  manifest: "/manifest.json",
};

export const viewport: Viewport = {
  themeColor: "#17211E",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={inter.className}>{children}</body>
    </html>
  );
}
'@

# src/app/login/page.tsx
Write-CleanFile -Path "src/app/login/page.tsx" -Content @'
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
        <div className="w-12 h-12 mx-auto rounded-2xl bg-[#17211E] text-white flex items-center justify-center font-bold text-sm">
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
'@

# src/app/auth/callback/route.ts
Write-CleanFile -Path "src/app/auth/callback/route.ts" -Content @'
import { NextResponse, type NextRequest } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";

type CookieToSet = { name: string; value: string; options?: CookieOptions };

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  if (!code) {
    return NextResponse.redirect(`${origin}/login`);
  }

  const response = NextResponse.redirect(`${origin}/`);
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet: CookieToSet[]) => {
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return NextResponse.redirect(`${origin}/login`);
  }
  return response;
}
'@

# src/app/auth/signout/route.ts
Write-CleanFile -Path "src/app/auth/signout/route.ts" -Content @'
import { NextResponse, type NextRequest } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";

type CookieToSet = { name: string; value: string; options?: CookieOptions };

export async function POST(request: NextRequest) {
  const response = NextResponse.redirect(new URL("/login", request.url), { status: 303 });
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet: CookieToSet[]) => {
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  await supabase.auth.signOut();
  request.cookies.getAll().forEach((c) => {
    if (c.name.startsWith("sb-")) {
      response.cookies.set(c.name, "", { path: "/", maxAge: 0 });
    }
  });
  return response;
}
'@

# src/app/api/ai/suggest-habits/route.ts
Write-CleanFile -Path "src/app/api/ai/suggest-habits/route.ts" -Content @'
import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { goal, why } = (await request.json()) as { goal?: string; why?: string };
  if (!goal || goal.trim().length < 3) {
    return NextResponse.json({ error: "Goal is required." }, { status: 400 });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "GEMINI_API_KEY is not configured. Add your own activities above." },
      { status: 503 }
    );
  }

  const prompt = `Break this goal into 4 realistic DAILY activities a focused person can execute every day:
Goal: "${goal.trim()}"
Context: "${(why || "").trim()}"
Return strictly a JSON array of objects with keys:
- "title": short concrete action (max 50 chars)
- "daily_target_mins": integer minutes between 10 and 90
- "scheduled_time": "HH:MM" (24h)`;

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { responseMimeType: "application/json", temperature: 0.4 },
        }),
      }
    );
    if (!res.ok) return NextResponse.json({ error: "AI helper busy. Add activities manually." }, { status: 502 });
    const json = await res.json();
    const parsed = JSON.parse(json?.candidates?.[0]?.content?.parts?.[0]?.text || "[]");
    return NextResponse.json({ habits: parsed });
  } catch {
    return NextResponse.json({ error: "Could not parse AI ideas." }, { status: 500 });
  }
}
'@

# src/app/api/excel/export/route.ts
Write-CleanFile -Path "src/app/api/excel/export/route.ts" -Content @'
import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [gRes, mRes, aRes, sRes] = await Promise.all([
    supabase.from("monk_core_goals").select("horizon, title, target_hours, target_date, is_active"),
    supabase.from("monk_milestones").select("title, due_date, is_completed"),
    supabase.from("monk_activities").select("title, scheduled_time, daily_target_mins, is_active"),
    supabase.from("monk_sessions").select("session_date, duration_mins, status, started_at, ended_at").order("session_date", { ascending: false }),
  ]);

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(gRes.data || []), "Goals");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(mRes.data || []), "Milestones");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(aRes.data || []), "Activities");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(sRes.data || []), "Daily_Sessions");

  const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
  const dateStr = new Date().toISOString().slice(0, 10);

  return new NextResponse(buffer, {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="monkthetics-export-${dateStr}.xlsx"`,
    },
  });
}
'@

# src/components/OnboardingFlow.tsx
Write-CleanFile -Path "src/components/OnboardingFlow.tsx" -Content @'
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

function addDaysIso(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export function OnboardingFlow({ userEmail }: { userEmail: string }) {
  const router = useRouter();
  const [displayName, setDisplayName] = useState("");
  const [age, setAge] = useState("");
  const [location, setLocation] = useState("");
  const [domain, setDomain] = useState("");
  const [industry, setIndustry] = useState("");
  const [growthAspect, setGrowthAspect] = useState("Career & Craft");

  const [ltTitle, setLtTitle] = useState("");
  const [ltHours, setLtHours] = useState(300);
  const [ltDate, setLtDate] = useState(addDaysIso(365));

  const [stTitle, setStTitle] = useState("");
  const [stHours, setStHours] = useState(60);
  const [stDate, setStDate] = useState(addDaysIso(45));

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!ltTitle.trim() || !stTitle.trim()) {
      return setError("Please enter both your Long-Term Goal and Short-Term Goal.");
    }

    setSaving(true);
    setError(null);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setSaving(false);
      return setError("Session expired. Please sign in again.");
    }

    const { error: profErr } = await supabase.from("monk_profiles").upsert(
      {
        user_id: user.id,
        display_name: displayName.trim() || userEmail.split("@")[0],
        age: age ? Number(age) : null,
        location: location.trim(),
        domain: domain.trim(),
        industry: industry.trim(),
        growth_aspect: growthAspect,
        onboarding_step: 2,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" }
    );

    if (profErr) {
      setSaving(false);
      return setError(profErr.message);
    }

    await supabase.from("monk_core_goals").update({ is_active: false }).eq("user_id", user.id);

    const { error: goalErr } = await supabase.from("monk_core_goals").insert([
      {
        user_id: user.id,
        horizon: "long_term",
        title: ltTitle.trim(),
        target_hours: Math.max(1, ltHours),
        target_date: ltDate,
        is_active: true,
      },
      {
        user_id: user.id,
        horizon: "short_term",
        title: stTitle.trim(),
        target_hours: Math.max(1, stHours),
        target_date: stDate,
        is_active: true,
      },
    ]);

    if (goalErr) {
      setSaving(false);
      return setError(goalErr.message);
    }

    router.push("/setup");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-xl bg-white border border-[#E2E7E4] rounded-3xl p-7 space-y-6">
      <div className="space-y-1">
        <div className="text-xs font-medium text-[#256453]">Step 1 of 2 · Foundation</div>
        <h1 className="text-xl font-semibold tracking-tight">Define who you&apos;re becoming</h1>
        <p className="text-xs text-[#5B6863]">
          Set 1 Long-Term Goal, 1 immediate Short-Term Goal, and your context so insights stay personal.
        </p>
      </div>

      {error && <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-xl p-3">{error}</div>}

      <div className="space-y-3">
        <div className="text-xs font-semibold text-[#17211E]">About You</div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          <input type="text" value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Your name" className="px-3.5 py-2.5 text-xs rounded-xl border border-[#D8DFDB]" />
          <input type="number" min={12} max={100} value={age} onChange={(e) => setAge(e.target.value)} placeholder="Age" className="px-3.5 py-2.5 text-xs rounded-xl border border-[#D8DFDB]" />
          <input type="text" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="City, Country" className="px-3.5 py-2.5 text-xs rounded-xl border border-[#D8DFDB]" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          <input type="text" value={domain} onChange={(e) => setDomain(e.target.value)} placeholder="Field / Role" className="px-3.5 py-2.5 text-xs rounded-xl border border-[#D8DFDB]" />
          <input type="text" value={industry} onChange={(e) => setIndustry(e.target.value)} placeholder="Industry" className="px-3.5 py-2.5 text-xs rounded-xl border border-[#D8DFDB]" />
          <select value={growthAspect} onChange={(e) => setGrowthAspect(e.target.value)} className="px-3 py-2.5 text-xs rounded-xl border border-[#D8DFDB] bg-white">
            <option>Career &amp; Craft</option>
            <option>Building a Company</option>
            <option>Health &amp; Discipline</option>
            <option>Academic Mastery</option>
            <option>Financial Freedom</option>
          </select>
        </div>
      </div>

      <div className="space-y-2.5 pt-4 border-t border-[#EDF1EE]">
        <div className="text-xs font-semibold text-[#17211E]">1 Long-Term Goal (North Star)</div>
        <input type="text" required value={ltTitle} onChange={(e) => setLtTitle(e.target.value)} placeholder="e.g., Build a profitable SaaS company" className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-[#D8DFDB]" />
        <div className="grid grid-cols-2 gap-2.5">
          <input type="number" min={10} value={ltHours} onChange={(e) => setLtHours(Number(e.target.value || 100))} className="px-3.5 py-2 text-xs rounded-xl border border-[#D8DFDB]" />
          <input type="date" required value={ltDate} onChange={(e) => setLtDate(e.target.value)} className="px-3.5 py-2 text-xs rounded-xl border border-[#D8DFDB]" />
        </div>
      </div>

      <div className="space-y-2.5 pt-4 border-t border-[#EDF1EE]">
        <div className="text-xs font-semibold text-[#256453]">1 Short-Term Goal (Immediate Milestone)</div>
        <input type="text" required value={stTitle} onChange={(e) => setStTitle(e.target.value)} placeholder="e.g., Crack a Tier-1 Backend/AI offer in 60 days" className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-[#D8DFDB]" />
        <div className="grid grid-cols-2 gap-2.5">
          <input type="number" min={5} value={stHours} onChange={(e) => setStHours(Number(e.target.value || 40))} className="px-3.5 py-2 text-xs rounded-xl border border-[#D8DFDB]" />
          <input type="date" required value={stDate} onChange={(e) => setStDate(e.target.value)} className="px-3.5 py-2 text-xs rounded-xl border border-[#D8DFDB]" />
        </div>
      </div>

      <button type="submit" disabled={saving} className="w-full py-3 rounded-2xl bg-[#17211E] hover:bg-[#256453] text-white text-sm font-semibold transition disabled:opacity-50">
        {saving ? "Saving…" : "Continue to Activities & Milestones →"}
      </button>
    </form>
  );
}
'@

# src/app/onboarding/page.tsx
Write-CleanFile -Path "src/app/onboarding/page.tsx" -Content @'
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { OnboardingFlow } from "@/components/OnboardingFlow";

export default async function OnboardingPage() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();

  return (
    <main className="min-h-screen bg-[#F6F7F5] text-[#17211E] flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-xl flex items-center justify-between mb-5 text-xs text-[#5B6863]">
        <span className="font-semibold text-[#17211E]">Monkthetics</span>
        <form action="/auth/signout" method="post">
          <button type="submit" className="underline hover:text-[#17211E]">Sign out</button>
        </form>
      </div>
      <OnboardingFlow userEmail={user?.email || ""} />
    </main>
  );
}
'@

# src/components/SetupFlow.tsx
Write-CleanFile -Path "src/components/SetupFlow.tsx" -Content @'
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { CoreGoal } from "@/types/monk";

type DraftMilestone = { id: string; title: string; due_date: string };
type DraftActivity = { id: string; title: string; daily_target_mins: number; scheduled_time: string };

export function SetupFlow({ shortGoal, longGoal }: { shortGoal: CoreGoal; longGoal: CoreGoal | null }) {
  const router = useRouter();
  const [milestones, setMilestones] = useState<DraftMilestone[]>([
    { id: crypto.randomUUID(), title: "", due_date: "" },
  ]);
  const [activities, setActivities] = useState<DraftActivity[]>([
    { id: crypto.randomUUID(), title: "", daily_target_mins: 45, scheduled_time: "08:00" },
  ]);
  const [aiLoading, setAiLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function suggestIfStuck() {
    setAiLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/ai/suggest-habits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          goal: shortGoal.title,
          why: longGoal ? `Stepping stone toward: ${longGoal.title}` : "",
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "AI helper unavailable—write your own activities above.");
      } else if (Array.isArray(data.habits) && data.habits.length > 0) {
        setActivities(
          data.habits.map((h: { title: string; daily_target_mins?: number; scheduled_time?: string }) => ({
            id: crypto.randomUUID(),
            title: String(h.title || ""),
            daily_target_mins: Math.min(240, Math.max(5, Number(h.daily_target_mins || 30))),
            scheduled_time: String(h.scheduled_time || ""),
          }))
        );
      }
    } catch {
      setError("Could not reach AI helper—write your own activities above.");
    } finally {
      setAiLoading(false);
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    const validActs = activities.filter((a) => a.title.trim().length > 0);
    const validMiles = milestones.filter((m) => m.title.trim().length > 0);
    if (validActs.length === 0) return setError("Add at least one daily activity.");

    setSaving(true);
    setError(null);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setSaving(false);
      return setError("Session expired.");
    }

    if (validMiles.length > 0) {
      const { error: mErr } = await supabase.from("monk_milestones").insert(
        validMiles.map((m, idx) => ({
          user_id: user.id,
          goal_id: shortGoal.id,
          title: m.title.trim(),
          due_date: m.due_date || null,
          sort_order: idx,
        }))
      );
      if (mErr) {
        setSaving(false);
        return setError(mErr.message);
      }
    }

    const { error: aErr } = await supabase.from("monk_activities").insert(
      validActs.map((a, idx) => ({
        user_id: user.id,
        goal_id: shortGoal.id,
        title: a.title.trim(),
        daily_target_mins: Math.max(5, Number(a.daily_target_mins || 30)),
        scheduled_time: a.scheduled_time || null,
        sort_order: idx,
        is_active: true,
      }))
    );

    if (aErr) {
      setSaving(false);
      return setError(aErr.message);
    }

    await supabase
      .from("monk_profiles")
      .update({ onboarding_step: 3, updated_at: new Date().toISOString() })
      .eq("user_id", user.id);

    router.push("/");
    router.refresh();
  }

  return (
    <form onSubmit={handleSave} className="w-full max-w-xl bg-white border border-[#E2E7E4] rounded-3xl p-7 space-y-6">
      <div className="space-y-1">
        <div className="text-xs font-medium text-[#256453]">Step 2 of 2 · Your Daily Craft</div>
        <h1 className="text-xl font-semibold tracking-tight">{shortGoal.title}</h1>
        {longGoal && <p className="text-xs text-[#5B6863]">North Star: {longGoal.title}</p>}
      </div>

      {error && <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-xl p-3">{error}</div>}

      <div className="space-y-2.5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-[#17211E]">Milestones &amp; Checkpoints</span>
          <button type="button" onClick={() => setMilestones((p) => [...p, { id: crypto.randomUUID(), title: "", due_date: "" }])} className="text-xs font-medium text-[#256453] hover:underline">
            + Add checkpoint
          </button>
        </div>
        {milestones.map((m) => (
          <div key={m.id} className="grid grid-cols-12 gap-2 items-center">
            <input type="text" value={m.title} onChange={(e) => setMilestones((p) => p.map((x) => (x.id === m.id ? { ...x, title: e.target.value } : x)))} placeholder="e.g., Pass Mock Interview #2" className="col-span-7 px-3 py-2 text-xs rounded-xl border border-[#D8DFDB]" />
            <input type="date" value={m.due_date} onChange={(e) => setMilestones((p) => p.map((x) => (x.id === m.id ? { ...x, due_date: e.target.value } : x)))} className="col-span-4 px-2.5 py-2 text-xs rounded-xl border border-[#D8DFDB]" />
            <button type="button" onClick={() => setMilestones((p) => p.filter((x) => x.id !== m.id))} className="col-span-1 text-xs text-[#87948F] hover:text-red-700">✕</button>
          </div>
        ))}
      </div>

      <div className="space-y-2.5 pt-4 border-t border-[#EDF1EE]">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs font-semibold text-[#17211E]">Your Daily Activities</div>
            <p className="text-[11px] text-[#5B6863]">Write what you will show up for daily (leave time blank if flexible).</p>
          </div>
          <button type="button" onClick={() => setActivities((p) => [...p, { id: crypto.randomUUID(), title: "", daily_target_mins: 30, scheduled_time: "" }])} className="text-xs font-medium text-[#256453] hover:underline shrink-0">
            + Add activity
          </button>
        </div>

        {activities.map((a) => (
          <div key={a.id} className="grid grid-cols-12 gap-2 items-center">
            <input type="text" required value={a.title} onChange={(e) => setActivities((p) => p.map((x) => (x.id === a.id ? { ...x, title: e.target.value } : x)))} placeholder="e.g., 1 Zero-AI DSA Problem" className="col-span-6 px-3 py-2 text-xs rounded-xl border border-[#D8DFDB]" />
            <input type="number" min={5} max={360} value={a.daily_target_mins} onChange={(e) => setActivities((p) => p.map((x) => (x.id === a.id ? { ...x, daily_target_mins: Number(e.target.value || 30) } : x)))} className="col-span-2 px-2 py-2 text-xs text-center rounded-xl border border-[#D8DFDB]" />
            <input type="time" value={a.scheduled_time} onChange={(e) => setActivities((p) => p.map((x) => (x.id === a.id ? { ...x, scheduled_time: e.target.value } : x)))} className="col-span-3 px-2 py-2 text-xs rounded-xl border border-[#D8DFDB]" />
            <button type="button" onClick={() => setActivities((p) => p.filter((x) => x.id !== a.id))} className="col-span-1 text-xs text-[#87948F] hover:text-red-700">✕</button>
          </div>
        ))}

        <div className="pt-1">
          <button type="button" onClick={suggestIfStuck} disabled={aiLoading} className="text-[11px] text-[#5B6863] hover:text-[#256453] underline disabled:opacity-50">
            {aiLoading ? "Drafting starter ideas…" : "Not sure where to start? Suggest starter activities"}
          </button>
        </div>
      </div>

      <button type="submit" disabled={saving} className="w-full py-3 rounded-2xl bg-[#17211E] hover:bg-[#256453] text-white text-sm font-semibold transition disabled:opacity-50">
        {saving ? "Locking your rhythm…" : "Enter Daily Focus Widget →"}
      </button>
    </form>
  );
}
'@

# src/app/setup/page.tsx
Write-CleanFile -Path "src/app/setup/page.tsx" -Content @'
import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { SetupFlow } from "@/components/SetupFlow";
import type { CoreGoal } from "@/types/monk";

export default async function SetupPage() {
  const supabase = await createServerSupabaseClient();
  const { data: goals } = await supabase
    .from("monk_core_goals")
    .select("id, horizon, title, why_statement, target_hours, target_date")
    .eq("is_active", true);

  const list = (goals || []) as CoreGoal[];
  const shortGoal = list.find((g) => g.horizon === "short_term");
  const longGoal = list.find((g) => g.horizon === "long_term") ?? null;

  if (!shortGoal) redirect("/onboarding");

  return (
    <main className="min-h-screen bg-[#F6F7F5] text-[#17211E] flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-xl flex items-center justify-between mb-5 text-xs text-[#5B6863]">
        <span className="font-semibold text-[#17211E]">Monkthetics</span>
        <form action="/auth/signout" method="post">
          <button type="submit" className="underline hover:text-[#17211E]">Sign out</button>
        </form>
      </div>
      <SetupFlow shortGoal={shortGoal} longGoal={longGoal} />
    </main>
  );
}
'@

# src/components/DailyWidget.tsx
Write-CleanFile -Path "src/components/DailyWidget.tsx" -Content @'
"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import type { DailyActivity, WorkSession } from "@/types/monk";

interface DailyWidgetProps {
  displayName: string;
  shortGoalTitle: string;
  todayIso: string;
  activities: DailyActivity[];
  initialSessions: WorkSession[];
}

export function DailyWidget({
  displayName,
  shortGoalTitle,
  todayIso,
  activities,
  initialSessions,
}: DailyWidgetProps) {
  const [sessions, setSessions] = useState<Record<string, WorkSession>>(() => {
    const map: Record<string, WorkSession> = {};
    for (const s of initialSessions) map[s.activity_id] = s;
    return map;
  });

  const [nowMs, setNowMs] = useState(() => Date.now());
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editMins, setEditMins] = useState("");
  const [error, setError] = useState<string | null>(null);

  const runningAct = activities.find((a) => sessions[a.id]?.status === "running") ?? null;
  const pendingActs = activities.filter((a) => !sessions[a.id] || sessions[a.id].status === "running");
  const activeAct = runningAct ?? pendingActs[0] ?? null;
  const activeSession = activeAct ? sessions[activeAct.id] : null;
  const isRunning = activeSession?.status === "running" && Boolean(activeSession.started_at);

  useEffect(() => {
    if (!isRunning) return;
    const id = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(id);
  }, [isRunning]);

  const elapsedSecs =
    isRunning && activeSession?.started_at
      ? Math.max(0, Math.floor((nowMs - new Date(activeSession.started_at).getTime()) / 1000))
      : 0;

  async function startWork(act: DailyActivity) {
    setSaving(true);
    setError(null);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return setError("Session expired.");

    const startedAt = new Date().toISOString();
    const { data, error: dbErr } = await supabase
      .from("monk_sessions")
      .upsert(
        {
          user_id: user.id,
          activity_id: act.id,
          session_date: todayIso,
          started_at: startedAt,
          ended_at: null,
          status: "running",
          updated_at: startedAt,
        },
        { onConflict: "activity_id,session_date" }
      )
      .select("*")
      .single();

    setSaving(false);
    if (dbErr || !data) return setError(dbErr?.message || "Could not start session.");
    setNowMs(Date.now());
    setSessions((prev) => ({ ...prev, [act.id]: data as WorkSession }));
  }

  async function endWork(act: DailyActivity, finalStatus: "done" | "partly" | "skipped") {
    setSaving(true);
    setError(null);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return setError("Session expired.");

    const existing = sessions[act.id];
    const endedAt = new Date().toISOString();
    let mins = existing?.duration_mins || 0;

    if (finalStatus !== "skipped") {
      if (existing?.started_at) {
        const diffMins = Math.max(1, Math.round((Date.now() - new Date(existing.started_at).getTime()) / 60000));
        mins = mins + diffMins;
      } else {
        mins = finalStatus === "done" ? act.daily_target_mins : Math.max(5, Math.round(act.daily_target_mins * 0.5));
      }
    }

    const { data, error: dbErr } = await supabase
      .from("monk_sessions")
      .upsert(
        {
          user_id: user.id,
          activity_id: act.id,
          session_date: todayIso,
          started_at: existing?.started_at || endedAt,
          ended_at: endedAt,
          duration_mins: mins,
          status: finalStatus,
          updated_at: endedAt,
        },
        { onConflict: "activity_id,session_date" }
      )
      .select("*")
      .single();

    setSaving(false);
    if (dbErr || !data) return setError(dbErr?.message || "Could not save session.");
    setSessions((prev) => ({ ...prev, [act.id]: data as WorkSession }));
  }

  async function saveManualTime(actId: string) {
    const mins = Math.max(0, Math.min(720, Math.round(Number(editMins || 0))));
    setSaving(true);
    setError(null);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return setError("Session expired.");

    const act = activities.find((a) => a.id === actId);
    const status: WorkSession["status"] =
      mins === 0 ? "skipped" : act && mins >= act.daily_target_mins ? "done" : "partly";

    const { data, error: dbErr } = await supabase
      .from("monk_sessions")
      .upsert(
        {
          user_id: user.id,
          activity_id: actId,
          session_date: todayIso,
          duration_mins: mins,
          status,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "activity_id,session_date" }
      )
      .select("*")
      .single();

    setSaving(false);
    if (dbErr || !data) return setError(dbErr?.message || "Could not update time.");
    setSessions((prev) => ({ ...prev, [actId]: data as WorkSession }));
    setEditingId(null);
  }

  const mm = String(Math.floor(elapsedSecs / 60)).padStart(2, "0");
  const ss = String(elapsedSecs % 60).padStart(2, "0");
  const totalTodayMins = Object.values(sessions).reduce((s, x) => s + (x.duration_mins || 0), 0);

  return (
    <div className="w-full max-w-md space-y-5">
      {!activeAct ? (
        <div className="bg-white border border-[#E2E7E4] rounded-3xl p-8 text-center space-y-4">
          <div className="w-12 h-12 mx-auto rounded-full bg-[#E8F2EE] text-[#256453] flex items-center justify-center text-lg font-semibold">✓</div>
          <h1 className="text-xl font-semibold">Done for today, {displayName}.</h1>
          <p className="text-sm text-[#5B6863]">
            Total captured today: <strong>{totalTodayMins} min</strong> toward{" "}
            <span className="text-[#17211E] font-medium">{shortGoalTitle}</span>.
          </p>
        </div>
      ) : (
        <div className="bg-white border border-[#E2E7E4] rounded-3xl p-8 text-center space-y-6">
          <div className="space-y-1">
            <div className="text-xs font-mono text-[#5B6863]">
              {activeAct.scheduled_time ? activeAct.scheduled_time.slice(0, 5) : "Flexible"} · Target {activeAct.daily_target_mins}m
            </div>
            <div className="text-xs font-medium text-[#256453]">{shortGoalTitle}</div>
          </div>

          <h1 className="text-2xl font-semibold tracking-tight text-[#17211E] py-1">{activeAct.title}</h1>

          {isRunning && (
            <div className="space-y-1">
              <div className="font-mono text-4xl font-bold text-[#17211E] tracking-tight">{mm}:{ss}</div>
              <div className="text-[11px] text-[#256453]">Running safely in background</div>
            </div>
          )}

          {error && <div className="text-xs text-red-700 bg-red-50 rounded-xl p-2.5">{error}</div>}

          {!isRunning ? (
            <div className="space-y-2.5 pt-2">
              <button type="button" disabled={saving} onClick={() => startWork(activeAct)} className="w-full py-3.5 rounded-2xl bg-[#17211E] hover:bg-[#256453] text-white text-sm font-semibold transition">
                Start Activity
              </button>
              <div className="grid grid-cols-2 gap-2">
                <button type="button" disabled={saving} onClick={() => endWork(activeAct, "done")} className="py-2.5 rounded-xl bg-[#E8F2EE] text-[#256453] text-xs font-semibold">
                  Mark Done ({activeAct.daily_target_mins}m)
                </button>
                <button type="button" disabled={saving} onClick={() => endWork(activeAct, "skipped")} className="py-2.5 rounded-xl border border-[#D8DFDB] text-[#5B6863] text-xs font-medium">
                  Skip Today
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-2.5 pt-2">
              <button type="button" disabled={saving} onClick={() => endWork(activeAct, "done")} className="w-full py-3.5 rounded-2xl bg-[#256453] hover:bg-[#1C4D40] text-white text-sm font-semibold transition">
                End &amp; Save as Done
              </button>
              <button type="button" disabled={saving} onClick={() => endWork(activeAct, "partly")} className="w-full py-2.5 rounded-xl bg-[#F2F5F3] text-[#17211E] text-xs font-semibold">
                End as Partly Done
              </button>
            </div>
          )}
        </div>
      )}

      <div className="bg-white border border-[#E2E7E4] rounded-2xl p-4 space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="font-semibold text-[#17211E]">Today&apos;s Activities (Edit Time)</span>
          <span className="font-mono text-[#256453]">{totalTodayMins} min total</span>
        </div>

        <div className="divide-y divide-[#EDF1EE]">
          {activities.map((a) => {
            const s = sessions[a.id];
            const isEditing = editingId === a.id;
            return (
              <div key={a.id} className="py-2.5 flex items-center justify-between gap-2 text-xs">
                <div className="min-w-0">
                  <div className="font-medium text-[#17211E] truncate">{a.title}</div>
                  <div className="text-[11px] text-[#5B6863]">
                    {a.scheduled_time ? a.scheduled_time.slice(0, 5) : "Anytime"} · {s ? s.status : "pending"}
                  </div>
                </div>

                {isEditing ? (
                  <div className="flex items-center gap-1.5 shrink-0">
                    <input type="number" min={0} max={720} value={editMins} onChange={(e) => setEditMins(e.target.value)} className="w-16 px-2 py-1 text-xs text-center rounded-lg border border-[#D8DFDB]" />
                    <button type="button" onClick={() => saveManualTime(a.id)} className="px-2.5 py-1 rounded-lg bg-[#17211E] text-white text-[11px] font-semibold">Save</button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setEditingId(a.id);
                      setEditMins(String(s?.duration_mins ?? a.daily_target_mins));
                    }}
                    className="font-mono px-2.5 py-1 rounded-lg bg-[#F4F6F5] hover:bg-[#E8F2EE] text-[#17211E] shrink-0"
                  >
                    {s?.duration_mins ?? 0}m ✎
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
'@

# src/app/page.tsx
Write-CleanFile -Path "src/app/page.tsx" -Content @'
import Link from "next/link";
import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { DailyWidget } from "@/components/DailyWidget";
import type { CoreGoal, DailyActivity, WorkSession } from "@/types/monk";

export default async function HomePage() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("monk_profiles")
    .select("display_name, onboarding_step")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!profile || profile.onboarding_step < 2) redirect("/onboarding");
  if (profile.onboarding_step < 3) redirect("/setup");

  const todayIso = new Date().toISOString().slice(0, 10);

  const [gRes, aRes, sRes] = await Promise.all([
    supabase.from("monk_core_goals").select("id, horizon, title, why_statement, target_hours, target_date").eq("is_active", true),
    supabase.from("monk_activities").select("id, goal_id, title, scheduled_time, daily_target_mins").eq("is_active", true).order("scheduled_time", { ascending: true, nullsFirst: false }),
    supabase.from("monk_sessions").select("id, activity_id, session_date, started_at, ended_at, duration_mins, status").eq("session_date", todayIso),
  ]);

  const goals = (gRes.data || []) as CoreGoal[];
  const shortGoal = goals.find((g) => g.horizon === "short_term");
  const activities = (aRes.data || []) as DailyActivity[];
  if (!shortGoal) redirect("/onboarding");
  if (!activities.length) redirect("/setup");

  return (
    <main className="min-h-screen bg-[#F6F7F5] text-[#17211E] flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-md flex items-center justify-between mb-6 text-xs text-[#5B6863]">
        <span className="font-semibold text-[#17211E]">Monkthetics</span>
        <div className="flex items-center gap-4">
          <Link href="/insights" className="font-medium hover:text-[#17211E]">Insights</Link>
          <Link href="/setup" className="hover:text-[#17211E]">Edit Plan</Link>
          <form action="/auth/signout" method="post">
            <button type="submit" className="underline hover:text-[#17211E]">Sign out</button>
          </form>
        </div>
      </div>

      <DailyWidget
        displayName={profile.display_name || "Builder"}
        shortGoalTitle={shortGoal.title}
        todayIso={todayIso}
        activities={activities}
        initialSessions={(sRes.data || []) as WorkSession[]}
      />
    </main>
  );
}
'@

# src/components/MilestoneChecklist.tsx
Write-CleanFile -Path "src/components/MilestoneChecklist.tsx" -Content @'
"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Milestone } from "@/types/monk";

export function MilestoneChecklist({ initial }: { initial: Milestone[] }) {
  const [items, setItems] = useState<Milestone[]>(initial);

  async function toggle(id: string) {
    const target = items.find((m) => m.id === id);
    if (!target) return;
    const next = !target.is_completed;
    setItems((prev) => prev.map((m) => (m.id === id ? { ...m, is_completed: next } : m)));

    const supabase = createClient();
    await supabase
      .from("monk_milestones")
      .update({ is_completed: next, completed_at: next ? new Date().toISOString() : null })
      .eq("id", id);
  }

  if (!items.length) return <p className="text-xs text-[#5B6863]">No checkpoints added yet.</p>;

  return (
    <div className="divide-y divide-[#EDF1EE]">
      {items.map((m) => (
        <button key={m.id} type="button" onClick={() => toggle(m.id)} className="w-full py-2.5 flex items-center justify-between gap-3 text-left text-xs">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className={`w-4 h-4 rounded-md border flex items-center justify-center shrink-0 text-[10px] ${m.is_completed ? "bg-[#256453] border-[#256453] text-white" : "border-[#9AA8A2]"}`}>
              {m.is_completed ? "✓" : ""}
            </span>
            <span className={m.is_completed ? "line-through text-[#87948F]" : "text-[#17211E] font-medium"}>{m.title}</span>
          </div>
          {m.due_date && <span className="font-mono text-[11px] text-[#5B6863] shrink-0">{m.due_date}</span>}
        </button>
      ))}
    </div>
  );
}
'@

# src/app/insights/page.tsx
Write-CleanFile -Path "src/app/insights/page.tsx" -Content @'
import Link from "next/link";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { MilestoneChecklist } from "@/components/MilestoneChecklist";
import type { CoreGoal, Milestone } from "@/types/monk";

function predictGoal(goal: CoreGoal, loggedHrs: number, weeklyPaceHrs: number) {
  const remainingHrs = Math.max(0, Number(goal.target_hours) - loggedHrs);
  const pct = Math.min(100, Math.round((loggedHrs / Math.max(1, Number(goal.target_hours))) * 100));

  const today = new Date();
  const target = new Date(goal.target_date + "T00:00:00");
  const daysLeft = Math.max(1, Math.ceil((target.getTime() - today.getTime()) / 86400000));
  const requiredPerWeek = (remainingHrs / daysLeft) * 7;

  let eta = "Log 2+ days to calculate prediction";
  let status: "Achieved" | "On Track" | "Behind Pace" = "On Track";

  if (remainingHrs === 0) {
    eta = "Goal hours achieved";
    status = "Achieved";
  } else if (weeklyPaceHrs >= 0.5) {
    const daysNeeded = Math.ceil((remainingHrs / weeklyPaceHrs) * 7);
    const predDate = new Date();
    predDate.setDate(predDate.getDate() + daysNeeded);
    eta = `Predicted finish: ${predDate.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })} (${daysNeeded}d at ${weeklyPaceHrs.toFixed(1)}h/wk)`;
    status = weeklyPaceHrs >= requiredPerWeek * 0.9 ? "On Track" : "Behind Pace";
  } else {
    status = "Behind Pace";
  }

  return { pct, remainingHrs, requiredPerWeek, eta, status };
}

export default async function InsightsPage() {
  const supabase = await createServerSupabaseClient();

  const [gRes, mRes, sRes] = await Promise.all([
    supabase.from("monk_core_goals").select("*").eq("is_active", true),
    supabase.from("monk_milestones").select("id, goal_id, title, due_date, is_completed").order("sort_order", { ascending: true }),
    supabase.from("monk_sessions").select("session_date, duration_mins, status, monk_activities(scheduled_time)").order("session_date", { ascending: false }).limit(180),
  ]);

  const goals = (gRes.data || []) as CoreGoal[];
  const milestones = (mRes.data || []) as Milestone[];
  const sessions = sRes.data || [];

  const totalHrs = sessions.reduce((s, r) => s + Number(r.duration_mins || 0), 0) / 60;

  const sevenDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    const iso = d.toISOString().slice(0, 10);
    const mins = sessions.filter((r) => r.session_date === iso).reduce((s, r) => s + Number(r.duration_mins || 0), 0);
    return { iso, label: d.toLocaleDateString("en-US", { weekday: "short" }), mins };
  });
  const weeklyPaceHrs = sevenDays.reduce((s, d) => s + d.mins, 0) / 60;
  const maxDayMins = Math.max(60, ...sevenDays.map((d) => d.mins));

  const slotMins: Record<string, number> = { Morning: 0, Afternoon: 0, Evening: 0, Flexible: 0 };
  for (const r of sessions) {
    const meta = Array.isArray(r.monk_activities) ? r.monk_activities[0] : r.monk_activities;
    const t = meta?.scheduled_time ? Number(String(meta.scheduled_time).slice(0, 2)) : -1;
    const bucket = t < 0 ? "Flexible" : t < 12 ? "Morning" : t < 17 ? "Afternoon" : "Evening";
    slotMins[bucket] += Number(r.duration_mins || 0);
  }
  const peakSlot = Object.entries(slotMins).sort((a, b) => b[1] - a[1])[0]?.[0] || "Morning";

  return (
    <main className="min-h-screen bg-[#F6F7F5] text-[#17211E] flex flex-col items-center p-6 pt-8 pb-16">
      <div className="w-full max-w-2xl space-y-5">
        <div className="flex items-center justify-between text-xs text-[#5B6863]">
          <Link href="/" className="font-semibold text-[#17211E] hover:underline">← Back to Daily Widget</Link>
          <div className="flex items-center gap-4">
            <a href="/api/excel/export" className="font-semibold text-[#256453] hover:underline">Export .xlsx</a>
            <Link href="/onboarding" className="hover:text-[#17211E]">Reset Goals</Link>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {goals.map((g) => {
            const pred = predictGoal(g, totalHrs, weeklyPaceHrs);
            return (
              <div key={g.id} className="bg-white border border-[#E2E7E4] rounded-3xl p-5 space-y-3">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="font-semibold uppercase tracking-wide text-[#5B6863]">
                    {g.horizon === "short_term" ? "Short-Term Goal" : "Long-Term Goal"}
                  </span>
                  <span className={`px-2 py-0.5 rounded-full font-semibold ${pred.status === "Behind Pace" ? "bg-[#FCECEC] text-[#B43E3E]" : "bg-[#E8F2EE] text-[#256453]"}`}>
                    {pred.status}
                  </span>
                </div>
                <h2 className="text-base font-semibold">{g.title}</h2>
                <div className="w-full h-2 rounded-full bg-[#E8EDE9] overflow-hidden">
                  <div className="h-full bg-[#256453] rounded-full" style={{ width: `${pred.pct}%` }} />
                </div>
                <div className="text-xs text-[#36433E]">{pred.eta}</div>
                <div className="text-[11px] text-[#5B6863]">
                  Need {pred.requiredPerWeek.toFixed(1)}h/wk · Target date {g.target_date}
                </div>
              </div>
            );
          })}
        </div>

        <div className="bg-white border border-[#E2E7E4] rounded-3xl p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-semibold">This Week&apos;s Productivity ({weeklyPaceHrs.toFixed(1)} hrs)</h2>
              <p className="text-xs text-[#5B6863]">
                Strongest working window: <strong className="text-[#17211E]">{peakSlot}</strong>
              </p>
            </div>
            <span className="font-mono text-xs px-2.5 py-1 rounded-full bg-[#E8F2EE] text-[#256453]">
              {totalHrs.toFixed(1)} hrs total
            </span>
          </div>

          <div className="grid grid-cols-7 gap-3 items-end h-36 pt-3">
            {sevenDays.map((d) => (
              <div key={d.iso} className="flex flex-col items-center gap-1.5 h-full justify-end">
                <span className="text-[10px] font-mono text-[#5B6863]">{d.mins}m</span>
                <div className="w-full max-w-[36px] h-24 bg-[#EDF1EE] rounded-lg overflow-hidden flex items-end">
                  <div className="w-full bg-[#256453] rounded-lg" style={{ height: `${Math.max(4, Math.round((d.mins / maxDayMins) * 100))}%` }} />
                </div>
                <span className="text-[11px] text-[#5B6863]">{d.label}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white border border-[#E2E7E4] rounded-3xl p-6 space-y-3">
          <h2 className="text-sm font-semibold">Goal Milestones &amp; Checkpoints</h2>
          <MilestoneChecklist initial={milestones} />
        </div>
      </div>
    </main>
  );
}
'@

Write-Host "`n=== Clean Rebuild Complete (19 unified files) ===" -ForegroundColor Cyan
Write-Host "Now run:" -ForegroundColor Yellow
Write-Host "  npm run build"
Write-Host "  git add -A && git commit -m 'Clean unified Monkthetics 4-flow app' && git push"
