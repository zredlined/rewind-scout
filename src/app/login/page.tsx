'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

type Step = 'code' | 'name';

export default function LoginPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>('code');
  const [joinCode, setJoinCode] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/auth/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ joinCode: joinCode.trim().toUpperCase(), displayName: displayName.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Something went wrong');
        return;
      }
      window.location.href = '/check-in';
    } catch {
      setError('Network error — try again');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-[80vh] items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold">FRC Scouting</h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Enter your team code to get started
          </p>
        </div>

        {step === 'code' && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (joinCode.trim().length >= 4) setStep('name');
            }}
            className="space-y-4"
          >
            <label className="block">
              <span className="text-sm font-medium">Team code</span>
              <input
                type="text"
                required
                autoFocus
                maxLength={6}
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
                placeholder="ABC123"
                className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-center text-lg tracking-widest focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-900"
              />
            </label>
            {error && step === 'code' && <p className="text-sm text-red-600">{error}</p>}
            <button
              type="submit"
              disabled={joinCode.trim().length < 4}
              className="w-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              Next
            </button>
          </form>
        )}

        {step === 'name' && (
          <form onSubmit={handleJoin} className="space-y-4">
            <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-center text-sm dark:border-blue-900 dark:bg-blue-950">
              Team code: <strong>{joinCode}</strong>
              <button
                type="button"
                onClick={() => { setStep('code'); setError(''); }}
                className="ml-2 text-blue-600 hover:underline"
              >
                Change
              </button>
            </div>
            <label className="block">
              <span className="text-sm font-medium">What&apos;s your name?</span>
              <input
                type="text"
                required
                autoFocus
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Jane Smith"
                className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-900"
              />
            </label>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <button
              type="submit"
              disabled={loading || !displayName.trim()}
              className="w-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? 'Joining...' : 'Join'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
