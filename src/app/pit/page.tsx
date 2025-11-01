'use client';

export const dynamic = 'force-dynamic';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

export default function PitScoutingPage() {
  const router = useRouter();
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => { if (!data.user) router.replace('/login'); });
  }, [router]);
  return (
    <div style={{ padding: 16 }}>
      <h1>Pit Scouting</h1>
      <p>Coming soon.</p>
    </div>
  );
}


