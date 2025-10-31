'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

export default function Header() {
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    supabase.auth.getUser().then(({ data }) => {
      if (!mounted) return;
      setEmail(data.user?.email ?? null);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setEmail(session?.user?.email ?? null);
    });
    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  async function logout() {
    await supabase.auth.signOut();
    // no redirect here; header will update
  }

  return (
    <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px', borderBottom: '1px solid #eee' }}>
      <nav style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        <Link href="/" style={{ fontWeight: 600 }}>FRC Scouting</Link>
        <Link href="/scout">Scout</Link>
        <Link href="/analysis">Analysis</Link>
        <Link href="/form-builder">Form Builder</Link>
        <Link href="/dashboard">TBA</Link>
      </nav>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        {email ? (
          <>
            <span style={{ fontSize: 14, color: '#555' }}>{email}</span>
            <button onClick={logout} style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid #ccc' }}>Log out</button>
          </>
        ) : (
          <Link href="/login" style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid #ccc' }}>Login</Link>
        )}
      </div>
    </header>
  );
}


