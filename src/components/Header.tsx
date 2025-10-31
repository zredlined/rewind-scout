'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
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

  const initials = useMemo(() => {
    if (!email) return '';
    const name = email.split('@')[0];
    return name.slice(0, 2).toUpperCase();
  }, [email]);

  return (
    <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px', borderBottom: '1px solid #eee' }}>
      <nav style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        <Link href="/" style={{ fontWeight: 600 }}>FRC Scouting</Link>
        <Link href="/check-in">Check-in</Link>
        <Link href="/scout">Scout</Link>
        <Link href="/analysis">Analysis</Link>
        <Link href="/form-builder">Form Builder</Link>
      </nav>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        {email ? (
          <>
            <div style={{ width: 28, height: 28, borderRadius: 14, background: '#eee', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12 }}>{initials}</div>
            <button onClick={logout} style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid #ccc' }}>Log out</button>
          </>
        ) : (
          <Link href="/login" style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid #ccc' }}>Login</Link>
        )}
      </div>
    </header>
  );
}


