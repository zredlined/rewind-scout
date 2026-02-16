'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

type Step = 'email' | 'otp' | 'sent' | 'profile';

export default function LoginPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [fullName, setFullName] = useState('');
  const [scoutTeamNumber, setScoutTeamNumber] = useState('');

  async function handlePostAuth() {
    const { data } = await supabase.auth.getUser();
    if (!data.user) return;

    // Ensure a profile row exists
    await supabase.from('profiles').upsert({
      id: data.user.id,
      email: data.user.email ?? null,
      full_name: (data.user.user_metadata as Record<string, string>)?.full_name ?? null,
    });

    // Check if profile is complete (has name + team number)
    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name,team_number')
      .eq('id', data.user.id)
      .maybeSingle();

    const name = (profile as any)?.full_name;
    const team = (profile as any)?.team_number;

    if (name && team) {
      router.replace('/check-in');
    } else {
      // Pre-fill with whatever we already have
      if (name) setFullName(name);
      setStep('profile');
    }
  }

  // Redirect if already signed in (or show profile step)
  useEffect(() => {
    handlePostAuth();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Listen for sign-in from magic link (opened in same browser)
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event) => {
      if (event === 'SIGNED_IN') {
        await handlePostAuth();
      }
    });
    return () => { subscription.unsubscribe(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  async function handleSendLink(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    const { error: err } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: typeof window !== 'undefined' ? window.location.origin : '',
      },
    });
    setLoading(false);
    if (err) {
      setError(err.message);
    } else {
      setStep('sent');
    }
  }

  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    const { data } = await supabase.auth.getUser();
    if (!data.user) { setError('Not signed in'); setLoading(false); return; }
    const { error: err } = await supabase.from('profiles').upsert({
      id: data.user.id,
      full_name: fullName.trim(),
      team_number: parseInt(scoutTeamNumber, 10),
    } as any);
    setLoading(false);
    if (err) { setError(err.message); return; }
    router.replace('/check-in');
  }

  async function handleVerifyOtp(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    const { error: err } = await supabase.auth.verifyOtp({
      email,
      token: otp,
      type: 'email',
    });
    setLoading(false);
    if (err) {
      setError(err.message);
    }
    // onAuthStateChange will handle redirect on success
  }

  return (
    <div className="flex min-h-[80vh] items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold">FRC Scouting</h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Sign in with your email — no password needed
          </p>
        </div>

        {step === 'email' && (
          <form onSubmit={handleSendLink} className="space-y-4">
            <label className="block">
              <span className="text-sm font-medium">Email address</span>
              <input
                type="email"
                required
                autoFocus
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@school.edu"
                className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-900"
              />
            </label>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? 'Sending...' : 'Send me a sign-in link'}
            </button>
          </form>
        )}

        {step === 'profile' && (
          <form onSubmit={handleSaveProfile} className="space-y-4">
            <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-center dark:border-blue-900 dark:bg-blue-950">
              <p className="text-sm font-medium text-blue-800 dark:text-blue-200">
                One more thing — tell us who you are!
              </p>
            </div>
            <label className="block">
              <span className="text-sm font-medium">Your name</span>
              <input
                type="text"
                required
                autoFocus
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Jane Smith"
                className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-900"
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium">Your FRC team number</span>
              <input
                type="text"
                inputMode="numeric"
                required
                value={scoutTeamNumber}
                onChange={(e) => setScoutTeamNumber(e.target.value.replace(/\D/g, ''))}
                placeholder="2767"
                className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-900"
              />
            </label>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <button
              type="submit"
              disabled={loading || !fullName.trim() || !scoutTeamNumber}
              className="w-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? 'Saving...' : 'Continue'}
            </button>
          </form>
        )}

        {step === 'sent' && (
          <div className="space-y-4">
            <div className="rounded-lg border border-green-200 bg-green-50 p-4 text-center dark:border-green-900 dark:bg-green-950">
              <p className="text-sm font-medium text-green-800 dark:text-green-200">
                Check your email!
              </p>
              <p className="mt-1 text-sm text-green-700 dark:text-green-300">
                We sent a sign-in link to <strong>{email}</strong>
              </p>
            </div>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-zinc-200 dark:border-zinc-700" />
              </div>
              <div className="relative flex justify-center text-xs">
                <span className="bg-white px-2 text-zinc-500 dark:bg-[#0a0a0a] dark:text-zinc-400">
                  or enter the 6-digit code from the email
                </span>
              </div>
            </div>

            <form onSubmit={handleVerifyOtp} className="space-y-4">
              <input
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                required
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                placeholder="000000"
                className="block w-full rounded-lg border border-zinc-300 px-3 py-2 text-center text-lg tracking-widest focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-900"
              />
              {error && <p className="text-sm text-red-600">{error}</p>}
              <button
                type="submit"
                disabled={loading || otp.length !== 6}
                className="w-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {loading ? 'Verifying...' : 'Verify code'}
              </button>
            </form>

            <button
              onClick={() => { setStep('email'); setError(''); setOtp(''); }}
              className="w-full text-center text-sm text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
            >
              Use a different email
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
