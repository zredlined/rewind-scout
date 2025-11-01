'use client';

export const dynamic = 'force-dynamic';

import { Auth } from '@supabase/auth-ui-react';
import { ThemeSupa } from '@supabase/auth-ui-shared';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

export default function LoginPage() {
  const router = useRouter();
  const [displayName, setDisplayName] = useState('');

  // Redirect if already signed in
  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (data.user) {
        await supabase.from('profiles').upsert({
          id: data.user.id,
          email: data.user.email ?? null,
          full_name: (data.user.user_metadata as any)?.full_name ?? (displayName || null),
        });
        router.replace('/check-in');
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event) => {
      if (event === 'SIGNED_IN') {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          await supabase.from('profiles').upsert({
            id: user.id,
            email: user.email ?? null,
            full_name: (user.user_metadata as any)?.full_name ?? (displayName || null),
          });
          router.replace('/check-in');
        }
      }
    });
    return () => {
      subscription.unsubscribe();
    };
  }, [router, displayName]);

  return (
    <div style={{ maxWidth: 420, margin: '2rem auto', display: 'grid', gap: 12 }}>
      <label style={{ display: 'grid', gap: 6 }}>
        <span>Display name (optional if using email/password)</span>
        <input
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          placeholder="Your name"
          style={{ padding: 8, border: '1px solid #ccc', borderRadius: 6 }}
        />
      </label>
      <Auth
        supabaseClient={supabase}
        appearance={{ theme: ThemeSupa }}
        redirectTo={typeof window !== 'undefined' ? window.location.origin : ''}
        providers={['google']}
        magicLink
      />
    </div>
  );
}


