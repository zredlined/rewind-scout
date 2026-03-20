'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useRequireAuth } from '@/lib/AuthContext';
import { Bar, BarChart, CartesianGrid, Tooltip, XAxis, YAxis, ResponsiveContainer, Legend } from 'recharts';

type MetricValue = string | number | boolean | string[] | null | undefined;
type Entry = {
  id: string;
  event_code: string;
  match_key: string;
  team_number: number;
  season: number;
  metrics: Record<string, MetricValue>;
  scout_name?: string | null;
  created_at?: string;
  scouted_at?: string | null;
};
type TeamInfoRow = { number: number; nickname: string | null; name: string | null; logo_url: string | null };
type EventNameRow = { code: string; name: string };
type FormField = { id: string; label: string; type: string; options?: string[] };
type FormTemplateRow = { form_definition: FormField[] | null };
type PitEntry = {
  team_number: number;
  metrics: Record<string, MetricValue>;
  photos?: string[];
  created_at?: string;
  scouted_at?: string;
  season?: number;
  event_code?: string;
};

function getStoredCurrentEventCode(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return localStorage.getItem('currentEventCode');
  } catch {
    return null;
  }
}

export default function AnalysisPage() {
  useRequireAuth();
  const [teamNumber, setTeamNumber] = useState<string>('');
  // Removed timeframe slider; scope handles event vs season
  const [rows, setRows] = useState<Entry[]>([]);
  const [status, setStatus] = useState<string>('');
  const [scope, setScope] = useState<'event' | 'season'>('event');
  const [eventNames, setEventNames] = useState<Record<string, string>>({});
  const [teamInfo, setTeamInfo] = useState<Record<number, { nickname?: string; name?: string; logo_url?: string }>>({});
  const [textKeys, setTextKeys] = useState<string[]>([]);
  const [multiKeys, setMultiKeys] = useState<string[]>([]);
  // Pit scouting
  const [pitRows, setPitRows] = useState<PitEntry[]>([]);
  const [pitTemplate, setPitTemplate] = useState<FormField[]>([]);

  async function load() {
    setStatus('Loading...');
    let q = supabase.from('scouting_entries').select('id,event_code,match_key,team_number,season,metrics,scout_name,created_at,scouted_at');
    if (teamNumber) q = q.eq('team_number', parseInt(teamNumber, 10));
    if (scope === 'event') {
      const ce = getStoredCurrentEventCode();
      if (ce) q = q.eq('event_code', ce);
    } else {
      // scope = season
      // If current event exists, derive its season; else use current year
      let seasonYear = new Date().getFullYear();
      const ce = getStoredCurrentEventCode();
      if (ce && /^\d{4}/.test(ce)) seasonYear = parseInt(ce.slice(0,4), 10);
      q = q.eq('season', seasonYear);
    }
    // Sort newest first by scouted_at then created_at
    const { data, error } = await q
      .order('scouted_at', { ascending: false })
      .order('created_at', { ascending: false });
    if (error) setStatus(`Error: ${error.message}`);
    else {
      const entries = (data as Entry[] | null) || [];
      setRows(entries);
      // Load human-readable event names for the codes present in results
      try {
        const codes = Array.from(new Set(entries.map((r) => r.event_code).filter(Boolean)));
        if (codes.length > 0) {
          const { data: evs } = await supabase.from('events').select('code,name').in('code', codes);
          const map: Record<string, string> = {};
          for (const e of (evs as EventNameRow[] | null) || []) map[e.code] = e.name;
          setEventNames(map);
        } else {
          setEventNames({});
        }
        // Load team names/logos
        const teamNums = Array.from(new Set(entries.map((r) => r.team_number).filter(Boolean)));
        if (teamNums.length > 0) {
          const { data: teams } = await supabase.from('frc_teams').select('number,nickname,name,logo_url').in('number', teamNums);
          const tmap: Record<number, { nickname?: string; name?: string; logo_url?: string }> = {};
          ((teams as TeamInfoRow[] | null) || []).forEach((t) => { tmap[t.number] = { nickname: t.nickname || undefined, name: t.name || undefined, logo_url: t.logo_url || undefined }; });
          setTeamInfo(tmap);
        } else {
          setTeamInfo({});
        }
        // Determine field types from current season template to separate numeric/multi/text (match)
        let seasonYear = new Date().getFullYear();
        if (scope === 'event') {
          const first = entries[0];
          if (first?.season) seasonYear = first.season;
          else {
            const ce = getStoredCurrentEventCode();
            if (ce && /^\d{4}/.test(ce)) seasonYear = parseInt(ce.slice(0,4), 10);
          }
        } else {
          // already based on season
          const first = entries[0];
          if (first?.season) seasonYear = first.season;
        }
        const { data: tpl } = await supabase
          .from('form_templates')
          .select('form_definition')
          .eq('season', seasonYear)
          .maybeSingle<FormTemplateRow>();
        const def = tpl?.form_definition || [];
        const tKeys: string[] = [];
        const mKeys: string[] = [];
        def.forEach((f) => {
          if (f?.type === 'text') tKeys.push(String(f.label));
          if (f?.type === 'multiselect') mKeys.push(String(f.label));
        });
        setTextKeys(tKeys);
        setMultiKeys(mKeys);

        // Load pit entries (same scope filters)
        let pq = supabase.from('pit_entries').select('team_number,metrics,photos,created_at,season,event_code');
        if (scope === 'event') {
          const ce = getStoredCurrentEventCode();
          if (ce) pq = pq.eq('event_code', ce);
        } else {
          pq = pq.eq('season', seasonYear);
        }
        const { data: pRows } = await pq.order('created_at', { ascending: false });
        setPitRows((pRows as PitEntry[] | null) || []);

        // Load pit template for the same season
        const { data: ptpl } = await supabase
          .from('pit_templates')
          .select('form_definition')
          .eq('season', seasonYear)
          .maybeSingle<FormTemplateRow>();
        setPitTemplate(ptpl?.form_definition || []);
      } catch {}
      setStatus('');
    }
  }

  useEffect(() => {
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
    // exclude known text keys
    const filtered = Array.from(candidates).filter((k) => !textKeys.includes(k));
    return filtered.sort();
  }, [rows, textKeys]);

  const categoricalMetrics = useMemo(() => {
    // Only include fields declared as multiselect in template
    const set = new Set(multiKeys);
    // Ensure there is data for them
    const available = new Set<string>();
    for (const r of rows) {
      const m = r.metrics || {};
      for (const key of set) {
        const v = m[key];
        if ((Array.isArray(v) && v.length) || (typeof v === 'string' && v.trim().length)) available.add(key);
      }
    }
    return Array.from(available).sort();
  }, [rows, multiKeys]);

  function computeTeamVsField(metric: string) {
    const isTeamRow = (r: Entry) => teamNumber && r.team_number === Number(teamNumber);
    const numeric = rows
      .map((r) => ({ r, val: Number(r.metrics?.[metric]) }))
      .filter(({ val }) => !Number.isNaN(val));
    const teamVals = numeric.filter(({ r }) => isTeamRow(r)).map(({ val }) => val);
    const othersVals = numeric.filter(({ r }) => !isTeamRow(r)).map(({ val }) => val);
    const avg = (arr: number[]) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0);
    return { teamAvg: +avg(teamVals).toFixed(2), othersAvg: +avg(othersVals).toFixed(2) };
  }

  const hasTeamNumericData = (metric: string) => {
    // Consider "has data" only if the team has at least one non-zero numeric entry for this metric
    const tnum = Number(teamNumber);
    if (!tnum) return false;
    for (const r of rows) {
      if (r.team_number === tnum) {
        const raw = r.metrics?.[metric];
        const v = Number(raw);
        if (!Number.isNaN(v) && v > 0) return true;
      }
    }
    return false;
  };

  function formatTime(iso?: string | null) {
    if (!iso) return '';
    try {
      const dt = new Date(iso);
      return new Intl.DateTimeFormat('en-US', {
        year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
        hour12: false, timeZone: 'America/Los_Angeles'
      }).format(dt);
    } catch { return iso; }
  }

  return (
    <div className="p-4 max-w-[960px] mx-auto grid gap-3">
      <h1>Analysis</h1>

      <div className="flex gap-3 items-center flex-wrap">
        <label>
          Team Number
          <input value={teamNumber} onChange={(e) => setTeamNumber(e.target.value)} placeholder="2767" className="ml-2 px-2 py-1.5 border border-zinc-300 dark:border-zinc-600 rounded-md bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100" />
        </label>
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
        <button onClick={load} className="px-3 py-2 rounded-md bg-blue-600 text-white font-medium hover:bg-blue-700">Load</button>
        <span className="text-zinc-500 dark:text-zinc-400">{status}</span>
      </div>

      {numericMetrics.length > 0 && (
        <>
          {/* Summary metric cards */}
          <div className="grid gap-3 mb-2 [grid-template-columns:repeat(auto-fit,minmax(240px,1fr))]">
            {numericMetrics.map((metric) => {
              if (!hasTeamNumericData(metric)) return null;
              const { teamAvg, othersAvg } = computeTeamVsField(metric);
              const deltaPct = othersAvg === 0 ? (teamAvg > 0 ? 100 : 0) : ((teamAvg - othersAvg) / othersAvg) * 100;
              // Hide cards with no data
              if (Number.isNaN(teamAvg) && Number.isNaN(othersAvg)) return null;
              return (
                <div key={metric} className="border border-zinc-200 dark:border-zinc-700 rounded-lg p-3 bg-zinc-50 dark:bg-zinc-800">
                  <div className="text-xs text-zinc-500 dark:text-zinc-400">{metric}</div>
                  <div className="flex gap-3 items-baseline mt-1">
                    <div className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">{teamAvg}</div>
                    <div className="text-xs text-zinc-500 dark:text-zinc-400">vs Others {othersAvg} ({deltaPct.toFixed(0)}%)</div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Team progression charts (compact) */}
          <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(280px,1fr))]">
            {numericMetrics.map((metric) => {
              if (!hasTeamNumericData(metric)) return null;
              const data = rows
                .filter((r) => r.team_number === Number(teamNumber))
                .map((r) => ({ name: r.match_key, Team: Number(r.metrics?.[metric]) || 0 }))
                .filter((d) => !Number.isNaN(d.Team))
                .reverse(); // newest first above; reverse for progression
              if (data.length === 0) return null; // hide empty charts
              return (
                <div key={metric} className="h-[220px] bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg p-2">
                  <div className="text-xs text-zinc-500 dark:text-zinc-400 mb-1">{metric}</div>
                  <ResponsiveContainer width="100%" height="85%">
                    <BarChart data={data} margin={{ top: 8, right: 8, bottom: 8, left: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" hide />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="Team" fill="#8884d8" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              );
            })}
          </div>
        </>
      )}

      {categoricalMetrics.length > 0 && (
        <>
          <h2>Multi‑select metrics</h2>
          <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(280px,1fr))]">
            {categoricalMetrics.map((metric) => {
              // collect all option values seen for this metric
              const optionSet = new Set<string>();
              rows.forEach((r) => {
                const v = r.metrics?.[metric];
                if (Array.isArray(v)) v.forEach((x) => optionSet.add(String(x)));
                else if (typeof v === 'string' && v) optionSet.add(v);
              });
              const options = Array.from(optionSet).sort();
              // counts for team vs others per option
              const teamNum = Number(teamNumber);
              const counts = options.map((opt) => {
                let teamCount = 0;
                let othersCount = 0;
                rows.forEach((r) => {
                  const isTeam = teamNumber ? r.team_number === teamNum : false;
                  const v = r.metrics?.[metric];
                  const has = Array.isArray(v) ? v.includes(opt) : v === opt;
                  if (has) {
                    if (isTeam) teamCount += 1; else othersCount += 1;
                  }
                });
                return { name: opt, Team: teamCount, Others: othersCount };
              });
              // hide if no team has entries for this metric
              if (counts.every(c => c.Team === 0)) return null;
              return (
                <div key={metric} className="h-[240px] bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg p-2">
                  <div className="text-xs text-zinc-500 dark:text-zinc-400 mb-1">{metric}</div>
                  <ResponsiveContainer width="100%" height="85%">
                    <BarChart data={counts} margin={{ top: 8, right: 8, bottom: 8, left: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis allowDecimals={false} />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="Others" fill="#c1c1ff" />
                      <Bar dataKey="Team" fill="#8884d8" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Recent text fields (bottom) */}
      <div>
        <h2>Recent text notes</h2>
        {textKeys.length === 0 && <div className="text-zinc-500 dark:text-zinc-400">No text fields configured.</div>}
        <div className="grid gap-3">
          {textKeys.map((key) => {
            const teamRows = rows.filter((r) => r.team_number === Number(teamNumber));
            const notes = teamRows
              .map((r) => ({ t: formatTime(r.scouted_at ?? r.created_at), c: String(r.metrics?.[key] ?? '') }))
              .filter((x) => x.c && x.c.trim().length > 0)
              .slice(0, 5);
            if (notes.length === 0) return null;
            return (
              <div key={key}>
                <div className="font-semibold mb-1.5 text-zinc-900 dark:text-zinc-100">{key}</div>
                <div className="grid gap-2">
                  {notes.map((x, i) => (
                    <div key={i} className="border border-zinc-200 dark:border-zinc-700 rounded-lg p-2">
                      <div className="text-xs text-zinc-500 dark:text-zinc-400">{x.t}</div>
                      <div className="text-zinc-900 dark:text-zinc-100">{x.c}</div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Pit scouting summary for selected team */}
      {teamNumber && (
        <div>
          <h2>Pit scouting</h2>
          {(() => {
            const tnum = Number(teamNumber);
            const teamPit = pitRows.filter(r => r.team_number === tnum);
            if (!teamPit.length) return <div className="text-zinc-500 dark:text-zinc-400">No pit entry.</div>;
            const entry = teamPit[0];
            const photos: string[] = entry.photos || [];
            return (
              <div className="grid gap-2.5">
                {photos.length > 0 && (
                  <div className="flex gap-2 overflow-x-auto">
                    {photos.map((url, i) => (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img key={i} src={url} alt="robot" width={96} height={96} className="object-cover rounded-md border border-zinc-200 dark:border-zinc-700" />
                    ))}
                  </div>
                )}
                <div className="grid gap-1.5">
                  {pitTemplate.map((f) => {
                    const val = entry.metrics?.[f.label];
                    if (val === undefined || val === '' || (Array.isArray(val) && val.length === 0)) return null;
                    return (
                      <div key={f.id} className="flex gap-2">
                        <div className="w-[180px] text-zinc-500 dark:text-zinc-400">{f.label}</div>
                        <div className="font-semibold text-zinc-900 dark:text-zinc-100">{Array.isArray(val) ? val.join(', ') : String(val)}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })()}
        </div>
      )}

      <h2>Raw Entries</h2>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr>
              <th className="border-b border-zinc-200 dark:border-zinc-700 text-left px-1.5 py-1.5 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100">Match</th>
              <th className="border-b border-zinc-200 dark:border-zinc-700 text-left px-1.5 py-1.5 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100">Team</th>
              <th className="border-b border-zinc-200 dark:border-zinc-700 text-left px-1.5 py-1.5 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100">Event</th>
              <th className="border-b border-zinc-200 dark:border-zinc-700 text-left px-1.5 py-1.5 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100">Scout</th>
              <th className="border-b border-zinc-200 dark:border-zinc-700 text-left px-1.5 py-1.5 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100">Time</th>
              <th className="border-b border-zinc-200 dark:border-zinc-700 text-left px-1.5 py-1.5 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100">Metrics</th>
            </tr>
          </thead>
          <tbody>
            {(teamNumber ? rows.filter((r) => r.team_number === Number(teamNumber)) : []).map((r) => (
              <tr key={r.id}>
                <td className="border-b border-zinc-100 dark:border-zinc-700 px-1.5 py-1.5 text-zinc-900 dark:text-zinc-100">{r.match_key}</td>
                <td className="border-b border-zinc-100 dark:border-zinc-700 px-1.5 py-1.5 text-zinc-900 dark:text-zinc-100">
                  <div className="flex items-center gap-1.5">
                    {teamInfo[r.team_number]?.logo_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={teamInfo[r.team_number]!.logo_url!} alt="" width={18} height={18} className="rounded" />
                    ) : null}
                    <span>{teamInfo[r.team_number]?.nickname || teamInfo[r.team_number]?.name || r.team_number}</span>
                  </div>
                </td>
                <td className="border-b border-zinc-100 dark:border-zinc-700 px-1.5 py-1.5 text-zinc-900 dark:text-zinc-100">{eventNames[r.event_code] ?? r.event_code}</td>
                <td className="border-b border-zinc-100 dark:border-zinc-700 px-1.5 py-1.5 text-zinc-900 dark:text-zinc-100">{r.scout_name ?? ''}</td>
                <td className="border-b border-zinc-100 dark:border-zinc-700 px-1.5 py-1.5 text-zinc-900 dark:text-zinc-100">{formatTime(r.scouted_at ?? r.created_at)}</td>
                <td className="border-b border-zinc-100 dark:border-zinc-700 px-1.5 py-1.5 font-mono whitespace-pre-wrap text-zinc-900 dark:text-zinc-100">{JSON.stringify(r.metrics)}</td>
              </tr>
            ))}
            {!teamNumber && (
              <tr>
                <td colSpan={6} className="px-2 py-2 text-zinc-500 dark:text-zinc-400">Enter a team number above to view their entries.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

