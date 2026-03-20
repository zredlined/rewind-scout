'use client';

export const dynamic = 'force-dynamic';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useRequireAuth } from '@/lib/AuthContext';

type EntryIdRow = { id: string };
type ExportRow = {
  season: number;
  event_code: string;
  match_key: string;
  team_number: number;
  scout_id: string | null;
  metrics: Record<string, unknown> | null;
  created_at: string | null;
};

export default function AdminPage() {
  useRequireAuth();
  const [status, setStatus] = useState<string>('');

  async function deleteLast24h() {
    if (!confirm('Delete entries from the last 24 hours?')) return;
    setStatus('Deleting...');
    const since = new Date();
    since.setDate(since.getDate() - 1);
    const { data, error } = await supabase
      .from('scouting_entries')
      .select('id')
      .gte('created_at', since.toISOString());
    if (error) { setStatus(`Error: ${error.message}`); return; }
    const ids = ((data as EntryIdRow[] | null) || []).map((r) => r.id);
    if (ids.length === 0) { setStatus('No entries to delete.'); return; }
    const { error: delErr } = await supabase.from('scouting_entries').delete().in('id', ids);
    setStatus(delErr ? `Error: ${delErr.message}` : `Deleted ${ids.length} entries.`);
  }

  async function deleteAll() {
    if (!confirm('Delete ALL scouting entries?')) return;
    setStatus('Deleting all...');
    // Supabase client requires a filter on delete(); use a wide created_at range
    const { error } = await supabase
      .from('scouting_entries')
      .delete()
      .gte('created_at', '1970-01-01T00:00:00Z');
    setStatus(error ? `Error: ${error.message}` : 'Deleted all entries.');
  }

  async function exportCsv() {
    setStatus('Exporting...');
    const { data, error } = await supabase
      .from('scouting_entries')
      .select('season,event_code,match_key,team_number,scout_id,metrics,created_at');
    if (error) { setStatus(`Error: ${error.message}`); return; }
    const rows = (data as ExportRow[] | null) || [];
    const header = ['season','event_code','match_key','team_number','scout_id','created_at','metrics_json'];
    const csv = [header.join(',')].concat(rows.map((r) => {
      const metrics = JSON.stringify(r.metrics || {}).replaceAll('"', '""');
      return [r.season, r.event_code, r.match_key, r.team_number, r.scout_id, r.created_at, `"${metrics}"`].join(',');
    })).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `scouting_export_${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    setStatus(`Exported ${rows.length} rows.`);
  }

  return (
    <div className="p-4 max-w-2xl mx-auto">
      <h1>Admin</h1>
      <div className="grid gap-3 mt-3">
        <button onClick={deleteLast24h} className="px-3 py-2 rounded-md border border-zinc-300 dark:border-zinc-600 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800">Delete last 24h</button>
        <button onClick={deleteAll} className="px-3 py-2 rounded-md bg-red-600 text-white font-medium hover:bg-red-700">Delete ALL</button>
        <button onClick={exportCsv} className="px-3 py-2 rounded-md border border-zinc-300 dark:border-zinc-600 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800">Export CSV</button>
        <span className="text-zinc-500 dark:text-zinc-400">{status}</span>
      </div>
    </div>
  );
}

