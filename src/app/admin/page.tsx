'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

export default function AdminPage() {
  const [status, setStatus] = useState<string>('');

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) window.location.href = '/login';
    });
  }, []);

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
    const ids = (data as any[]).map((r) => r.id);
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
    const rows = (data as any[]) || [];
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
    <div style={{ padding: 16, maxWidth: 720, margin: '0 auto' }}>
      <h1>Admin</h1>
      <div style={{ display: 'grid', gap: 12, marginTop: 12 }}>
        <button onClick={deleteLast24h} style={{ padding: 10, borderRadius: 6, border: '1px solid #ccc' }}>Delete last 24h</button>
        <button onClick={deleteAll} style={{ padding: 10, borderRadius: 6, border: '1px solid #f22', color: '#f22' }}>Delete ALL</button>
        <button onClick={exportCsv} style={{ padding: 10, borderRadius: 6, border: '1px solid #ccc' }}>Export CSV</button>
        <span style={{ color: '#555' }}>{status}</span>
      </div>
    </div>
  );
}


