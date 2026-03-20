'use client';

export const dynamic = 'force-dynamic';

import { useState } from 'react';
import Link from 'next/link';
import { useRequireAuth } from '@/lib/AuthContext';

function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}

export default function Dashboard() {
  const { user, loading } = useRequireAuth();
  const [season, setSeason] = useState<string>('2026');
  const [eventCode, setEventCode] = useState<string>('');
  const [status, setStatus] = useState<string>('');

  if (loading || !user) {
    return (
      <div className="p-6">
        <p>{loading ? 'Loading...' : 'Not signed in.'}</p>
        {!loading && <Link href="/login">Go to Login</Link>}
      </div>
    );
  }

  async function importEvents() {
    setStatus('Importing events...');
    try {
      const res = await fetch(`/api/tba/events?season=${encodeURIComponent(season)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Failed');
      setStatus(`Imported/updated ${data.count} events for ${season}.`);
    } catch (e) {
      setStatus(`Error: ${errorMessage(e)}`);
    }
  }

  async function importMatches() {
    if (!eventCode) {
      setStatus('Enter an event code (e.g., 2026miket)');
      return;
    }
    setStatus(`Importing matches for ${eventCode}...`);
    try {
      const res = await fetch(`/api/tba/events/${encodeURIComponent(eventCode)}/matches`, {
        method: 'POST',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Failed');
      setStatus(`Imported/updated ${data.imported} matches for ${eventCode}.`);
    } catch (e) {
      setStatus(`Error: ${errorMessage(e)}`);
    }
  }

  return (
    <div className="p-6">
      <h1>Welcome</h1>
      <p>Signed in as {user.displayName}</p>
      <div className="mt-6 grid gap-3 max-w-2xl">
        <h2>Navigation</h2>
        <div className="flex gap-3 flex-wrap">
          <Link href="/scout" className="px-3 py-2 rounded-md bg-blue-600 text-white font-medium hover:bg-blue-700">Go to Scouting Form</Link>
          <Link href="/analysis" className="px-3 py-2 rounded-md bg-blue-600 text-white font-medium hover:bg-blue-700">View Analysis</Link>
          <Link href="/form-builder" className="px-3 py-2 rounded-md bg-blue-600 text-white font-medium hover:bg-blue-700">Build/Edit Scouting Form</Link>
        </div>

        <hr className="my-4 border-zinc-200 dark:border-zinc-700" />

        <h2>TBA Imports</h2>
        <label className="grid gap-1.5">
          <span>Season</span>
          <input
            value={season}
            onChange={(e) => setSeason(e.target.value)}
            placeholder="2026"
            className="px-2 py-1.5 border border-zinc-300 dark:border-zinc-600 rounded-md bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
          />
        </label>
        <button onClick={importEvents} className="px-3 py-2 rounded-md bg-blue-600 text-white font-medium hover:bg-blue-700">
          Import events for season
        </button>

        <label className="grid gap-1.5">
          <span>Event code (e.g., 2026miket)</span>
          <input
            value={eventCode}
            onChange={(e) => setEventCode(e.target.value)}
            placeholder="2026miket"
            className="px-2 py-1.5 border border-zinc-300 dark:border-zinc-600 rounded-md bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
          />
        </label>
        <button onClick={importMatches} className="px-3 py-2 rounded-md bg-blue-600 text-white font-medium hover:bg-blue-700">
          Import matches for event
        </button>

        <div className="text-zinc-500 dark:text-zinc-400">{status}</div>

        <div className="mt-4">
          <Link href="/">Home</Link>
        </div>
      </div>
    </div>
  );
}

