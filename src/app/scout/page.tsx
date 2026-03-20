'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useRequireAuth } from '@/lib/AuthContext';

type FieldType = 'counter' | 'checkbox' | 'text' | 'multiselect';
type FormField = { id: string; label: string; type: FieldType; options?: string[] };
type SubmissionSummary = { eventCode: string; matchKey: string; teamNumber: string };
type FieldValue = string | number | boolean;
type FormTemplateRow = { form_definition: FormField[] | null };
type EventOption = { code: string; name: string };
type MatchRow = { match_key: string };
type EventIdRow = { id: string };

function getStoredCurrentEventCode(): string {
  if (typeof window === 'undefined') return '';
  try {
    return localStorage.getItem('currentEventCode') || '';
  } catch {
    return '';
  }
}

function naturalMatchCompare(a: string, b: string): number {
  const rank = (t: string) => ({ qm: 1, qf: 2, sf: 3, f: 4 }[t] ?? 99);
  const parse = (k: string) => {
    // qm12 | qf1m2 | sf1m1 | f1m1
    const m = k.match(/^(qm|qf|sf|f)(\d+)?(?:m(\d+))?$/);
    if (!m) return { t: 'zz', a: 0, b: 0 };
    return { t: m[1], a: Number(m[2] || 0), b: Number(m[3] || 0) };
  };
  const A = parse(a);
  const B = parse(b);
  if (rank(A.t) !== rank(B.t)) return rank(A.t) - rank(B.t);
  if (A.a !== B.a) return A.a - B.a;
  return A.b - B.b;
}

