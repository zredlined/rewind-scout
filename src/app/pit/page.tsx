'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

type PitField = { id: string; label: string; type: 'number' | 'text' | 'multiselect'; options?: string[] };

export default function PitScoutingPage() {
  const router = useRouter();
  const defaultSeason = new Date().getFullYear();
  const [season, setSeason] = useState<number>(defaultSeason);
  const [eventCode, setEventCode] = useState<string>('');
  const [teamNumber, setTeamNumber] = useState<string>('');
  const [fields, setFields] = useState<PitField[]>([]);
  const [values, setValues] = useState<Record<string, any>>({});
  const [status, setStatus] = useState<string>('');
  const [teams, setTeams] = useState<Array<{ number: number; name: string; logo?: string }>>([]);
  const [photos, setPhotos] = useState<File[]>([]);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => { if (!data.user) router.replace('/login'); });
    // default event from local storage
    try {
      const ce = localStorage.getItem('currentEventCode');
      if (ce) { setEventCode(ce); const yr = parseInt(ce.slice(0,4), 10); if (!Number.isNaN(yr)) setSeason(yr); }
    } catch {}
  }, [router]);

  useEffect(() => {
    async function loadTemplate() {
      setStatus('Loading template...');
      const { data, error } = await supabase
        .from('pit_templates')
        .select('form_definition')
        .eq('season', season)
        .maybeSingle();
      if (error) { setStatus(`Error: ${error.message}`); return; }
      const def = (data?.form_definition as any[]) || [];
      setFields(def);
      const init: Record<string, any> = {};
      def.forEach(f => {
        if (f.type === 'number') init[f.label] = 0;
        if (f.type === 'text') init[f.label] = '';
        if (f.type === 'multiselect') init[f.label] = '';
      });
      setValues(init);
      setStatus('');
    }
    loadTemplate();
  }, [season]);

  useEffect(() => {
    async function loadTeams() {
      if (!eventCode) { setTeams([]); return; }
      // derive teams from matches for the event, then join frc_teams for names
      const { data: ev } = await supabase.from('events').select('id').eq('code', eventCode).maybeSingle();
      if (!ev?.id) { setTeams([]); return; }
      const { data: ms } = await supabase.from('matches').select('red_teams,blue_teams').eq('event_id', ev.id);
      const setNums = new Set<number>();
      (ms as any[] || []).forEach(m => {
        (m.red_teams || []).forEach((n: number) => setNums.add(n));
        (m.blue_teams || []).forEach((n: number) => setNums.add(n));
      });
      const nums = Array.from(setNums);
      if (nums.length === 0) { setTeams([]); return; }
      const { data: ti } = await supabase.from('frc_teams').select('number,nickname,name,logo_url').in('number', nums);
      const t = (ti as any[] || []).map(t => ({ number: t.number, name: t.nickname || t.name || String(t.number), logo: t.logo_url || undefined }));
      // sort by team number
      t.sort((a, b) => a.number - b.number);
      setTeams(t);
    }
    loadTeams();
  }, [eventCode]);

  function setValue(label: string, v: any) { setValues(prev => ({ ...prev, [label]: v })); }

  function onPickPhotos(files: FileList | null) {
    if (!files) return;
    const arr = Array.from(files);
    setPhotos(prev => [...prev, ...arr]);
  }

  async function uploadPhotos(): Promise<string[]> {
    if (photos.length === 0) return [];
    const bucket = 'pit-photos';
    const urls: string[] = [];
    for (const file of photos) {
      const path = `${season}/${eventCode}/${teamNumber}/${crypto.randomUUID()}.${(file.type.split('/')[1]||'jpg')}`;
      const { error } = await supabase.storage.from(bucket).upload(path, file, { upsert: false });
      if (!error) {
        const { data } = supabase.storage.from(bucket).getPublicUrl(path);
        if (data?.publicUrl) urls.push(data.publicUrl);
      }
    }
    return urls;
  }

  async function submit() {
    if (!eventCode || !teamNumber) { setStatus('Enter event code and team number'); return; }
    setStatus('Submitting...');
    const { data: userData } = await supabase.auth.getUser();
    const scoutId = userData.user?.id ?? null;
    const photoUrls = await uploadPhotos();
    const payload = {
      season,
      event_code: eventCode,
      team_number: parseInt(teamNumber, 10),
      scout_id: scoutId,
      metrics: values,
      photos: photoUrls,
    };
    const { error } = await supabase.from('pit_entries').insert(payload);
    if (error) { setStatus(`Error: ${error.message}`); return; }
    setStatus('Submitted.');
    setPhotos([]);
  }

  return (
    <div style={{ padding: 16, maxWidth: 840, margin: '0 auto', display: 'grid', gap: 12 }}>
      <h1>Pit Scouting</h1>
      <div style={{ display: 'grid', gap: 12 }}>
        <label>
          Season
          <input type="number" value={season} onChange={(e) => setSeason(parseInt(e.target.value || String(defaultSeason), 10))} style={{ marginLeft: 8, padding: 6, border: '1px solid #ccc', borderRadius: 6 }} />
        </label>
        <label>
          Event Code
          <input value={eventCode} onChange={(e) => setEventCode(e.target.value)} placeholder="2026miket" style={{ marginLeft: 8, padding: 6, border: '1px solid #ccc', borderRadius: 6 }} />
        </label>
        <label>
          Team
          <select value={teamNumber} onChange={(e) => setTeamNumber(e.target.value)} style={{ marginLeft: 8, padding: 6 }}>
            <option value="">Select team</option>
            {teams.map(t => (
              <option key={t.number} value={t.number}>{t.number} — {t.name}</option>
            ))}
          </select>
        </label>
        <label>
          Or enter team
          <input value={teamNumber} onChange={(e) => setTeamNumber(e.target.value)} placeholder="2767" style={{ marginLeft: 8, padding: 6, border: '1px solid #ccc', borderRadius: 6 }} />
        </label>
      </div>

      <div style={{ marginTop: 8, display: 'grid', gap: 12 }}>
        {fields.map((f) => (
          <div key={f.id} style={{ display: 'grid', gap: 8 }}>
            <label>{f.label}</label>
            {f.type === 'number' && (
              <input type="number" value={values[f.label] ?? 0} onChange={(e) => setValue(f.label, Number(e.target.value))} style={{ padding: 8, border: '1px solid #ccc', borderRadius: 6 }} />
            )}
            {f.type === 'text' && (
              <textarea value={values[f.label] ?? ''} onChange={(e) => setValue(f.label, e.target.value)} rows={3} style={{ padding: 8, border: '1px solid #ccc', borderRadius: 6 }} />
            )}
            {f.type === 'multiselect' && (
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {(f.options || []).map((opt) => {
                  const selected: string = values[f.label] || '';
                  const isOn = selected === opt;
                  return (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => setValue(f.label, isOn ? '' : opt)}
                      style={{ padding: '6px 10px', borderRadius: 16, border: '1px solid #ccc', background: isOn ? '#111' : '#fff', color: isOn ? '#fff' : '#111' }}
                    >
                      {opt}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gap: 8 }}>
        <label>
          Photos
          <input type="file" accept="image/*" capture="environment" multiple onChange={(e) => onPickPhotos(e.target.files)} style={{ display: 'block', marginTop: 6 }} />
        </label>
        <div style={{ display: 'flex', overflowX: 'auto', gap: 8 }}>
          {photos.map((f, idx) => (
            <div key={idx} style={{ minWidth: 80, minHeight: 80, border: '1px solid #eee', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 4 }}>
              <span style={{ fontSize: 12 }}>{f.name}</span>
            </div>
          ))}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        <button onClick={submit} style={{ padding: 10, borderRadius: 6, background: '#111', color: '#fff' }}>Submit</button>
        <span style={{ color: '#555' }}>{status}</span>
      </div>
    </div>
  );
}



