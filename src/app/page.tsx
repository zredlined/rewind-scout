"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function Home() {
  const router = useRouter();
  useEffect(() => {
    try {
      const ce = localStorage.getItem("currentEventCode");
      router.replace(ce ? "/scout" : "/check-in");
    } catch {
      router.replace("/check-in");
    }
  }, [router]);
  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 font-sans dark:bg-black">
      <main className="flex min-h-screen w-full max-w-3xl flex-col items-start justify-center gap-6 py-24 px-8 bg-white dark:bg-black">
        <h1 className="text-3xl font-semibold tracking-tight text-black dark:text-zinc-50">Loading…</h1>
        <p className="text-zinc-600 dark:text-zinc-400">Redirecting you…</p>
      </main>
    </div>
  );
}
