'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

type Entry = {
  team_number: number;
  metrics: Record<string, any>;
  event_code: string;
  season: number;
};

export default function LeaderboardPage() {
  const router = useRouter();
  const [rows, setRows] = useState<Entry[]>([]);
  const [status, setStatus] = useState('');
  const [scope, setScope] = useState<'event' | 'season'>('event');
  const [metric, setMetric] = useState<string>('');
  const [teamInfo, setTeamInfo] = useState<Record<number, { nickname?: string; name?: string; logo_url?: string }>>({});

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) router.replace('/login');
    });
  }, [router]);

  async function load() {
    setStatus('Loading...');
    let q = supabase.from('scouting_entries').select('team_number,metrics,event_code,season');
    if (scope === 'event') {
      try {
        const ce = localStorage.getItem('currentEventCode');
        if (ce) q = q.eq('event_code', ce);
      } catch {}
    } else {
      let seasonYear = new Date().getFullYear();
      try {
        const ce = localStorage.getItem('currentEventCode');
        if (ce && /^\d{4}/.test(ce)) seasonYear = parseInt(ce.slice(0,4), 10);
      } catch {}
      q = q.eq('season', seasonYear);
    }
    const { data, error } = await q;
    if (error) { setStatus(`Error: ${error.message}`); return; }
    const entries = (data as any[]) as Entry[];
    setRows(entries);
    // load team names/logos for the teams present
    try {
      const teamNums = Array.from(new Set(entries.map((r) => r.team_number).filter(Boolean)));
      if (teamNums.length > 0) {
        const { data: teams } = await supabase.from('teams').select('number,nickname,name,logo_url').in('number', teamNums);
        const tmap: any = {};
        (teams as any[] || []).forEach((t) => { tmap[t.number] = { nickname: t.nickname, name: t.name, logo_url: t.logo_url }; });
        setTeamInfo(tmap);
      } else {
        setTeamInfo({});
      }
    } catch {}
    setStatus('');
  }

  useEffect(() => { load(); }, [scope]);

  const numericMetrics = useMemo(() => {
    const set = new Set<string>();
    for (const r of rows) {
      const m = r.metrics || {};
      for (const [k, v] of Object.entries(m)) {
        const n = Number(v);
        if (!Number.isNaN(n)) set.add(k);
      }
    }
    const list = Array.from(set).sort();
    if (!metric && list.length) setMetric(list[0]);
    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows]);

  const teamAverages = useMemo(() => {
    const byTeam = new Map<number, { count: number; sums: Record<string, number> }>();
    for (const r of rows) {
      const m = r.metrics || {};
      const rec = byTeam.get(r.team_number) || { count: 0, sums: {} };
      rec.count += 1;
      for (const key of numericMetrics) {
        const val = Number((m as any)[key]);
        if (!Number.isNaN(val)) rec.sums[key] = (rec.sums[key] || 0) + val;
      }
      byTeam.set(r.team_number, rec);
    }
    const out = Array.from(byTeam.entries()).map(([team, rec]) => {
      const avgs: Record<string, number> = {};
      for (const key of numericMetrics) {
        const s = rec.sums[key] || 0;
        avgs[key] = rec.count ? +(s / rec.count).toFixed(2) : 0;
      }
      return { team, count: rec.count, avgs };
    });
    return out;
  }, [rows, numericMetrics]);

  const sorted = useMemo(() => {
    const key = metric || (numericMetrics[0] || '');
    if (!key) return teamAverages;
    return [...teamAverages].sort((a, b) => (b.avgs[key] || 0) - (a.avgs[key] || 0));
  }, [teamAverages, metric, numericMetrics]);

  return (
    <div style={{ padding: 16, maxWidth: 1000, margin: '0 auto', display: 'grid', gap: 12 }}>
      <h1>Leaderboard</h1>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
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
          Sort by metric
          <select value={metric} onChange={(e) => setMetric(e.target.value)} style={{ marginLeft: 8, padding: 6 }}>
            {numericMetrics.map((k) => (
              <option key={k} value={k}>{k}</option>
            ))}
          </select>
        </label>
        <button onClick={load} style={{ padding: 8, borderRadius: 6, background: '#111', color: '#fff' }}>Refresh</button>
        <span style={{ color: '#555' }}>{status}</span>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ borderBottom: '1px solid #ddd', textAlign: 'left', padding: 6 }}>#</th>
              <th style={{ borderBottom: '1px solid #ddd', textAlign: 'left', padding: 6 }}>Team</th>
              <th style={{ borderBottom: '1px solid #ddd', textAlign: 'left', padding: 6 }}>Matches</th>
              {numericMetrics.map((k) => (
                <th key={k} style={{ borderBottom: '1px solid #ddd', textAlign: 'left', padding: 6 }}>{k}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((row, idx) => (
              <tr key={row.team}>
                <td style={{ borderBottom: '1px solid #f0f0f0', padding: 6 }}>{idx + 1}</td>
                <td style={{ borderBottom: '1px solid #f0f0f0', padding: 6 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    {teamInfo[row.team]?.logo_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={teamInfo[row.team]!.logo_url!} alt="" width={18} height={18} style={{ borderRadius: 4 }} />
                    ) : null}
                    <span>{teamInfo[row.team]?.nickname || teamInfo[row.team]?.name || row.team}</span>
                  </div>
                </td>
                <td style={{ borderBottom: '1px solid #f0f0f0', padding: 6 }}>{row.count}</td>
                {numericMetrics.map((k) => (
                  <td key={k} style={{ borderBottom: '1px solid #f0f0f0', padding: 6 }}>{row.avgs[k] ?? 0}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}


