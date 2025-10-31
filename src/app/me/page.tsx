'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

export default function MePage() {
  const [email, setEmail] = useState<string>('');
  const [count, setCount] = useState<number>(0);
  const [status, setStatus] = useState<string>('');

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) { window.location.href = '/login'; return; }
      setEmail(data.user.email || '');
      try {
        const ce = localStorage.getItem('currentEventCode');
        let q = supabase.from('scouting_entries').select('id', { count: 'exact', head: true }).eq('scout_id', data.user.id);
        if (ce) q = q.eq('event_code', ce);
        const { count: c, error } = await q;
        if (!error && typeof c === 'number') setCount(c);
      } catch (e) {
        setStatus(String(e));
      }
    });
  }, []);

  return (
    <div style={{ padding: 16 }}>
      <h1>Me</h1>
      <p>{email}</p>
      <div style={{ marginTop: 12 }}>Entries this event: <strong>{count}</strong></div>
      <div style={{ color: '#555' }}>{status}</div>
    </div>
  );
}


