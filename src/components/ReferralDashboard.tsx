'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { Button } from '@/ui/components/Button';
import Milestones from './Milestones';
import Leaderboard from './Leaderboard';
import { authedFetcher } from '@/lib/clientAuth';

export default function ReferralDashboard({ email }: { email: string }) {
  const { data, isLoading, error } = useSWR(
    email ? `/api/referral/stats?email=${encodeURIComponent(email)}` : null,
    authedFetcher
  );

  const [copied, setCopied] = useState(false);

  const referralLink = data?.referralLink || '';
  const referralsCount = data?.referralsCount ?? 0;
  const position = data?.position;

  const handleCopy = () => {
    if (referralLink) {
      navigator.clipboard.writeText(referralLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (isLoading) {
    return (
      <div className="animate-pulse space-y-6">
        <div className="h-32 bg-white/5 rounded-2xl"></div>
        <div className="h-64 bg-white/5 rounded-2xl"></div>
      </div>
    );
  }

  // Distinguish "not authed for this email" (401 from API gate) vs other
  // failures. The 401 case happens when the user enters someone else's
  // email, OR when they're on a fresh device without the session token
  // from signup. Both resolve by re-submitting the waitlist form.
  if (error?.status === 401) {
    return (
      <div className="rounded-2xl bg-white/5 p-6 border border-[rgba(255,255,255,0.08)]">
        <p className="text-[#94a3b8ff]">
          To view your referral stats, sign up (or re-sign-up on this device)
          using the form on the homepage. We can&apos;t look up someone else&apos;s stats.
        </p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="rounded-2xl bg-white/5 p-6 border border-[rgba(255,255,255,0.08)]">
        <p className="text-[#94a3b8ff]">Unable to load your referral stats.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Card */}
      <div className="rounded-2xl bg-white/5 p-6 border border-[rgba(255,255,255,0.08)] backdrop-blur-xl">
        <h2 className="text-2xl font-['Inter'] font-[700] text-[#eaf6ffff] mb-6">
          Your Referral Dashboard
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="p-4 rounded-xl bg-white/5">
            <div className="text-sm text-[#94a3b8ff] mb-1">Referrals</div>
            <div className="text-3xl font-['Inter'] font-[700] text-brand-ffb703">
              {referralsCount}
            </div>
          </div>
          {position && (
            <div className="p-4 rounded-xl bg-white/5">
              <div className="text-sm text-[#94a3b8ff] mb-1">Your Rank</div>
              <div className="text-3xl font-['Inter'] font-[700] text-[#eaf6ffff]">
                #{position}
              </div>
            </div>
          )}
          <div className="p-4 rounded-xl bg-white/5">
            <div className="text-sm text-[#94a3b8ff] mb-1">Total Users</div>
            <div className="text-3xl font-['Inter'] font-[700] text-[#eaf6ffff]">
              {data.totalUsers}
            </div>
          </div>
        </div>

        {/* Referral Link */}
        <div className="p-4 rounded-xl bg-white/10 border border-[rgba(255,255,255,0.1)]">
          <div className="mb-2">
            <label className="text-sm font-['Inter'] font-[600] text-[#eaf6ffff]">
              Your Referral Link
            </label>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={referralLink}
              readOnly
              className="flex-1 px-4 py-2 rounded-lg bg-[#0a141e] text-[#eaf6ffff] font-mono text-sm border border-[rgba(255,255,255,0.1)]"
            />
            <Button
              onClick={handleCopy}
              className={`px-4 py-2 rounded-lg font-['Inter'] font-[600] transition ${
                copied
                  ? 'bg-green-500 text-white'
                  : 'bg-brand-ffb703 text-black hover:bg-brand-ffb703/90'
              }`}
            >
              {copied ? 'Copied!' : 'Copy'}
            </Button>
          </div>
        </div>
      </div>

      {/* Milestones */}
      <Milestones email={email} />

      {/* Leaderboard */}
      <Leaderboard />
    </div>
  );
}