export default function ScoutPage() {
  const defaultSeason = new Date().getFullYear();
  const router = useRouter();
  const { user } = useRequireAuth();
  const [season, setSeason] = useState<number>(defaultSeason);
  const [eventCode, setEventCode] = useState<string>('');
  const [matchKey, setMatchKey] = useState<string>('');
  const [teamNumber, setTeamNumber] = useState<string>('');
  const [fields, setFields] = useState<FormField[]>([]);
  const [values, setValues] = useState<Record<string, FieldValue>>({});
  const [status, setStatus] = useState<string>('');
  const [justSubmitted, setJustSubmitted] = useState<boolean>(false);
  const [manual, setManual] = useState<boolean>(false);
  const [events, setEvents] = useState<EventOption[]>([]);
  const [matches, setMatches] = useState<MatchRow[]>([]);
  const [eventSearch, setEventSearch] = useState<string>('');
  const [hasCurrentEvent, setHasCurrentEvent] = useState(false);

  useEffect(() => {
    const code = getStoredCurrentEventCode();
    if (code) {
      setEventCode(code);
      setHasCurrentEvent(true);
    }
  }, []);
  const [submissionSummary, setSubmissionSummary] = useState<SubmissionSummary | null>(null);
  const matchIndex = matches.findIndex((m) => m.match_key === matchKey);

  useEffect(() => {
    async function load() {
      setStatus('Loading form...');
      const { data, error } = await supabase
        .from('form_templates')
        .select('form_definition')
        .eq('season', season)
        .maybeSingle<FormTemplateRow>();
      if (error) {
        setStatus(`Error: ${error.message}`);
      } else {
        const def = data?.form_definition ?? [];
        const arr = Array.isArray(def) ? def : [];
        setFields(arr);
        const initial: Record<string, FieldValue> = {};
        for (const f of arr) {
          if (f.type === 'counter') initial[f.label] = 0;
          if (f.type === 'checkbox') initial[f.label] = false;
          if (f.type === 'text') initial[f.label] = '';
          if (f.type === 'multiselect') initial[f.label] = '';
        }
        setValues(initial);
        setStatus('');
      }
    }
    load();
  }, [router, season]);

  // Load TBA-imported events and matches when not manual
  useEffect(() => {
    if (manual) return;
    async function loadEvents() {
      const { data, error } = await supabase
        .from('events')
        .select('code,name');
      if (error) return;
      const prefix = String(season);
      setEvents(((data as EventOption[] | null) || []).filter((e) => (e.code || '').startsWith(prefix)));
    }
    loadEvents();
  }, [season, manual]);

  useEffect(() => {
    if (manual || !eventCode) return;
    async function loadMatches() {
      // need event_id for matches; fetch by code first
      const { data: ev } = await supabase.from('events').select('id').eq('code', eventCode).maybeSingle<EventIdRow>();
      if (!ev?.id) { setMatches([]); return; }
      const { data, error } = await supabase
        .from('matches')
        .select('match_key')
        .eq('event_id', ev.id)
        .order('match_key');
      if (error) return;
      const list = ((data as MatchRow[] | null) || []).sort((a, b) => naturalMatchCompare(a.match_key, b.match_key));
      setMatches(list);
      if (list.length > 0) {
        setMatchKey((prev) => prev || list[0].match_key);
      }
    }
    loadMatches();
  }, [eventCode, manual]);

  function setValue(label: string, v: FieldValue) {
    setValues((prev) => ({ ...prev, [label]: v }));
  }

  async function submit() {
    if (!eventCode || !matchKey || !teamNumber) {
      setStatus('Enter event code, match key, and team number');
      return;
    }
    setStatus('Submitting...');
    const payload = {
      season,
      event_code: eventCode,
      match_key: matchKey,
      team_number: parseInt(teamNumber, 10),
      scout_id: user?.id ?? null,
      scout_name: user?.displayName ?? null,
      scouted_at: new Date().toISOString(),
      metrics: values,
    };
    const { error } = await supabase.from('scouting_entries').insert(payload);
    if (error) {
      setStatus(`Error: ${error.message}`);
      return;
    }
    const submittedMatchKey = matchKey;
    const submittedTeamNumber = teamNumber;
    // clear except event code
    setTeamNumber('');
    const reset: Record<string, FieldValue> = {};
    for (const f of fields) {
      if (f.type === 'counter') reset[f.label] = 0;
      if (f.type === 'checkbox') reset[f.label] = false;
      if (f.type === 'text') reset[f.label] = '';
      if (f.type === 'multiselect') reset[f.label] = '';
    }
    setValues(reset);
    setStatus('Match scouting submitted.');
    setJustSubmitted(true);
    setSubmissionSummary({ eventCode, matchKey: submittedMatchKey, teamNumber: submittedTeamNumber });
    if (!manual && matches.length > 0) {
      const nextIdx = Math.min(matches.length - 1, Math.max(matchIndex, 0) + 1);
      setMatchKey(matches[nextIdx].match_key);
    } else {
      setMatchKey('');
    }
  }

  function prevMatch() {
    if (matches.length === 0) return;
    const idx = Math.max(0, matchIndex - 1);
    setMatchKey(matches[idx].match_key);
  }

  function nextMatch() {
    if (matches.length === 0) return;
    const idx = Math.min(matches.length - 1, matchIndex + 1);
    setMatchKey(matches[idx].match_key);
  }

  return (
    <div className="mx-auto max-w-3xl p-4">
      <h1>Scouting Form</h1>
      {!hasCurrentEvent && !manual && (
        <div className="mt-3 rounded-xl border border-yellow-300 dark:border-yellow-700 bg-yellow-50 dark:bg-yellow-950 p-3">
          <div className="font-bold text-yellow-800 dark:text-yellow-300">Check in before scouting</div>
          <div className="mt-1 text-yellow-800 dark:text-yellow-300">
            Choosing an event first will auto-fill the event and load the official match list.
          </div>
          <button onClick={() => router.push('/check-in')} className="mt-2.5 px-3 py-2 rounded-md bg-blue-600 text-white font-medium hover:bg-blue-700">
            Go to check-in
          </button>
        </div>
      )}

      <div className="grid gap-3 mt-3">
        {!hasCurrentEvent && (
          <>
            <label className="text-zinc-900 dark:text-zinc-100">
              Season
              <input type="number" value={season} onChange={(e) => setSeason(parseInt(e.target.value || String(defaultSeason), 10))} className="ml-2 border border-zinc-300 dark:border-zinc-600 rounded-md bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 px-2 py-1.5" />
            </label>
            <label className="flex items-center gap-2 text-zinc-900 dark:text-zinc-100">
              <input type="checkbox" checked={manual} onChange={(e) => setManual(e.target.checked)} />
              Manual entry
            </label>
          </>
        )}
        {(!hasCurrentEvent && manual) ? (
          <>
            <label className="text-zinc-900 dark:text-zinc-100">
              Event Code
              <input value={eventCode} onChange={(e) => setEventCode(e.target.value)} placeholder="2026miket" className="ml-2 border border-zinc-300 dark:border-zinc-600 rounded-md bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 px-2 py-1.5" />
            </label>
            <label className="text-zinc-900 dark:text-zinc-100">
              Match Key
              <input value={matchKey} onChange={(e) => setMatchKey(e.target.value)} placeholder="qm12" className="ml-2 border border-zinc-300 dark:border-zinc-600 rounded-md bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 px-2 py-1.5" />
            </label>
          </>
        ) : (
          <>
            {!hasCurrentEvent && (
              <>
                <label className="text-zinc-900 dark:text-zinc-100">
                  Search events
                  <input value={eventSearch} onChange={(e) => setEventSearch(e.target.value)} placeholder="type to filter..." className="ml-2 border border-zinc-300 dark:border-zinc-600 rounded-md bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 px-2 py-1.5" />
                </label>
                <label className="text-zinc-900 dark:text-zinc-100">
                  Event
                  <select value={eventCode} onChange={(e) => setEventCode(e.target.value)} className="ml-2 border border-zinc-300 dark:border-zinc-600 rounded-md bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 px-2 py-1.5">
                    <option value="">Select event</option>
                    {events
                      .filter((e) => (e.code + ' ' + e.name).toLowerCase().includes(eventSearch.toLowerCase()))
                      .map((e) => (
                        <option key={e.code} value={e.code}>{e.code} — {e.name}</option>
                      ))}
                  </select>
                </label>
              </>
            )}
            {hasCurrentEvent && (
              <div className="text-zinc-900 dark:text-zinc-100">Event: <strong>{eventCode}</strong></div>
            )}
            <label className="text-zinc-900 dark:text-zinc-100">
              Match
              <select value={matchKey} onChange={(e) => setMatchKey(e.target.value)} className="ml-2 border border-zinc-300 dark:border-zinc-600 rounded-md bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 px-2 py-1.5">
                <option value="">Select match</option>
                {matches.map((m) => (
                  <option key={m.match_key} value={m.match_key}>{m.match_key}</option>
                ))}
              </select>
            </label>
            <label className="text-zinc-900 dark:text-zinc-100">
              Or type match
              <input value={matchKey} onChange={(e) => setMatchKey(e.target.value)} placeholder="qm12" className="ml-2 border border-zinc-300 dark:border-zinc-600 rounded-md bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 px-2 py-1.5" />
            </label>
          </>
        )}
        <label className="text-zinc-900 dark:text-zinc-100">
          Team Number
          <input value={teamNumber} onChange={(e) => setTeamNumber(e.target.value)} placeholder="2767" className="ml-2 border border-zinc-300 dark:border-zinc-600 rounded-md bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 px-2 py-1.5" />
        </label>
      </div>

      <div className="mt-4 grid gap-3">
        {fields.map((f) => (
          f.type === 'counter' ? (
            (() => {
              const rawCount = values[f.label];
              const count = typeof rawCount === 'number' ? rawCount : 0;
              return (
                <div key={f.id} className="flex items-center justify-between gap-3">
                  <label className="flex-1 text-zinc-900 dark:text-zinc-100">{f.label}</label>
                  <div className="flex gap-3 items-center">
                    <button
                      aria-label={`Decrement ${f.label}`}
                      onClick={() => setValue(f.label, Math.max(0, count - 1))}
                      className="w-12 h-12 text-xl rounded-xl border border-zinc-300 dark:border-zinc-600 bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
                    >
                      −
                    </button>
                    <span className="min-w-[48px] text-center text-xl font-bold text-zinc-900 dark:text-zinc-100">
                      {count}
                    </span>
                    <button
                      aria-label={`Increment ${f.label}`}
                      onClick={() => setValue(f.label, count + 1)}
                      className="w-12 h-12 text-xl rounded-xl border border-zinc-300 dark:border-zinc-600 bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
                    >
                      +
                    </button>
                  </div>
                </div>
              );
            })()
          ) : (
            (() => {
              const rawValue = values[f.label];
              const textValue = typeof rawValue === 'string' ? rawValue : '';
              return (
                <div key={f.id} className={f.type === 'checkbox' ? 'flex items-center gap-3' : 'grid gap-2'}>
                  {f.type === 'checkbox' && (
                    <input type="checkbox" checked={!!values[f.label]} onChange={(e) => setValue(f.label, e.target.checked)} className="h-5 w-5 rounded accent-blue-600" />
                  )}
                  <label className="text-zinc-900 dark:text-zinc-100">{f.label}</label>
                  {f.type === 'text' && (
                    <textarea
                      value={textValue}
                      onChange={(e) => setValue(f.label, e.target.value)}
                      rows={3}
                      className="border border-zinc-300 dark:border-zinc-600 rounded-md bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 px-2 py-1.5"
                    />
                  )}
                  {f.type === 'multiselect' && (
                    <div className="flex gap-2 flex-wrap">
                      {(f.options || []).map((opt) => {
                        const isOn = textValue === opt;
                        return (
                          <button
                            key={opt}
                            type="button"
                            onClick={() => setValue(f.label, isOn ? '' : opt)}
                            className={`px-2.5 py-1.5 rounded-2xl border ${isOn ? 'bg-blue-600 border-blue-600 text-white' : 'border-zinc-300 dark:border-zinc-600 text-zinc-700 dark:text-zinc-200'}`}
                          >
                            {opt}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })()
          )
        ))}
      </div>

      <div className="mt-4 flex gap-3 items-center">
        {!manual && matches.length > 0 && (
          <>
            <button onClick={prevMatch} className="px-3 py-2 rounded-md border border-zinc-300 dark:border-zinc-600 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800">Prev match</button>
            <span className="text-zinc-900 dark:text-zinc-100">Match {matchIndex + 1} / {matches.length}</span>
            <button onClick={nextMatch} className="px-3 py-2 rounded-md border border-zinc-300 dark:border-zinc-600 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800">Next match</button>
          </>
        )}
        <button onClick={submit} className="px-3 py-2 rounded-md bg-blue-600 text-white font-medium hover:bg-blue-700">Submit</button>
        <span className="text-zinc-500 dark:text-zinc-400">{status}</span>
      </div>

      {justSubmitted && (
        <div className="mt-4 rounded-xl border border-green-300 dark:border-green-800 bg-green-50 dark:bg-green-950 p-3.5 grid gap-2.5">
          <div>
            <div className="font-bold text-green-800 dark:text-green-300">Submission saved</div>
            {submissionSummary && (
              <div className="mt-1 text-green-800 dark:text-green-300">
                {submissionSummary.eventCode} • {submissionSummary.matchKey} • Team {submissionSummary.teamNumber}
              </div>
            )}
          </div>
          <div className="text-green-800 dark:text-green-300">
            {matches.length > 0 ? 'You can keep moving right into the next match, or jump to analysis to review the data.' : 'You can scout another match now or review your data in analysis.'}
          </div>
          <div className="flex gap-2 flex-wrap">
            {matches.length > 0 && (
              <button
                onClick={() => {
                  setJustSubmitted(false);
                }}
                className="px-3 py-2 rounded-md bg-blue-600 text-white font-medium hover:bg-blue-700"
              >
                Scout next match
              </button>
            )}
            {!matches.length && (
              <button
                onClick={() => setJustSubmitted(false)}
                className="px-3 py-2 rounded-md bg-blue-600 text-white font-medium hover:bg-blue-700"
              >
                Add another entry
              </button>
            )}
            <button
              onClick={() => router.push('/analysis')}
              className="px-3 py-2 rounded-md border border-zinc-300 dark:border-zinc-600 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800"
            >
              View analysis
            </button>
            <button
              onClick={() => router.push('/me')}
              className="px-3 py-2 rounded-md border border-zinc-300 dark:border-zinc-600 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800"
            >
              View leaderboard
            </button>
            <button
              onClick={() => router.push('/check-in')}
              className="px-3 py-2 rounded-md border border-zinc-300 dark:border-zinc-600 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800"
            >
              Switch event
            </button>
          </div>
        </div>
      )}

      {!justSubmitted && submissionSummary && (
        <div className="mt-3 text-sm text-zinc-500 dark:text-zinc-400">
          Last saved: {submissionSummary.eventCode} • {submissionSummary.matchKey} • Team {submissionSummary.teamNumber}
        </div>
      )}
    </div>
  );
}
