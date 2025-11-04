'use client';

import { useState } from 'react';
import { Button } from '@/ui/components/Button';
import { TextField } from '@/ui/components/TextField';

export default function JoinWaitlist() {
  const [link, setLink] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/waitlist/join', {
        method: 'POST',
        body: JSON.stringify({
          email,
          displayName,
        }),
        headers: { 'Content-Type': 'application/json' },
      });

      const data = await res.json();

      if (!res.ok) {
        // Mostrar mensaje más específico si está disponible
        const errorMessage = data.message || data.error || 'Failed to join waitlist';
        throw new Error(errorMessage);
      }

      if (data.ok) {
        // Redirigir a página de agradecimiento después de 1 segundo
        setTimeout(() => {
          window.location.href = '/thank-you';
        }, 1000);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex w-full max-w-[576px] flex-col items-start gap-6">
      {!link ? (
        <>
          <form onSubmit={onSubmit} className="flex w-full flex-col gap-4">
            <TextField className="h-auto w-full flex-none" label="" helpText="">
              <TextField.Input
                placeholder="Your name"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                required
              />
            </TextField>
            <TextField className="h-auto w-full flex-none" label="" helpText="">
              <TextField.Input
                type="email"
                placeholder="you@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </TextField>
            {error && (
              <div className="rounded-xl bg-red-500/20 px-4 py-2 text-sm text-red-400">
                {error}
              </div>
            )}
            <Button
              className="h-10 w-full flex-none hover:shadow-[0_0_28px_rgba(255,183,3,0.5)] hover:shadow-[0_0_28px_rgba(255,183,3,0.5)]:hover inline-flex items-center justify-center px-6 py-3 rounded-xl text-black font-['Inter'] font-[700] bg-brand-ffb703 transition-all duration-300 !opacity-100 focus:!opacity-100 active:!opacity-100 [&_*]:!opacity-100 [&_*]:!translate-y-0 [&_*]:!scale-100 [&_*]:!blur-0 disabled:opacity-50"
              style={{ opacity: 1 }}
              size="large"
              disabled={loading}
              type="submit"
            >
              {loading ? 'Joining...' : 'Join Beta Waitlist'}
            </Button>
          </form>
        </>
      ) : (
        <div className="flex w-full flex-col gap-4">
          <div className="rounded-xl bg-white/10 p-4 flex flex-col gap-4">
            <div>
              <h3 className="font-['Inter'] text-[18px] font-[700] text-[#eaf6ffff] mb-2">
                Welcome! Your referral link:
              </h3>
              <div className="flex items-center gap-2">
                <span className="flex-1 truncate font-mono text-sm text-[#94a3b8ff] bg-[#0a141e] px-3 py-2 rounded-lg">
                  {link}
                </span>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(link);
                  }}
                  className="px-4 py-2 rounded-lg bg-brand-ffb703 text-black font-['Inter'] font-[600] hover:bg-brand-ffb703/90 transition"
                >
                  Copy
                </button>
              </div>
            </div>
            <p className="text-sm text-[#94a3b8ff]">
              Share this link to invite friends and climb the leaderboard! Check your email for
              more details.
            </p>
            <div className="flex gap-2">
              <a
                href="/leaderboard"
                className="flex-1 px-4 py-2 rounded-lg bg-white/5 text-[#eaf6ffff] font-['Inter'] font-[600] text-center hover:bg-white/10 transition"
              >
                View Leaderboard
              </a>
              <Button
                onClick={() => {
                  setLink(null);
                  setDisplayName('');
                  setEmail('');
                }}
                className="px-4 py-2 rounded-lg border border-[rgba(255,255,255,0.1)] bg-[rgba(10,20,30,0.60)] text-[#EAF6FF] font-['Inter'] font-[600]"
                variant="neutral-secondary"
              >
                New User
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

