'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useRequireAuth } from '@/lib/AuthContext';

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

const inputCls = 'ml-2 px-2 py-1.5 border border-zinc-300 dark:border-zinc-600 rounded-md bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100';
const btnPrimary = 'px-3 py-2 rounded-md bg-blue-600 text-white font-medium hover:bg-blue-700';
const btnSecondary = 'px-3 py-2 rounded-md border border-zinc-300 dark:border-zinc-600 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800';

export default function PitScoutingPage() {
  const router = useRouter();
  const { user } = useRequireAuth();
  const defaultSeason = new Date().getFullYear();
  const [season, setSeason] = useState<number>(defaultSeason);
  const [eventCode, setEventCode] = useState<string>('');
  const [teamNumber, setTeamNumber] = useState<string>('');
  const [fields, setFields] = useState<PitField[]>([]);
  const [values, setValues] = useState<Record<string, PitFieldValue>>({});
  const [status, setStatus] = useState<string>('');
  const [teams, setTeams] = useState<Array<{ number: number; name: string; logo?: string }>>([]);
  const [photos, setPhotos] = useState<File[]>([]);
  const [hasCurrentEvent, setHasCurrentEvent] = useState(false);

  useEffect(() => {
    const code = getStoredCurrentEventCode();
    if (code) {
      setEventCode(code);
      setSeason(getStoredSeason(defaultSeason));
      setHasCurrentEvent(true);
    }
  }, [defaultSeason]);
  const [justSubmitted, setJustSubmitted] = useState(false);
  const [submissionSummary, setSubmissionSummary] = useState<PitSubmissionSummary | null>(null);

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
        if (f.type === 'number') init[f.label] = '';
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
    const scoutId = user?.id ?? null;
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
      if (f.type === 'number') init[f.label] = '';
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
    <div className="mx-auto max-w-3xl p-4 grid gap-3">
      <h1 className="text-xl font-bold">Pit Scouting</h1>

      {!hasCurrentEvent && (
        <div className="rounded-xl border border-yellow-300 dark:border-yellow-700 bg-yellow-50 dark:bg-yellow-950 p-3">
          <div className="font-bold text-zinc-900 dark:text-zinc-100">Check in before pit scouting</div>
          <div className="mt-1 text-sm text-yellow-800 dark:text-yellow-300">
            Checking in first narrows pit teams to the event you are actually working.
          </div>
          <button onClick={() => router.push('/check-in')} className={`mt-2.5 ${btnPrimary}`}>
            Go to check-in
          </button>
        </div>
      )}

      <div className="grid gap-3">
        <label className="text-sm font-medium">
          Season
          <input type="number" value={season} onChange={(e) => setSeason(parseInt(e.target.value || String(defaultSeason), 10))} className={inputCls} />
        </label>
        <label className="text-sm font-medium">
          Event Code
          <input value={eventCode} onChange={(e) => setEventCode(e.target.value)} placeholder="2026miket" className={inputCls} />
        </label>
        <label className="text-sm font-medium">
          Team
          <select value={teamNumber} onChange={(e) => setTeamNumber(e.target.value)} className={`${inputCls}`}>
            <option value="">Select team</option>
            {teams.map(t => (
              <option key={t.number} value={t.number}>{t.number} — {t.name}</option>
            ))}
          </select>
        </label>
        <label className="text-sm font-medium">
          Or enter team
          <input value={teamNumber} onChange={(e) => setTeamNumber(e.target.value)} placeholder="2767" className={inputCls} />
        </label>
      </div>

      <div className="mt-2 grid gap-3">
        {fields.map((f) => (
          <div key={f.id} className="grid gap-2">
            <label className="text-sm font-medium">{f.label}</label>
            {f.type === 'number' && (
              <input type="number" value={values[f.label] ?? ''} onChange={(e) => setValue(f.label, e.target.value === '' ? '' : Number(e.target.value))} placeholder="0" className={`${inputCls} ml-0`} />
            )}
            {f.type === 'text' && (
              <textarea value={values[f.label] ?? ''} onChange={(e) => setValue(f.label, e.target.value)} rows={3} className={`${inputCls} ml-0`} />
            )}
            {f.type === 'multiselect' && (
              <div className="flex gap-2 flex-wrap">
                {(f.options || []).map((opt) => {
                  const rawSelected = values[f.label];
                  const selected = typeof rawSelected === 'string' ? rawSelected : '';
                  const isOn = selected === opt;
                  return (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => setValue(f.label, isOn ? '' : opt)}
                      className={`px-2.5 py-1.5 rounded-full border text-sm ${isOn ? 'bg-blue-600 border-blue-600 text-white' : 'border-zinc-300 dark:border-zinc-600 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800'}`}
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

      <div className="grid gap-2">
        <span className="text-sm font-medium">Photos</span>
        <label className={`${btnSecondary} inline-flex items-center gap-2 cursor-pointer w-fit`}>
          <span>📷</span>
          <span>{photos.length ? `${photos.length} photo${photos.length > 1 ? 's' : ''} selected` : 'Take or choose photos'}</span>
          <input type="file" accept="image/*" capture="environment" multiple onChange={(e) => onPickPhotos(e.target.files)} className="hidden" />
        </label>
        {photos.length > 0 && (
          <div className="flex overflow-x-auto gap-2">
            {photos.map((f, idx) => (
              <div key={idx} className="min-w-[80px] min-h-[80px] border border-zinc-200 dark:border-zinc-700 rounded-md flex items-center justify-center p-1 bg-zinc-50 dark:bg-zinc-800">
                <span className="text-xs text-zinc-500 dark:text-zinc-400 text-center break-all">{f.name}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex gap-3 items-center">
        <button onClick={submit} className={btnPrimary}>Submit</button>
        <span className="text-sm text-zinc-500 dark:text-zinc-400">{status}</span>
      </div>

      {justSubmitted && submissionSummary && (
        <div className="rounded-xl border border-green-300 dark:border-green-800 bg-green-50 dark:bg-green-950 p-3.5 grid gap-2.5">
          <div>
            <div className="font-bold text-green-800 dark:text-green-300">Pit entry saved</div>
            <div className="mt-1 text-sm text-green-700 dark:text-green-400">
              {submissionSummary.eventCode} • Team {submissionSummary.teamNumber}
            </div>
          </div>
          <div className="text-sm text-green-700 dark:text-green-400">
            Keep working through the pit list, or jump out to analysis and the leaderboard.
          </div>
          <div className="flex gap-2 flex-wrap">
            <button onClick={() => setJustSubmitted(false)} className={btnPrimary}>
              Scout next pit
            </button>
            <button onClick={() => router.push('/analysis')} className={btnSecondary}>
              View analysis
            </button>
            <button onClick={() => router.push('/me')} className={btnSecondary}>
              View leaderboard
            </button>
            <button onClick={() => router.push('/check-in')} className={btnSecondary}>
              Switch event
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
