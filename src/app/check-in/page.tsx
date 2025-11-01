'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';

type TbaEvent = { code: string; name: string };

export default function CheckInPage() {
  const [season, setSeason] = useState<number>(new Date().getFullYear());
  const [events, setEvents] = useState<TbaEvent[]>([]);
  const [search, setSearch] = useState<string>('');
  const [status, setStatus] = useState<string>('');
  const router = useRouter();

  useEffect(() => {
    // require auth
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) router.replace('/login');
    });
  }, [router]);

  async function loadEvents() {
    setStatus('Loading events...');
    const res = await fetch(`/api/tba/events?season=${encodeURIComponent(String(season))}`);
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setStatus(`Error: ${d?.error || res.statusText}`);
      return;
    }
    // fetch from our DB after import to list; already filtered by season using prefix
    const { data, error } = await supabase.from('events').select('code,name');
    if (error) { setStatus(`Error: ${error.message}`); return; }
    const prefix = String(season);
    setEvents(((data as any[]) || []).filter((e) => (e.code || '').startsWith(prefix)));
    setStatus('');
  }

  async function chooseEvent(code: string) {
    setStatus('Importing matches...');
    const res = await fetch(`/api/tba/events/${encodeURIComponent(code)}/matches`, { method: 'POST' });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setStatus(`Error: ${d?.error || res.statusText}`);
      return;
    }
    // Import teams (names/logos) best-effort
    try {
      await fetch(`/api/tba/events/${encodeURIComponent(code)}/teams`, { method: 'POST' });
    } catch {}
    try {
      localStorage.setItem('currentEventCode', code);
    } catch {}
    // best-effort profile persist if column exists
    supabase.auth.getUser().then(async ({ data }) => {
      const uid = data.user?.id;
      if (uid) {
        try {
          await supabase.from('profiles').update({ current_event_code: code } as any).eq('id', uid);
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
      <p>Pick your season and event. We’ll import matches and set it as your current event.</p>

      <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', marginTop: 8 }}>
        <label>
          Season
          <input type="number" value={season} onChange={(e) => setSeason(parseInt(e.target.value || String(new Date().getFullYear()), 10))} style={{ marginLeft: 8, padding: 6, border: '1px solid #ccc', borderRadius: 6 }} />
        </label>
        <button onClick={loadEvents} style={{ padding: 8, borderRadius: 6, background: '#111', color: '#fff' }}>Load events</button>
        <span style={{ color: '#555' }}>{status}</span>
      </div>

      <div style={{ marginTop: 12 }}>
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search events..." style={{ width: '100%', padding: 8, border: '1px solid #ccc', borderRadius: 6 }} />
      </div>

      <div style={{ marginTop: 12, display: 'grid', gap: 8 }}>
        {filtered.map((e) => (
          <div key={e.code} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid #eee', borderRadius: 8, padding: 8 }}>
            <div>
              <div style={{ fontWeight: 600 }}>{e.name}</div>
              <div style={{ fontSize: 12, color: '#666' }}>{e.code}</div>
            </div>
            <button onClick={() => chooseEvent(e.code)} style={{ padding: 8, borderRadius: 6, background: '#111', color: '#fff' }}>Use this event</button>
          </div>
        ))}
        {filtered.length === 0 && <div>No events loaded yet. Click "Load events" above.</div>}
      </div>
    </div>
  );
}


