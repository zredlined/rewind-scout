'use client';

import { Auth } from '@supabase/auth-ui-react';
import { ThemeSupa } from '@supabase/auth-ui-shared';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

export default function LoginPage() {
  const router = useRouter();

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event) => {
      if (event === 'SIGNED_IN') {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          await supabase.from('profiles').upsert({
            id: user.id,
            email: user.email ?? null,
            full_name: (user.user_metadata as any)?.full_name ?? null,
          });
          router.replace('/dashboard');
        }
      }
    });
    return () => {
      subscription.unsubscribe();
    };
  }, [router]);

  return (
    <div style={{ maxWidth: 420, margin: '2rem auto' }}>
      <Auth
        supabaseClient={supabase}
        appearance={{ theme: ThemeSupa }}
        providers={['google']}
        magicLink
      />
    </div>
  );
}


