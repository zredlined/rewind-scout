'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Bar, BarChart, CartesianGrid, Tooltip, XAxis, YAxis, ResponsiveContainer } from 'recharts';

type Entry = {
  id: string;
  event_code: string;
  match_key: string;
  team_number: number;
  season: number;
  metrics: Record<string, any>;
};

export default function AnalysisPage() {
  const [teamNumber, setTeamNumber] = useState<string>('');
  const [metricKey, setMetricKey] = useState<string>('');
  const [rows, setRows] = useState<Entry[]>([]);
  const [status, setStatus] = useState<string>('');

  async function load() {
    setStatus('Loading...');
    let q = supabase.from('scouting_entries').select('id,event_code,match_key,team_number,season,metrics');
    if (teamNumber) q = q.eq('team_number', parseInt(teamNumber, 10));
    const { data, error } = await q.order('match_key', { ascending: true });
    if (error) setStatus(`Error: ${error.message}`);
    else {
      setRows((data as any[]) as Entry[]);
      setStatus('');
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const metricOptions = useMemo(() => {
    const set = new Set<string>();
    for (const r of rows) {
      if (r?.metrics && typeof r.metrics === 'object') {
        for (const k of Object.keys(r.metrics)) set.add(k);
      }
    }
    return Array.from(set).sort();
  }, [rows]);

  const chartData = useMemo(() => {
    if (!metricKey) return [] as { name: string; value: number }[];
    return rows
      .map((r) => ({ name: r.match_key, value: Number(r.metrics?.[metricKey]) || 0 }))
      .filter((d) => !Number.isNaN(d.value));
  }, [rows, metricKey]);

  const avg = useMemo(() => {
    if (!chartData.length) return 0;
    const s = chartData.reduce((acc, d) => acc + d.value, 0);
    return +(s / chartData.length).toFixed(2);
  }, [chartData]);

  return (
    <div style={{ padding: 16, maxWidth: 960, margin: '0 auto', display: 'grid', gap: 12 }}>
      <h1>Analysis</h1>

      <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <label>
          Team Number
          <input value={teamNumber} onChange={(e) => setTeamNumber(e.target.value)} placeholder="2767" style={{ marginLeft: 8, padding: 6, border: '1px solid #ccc', borderRadius: 6 }} />
        </label>
        <button onClick={load} style={{ padding: 8, borderRadius: 6, background: '#111', color: '#fff' }}>Load</button>
        <span style={{ color: '#555' }}>{status}</span>
      </div>

      <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <label>
          Metric
          <select value={metricKey} onChange={(e) => setMetricKey(e.target.value)} style={{ marginLeft: 8, padding: 6 }}>
            <option value="">Select a metric</option>
            {metricOptions.map((k) => (
              <option key={k} value={k}>{k}</option>
            ))}
          </select>
        </label>
        {metricKey && <span>Average: {avg}</span>}
      </div>

      <div style={{ height: 320, width: '100%', background: '#fafafa', border: '1px solid #eee', borderRadius: 8, padding: 8 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 16, right: 16, bottom: 16, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" />
            <YAxis />
            <Tooltip />
            <Bar dataKey="value" fill="#8884d8" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <h2>Raw Entries</h2>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ borderBottom: '1px solid #ddd', textAlign: 'left', padding: 6 }}>Match</th>
              <th style={{ borderBottom: '1px solid #ddd', textAlign: 'left', padding: 6 }}>Team</th>
              <th style={{ borderBottom: '1px solid #ddd', textAlign: 'left', padding: 6 }}>Event</th>
              <th style={{ borderBottom: '1px solid #ddd', textAlign: 'left', padding: 6 }}>Season</th>
              <th style={{ borderBottom: '1px solid #ddd', textAlign: 'left', padding: 6 }}>Metrics</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td style={{ borderBottom: '1px solid #f0f0f0', padding: 6 }}>{r.match_key}</td>
                <td style={{ borderBottom: '1px solid #f0f0f0', padding: 6 }}>{r.team_number}</td>
                <td style={{ borderBottom: '1px solid #f0f0f0', padding: 6 }}>{r.event_code}</td>
                <td style={{ borderBottom: '1px solid #f0f0f0', padding: 6 }}>{r.season}</td>
                <td style={{ borderBottom: '1px solid #f0f0f0', padding: 6, fontFamily: 'monospace', whiteSpace: 'pre-wrap' }}>{JSON.stringify(r.metrics)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}


