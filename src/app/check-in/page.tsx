'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { useRequireAuth } from '@/lib/AuthContext';

type TbaEvent = { code: string; name: string; start_date?: string | null; end_date?: string | null };

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

function getInitialSeason(): number {
  const currentYear = new Date().getFullYear();
  const code = getStoredCurrentEventCode();
  if (code && /^\d{4}/.test(code)) return parseInt(code.slice(0, 4), 10);
  return currentYear;
}

function dayStamp(value: Date): number {
  return Date.UTC(value.getFullYear(), value.getMonth(), value.getDate());
}

function eventDistance(event: TbaEvent): number {
  const today = dayStamp(new Date());
  const start = event.start_date ? dayStamp(new Date(event.start_date)) : Number.POSITIVE_INFINITY;
  const end = event.end_date ? dayStamp(new Date(event.end_date)) : start;
  if (today >= start && today <= end) return -1;
  if (today < start) return start - today;
  return today - end;
}

function formatEventDate(event: TbaEvent): string {
  if (!event.start_date) return 'Date unavailable';
  const start = new Date(`${event.start_date}T12:00:00`);
  const end = event.end_date ? new Date(`${event.end_date}T12:00:00`) : null;
  const fmt = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' });
  if (!end || event.start_date === event.end_date) return fmt.format(start);
  return `${fmt.format(start)} - ${fmt.format(end)}`;
}

export default function CheckInPage() {
  useRequireAuth();
  const [season, setSeason] = useState<number>(getInitialSeason);
  const [events, setEvents] = useState<TbaEvent[]>([]);
  const [search, setSearch] = useState<string>('');
  const [status, setStatus] = useState<string>('');
  const [currentEventCode, setCurrentEventCode] = useState<string>('');
  const [currentEventName, setCurrentEventName] = useState<string>('');
  const router = useRouter();

  useEffect(() => {
    setCurrentEventCode(getStoredCurrentEventCode());
    setCurrentEventName(getStoredCurrentEventName());
  }, []);

  useEffect(() => {
    loadEvents();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [season]);

  async function loadEvents() {
    setStatus('Loading events...');
    const res = await fetch(`/api/tba/events?season=${encodeURIComponent(String(season))}`);
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setStatus(`Error: ${d?.error || res.statusText}`);
      return;
    }
    // fetch from our DB after import to list; already filtered by season using prefix
    const { data, error } = await supabase.from('events').select('code,name,start_date,end_date');
    if (error) { setStatus(`Error: ${error.message}`); return; }
    const prefix = String(season);
    const rows = ((data as TbaEvent[] | null) || [])
      .filter((e) => (e.code || '').startsWith(prefix))
      .sort((a, b) => eventDistance(a) - eventDistance(b) || (a.start_date || '').localeCompare(b.start_date || '') || a.name.localeCompare(b.name));
    setEvents(rows);
    setStatus('');
  }

  async function chooseEvent(code: string, name: string) {
    setStatus('Importing matches...');
    const res = await fetch(`/api/tba/events/${encodeURIComponent(code)}/matches`, { method: 'POST' });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      console.error('Match import failed', d);
      setStatus(`Match import failed: ${d?.error || res.statusText}`);
      return;
    }
    setStatus('Importing teams...');
    try {
      const teamRes = await fetch(`/api/tba/events/${encodeURIComponent(code)}/teams`, { method: 'POST' });
      if (!teamRes.ok) {
        const td = await teamRes.json().catch(() => ({}));
        console.error('Team import failed', td);
        setStatus('Matches imported, but team import failed.');
      }
    } catch (e) {
      console.error('Team import fetch error:', e);
      setStatus('Matches imported, but team import failed.');
    }
    try {
      localStorage.setItem('currentEventCode', code);
      localStorage.setItem('currentEventName', name);
      window.dispatchEvent(new Event('current-event-changed'));
      setCurrentEventCode(code);
      setCurrentEventName(name);
    } catch {}
    setStatus('Ready!');
    router.push('/scout');
  }

  const filtered = events.filter((e) => (e.code + ' ' + e.name).toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="mx-auto max-w-3xl p-4">
      <h1 className="text-zinc-900 dark:text-zinc-100">Check-in</h1>
      <p className="text-zinc-900 dark:text-zinc-100">Pick your event once and the app will use it everywhere for scouting, pit scouting, and analysis.</p>

      <div className="mt-3 rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950 p-3">
        <div className="font-bold text-zinc-900 dark:text-zinc-100">Current event</div>
        <div className="mt-1 text-zinc-500 dark:text-zinc-400">
          {currentEventCode ? `Checked in to ${currentEventName || currentEventCode}. You can switch events anytime below.` : 'No active event selected yet. Check in now so match and pit scouting are pre-filled.'}
        </div>
      </div>

      <div className="flex flex-wrap gap-3 items-center mt-2">
        <label className="text-zinc-900 dark:text-zinc-100">
          Season
          <input type="number" value={season} onChange={(e) => setSeason(parseInt(e.target.value || String(new Date().getFullYear()), 10))} className="ml-2 px-2 py-1.5 border border-zinc-300 dark:border-zinc-600 rounded-md bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100" />
        </label>
        <button onClick={loadEvents} className="px-3 py-2 rounded-md bg-blue-600 text-white font-medium hover:bg-blue-700">Load events</button>
        <span className="text-zinc-500 dark:text-zinc-400">{status}</span>
      </div>

      <div className="mt-3">
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by event code or name..." className="w-full px-2 py-1.5 border border-zinc-300 dark:border-zinc-600 rounded-md bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100" />
      </div>

      <div className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
        Events happening now or nearest in time are shown first.
      </div>

      <div className="mt-3 grid gap-2">
        {filtered.map((e) => (
          <div key={e.code} className="flex justify-between items-center border border-zinc-200 dark:border-zinc-700 rounded-lg p-2">
            <div>
              <div className="font-semibold text-zinc-900 dark:text-zinc-100">{e.name}</div>
              <div className="text-xs text-zinc-500 dark:text-zinc-400">{e.code} • {formatEventDate(e)}</div>
            </div>
            <button onClick={() => chooseEvent(e.code, e.name)} className={`px-3 py-2 rounded-md font-medium text-white ${currentEventCode === e.code ? 'bg-blue-600 hover:bg-blue-700' : 'bg-zinc-900 hover:bg-zinc-700 dark:bg-zinc-700 dark:hover:bg-zinc-600'}`}>
              {currentEventCode === e.code ? 'Selected' : 'Use this event'}
            </button>
          </div>
        ))}
        {filtered.length === 0 && <div className="text-zinc-900 dark:text-zinc-100">No events found yet. Try another season or search term.</div>}
      </div>
    </div>
  );
}
