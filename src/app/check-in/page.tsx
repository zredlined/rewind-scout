'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';

type TbaEvent = { code: string; name: string; start_date?: string | null; end_date?: string | null };
type ProfileUpdate = { current_event_code: string };

function getStoredCurrentEventCode(): string {
  if (typeof window === 'undefined') return '';
  try {
    return localStorage.getItem('currentEventCode') || '';
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
  const [season, setSeason] = useState<number>(getInitialSeason);
  const [events, setEvents] = useState<TbaEvent[]>([]);
  const [search, setSearch] = useState<string>('');
  const [status, setStatus] = useState<string>('');
  const [currentEventCode, setCurrentEventCode] = useState<string>(getStoredCurrentEventCode);
  const router = useRouter();

  useEffect(() => {
    // require auth
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) router.replace('/login');
    });
  }, [router]);

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

  async function chooseEvent(code: string) {
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
      window.dispatchEvent(new Event('current-event-changed'));
      setCurrentEventCode(code);
    } catch {}
    // best-effort profile persist if column exists
    supabase.auth.getUser().then(async ({ data }) => {
      const uid = data.user?.id;
      if (uid) {
        try {
          await supabase.from('profiles').update({ current_event_code: code } satisfies ProfileUpdate).eq('id', uid);
        } catch {}
      }
    });
    setStatus('Ready!');
    router.push('/scout');
  }

  const filtered = events.filter((e) => (e.code + ' ' + e.name).toLowerCase().includes(search.toLowerCase()));

  return (
    <div style={{ padding: 16, maxWidth: 800, margin: '0 auto' }}>
      <h1>Check-in</h1>
      <p>Pick your event once and the app will use it everywhere for scouting, pit scouting, and analysis.</p>

      <div style={{ marginTop: 12, border: '1px solid #dbe7ff', background: '#f7faff', borderRadius: 12, padding: 12 }}>
        <div style={{ fontWeight: 700 }}>Current event</div>
        <div style={{ marginTop: 4, color: '#445' }}>
          {currentEventCode ? `Checked in to ${currentEventCode}. You can switch events anytime below.` : 'No active event selected yet. Check in now so match and pit scouting are pre-filled.'}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', marginTop: 8 }}>
        <label>
          Season
          <input type="number" value={season} onChange={(e) => setSeason(parseInt(e.target.value || String(new Date().getFullYear()), 10))} style={{ marginLeft: 8, padding: 6, border: '1px solid #ccc', borderRadius: 6 }} />
        </label>
        <button onClick={loadEvents} style={{ padding: 8, borderRadius: 6, background: '#111', color: '#fff' }}>Load events</button>
        <span style={{ color: '#555' }}>{status}</span>
      </div>

      <div style={{ marginTop: 12 }}>
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by event code or name..." style={{ width: '100%', padding: 8, border: '1px solid #ccc', borderRadius: 6 }} />
      </div>

      <div style={{ marginTop: 8, color: '#555', fontSize: 14 }}>
        Events happening now or nearest in time are shown first.
      </div>

      <div style={{ marginTop: 12, display: 'grid', gap: 8 }}>
        {filtered.map((e) => (
          <div key={e.code} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid #eee', borderRadius: 8, padding: 8 }}>
            <div>
              <div style={{ fontWeight: 600 }}>{e.name}</div>
              <div style={{ fontSize: 12, color: '#666' }}>{e.code} • {formatEventDate(e)}</div>
            </div>
            <button onClick={() => chooseEvent(e.code)} style={{ padding: 8, borderRadius: 6, background: currentEventCode === e.code ? '#1d4ed8' : '#111', color: '#fff' }}>
              {currentEventCode === e.code ? 'Selected' : 'Use this event'}
            </button>
          </div>
        ))}
        {filtered.length === 0 && <div>No events found yet. Try another season or search term.</div>}
      </div>
    </div>
  );
}
