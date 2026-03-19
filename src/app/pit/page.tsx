'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

type PitField = { id: string; label: string; type: 'number' | 'text' | 'multiselect'; options?: string[] };
type PitSubmissionSummary = { eventCode: string; teamNumber: string };
type PitFieldValue = string | number;
type PitTemplateRow = { form_definition: PitField[] | null };
type EventIdRow = { id: string };
type MatchTeamsRow = { red_teams: number[] | null; blue_teams: number[] | null };
type TeamRow = { number: number; nickname: string | null; name: string | null; logo_url: string | null };

function getStoredCurrentEventCode(): string {
  if (typeof window === 'undefined') return '';
  try {
    return localStorage.getItem('currentEventCode') || '';
  } catch {
    return '';
  }
}

function getStoredSeason(defaultSeason: number): number {
  const code = getStoredCurrentEventCode();
  if (code && /^\d{4}/.test(code)) return parseInt(code.slice(0, 4), 10);
  return defaultSeason;
}

export default function PitScoutingPage() {
  const router = useRouter();
  const defaultSeason = new Date().getFullYear();
  const [season, setSeason] = useState<number>(() => getStoredSeason(defaultSeason));
  const [eventCode, setEventCode] = useState<string>(getStoredCurrentEventCode);
  const [teamNumber, setTeamNumber] = useState<string>('');
  const [fields, setFields] = useState<PitField[]>([]);
  const [values, setValues] = useState<Record<string, PitFieldValue>>({});
  const [status, setStatus] = useState<string>('');
  const [teams, setTeams] = useState<Array<{ number: number; name: string; logo?: string }>>([]);
  const [photos, setPhotos] = useState<File[]>([]);
  const [hasCurrentEvent] = useState(() => Boolean(getStoredCurrentEventCode()));
  const [justSubmitted, setJustSubmitted] = useState(false);
  const [submissionSummary, setSubmissionSummary] = useState<PitSubmissionSummary | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => { if (!data.user) router.replace('/login'); });
  }, [router]);

  useEffect(() => {
    async function loadTemplate() {
      setStatus('Loading template...');
      const { data, error } = await supabase
        .from('pit_templates')
        .select('form_definition')
        .eq('season', season)
        .maybeSingle<PitTemplateRow>();
      if (error) { setStatus(`Error: ${error.message}`); return; }
      const def = data?.form_definition || [];
      setFields(def);
      const init: Record<string, PitFieldValue> = {};
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
      const { data: ev } = await supabase.from('events').select('id').eq('code', eventCode).maybeSingle<EventIdRow>();
      if (!ev?.id) { setTeams([]); return; }
      const { data: ms } = await supabase.from('matches').select('red_teams,blue_teams').eq('event_id', ev.id);
      const setNums = new Set<number>();
      ((ms as MatchTeamsRow[] | null) || []).forEach(m => {
        (m.red_teams || []).forEach((n: number) => setNums.add(n));
        (m.blue_teams || []).forEach((n: number) => setNums.add(n));
      });
      const nums = Array.from(setNums);
      if (nums.length === 0) { setTeams([]); return; }
      const { data: ti } = await supabase.from('frc_teams').select('number,nickname,name,logo_url').in('number', nums);
      const t = ((ti as TeamRow[] | null) || []).map((team) => ({
        number: team.number,
        name: team.nickname || team.name || String(team.number),
        logo: team.logo_url || undefined,
      }));
      // sort by team number
      t.sort((a, b) => a.number - b.number);
      setTeams(t);
    }
    loadTeams();
  }, [eventCode]);

  function setValue(label: string, v: PitFieldValue) { setValues(prev => ({ ...prev, [label]: v })); }

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
    const submittedTeamNumber = teamNumber;
    const init: Record<string, PitFieldValue> = {};
    fields.forEach(f => {
      if (f.type === 'number') init[f.label] = 0;
      if (f.type === 'text') init[f.label] = '';
      if (f.type === 'multiselect') init[f.label] = '';
    });
    setValues(init);
    setTeamNumber('');
    setStatus('Pit scouting submitted.');
    setPhotos([]);
    setJustSubmitted(true);
    setSubmissionSummary({ eventCode, teamNumber: submittedTeamNumber });
  }

  return (
    <div style={{ padding: 16, maxWidth: 840, margin: '0 auto', display: 'grid', gap: 12 }}>
      <h1>Pit Scouting</h1>
      {!hasCurrentEvent && (
        <div style={{ border: '1px solid #f3d18a', background: '#fff8e8', borderRadius: 12, padding: 12 }}>
          <div style={{ fontWeight: 700 }}>Check in before pit scouting</div>
          <div style={{ marginTop: 4, color: '#6b5a22' }}>
            Checking in first narrows pit teams to the event you are actually working.
          </div>
          <button onClick={() => router.push('/check-in')} style={{ marginTop: 10, padding: 8, borderRadius: 6, background: '#111', color: '#fff' }}>
            Go to check-in
          </button>
        </div>
      )}
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

      {justSubmitted && submissionSummary && (
        <div style={{ border: '1px solid #c9f0d4', background: '#f3fff7', borderRadius: 12, padding: 14, display: 'grid', gap: 10 }}>
          <div>
            <div style={{ fontWeight: 700, color: '#155724' }}>Pit entry saved</div>
            <div style={{ marginTop: 4, color: '#2b5b37' }}>
              {submissionSummary.eventCode} • Team {submissionSummary.teamNumber}
            </div>
          </div>
          <div style={{ color: '#35543d' }}>
            Keep working through the pit list, or jump out to analysis and the leaderboard.
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button
              onClick={() => setJustSubmitted(false)}
              style={{ padding: 8, borderRadius: 6, background: '#111', color: '#fff' }}
            >
              Scout next pit
            </button>
            <button
              onClick={() => router.push('/analysis')}
              style={{ padding: 8, borderRadius: 6, border: '1px solid #ccc' }}
            >
              View analysis
            </button>
            <button
              onClick={() => router.push('/me')}
              style={{ padding: 8, borderRadius: 6, border: '1px solid #ccc' }}
            >
              View leaderboard
            </button>
            <button
              onClick={() => router.push('/check-in')}
              style={{ padding: 8, borderRadius: 6, border: '1px solid #ccc' }}
            >
              Switch event
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

