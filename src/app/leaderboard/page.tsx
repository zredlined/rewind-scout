'use client';

export const dynamic = 'force-dynamic';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useRequireAuth } from '@/lib/AuthContext';

type MetricValue = string | number | boolean;
type Entry = {
  team_number: number;
  metrics: Record<string, MetricValue>;
  event_code: string;
  season: number;
};
type TeamInfoRow = {
  number: number;
  nickname: string | null;
  name: string | null;
  logo_url: string | null;
};
type FormField = {
  id: string;
  label: string;
  type: 'counter' | 'checkbox' | 'text' | 'multiselect';
  options?: string[];
};
type FormTemplateRow = {
  form_definition: FormField[] | null;
};

function getStoredCurrentEventCode(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return localStorage.getItem('currentEventCode');
  } catch {
    return null;
  }
}

export default function LeaderboardPage() {
  useRequireAuth();
  const [rows, setRows] = useState<Entry[]>([]);
  const [status, setStatus] = useState('');
  const [scope, setScope] = useState<'event' | 'season'>('event');
  const [metric, setMetric] = useState<string>('');
  const [teamInfo, setTeamInfo] = useState<Record<number, { nickname?: string; name?: string; logo_url?: string }>>({});
  const [counterKeys, setCounterKeys] = useState<string[]>([]);

  const load = useCallback(async () => {
    setStatus('Loading...');
    let q = supabase.from('scouting_entries').select('team_number,metrics,event_code,season');
    if (scope === 'event') {
      const ce = getStoredCurrentEventCode();
      if (ce) q = q.eq('event_code', ce);
    } else {
      let seasonYear = new Date().getFullYear();
      const ce = getStoredCurrentEventCode();
      if (ce && /^\d{4}/.test(ce)) seasonYear = parseInt(ce.slice(0,4), 10);
      q = q.eq('season', seasonYear);
    }
    const { data, error } = await q;
    if (error) { setStatus(`Error: ${error.message}`); return; }
    const entries = (data as Entry[] | null) || [];
    setRows(entries);
    // load team names/logos for the teams present
    try {
      const teamNums = Array.from(new Set(entries.map((r) => r.team_number).filter(Boolean)));
      if (teamNums.length > 0) {
        const { data: teams } = await supabase.from('frc_teams').select('number,nickname,name,logo_url').in('number', teamNums);
        const tmap: Record<number, { nickname?: string; name?: string; logo_url?: string }> = {};
        ((teams as TeamInfoRow[] | null) || []).forEach((t) => { tmap[t.number] = { nickname: t.nickname || undefined, name: t.name || undefined, logo_url: t.logo_url || undefined }; });
        setTeamInfo(tmap);
      } else {
        setTeamInfo({});
      }
    } catch {}
    // Load form template to identify counter fields (for heatmap)
    try {
      let seasonYear = new Date().getFullYear();
      if (scope === 'event') {
        const ce = getStoredCurrentEventCode();
        if (ce && /^\d{4}/.test(ce)) seasonYear = parseInt(ce.slice(0,4), 10);
      } else {
        const first = entries[0];
        if (first?.season) seasonYear = first.season;
      }
        const { data: tpl } = await supabase
          .from('form_templates')
          .select('form_definition')
          .eq('season', seasonYear)
          .maybeSingle<FormTemplateRow>();
        const def = tpl?.form_definition || [];
        const counters = def.filter((f) => f?.type === 'counter').map((f) => String(f.label));
        setCounterKeys(counters);
      } catch {}
    setStatus('');
  }, [scope]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, [load]);

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
        const val = Number(m[key]);
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

  // Per-metric max for heat map
  const metricMax: Record<string, number> = useMemo(() => {
    const maxes: Record<string, number> = {};
    for (const key of numericMetrics) {
      let m = 0;
      for (const row of teamAverages) {
        const v = row.avgs[key] || 0;
        if (v > m) m = v;
      }
      maxes[key] = m;
    }
    return maxes;
  }, [numericMetrics, teamAverages]);

  const sorted = useMemo(() => {
    const key = metric || (numericMetrics[0] || '');
    if (!key) return teamAverages;
    return [...teamAverages].sort((a, b) => (b.avgs[key] || 0) - (a.avgs[key] || 0));
  }, [teamAverages, metric, numericMetrics]);

  return (
    <div className="p-4 max-w-5xl mx-auto grid gap-3">
      <h1>Leaderboard</h1>
      <div className="flex gap-3 items-center flex-wrap">
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-1.5">
            <input type="radio" name="scope" checked={scope==='event'} onChange={() => setScope('event')} />
            Current event
          </label>
          <label className="flex items-center gap-1.5">
            <input type="radio" name="scope" checked={scope==='season'} onChange={() => setScope('season')} />
            Current season
          </label>
        </div>
        <label className="flex items-center gap-2">
          Sort by metric
          <select value={metric} onChange={(e) => setMetric(e.target.value)} className="ml-2 px-2 py-1.5 border border-zinc-300 dark:border-zinc-600 rounded-md bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100">
            {numericMetrics.map((k) => (
              <option key={k} value={k}>{k}</option>
            ))}
          </select>
        </label>
        <button onClick={load} className="px-3 py-2 rounded-md bg-blue-600 text-white font-medium hover:bg-blue-700">Refresh</button>
        <span className="text-zinc-500 dark:text-zinc-400">{status}</span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr>
              <th className="border-b border-zinc-200 dark:border-zinc-700 text-left p-1.5 bg-zinc-50 dark:bg-zinc-800">#</th>
              <th className="border-b border-zinc-200 dark:border-zinc-700 text-left p-1.5 bg-zinc-50 dark:bg-zinc-800">Team</th>
              <th className="border-b border-zinc-200 dark:border-zinc-700 text-left p-1.5 bg-zinc-50 dark:bg-zinc-800">Matches</th>
              {numericMetrics.map((k) => (
                <th key={k} className="border-b border-zinc-200 dark:border-zinc-700 text-left p-1.5 bg-zinc-50 dark:bg-zinc-800">{k}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((row, idx) => (
              <tr key={row.team}>
                <td className="border-b border-zinc-100 dark:border-zinc-800 p-1.5">{idx + 1}</td>
                <td className="border-b border-zinc-100 dark:border-zinc-800 p-1.5">
                  <div className="flex items-center gap-1.5">
                    {teamInfo[row.team]?.logo_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={teamInfo[row.team]!.logo_url!} alt="" width={18} height={18} className="rounded" />
                    ) : null}
                    <span>{teamInfo[row.team]?.nickname || teamInfo[row.team]?.name || row.team}</span>
                  </div>
                </td>
                <td className="border-b border-zinc-100 dark:border-zinc-800 p-1.5">{row.count}</td>
                {numericMetrics.map((k) => {
                  const val = row.avgs[k] ?? 0;
                  // Heat map only for counter fields
                  const isCounter = counterKeys.includes(k);
                  const max = metricMax[k] || 0;
                  const heatStyle: React.CSSProperties = (isCounter && max > 0 && val > 0)
                    ? { backgroundColor: `rgba(16,185,129,${(0.15 + 0.35 * Math.max(0, Math.min(1, val / max))).toFixed(3)})` }
                    : {};
                  const isBold = isCounter && max > 0 && val === max;
                  return (
                    <td key={k} className={`border-b border-zinc-100 dark:border-zinc-800 p-1.5${isBold ? ' font-bold' : ''}`} style={heatStyle}>{val}</td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
