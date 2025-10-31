'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';

export default function Dashboard() {
  const [email, setEmail] = useState<string | null>(null);
  const [season, setSeason] = useState<string>('2025');
  const [eventCode, setEventCode] = useState<string>('');
  const [status, setStatus] = useState<string>('');

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setEmail(data.user?.email ?? null);
    });
  }, []);

  if (!email) {
    return (
      <div style={{ padding: 24 }}>
        <p>Not signed in.</p>
        <Link href="/login">Go to Login</Link>
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
    } catch (e: any) {
      setStatus(`Error: ${e.message || String(e)}`);
    }
  }

  async function importMatches() {
    if (!eventCode) {
      setStatus('Enter an event code (e.g., 2025miket)');
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
    } catch (e: any) {
      setStatus(`Error: ${e.message || String(e)}`);
    }
  }

  return (
    <div style={{ padding: 24 }}>
      <h1>Welcome</h1>
      <p>Signed in as {email}</p>
      <div style={{ marginTop: 24, display: 'grid', gap: 12, maxWidth: 720 }}>
        <h2>Navigation</h2>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <Link href="/scout" style={{ padding: 10, borderRadius: 6, background: '#111', color: '#fff' }}>Go to Scouting Form</Link>
          <Link href="/analysis" style={{ padding: 10, borderRadius: 6, background: '#111', color: '#fff' }}>View Analysis</Link>
          <Link href="/form-builder" style={{ padding: 10, borderRadius: 6, background: '#111', color: '#fff' }}>Build/Edit Scouting Form</Link>
        </div>

        <hr style={{ margin: '16px 0' }} />

        <h2>TBA Imports</h2>
        <label style={{ display: 'grid', gap: 6 }}>
          <span>Season</span>
          <input
            value={season}
            onChange={(e) => setSeason(e.target.value)}
            placeholder="2025"
            style={{ padding: 8, border: '1px solid #ccc', borderRadius: 6 }}
          />
        </label>
        <button onClick={importEvents} style={{ padding: 10, borderRadius: 6, background: '#111', color: '#fff' }}>
          Import events for season
        </button>

        <label style={{ display: 'grid', gap: 6 }}>
          <span>Event code (e.g., 2025miket)</span>
          <input
            value={eventCode}
            onChange={(e) => setEventCode(e.target.value)}
            placeholder="2025miket"
            style={{ padding: 8, border: '1px solid #ccc', borderRadius: 6 }}
          />
        </label>
        <button onClick={importMatches} style={{ padding: 10, borderRadius: 6, background: '#111', color: '#fff' }}>
          Import matches for event
        </button>

        <div style={{ color: '#555' }}>{status}</div>

        <div style={{ marginTop: 16 }}>
          <Link href="/">Home</Link>
        </div>
      </div>
    </div>
  );
}


