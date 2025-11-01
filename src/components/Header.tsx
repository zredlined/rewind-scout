'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';

export default function Header() {
  const [email, setEmail] = useState<string | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);

  useEffect(() => {
    let mounted = true;
    supabase.auth.getUser().then(({ data }) => {
      if (!mounted) return;
      setEmail(data.user?.email ?? null);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setEmail(session?.user?.email ?? null);
    });
    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  async function logout() {
    await supabase.auth.signOut();
  }

  const initials = useMemo(() => {
    if (!email) return '';
    const name = email.split('@')[0];
    return name.slice(0, 2).toUpperCase();
  }, [email]);

  return (
    <header className="sticky top-0 z-10 border-b bg-white/90 backdrop-blur dark:bg-black/90">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
        <div className="flex items-center gap-3">
          <button className="md:hidden p-2 border rounded" onClick={() => setMobileOpen((v) => !v)} aria-label="Toggle menu">☰</button>
          <Link href="/" className="font-semibold">FRC Scouting</Link>
          <nav className="hidden md:flex items-center gap-3">
            <Link href="/scout" className="px-2 py-1 rounded hover:bg-zinc-100 dark:hover:bg-zinc-900">Scout</Link>
            <Link href="/analysis" className="px-2 py-1 rounded hover:bg-zinc-100 dark:hover:bg-zinc-900">Analysis</Link>
            <div className="relative">
              <button className="px-2 py-1 rounded border" onClick={() => setMoreOpen((v) => !v)}>More ▾</button>
              {moreOpen && (
                <div className="absolute mt-2 w-40 rounded border bg-white shadow dark:bg-black">
                  <Link href="/check-in" className="block px-3 py-2 hover:bg-zinc-100 dark:hover:bg-zinc-900" onClick={() => setMoreOpen(false)}>Check-in</Link>
                  <Link href="/form-builder" className="block px-3 py-2 hover:bg-zinc-100 dark:hover:bg-zinc-900" onClick={() => setMoreOpen(false)}>Form Builder</Link>
                  <Link href="/leaderboard" className="block px-3 py-2 hover:bg-zinc-100 dark:hover:bg-zinc-900" onClick={() => setMoreOpen(false)}>Leaderboard</Link>
                  <Link href="/me" className="block px-3 py-2 hover:bg-zinc-100 dark:hover:bg-zinc-900" onClick={() => setMoreOpen(false)}>Me</Link>
                </div>
              )}
            </div>
          </nav>
        </div>
        <div className="flex items-center gap-3">
          {email ? (
            <>
              <Link href="/me" className="w-8 h-8 rounded-full bg-zinc-200 dark:bg-zinc-800 flex items-center justify-center text-xs">{initials}</Link>
              <button onClick={logout} className="px-3 py-1 rounded border">Log out</button>
            </>
          ) : (
            <Link href="/login" className="px-3 py-1 rounded border">Login</Link>
          )}
        </div>
      </div>
      {mobileOpen && (
        <div className="md:hidden border-t px-4 pb-3">
          <nav className="flex flex-col gap-2 py-3">
            <Link href="/scout" className="px-2 py-2 rounded hover:bg-zinc-100 dark:hover:bg-zinc-900" onClick={() => setMobileOpen(false)}>Scout</Link>
            <Link href="/analysis" className="px-2 py-2 rounded hover:bg-zinc-100 dark:hover:bg-zinc-900" onClick={() => setMobileOpen(false)}>Analysis</Link>
            <Link href="/check-in" className="px-2 py-2 rounded hover:bg-zinc-100 dark:hover:bg-zinc-900" onClick={() => setMobileOpen(false)}>Check-in</Link>
            <Link href="/form-builder" className="px-2 py-2 rounded hover:bg-zinc-100 dark:hover:bg-zinc-900" onClick={() => setMobileOpen(false)}>Form Builder</Link>
            <Link href="/leaderboard" className="px-2 py-2 rounded hover:bg-zinc-100 dark:hover:bg-zinc-900" onClick={() => setMobileOpen(false)}>Leaderboard</Link>
            <Link href="/me" className="px-2 py-2 rounded hover:bg-zinc-100 dark:hover:bg-zinc-900" onClick={() => setMobileOpen(false)}>Me</Link>
          </nav>
        </div>
      )}
    </header>
  );
}


