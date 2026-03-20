'use client';

import { useEffect, useState } from 'react';
import { useRequireAuth } from '@/lib/AuthContext';
import { supabase } from '@/lib/supabase';

type ScoutRow = { id: string; display_name: string; created_at: string };

export default function TeamPage() {
  const { user, loading } = useRequireAuth();
  const [scouts, setScouts] = useState<ScoutRow[]>([]);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase
      .from('scouts')
      .select('id, display_name, created_at')
      .eq('team_id', user.teamId)
      .order('created_at')
      .then(({ data }) => {
        setScouts((data as ScoutRow[] | null) || []);
      });
  }, [user]);

  if (loading) return <div className="p-6">Loading...</div>;
  if (!user) return null;

  function copyCode() {
    // The join code isn't in the JWT, so we fetch it
    // For now show team info from session
  }

  return (
    <div className="p-4 max-w-xl mx-auto grid gap-4">
      <h1>Your Team</h1>

      <div className="border border-zinc-200 dark:border-zinc-700 rounded-xl p-4">
        <div className="text-sm text-zinc-500 dark:text-zinc-400">Team</div>
        <div className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">{user.teamNumber} &mdash; {user.teamName}</div>
      </div>

      <div className="border border-zinc-200 dark:border-zinc-700 rounded-xl p-4">
        <div className="text-sm text-zinc-500 dark:text-zinc-400 mb-1">Your name</div>
        <div className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">{user.displayName}</div>
      </div>

      <div>
        <h2>Roster ({scouts.length})</h2>
        <div className="grid gap-1 mt-2">
          {scouts.map((s) => (
            <div key={s.id} className="p-2 border border-zinc-200 dark:border-zinc-700 rounded-md text-zinc-900 dark:text-zinc-100">
              {s.display_name}
              {s.id === user.id && <span className="ml-2 text-zinc-500 dark:text-zinc-400 text-xs">(you)</span>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
