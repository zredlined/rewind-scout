'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

type FieldType = 'counter' | 'checkbox' | 'text' | 'multiselect';
type FormField = { id: string; label: string; type: FieldType; options?: string[] };
type SubmissionSummary = { eventCode: string; matchKey: string; teamNumber: string };
type FieldValue = string | number | boolean;
type ProfileNameRow = { full_name: string | null };
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
  const [season, setSeason] = useState<number>(defaultSeason);
  const [eventCode, setEventCode] = useState<string>(getStoredCurrentEventCode);
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
  const [profileName, setProfileName] = useState<string | null>(null);
  const [hasCurrentEvent] = useState<boolean>(() => Boolean(getStoredCurrentEventCode()));
  const [submissionSummary, setSubmissionSummary] = useState<SubmissionSummary | null>(null);
  const matchIndex = matches.findIndex((m) => m.match_key === matchKey);

  useEffect(() => {
    // require auth
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) router.replace('/login');
      else {
        supabase
          .from('profiles')
          .select('full_name')
          .eq('id', data.user.id)
          .maybeSingle()
          .then(({ data: p }) => {
            setProfileName((p as ProfileNameRow | null)?.full_name ?? null);
          });
      }
    });
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
    const { data: userData } = await supabase.auth.getUser();
    const scoutId = userData.user?.id ?? null;
    const payload = {
      season,
      event_code: eventCode,
      match_key: matchKey,
      team_number: parseInt(teamNumber, 10),
      scout_id: scoutId,
      scout_name: profileName ?? (userData.user?.email ?? null),
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
    <div style={{ padding: 16, maxWidth: 720, margin: '0 auto' }}>
      <h1>Scouting Form</h1>
      {!hasCurrentEvent && !manual && (
        <div style={{ marginTop: 12, border: '1px solid #f3d18a', background: '#fff8e8', borderRadius: 12, padding: 12 }}>
          <div style={{ fontWeight: 700 }}>Check in before scouting</div>
          <div style={{ marginTop: 4, color: '#6b5a22' }}>
            Choosing an event first will auto-fill the event and load the official match list.
          </div>
          <button onClick={() => router.push('/check-in')} style={{ marginTop: 10, padding: 8, borderRadius: 6, background: '#111', color: '#fff' }}>
            Go to check-in
          </button>
        </div>
      )}

      <div style={{ display: 'grid', gap: 12, marginTop: 12 }}>
        {!hasCurrentEvent && (
          <>
            <label>
              Season
              <input type="number" value={season} onChange={(e) => setSeason(parseInt(e.target.value || String(defaultSeason), 10))} style={{ marginLeft: 8, padding: 6, border: '1px solid #ccc', borderRadius: 6 }} />
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input type="checkbox" checked={manual} onChange={(e) => setManual(e.target.checked)} />
              Manual entry
            </label>
          </>
        )}
        {(!hasCurrentEvent && manual) ? (
          <>
            <label>
              Event Code
              <input value={eventCode} onChange={(e) => setEventCode(e.target.value)} placeholder="2026miket" style={{ marginLeft: 8, padding: 6, border: '1px solid #ccc', borderRadius: 6 }} />
            </label>
            <label>
              Match Key
              <input value={matchKey} onChange={(e) => setMatchKey(e.target.value)} placeholder="qm12" style={{ marginLeft: 8, padding: 6, border: '1px solid #ccc', borderRadius: 6 }} />
            </label>
          </>
        ) : (
          <>
            {!hasCurrentEvent && (
              <>
                <label>
                  Search events
                  <input value={eventSearch} onChange={(e) => setEventSearch(e.target.value)} placeholder="type to filter..." style={{ marginLeft: 8, padding: 6, border: '1px solid #ccc', borderRadius: 6 }} />
                </label>
                <label>
                  Event
                  <select value={eventCode} onChange={(e) => setEventCode(e.target.value)} style={{ marginLeft: 8, padding: 6 }}>
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
              <div>Event: <strong>{eventCode}</strong></div>
            )}
            <label>
              Match
              <select value={matchKey} onChange={(e) => setMatchKey(e.target.value)} style={{ marginLeft: 8, padding: 6 }}>
                <option value="">Select match</option>
                {matches.map((m) => (
                  <option key={m.match_key} value={m.match_key}>{m.match_key}</option>
                ))}
              </select>
            </label>
            <label>
              Or type match
              <input value={matchKey} onChange={(e) => setMatchKey(e.target.value)} placeholder="qm12" style={{ marginLeft: 8, padding: 6, border: '1px solid #ccc', borderRadius: 6 }} />
            </label>
          </>
        )}
        <label>
          Team Number
          <input value={teamNumber} onChange={(e) => setTeamNumber(e.target.value)} placeholder="2767" style={{ marginLeft: 8, padding: 6, border: '1px solid #ccc', borderRadius: 6 }} />
        </label>
      </div>

      <div style={{ marginTop: 16, display: 'grid', gap: 12 }}>
        {fields.map((f) => (
          f.type === 'counter' ? (
            (() => {
              const rawCount = values[f.label];
              const count = typeof rawCount === 'number' ? rawCount : 0;
              return (
                <div key={f.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                  <label style={{ flex: 1 }}>{f.label}</label>
                  <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                    <button
                      aria-label={`Decrement ${f.label}`}
                      onClick={() => setValue(f.label, Math.max(0, count - 1))}
                      style={{
                        width: 48,
                        height: 48,
                        fontSize: 22,
                        lineHeight: '22px',
                        borderRadius: 12,
                        border: '1px solid #ccc',
                        background: '#f5f5f5'
                      }}
                    >
                      −
                    </button>
                    <span style={{ minWidth: 48, textAlign: 'center', fontSize: 20, fontWeight: 700 }}>
                      {count}
                    </span>
                    <button
                      aria-label={`Increment ${f.label}`}
                      onClick={() => setValue(f.label, count + 1)}
                      style={{
                        width: 48,
                        height: 48,
                        fontSize: 22,
                        lineHeight: '22px',
                        borderRadius: 12,
                        border: '1px solid #ccc',
                        background: '#f5f5f5'
                      }}
                    >
                      +
                    </button>
                  </div>
                </div>
              );
            })()
          ) : (
            <div key={f.id} style={{ display: 'grid', gap: 8 }}>
              <label>{f.label}</label>
              {f.type === 'checkbox' && (
                <input type="checkbox" checked={!!values[f.label]} onChange={(e) => setValue(f.label, e.target.checked)} />
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
          )
        ))}
      </div>

      <div style={{ marginTop: 16, display: 'flex', gap: 12, alignItems: 'center' }}>
        {!manual && matches.length > 0 && (
          <>
            <button onClick={prevMatch} style={{ padding: 10, borderRadius: 6, border: '1px solid #ccc' }}>Prev match</button>
            <span>Match {matchIndex + 1} / {matches.length}</span>
            <button onClick={nextMatch} style={{ padding: 10, borderRadius: 6, border: '1px solid #ccc' }}>Next match</button>
          </>
        )}
        <button onClick={submit} style={{ padding: 10, borderRadius: 6, background: '#111', color: '#fff' }}>Submit</button>
        <span style={{ color: '#555' }}>{status}</span>
      </div>

      {justSubmitted && (
        <div style={{ marginTop: 16, border: '1px solid #c9f0d4', background: '#f3fff7', borderRadius: 12, padding: 14, display: 'grid', gap: 10 }}>
          <div>
            <div style={{ fontWeight: 700, color: '#155724' }}>Submission saved</div>
            {submissionSummary && (
              <div style={{ marginTop: 4, color: '#2b5b37' }}>
                {submissionSummary.eventCode} • {submissionSummary.matchKey} • Team {submissionSummary.teamNumber}
              </div>
            )}
          </div>
          <div style={{ color: '#35543d' }}>
            {matches.length > 0 ? 'You can keep moving right into the next match, or jump to analysis to review the data.' : 'You can scout another match now or review your data in analysis.'}
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {matches.length > 0 && (
              <button
                onClick={() => {
                  setJustSubmitted(false);
                }}
                style={{ padding: 8, borderRadius: 6, background: '#111', color: '#fff' }}
              >
                Scout next match
              </button>
            )}
            {!matches.length && (
              <button
                onClick={() => setJustSubmitted(false)}
                style={{ padding: 8, borderRadius: 6, background: '#111', color: '#fff' }}
              >
                Add another entry
              </button>
            )}
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

      {!justSubmitted && submissionSummary && (
        <div style={{ marginTop: 12, color: '#555', fontSize: 14 }}>
          Last saved: {submissionSummary.eventCode} • {submissionSummary.matchKey} • Team {submissionSummary.teamNumber}
        </div>
      )}
    </div>
  );
}
