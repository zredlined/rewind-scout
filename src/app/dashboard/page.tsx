'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';

export default function Dashboard() {
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setEmail(data.user?.email ?? null);
    });
  }, []);

  if (!email) {
    return (
      <div style={{ padding: 24 }}>
        <p>Not signed in.</p>
        <Link href="/login">Go to Login</Link>
      </div>
    );
  }

  return (
    <div style={{ padding: 24 }}>
      <h1>Welcome</h1>
      <p>Signed in as {email}</p>
      <div style={{ marginTop: 16 }}>
        <Link href="/">Home</Link>
      </div>
    </div>
  );
}


