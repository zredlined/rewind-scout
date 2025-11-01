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
  // Removed timeframe slider; scope handles event vs season
  const [rows, setRows] = useState<Entry[]>([]);
  const [status, setStatus] = useState<string>('');
  const [scope, setScope] = useState<'event' | 'season'>('event');
  const [eventNames, setEventNames] = useState<Record<string, string>>({});
  const [teamInfo, setTeamInfo] = useState<Record<number, { nickname?: string; name?: string; logo_url?: string }>>({});
  const [textKeys, setTextKeys] = useState<string[]>([]);
  const [multiKeys, setMultiKeys] = useState<string[]>([]);
  // Pit scouting
  const [pitRows, setPitRows] = useState<Array<{ team_number: number; metrics: any; photos?: string[]; created_at?: string; scouted_at?: string; season?: number; event_code?: string }>>([]);
  const [pitTemplate, setPitTemplate] = useState<Array<{ id: string; label: string; type: string; options?: string[] }>>([]);

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
    // Sort newest first by scouted_at then created_at
    const { data, error } = await q
      .order('scouted_at', { ascending: false })
      .order('created_at', { ascending: false });
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
        // Load team names/logos
        const teamNums = Array.from(new Set(entries.map((r) => r.team_number).filter(Boolean)));
        if (teamNums.length > 0) {
          const { data: teams } = await supabase.from('frc_teams').select('number,nickname,name,logo_url').in('number', teamNums);
          const tmap: any = {};
          (teams as any[] || []).forEach((t) => { tmap[t.number] = { nickname: t.nickname, name: t.name, logo_url: t.logo_url }; });
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
            const ce = (typeof window !== 'undefined') ? localStorage.getItem('currentEventCode') : null;
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
          .maybeSingle();
        const def = (tpl?.form_definition as any[]) || [];
        const tKeys: string[] = [];
        const mKeys: string[] = [];
        def.forEach((f: any) => {
          if (f?.type === 'text') tKeys.push(String(f.label));
          if (f?.type === 'multiselect') mKeys.push(String(f.label));
        });
        setTextKeys(tKeys);
        setMultiKeys(mKeys);

        // Load pit entries (same scope filters)
        let pq = supabase.from('pit_entries').select('team_number,metrics,photos,created_at,season,event_code');
        if (scope === 'event') {
          try { const ce = localStorage.getItem('currentEventCode'); if (ce) pq = pq.eq('event_code', ce); } catch {}
        } else {
          pq = pq.eq('season', seasonYear);
        }
        const { data: pRows } = await pq.order('created_at', { ascending: false });
        setPitRows((pRows as any[]) || []);

        // Load pit template for the same season
        const { data: ptpl } = await supabase
          .from('pit_templates')
          .select('form_definition')
          .eq('season', seasonYear)
          .maybeSingle();
        setPitTemplate(((ptpl?.form_definition as any[]) || []));
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
        const v: any = (m as any)[key];
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
        const raw = (r.metrics as any)?.[metric];
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
        <button onClick={load} style={{ padding: 8, borderRadius: 6, background: '#111', color: '#fff' }}>Load</button>
        <span style={{ color: '#555' }}>{status}</span>
      </div>

      {numericMetrics.length > 0 && (
        <>
          {/* Summary metric cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12, marginBottom: 8 }}>
            {numericMetrics.map((metric) => {
              if (!hasTeamNumericData(metric)) return null;
              const { teamAvg, othersAvg } = computeTeamVsField(metric);
              const deltaPct = othersAvg === 0 ? (teamAvg > 0 ? 100 : 0) : ((teamAvg - othersAvg) / othersAvg) * 100;
              // Hide cards with no data
              if (Number.isNaN(teamAvg) && Number.isNaN(othersAvg)) return null;
              return (
                <div key={metric} style={{ border: '1px solid #eee', borderRadius: 8, padding: 12, background: '#fafafa' }}>
                  <div style={{ fontSize: 12, color: '#666' }}>{metric}</div>
                  <div style={{ display: 'flex', gap: 12, alignItems: 'baseline', marginTop: 4 }}>
                    <div style={{ fontSize: 24, fontWeight: 700 }}>{teamAvg}</div>
                    <div style={{ fontSize: 12, color: '#666' }}>vs Others {othersAvg} ({deltaPct.toFixed(0)}%)</div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Team progression charts (compact) */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12 }}>
            {numericMetrics.map((metric) => {
              if (!hasTeamNumericData(metric)) return null;
              const data = rows
                .filter((r) => r.team_number === Number(teamNumber))
                .map((r) => ({ name: r.match_key, Team: Number(r.metrics?.[metric]) || 0 }))
                .filter((d) => !Number.isNaN(d.Team))
                .reverse(); // newest first above; reverse for progression
              if (data.length === 0) return null; // hide empty charts
              return (
                <div key={metric} style={{ height: 220, background: '#fafafa', border: '1px solid #eee', borderRadius: 8, padding: 8 }}>
                  <div style={{ fontSize: 12, color: '#666', marginBottom: 4 }}>{metric}</div>
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
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12 }}>
            {categoricalMetrics.map((metric) => {
              // collect all option values seen for this metric
              const optionSet = new Set<string>();
              rows.forEach((r) => {
                const v: any = (r.metrics as any)?.[metric];
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
                  const v: any = (r.metrics as any)?.[metric];
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
                <div key={metric} style={{ height: 240, background: '#fafafa', border: '1px solid #eee', borderRadius: 8, padding: 8 }}>
                  <div style={{ fontSize: 12, color: '#666', marginBottom: 4 }}>{metric}</div>
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
        {textKeys.length === 0 && <div style={{ color: '#666' }}>No text fields configured.</div>}
        <div style={{ display: 'grid', gap: 12 }}>
          {textKeys.map((key) => {
            const teamRows = rows.filter((r) => r.team_number === Number(teamNumber));
            const notes = teamRows
              .map((r) => ({ t: formatTime(r.scouted_at ?? r.created_at), c: String((r.metrics as any)?.[key] ?? '') }))
              .filter((x) => x.c && x.c.trim().length > 0)
              .slice(0, 5);
            if (notes.length === 0) return null;
            return (
              <div key={key}>
                <div style={{ fontWeight: 600, marginBottom: 6 }}>{key}</div>
                <div style={{ display: 'grid', gap: 8 }}>
                  {notes.map((x, i) => (
                    <div key={i} style={{ border: '1px solid #eee', borderRadius: 8, padding: 8 }}>
                      <div style={{ fontSize: 12, color: '#666' }}>{x.t}</div>
                      <div>{x.c}</div>
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
            if (!teamPit.length) return <div style={{ color: '#666' }}>No pit entry.</div>;
            const entry = teamPit[0];
            const photos: string[] = (entry.photos as any) || [];
            return (
              <div style={{ display: 'grid', gap: 10 }}>
                {photos.length > 0 && (
                  <div style={{ display: 'flex', gap: 8, overflowX: 'auto' }}>
                    {photos.map((url, i) => (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img key={i} src={url} alt="robot" width={96} height={96} style={{ objectFit: 'cover', borderRadius: 6, border: '1px solid #eee' }} />
                    ))}
                  </div>
                )}
                <div style={{ display: 'grid', gap: 6 }}>
                  {pitTemplate.map((f) => {
                    const val = (entry.metrics as any)?.[f.label];
                    if (val === undefined || val === '' || (Array.isArray(val) && val.length === 0)) return null;
                    return (
                      <div key={f.id} style={{ display: 'flex', gap: 8 }}>
                        <div style={{ width: 180, color: '#555' }}>{f.label}</div>
                        <div style={{ fontWeight: 600 }}>{Array.isArray(val) ? val.join(', ') : String(val)}</div>
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
                <td style={{ borderBottom: '1px solid #f0f0f0', padding: 6 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    {teamInfo[r.team_number]?.logo_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={teamInfo[r.team_number]!.logo_url!} alt="" width={18} height={18} style={{ borderRadius: 4 }} />
                    ) : null}
                    <span>{teamInfo[r.team_number]?.nickname || teamInfo[r.team_number]?.name || r.team_number}</span>
                  </div>
                </td>
                <td style={{ borderBottom: '1px solid #f0f0f0', padding: 6 }}>{eventNames[r.event_code] ?? r.event_code}</td>
                <td style={{ borderBottom: '1px solid #f0f0f0', padding: 6 }}>{r.scout_name ?? ''}</td>
                <td style={{ borderBottom: '1px solid #f0f0f0', padding: 6 }}>{formatTime(r.scouted_at ?? r.created_at)}</td>
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


