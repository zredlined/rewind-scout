'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';

type LeaderRow = {
  scoutId: string;
  name: string;
  email: string;
  matchCount: number;
  pitCount: number;
  total: number;
};

export default function MePage() {
  const [meEmail, setMeEmail] = useState<string>('');
  const [meId, setMeId] = useState<string>('');
  const [scope, setScope] = useState<'event' | 'season'>('event');
  const [rows, setRows] = useState<LeaderRow[]>([]);
  const [status, setStatus] = useState<string>('');

  async function load() {
    setStatus('Loading...');
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) { window.location.href = '/login'; return; }
    setMeEmail(auth.user.email || '');
    setMeId(auth.user.id);

    // Determine filters
    let ce: string | null = null;
    let season = new Date().getFullYear();
    try { ce = localStorage.getItem('currentEventCode'); if (ce && /^\d{4}/.test(ce)) season = parseInt(ce.slice(0,4), 10); } catch {}

    // Fetch match entries
    let mq = supabase.from('scouting_entries').select('scout_id,event_code,season');
    if (scope === 'event' && ce) mq = mq.eq('event_code', ce);
    if (scope === 'season') mq = mq.eq('season', season);
    const { data: mrows, error: merr } = await mq;
    if (merr) { setStatus(`Error: ${merr.message}`); return; }

    // Fetch pit entries
    let pq = supabase.from('pit_entries').select('scout_id,event_code,season');
    if (scope === 'event' && ce) pq = pq.eq('event_code', ce);
    if (scope === 'season') pq = pq.eq('season', season);
    const { data: prows, error: perr } = await pq;
    if (perr) { setStatus(`Error: ${perr.message}`); return; }

    // Aggregate counts per scout
    const matchCounts = new Map<string, number>();
    (mrows as any[] || []).forEach(r => {
      if (!r.scout_id) return; matchCounts.set(r.scout_id, (matchCounts.get(r.scout_id) || 0) + 1);
    });
    const pitCounts = new Map<string, number>();
    (prows as any[] || []).forEach(r => {
      if (!r.scout_id) return; pitCounts.set(r.scout_id, (pitCounts.get(r.scout_id) || 0) + 1);
    });
    const ids = Array.from(new Set([ ...matchCounts.keys(), ...pitCounts.keys() ]));

    // Fetch names/emails
    let people: Record<string, { name: string; email: string }> = {};
    if (ids.length) {
      const { data: profs } = await supabase.from('profiles').select('id,full_name,email').in('id', ids);
      (profs as any[] || []).forEach(p => {
        people[p.id] = { name: p.full_name || p.email || p.id, email: p.email || '' };
      });
    }

    // Ensure current user shows a friendly label even if profile is missing
    if (meId) {
      if (!people[meId]) people[meId] = { name: meEmail || meId, email: meEmail || '' };
    }

    const out: LeaderRow[] = ids.map(id => {
      const matchCount = matchCounts.get(id) || 0;
      const pitCount = pitCounts.get(id) || 0;
      const info = people[id] || { name: id, email: '' };
      return { scoutId: id, name: info.name, email: info.email, matchCount, pitCount, total: matchCount + pitCount };
    }).sort((a, b) => b.total - a.total);

    setRows(out);
    setStatus('');
  }

  useEffect(() => { load(); }, [scope]);

  const meRank = useMemo(() => {
    const idx = rows.findIndex(r => r.scoutId === meId);
    return idx >= 0 ? idx + 1 : undefined;
  }, [rows, meId]);

  return (
    <div style={{ padding: 16, maxWidth: 900, margin: '0 auto', display: 'grid', gap: 12 }}>
      <h1>Scout Leaderboard</h1>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <input type="radio" name="scope" checked={scope==='event'} onChange={() => setScope('event')} /> Current event
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <input type="radio" name="scope" checked={scope==='season'} onChange={() => setScope('season')} /> Current season
          </label>
        </div>
        <button onClick={load} style={{ padding: 8, borderRadius: 6, background: '#111', color: '#fff' }}>Refresh</button>
        <span style={{ color: '#555' }}>{status}</span>
      </div>

      <div style={{ border: '1px solid #eee', padding: 10, borderRadius: 8 }}>
        <div>Your account: {meEmail} {meRank ? `(Rank #${meRank})` : ''}</div>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ borderBottom: '1px solid #ddd', textAlign: 'left', padding: 6 }}>#</th>
              <th style={{ borderBottom: '1px solid #ddd', textAlign: 'left', padding: 6 }}>Scout</th>
              <th style={{ borderBottom: '1px solid #ddd', textAlign: 'left', padding: 6 }}>Email</th>
              <th style={{ borderBottom: '1px solid #ddd', textAlign: 'left', padding: 6 }}>Match entries</th>
              <th style={{ borderBottom: '1px solid #ddd', textAlign: 'left', padding: 6 }}>Pit entries</th>
              <th style={{ borderBottom: '1px solid #ddd', textAlign: 'left', padding: 6 }}>Total</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, idx) => (
              <tr key={r.scoutId} style={{ background: r.scoutId === meId ? 'rgba(16,185,129,0.08)' : undefined }}>
                <td style={{ borderBottom: '1px solid #f0f0f0', padding: 6 }}>{idx + 1}</td>
                <td style={{ borderBottom: '1px solid #f0f0f0', padding: 6 }}>{r.name}</td>
                <td style={{ borderBottom: '1px solid #f0f0f0', padding: 6 }}>{r.email}</td>
                <td style={{ borderBottom: '1px solid #f0f0f0', padding: 6 }}>{r.matchCount}</td>
                <td style={{ borderBottom: '1px solid #f0f0f0', padding: 6 }}>{r.pitCount}</td>
                <td style={{ borderBottom: '1px solid #f0f0f0', padding: 6, fontWeight: 700 }}>{r.total}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={6} style={{ padding: 10, color: '#666' }}>No entries yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}


