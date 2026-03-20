'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { supabase } from '@/lib/supabase';

function getStoredCurrentEventCode(): string {
  if (typeof window === 'undefined') return '';
  try {
    return localStorage.getItem('currentEventCode') || '';
  } catch {
    return '';
  }
}

function getStoredCurrentEventName(): string {
  if (typeof window === 'undefined') return '';
  try {
    return localStorage.getItem('currentEventName') || '';
  } catch {
    return '';
  }
}

export default function Header() {
  const { user, logout } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [currentEventCode, setCurrentEventCode] = useState('');
  const [currentEventName, setCurrentEventName] = useState('');

  useEffect(() => {
    const refreshCurrentEvent = () => {
      setCurrentEventCode(getStoredCurrentEventCode());
      setCurrentEventName(getStoredCurrentEventName());
    };
    refreshCurrentEvent();
    window.addEventListener('storage', refreshCurrentEvent);
    window.addEventListener('focus', refreshCurrentEvent);
    window.addEventListener('current-event-changed', refreshCurrentEvent);
    return () => {
      window.removeEventListener('storage', refreshCurrentEvent);
      window.removeEventListener('focus', refreshCurrentEvent);
      window.removeEventListener('current-event-changed', refreshCurrentEvent);
    };
  }, []);

  useEffect(() => {
    async function hydrateEventName() {
      if (!currentEventCode || currentEventName) return;
      const { data, error } = await supabase
        .from('events')
        .select('name')
        .eq('code', currentEventCode)
        .maybeSingle<{ name: string | null }>();
      if (error) return;
      const name = data?.name || '';
      if (!name) return;
      setCurrentEventName(name);
      try {
        localStorage.setItem('currentEventName', name);
      } catch {}
    }
    void hydrateEventName();
  }, [currentEventCode, currentEventName]);

  const initials = useMemo(() => {
    if (!user) return '';
    const parts = user.displayName.trim().split(/\s+/);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return user.displayName.slice(0, 2).toUpperCase();
  }, [user]);

  const currentEventLabel = currentEventName || currentEventCode;

  return (
    <header className="sticky top-0 z-10 border-b bg-white/90 backdrop-blur dark:bg-black/90">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
        <div className="flex min-w-0 items-center gap-3">
          <button className="md:hidden p-2 border rounded" onClick={() => setMobileOpen((v) => !v)} aria-label="Toggle menu">☰</button>
          <Link href="/" className="font-semibold">FRC Scouting</Link>
          <nav className="hidden md:flex items-center gap-3">
            <Link href="/scout" className="px-2 py-1 rounded hover:bg-zinc-100 dark:hover:bg-zinc-900">Match Scouting</Link>
            <Link href="/pit" className="px-2 py-1 rounded hover:bg-zinc-100 dark:hover:bg-zinc-900">Pit Scouting</Link>
            <div className="relative">
              <button className="px-2 py-1 rounded border" onClick={() => setMoreOpen((v) => !v)}>More ▾</button>
              {moreOpen && (
                <div className="absolute mt-2 w-56 rounded border bg-white shadow dark:bg-black">
                  <Link href="/check-in" className="block px-3 py-2 hover:bg-zinc-100 dark:hover:bg-zinc-900" onClick={() => setMoreOpen(false)}>
                    <span className="mr-2">📍</span>Check-in
                  </Link>
                  <Link href="/form-builder" className="block px-3 py-2 hover:bg-zinc-100 dark:hover:bg-zinc-900" onClick={() => setMoreOpen(false)}>
                    <span className="mr-2">📝</span>Match Form Builder
                  </Link>
                  <Link href="/pit/form-builder" className="block px-3 py-2 hover:bg-zinc-100 dark:hover:bg-zinc-900" onClick={() => setMoreOpen(false)}>
                    <span className="mr-2">🛠️</span>Pit Form Builder
                  </Link>
                  <Link href="/analysis" className="block px-3 py-2 hover:bg-zinc-100 dark:hover:bg-zinc-900" onClick={() => setMoreOpen(false)}>
                    <span className="mr-2">📊</span>Analysis
                  </Link>
                  <Link href="/leaderboard" className="block px-3 py-2 hover:bg-zinc-100 dark:hover:bg-zinc-900" onClick={() => setMoreOpen(false)}>
                    <span className="mr-2">🏆</span>Leaderboard
                  </Link>
                  <Link href="/me" className="block px-3 py-2 hover:bg-zinc-100 dark:hover:bg-zinc-900" onClick={() => setMoreOpen(false)}>
                    <span className="mr-2">🙋</span>Scouts
                  </Link>
                  <Link href="/team" className="block px-3 py-2 hover:bg-zinc-100 dark:hover:bg-zinc-900" onClick={() => setMoreOpen(false)}>
                    <span className="mr-2">👥</span>Team
                  </Link>
                </div>
              )}
            </div>
          </nav>
        </div>
        <div className="flex items-center gap-3">
          <div className="hidden lg:flex items-center gap-2 rounded-full border px-3 py-1 text-sm">
            <span className="text-zinc-500">Event</span>
            {currentEventLabel ? (
              <>
                <span className="max-w-56 truncate font-medium" title={currentEventLabel}>{currentEventLabel}</span>
                <Link href="/check-in" className="text-blue-600 hover:underline">
                  Switch
                </Link>
              </>
            ) : (
              <Link href="/check-in" className="font-medium text-amber-700 hover:underline">
                Check in
              </Link>
            )}
          </div>
          {user ? (
            <>
              <Link href="/team" className="w-8 h-8 rounded-full bg-zinc-200 dark:bg-zinc-800 flex items-center justify-center text-xs">{initials}</Link>
              <button onClick={logout} className="px-3 py-1 rounded border">Log out</button>
            </>
          ) : (
            <Link href="/login" className="px-3 py-1 rounded border">Login</Link>
          )}
        </div>
      </div>
      <div className="border-t px-4 py-2 lg:hidden">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 text-sm">
          <div className="min-w-0 truncate">
            <span className="text-zinc-500">Current event: </span>
            <span className="font-medium">{currentEventLabel || 'Not checked in'}</span>
          </div>
          <Link href="/check-in" className="shrink-0 rounded border px-2 py-1">
            {currentEventLabel ? 'Switch' : 'Check in'}
          </Link>
        </div>
      </div>
      {mobileOpen && (
        <div className="md:hidden border-t px-4 pb-3">
          <nav className="flex flex-col gap-2 py-3">
            <Link href="/scout" className="px-2 py-2 rounded hover:bg-zinc-100 dark:hover:bg-zinc-900" onClick={() => setMobileOpen(false)}>📝 Match Scouting</Link>
            <Link href="/pit" className="px-2 py-2 rounded hover:bg-zinc-100 dark:hover:bg-zinc-900" onClick={() => setMobileOpen(false)}>🛠️ Pit Scouting</Link>
            <Link href="/analysis" className="px-2 py-2 rounded hover:bg-zinc-100 dark:hover:bg-zinc-900" onClick={() => setMobileOpen(false)}>📊 Analysis</Link>
            <Link href="/check-in" className="px-2 py-2 rounded hover:bg-zinc-100 dark:hover:bg-zinc-900" onClick={() => setMobileOpen(false)}>📍 Check-in</Link>
            <Link href="/form-builder" className="px-2 py-2 rounded hover:bg-zinc-100 dark:hover:bg-zinc-900" onClick={() => setMobileOpen(false)}>📝 Match Form Builder</Link>
            <Link href="/pit/form-builder" className="px-2 py-2 rounded hover:bg-zinc-100 dark:hover:bg-zinc-900" onClick={() => setMobileOpen(false)}>🛠️ Pit Form Builder</Link>
            <Link href="/leaderboard" className="px-2 py-2 rounded hover:bg-zinc-100 dark:hover:bg-zinc-900" onClick={() => setMobileOpen(false)}>🏆 Leaderboard</Link>
            <Link href="/me" className="px-2 py-2 rounded hover:bg-zinc-100 dark:hover:bg-zinc-900" onClick={() => setMobileOpen(false)}>🙋 Scouts</Link>
            <Link href="/team" className="px-2 py-2 rounded hover:bg-zinc-100 dark:hover:bg-zinc-900" onClick={() => setMobileOpen(false)}>👥 Team</Link>
          </nav>
        </div>
      )}
    </header>
  );
}
