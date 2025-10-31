'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Bar, BarChart, CartesianGrid, Tooltip, XAxis, YAxis, ResponsiveContainer, Legend } from 'recharts';

type Entry = {
  id: string;
  event_code: string;
  match_key: string;
  team_number: number;
  season: number;
  metrics: Record<string, any>;
  scout_name?: string | null;
  created_at?: string;
  scouted_at?: string | null;
};

export default function AnalysisPage() {
  const router = useRouter();
  const [teamNumber, setTeamNumber] = useState<string>('');
  const [days, setDays] = useState<number>(0); // 0 = all time
  const [rows, setRows] = useState<Entry[]>([]);
  const [status, setStatus] = useState<string>('');
  const [scope, setScope] = useState<'event' | 'season'>('event');
  const [eventNames, setEventNames] = useState<Record<string, string>>({});

  async function load() {
    setStatus('Loading...');
    let q = supabase.from('scouting_entries').select('id,event_code,match_key,team_number,season,metrics,scout_name,created_at,scouted_at');
    if (teamNumber) q = q.eq('team_number', parseInt(teamNumber, 10));
    if (scope === 'event') {
      try {
        const ce = localStorage.getItem('currentEventCode');
        if (ce) q = q.eq('event_code', ce);
      } catch {}
    } else {
      // scope = season
      // If current event exists, derive its season; else use current year
      let seasonYear = new Date().getFullYear();
      try {
        const ce = localStorage.getItem('currentEventCode');
        if (ce && /^\d{4}/.test(ce)) seasonYear = parseInt(ce.slice(0,4), 10);
      } catch {}
      q = q.eq('season', seasonYear);
    }
    if (days > 0) {
      const since = new Date();
      since.setDate(since.getDate() - days);
      const iso = since.toISOString();
      // prefer scouted_at if present; fallback to created_at
      q = q.or(`scouted_at.gte.${iso},created_at.gte.${iso}`);
    }
    const { data, error } = await q.order('match_key', { ascending: true });
    if (error) setStatus(`Error: ${error.message}`);
    else {
      const entries = (data as any[]) as Entry[];
      setRows(entries);
      // Load human-readable event names for the codes present in results
      try {
        const codes = Array.from(new Set(entries.map((r) => r.event_code).filter(Boolean)));
        if (codes.length > 0) {
          const { data: evs } = await supabase.from('events').select('code,name').in('code', codes);
          const map: Record<string, string> = {};
          for (const e of (evs as any[]) || []) map[e.code] = e.name;
          setEventNames(map);
        } else {
          setEventNames({});
        }
      } catch {}
      setStatus('');
    }
  }

  useEffect(() => {
    // require auth
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) router.replace('/login');
    });
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const numericMetrics = useMemo(() => {
    const candidates = new Set<string>();
    for (const r of rows) {
      const m = r.metrics || {};
      for (const [k, v] of Object.entries(m)) {
        const n = Number(v);
        if (!Number.isNaN(n)) candidates.add(k);
      }
    }
    return Array.from(candidates).sort();
  }, [rows]);

  function computeTeamVsField(metric: string) {
    const isTeamRow = (r: Entry) => teamNumber && r.team_number === Number(teamNumber);
    const numeric = rows
      .map((r) => ({ r, val: Number(r.metrics?.[metric]) }))
      .filter(({ val }) => !Number.isNaN(val));
    const teamVals = numeric.filter(({ r }) => isTeamRow(r)).map(({ val }) => val);
    const fieldVals = numeric.filter(({ r }) => !isTeamRow(r)).map(({ val }) => val);
    const avg = (arr: number[]) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0);
    return { teamAvg: +avg(teamVals).toFixed(2), fieldAvg: +avg(fieldVals).toFixed(2) };
  }

  return (
    <div style={{ padding: 16, maxWidth: 960, margin: '0 auto', display: 'grid', gap: 12 }}>
      <h1>Analysis</h1>

      <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <label>
          Team Number
          <input value={teamNumber} onChange={(e) => setTeamNumber(e.target.value)} placeholder="2767" style={{ marginLeft: 8, padding: 6, border: '1px solid #ccc', borderRadius: 6 }} />
        </label>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <input type="radio" name="scope" checked={scope==='event'} onChange={() => setScope('event')} />
            Current event
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <input type="radio" name="scope" checked={scope==='season'} onChange={() => setScope('season')} />
            Current season
          </label>
        </div>
        <label>
          Timeframe (days)
          <input type="range" min={0} max={14} value={days} onChange={(e) => setDays(parseInt(e.target.value, 10))} style={{ marginLeft: 8 }} />
          <span style={{ marginLeft: 8 }}>{days === 0 ? 'All time' : `Past ${days}d`}</span>
        </label>
        <button onClick={load} style={{ padding: 8, borderRadius: 6, background: '#111', color: '#fff' }}>Load</button>
        <span style={{ color: '#555' }}>{status}</span>
      </div>

      {numericMetrics.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12 }}>
          {numericMetrics.map((metric) => {
            const data = rows
              .map((r) => ({ name: r.match_key, Team: r.team_number === Number(teamNumber) ? Number(r.metrics?.[metric]) || 0 : 0, Field: Number(r.metrics?.[metric]) || 0 }))
              .filter((d) => !Number.isNaN(d.Field));
            const { teamAvg, fieldAvg } = computeTeamVsField(metric);
            return (
              <div key={metric} style={{ height: 280, background: '#fafafa', border: '1px solid #eee', borderRadius: 8, padding: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <strong>{metric}</strong>
                  <span style={{ fontSize: 12, color: '#666' }}>Avg T:{teamAvg} / F:{fieldAvg}</span>
                </div>
                <ResponsiveContainer width="100%" height="85%">
                  <BarChart data={data} margin={{ top: 8, right: 8, bottom: 8, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" hide />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="Field" fill="#c1c1ff" />
                    <Bar dataKey="Team" fill="#8884d8" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            );
          })}
        </div>
      )}

      <h2>Raw Entries</h2>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ borderBottom: '1px solid #ddd', textAlign: 'left', padding: 6 }}>Match</th>
              <th style={{ borderBottom: '1px solid #ddd', textAlign: 'left', padding: 6 }}>Team</th>
              <th style={{ borderBottom: '1px solid #ddd', textAlign: 'left', padding: 6 }}>Event</th>
              <th style={{ borderBottom: '1px solid #ddd', textAlign: 'left', padding: 6 }}>Scout</th>
              <th style={{ borderBottom: '1px solid #ddd', textAlign: 'left', padding: 6 }}>Time</th>
              <th style={{ borderBottom: '1px solid #ddd', textAlign: 'left', padding: 6 }}>Metrics</th>
            </tr>
          </thead>
          <tbody>
            {(teamNumber ? rows.filter((r) => r.team_number === Number(teamNumber)) : []).map((r) => (
              <tr key={r.id}>
                <td style={{ borderBottom: '1px solid #f0f0f0', padding: 6 }}>{r.match_key}</td>
                <td style={{ borderBottom: '1px solid #f0f0f0', padding: 6 }}>{r.team_number}</td>
                <td style={{ borderBottom: '1px solid #f0f0f0', padding: 6 }}>{eventNames[r.event_code] ?? r.event_code}</td>
                <td style={{ borderBottom: '1px solid #f0f0f0', padding: 6 }}>{r.scout_name ?? ''}</td>
                <td style={{ borderBottom: '1px solid #f0f0f0', padding: 6 }}>{r.scouted_at ?? r.created_at ?? ''}</td>
                <td style={{ borderBottom: '1px solid #f0f0f0', padding: 6, fontFamily: 'monospace', whiteSpace: 'pre-wrap' }}>{JSON.stringify(r.metrics)}</td>
              </tr>
            ))}
            {!teamNumber && (
              <tr>
                <td colSpan={6} style={{ padding: 8, color: '#666' }}>Enter a team number above to view their entries.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}


