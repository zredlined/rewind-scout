'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';

type FieldType = 'counter' | 'checkbox' | 'text';
type FormField = { id: string; label: string; type: FieldType };

export default function ScoutPage() {
  const defaultSeason = new Date().getFullYear();
  const [season, setSeason] = useState<number>(defaultSeason);
  const [eventCode, setEventCode] = useState<string>('');
  const [matchKey, setMatchKey] = useState<string>('');
  const [teamNumber, setTeamNumber] = useState<string>('');
  const [fields, setFields] = useState<FormField[]>([]);
  const [values, setValues] = useState<Record<string, any>>({});
  const [status, setStatus] = useState<string>('');

  useEffect(() => {
    async function load() {
      setStatus('Loading form...');
      const { data, error } = await supabase
        .from('form_templates')
        .select('form_definition')
        .eq('season', season)
        .maybeSingle();
      if (error) {
        setStatus(`Error: ${error.message}`);
      } else {
        const def = (data?.form_definition as any) ?? [];
        const arr = Array.isArray(def) ? def : [];
        setFields(arr);
        const initial: Record<string, any> = {};
        for (const f of arr) {
          if (f.type === 'counter') initial[f.label] = 0;
          if (f.type === 'checkbox') initial[f.label] = false;
          if (f.type === 'text') initial[f.label] = '';
        }
        setValues(initial);
        setStatus('');
      }
    }
    load();
  }, [season]);

  function setValue(label: string, v: any) {
    setValues((prev) => ({ ...prev, [label]: v }));
  }

  async function submit() {
    if (!eventCode || !matchKey || !teamNumber) {
      setStatus('Enter event code, match key, and team number');
      return;
    }
    setStatus('Submitting...');
    const { data: userData } = await supabase.auth.getUser();
    const scoutId = userData.user?.id ?? null;
    const payload = {
      season,
      event_code: eventCode,
      match_key: matchKey,
      team_number: parseInt(teamNumber, 10),
      scout_id: scoutId,
      metrics: values,
    };
    const { error } = await supabase.from('scouting_entries').insert(payload);
    if (error) {
      setStatus(`Error: ${error.message}`);
      return;
    }
    // clear except event code
    setMatchKey('');
    setTeamNumber('');
    const reset: Record<string, any> = {};
    for (const f of fields) {
      if (f.type === 'counter') reset[f.label] = 0;
      if (f.type === 'checkbox') reset[f.label] = false;
      if (f.type === 'text') reset[f.label] = '';
    }
    setValues(reset);
    setStatus('Submitted.');
  }

  return (
    <div style={{ padding: 16, maxWidth: 720, margin: '0 auto' }}>
      <h1>Scouting Form</h1>

      <div style={{ display: 'grid', gap: 12, marginTop: 12 }}>
        <label>
          Season
          <input type="number" value={season} onChange={(e) => setSeason(parseInt(e.target.value || String(defaultSeason), 10))} style={{ marginLeft: 8, padding: 6, border: '1px solid #ccc', borderRadius: 6 }} />
        </label>
        <label>
          Event Code
          <input value={eventCode} onChange={(e) => setEventCode(e.target.value)} placeholder="2026miket" style={{ marginLeft: 8, padding: 6, border: '1px solid #ccc', borderRadius: 6 }} />
        </label>
        <label>
          Match Key
          <input value={matchKey} onChange={(e) => setMatchKey(e.target.value)} placeholder="qm12" style={{ marginLeft: 8, padding: 6, border: '1px solid #ccc', borderRadius: 6 }} />
        </label>
        <label>
          Team Number
          <input value={teamNumber} onChange={(e) => setTeamNumber(e.target.value)} placeholder="2767" style={{ marginLeft: 8, padding: 6, border: '1px solid #ccc', borderRadius: 6 }} />
        </label>
      </div>

      <div style={{ marginTop: 16, display: 'grid', gap: 12 }}>
        {fields.map((f) => (
          <div key={f.id} style={{ display: 'grid', gap: 8 }}>
            <label>{f.label}</label>
            {f.type === 'counter' && (
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <button onClick={() => setValue(f.label, Math.max(0, (values[f.label] ?? 0) - 1))} style={{ padding: 8 }}>-</button>
                <span style={{ minWidth: 32, textAlign: 'center' }}>{values[f.label] ?? 0}</span>
                <button onClick={() => setValue(f.label, (values[f.label] ?? 0) + 1)} style={{ padding: 8 }}>+</button>
              </div>
            )}
            {f.type === 'checkbox' && (
              <input type="checkbox" checked={!!values[f.label]} onChange={(e) => setValue(f.label, e.target.checked)} />
            )}
            {f.type === 'text' && (
              <textarea value={values[f.label] ?? ''} onChange={(e) => setValue(f.label, e.target.value)} rows={3} style={{ padding: 8, border: '1px solid #ccc', borderRadius: 6 }} />
            )}
          </div>
        ))}
      </div>

      <div style={{ marginTop: 16, display: 'flex', gap: 12, alignItems: 'center' }}>
        <button onClick={submit} style={{ padding: 10, borderRadius: 6, background: '#111', color: '#fff' }}>Submit</button>
        <span style={{ color: '#555' }}>{status}</span>
      </div>
    </div>
  );
}


