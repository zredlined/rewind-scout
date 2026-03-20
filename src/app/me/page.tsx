'use client';

export const dynamic = 'force-dynamic';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useRequireAuth } from '@/lib/AuthContext';

type LeaderRow = {
  scoutId: string;
  name: string;
  email: string;
  matchCount: number;
  pitCount: number;
  total: number;
};

type MatchEntryRow = {
  scout_id: string | null;
  scout_name: string | null;
  event_code: string;
  season: number;
};

type PitEntryRow = {
  scout_id: string | null;
  event_code: string;
  season: number;
};

type ProfileRow = {
  id: string;
  full_name: string | null;
  email: string | null;
};

export default function MePage() {
  const { user } = useRequireAuth();
  const [meId, setMeId] = useState<string>('');
  const [scope, setScope] = useState<'event' | 'season'>('event');
  const [rows, setRows] = useState<LeaderRow[]>([]);
  const [status, setStatus] = useState<string>('');

  const load = useCallback(async () => {
    if (!user) return;
    setStatus('Loading...');
    const currentUserId = user.id;
    setMeId(currentUserId);

    // Determine filters
    let ce: string | null = null;
    let season = new Date().getFullYear();
    try { ce = localStorage.getItem('currentEventCode'); if (ce && /^\d{4}/.test(ce)) season = parseInt(ce.slice(0,4), 10); } catch {}

    // Fetch match entries
    let mq = supabase.from('scouting_entries').select('scout_id,scout_name,event_code,season');
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

    // Aggregate counts per scout and build scout_name fallback map
    const matchCounts = new Map<string, number>();
    const scoutNameMap = new Map<string, string>();
    ((mrows as MatchEntryRow[] | null) || []).forEach(r => {
      if (!r.scout_id) return;
      matchCounts.set(r.scout_id, (matchCounts.get(r.scout_id) || 0) + 1);
      if (r.scout_name && !scoutNameMap.has(r.scout_id)) scoutNameMap.set(r.scout_id, r.scout_name);
    });
    const pitCounts = new Map<string, number>();
    ((prows as PitEntryRow[] | null) || []).forEach(r => {
      if (!r.scout_id) return; pitCounts.set(r.scout_id, (pitCounts.get(r.scout_id) || 0) + 1);
    });
    const ids = Array.from(new Set([ ...matchCounts.keys(), ...pitCounts.keys() ]));

    // Fetch names/emails
    const people: Record<string, { name: string; email: string }> = {};
    if (ids.length) {
      const { data: profs } = await supabase.from('profiles').select('id,full_name,email').in('id', ids);
      ((profs as ProfileRow[] | null) || []).forEach(p => {
        people[p.id] = { name: p.full_name || p.email || scoutNameMap.get(p.id) || p.id, email: p.email || '' };
      });
      // Backfill scouts that have no profile row but do have a scout_name
      for (const id of ids) {
        if (!people[id] && scoutNameMap.has(id)) {
          people[id] = { name: scoutNameMap.get(id)!, email: '' };
        }
      }
    }

    // Ensure current user shows a friendly label even if profile is missing
    if (currentUserId && !people[currentUserId]) {
      people[currentUserId] = { name: user?.displayName || currentUserId, email: '' };
    }

    const out: LeaderRow[] = ids.map(id => {
      const matchCount = matchCounts.get(id) || 0;
      const pitCount = pitCounts.get(id) || 0;
      const info = people[id] || { name: id, email: '' };
      return { scoutId: id, name: info.name, email: info.email, matchCount, pitCount, total: matchCount + pitCount };
    }).sort((a, b) => b.total - a.total);

    setRows(out);
    setStatus('');
  }, [scope, user]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, [load]);

  const meRank = useMemo(() => {
    const idx = rows.findIndex(r => r.scoutId === meId);
    return idx >= 0 ? idx + 1 : undefined;
  }, [rows, meId]);

  return (
    <div className="p-4 max-w-4xl mx-auto grid gap-3">
      <h1>Scout Leaderboard</h1>
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-1.5">
            <input type="radio" name="scope" checked={scope==='event'} onChange={() => setScope('event')} /> Current event
          </label>
          <label className="flex items-center gap-1.5">
            <input type="radio" name="scope" checked={scope==='season'} onChange={() => setScope('season')} /> Current season
          </label>
        </div>
        <button onClick={load} className="px-3 py-2 rounded-md bg-blue-600 text-white font-medium hover:bg-blue-700">Refresh</button>
        <span className="text-zinc-500 dark:text-zinc-400">{status}</span>
      </div>

      <div className="border border-zinc-200 dark:border-zinc-700 rounded-xl p-3">
        <div className="text-zinc-900 dark:text-zinc-100">Your account: {user?.displayName ?? ''} {meRank ? `(Rank #${meRank})` : ''}</div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr>
              <th className="border-b border-zinc-200 dark:border-zinc-700 text-left p-1.5 bg-zinc-50 dark:bg-zinc-800">#</th>
              <th className="border-b border-zinc-200 dark:border-zinc-700 text-left p-1.5 bg-zinc-50 dark:bg-zinc-800">Scout</th>
              <th className="border-b border-zinc-200 dark:border-zinc-700 text-left p-1.5 bg-zinc-50 dark:bg-zinc-800">Email</th>
              <th className="border-b border-zinc-200 dark:border-zinc-700 text-left p-1.5 bg-zinc-50 dark:bg-zinc-800">Match entries</th>
              <th className="border-b border-zinc-200 dark:border-zinc-700 text-left p-1.5 bg-zinc-50 dark:bg-zinc-800">Pit entries</th>
              <th className="border-b border-zinc-200 dark:border-zinc-700 text-left p-1.5 bg-zinc-50 dark:bg-zinc-800">Total</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, idx) => (
              <tr key={r.scoutId} style={r.scoutId === meId ? { background: 'rgba(16,185,129,0.08)' } : undefined}>
                <td className="border-b border-zinc-100 dark:border-zinc-800 p-1.5">{idx + 1}</td>
                <td className="border-b border-zinc-100 dark:border-zinc-800 p-1.5">{r.name}</td>
                <td className="border-b border-zinc-100 dark:border-zinc-800 p-1.5">{r.email}</td>
                <td className="border-b border-zinc-100 dark:border-zinc-800 p-1.5">{r.matchCount}</td>
                <td className="border-b border-zinc-100 dark:border-zinc-800 p-1.5">{r.pitCount}</td>
                <td className="border-b border-zinc-100 dark:border-zinc-800 p-1.5 font-bold">{r.total}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={6} className="p-2.5 text-zinc-500 dark:text-zinc-400">No entries yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
