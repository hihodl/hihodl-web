'use client';

import useSWR from 'swr';

const fetcher = (u: string) => fetch(u).then((r) => r.json());

export default function Milestones({ email }: { email: string }) {
  const { data, isLoading } = useSWR(
    email ? `/api/milestones?email=${encodeURIComponent(email)}` : null,
    fetcher
  );

  const tiers = data?.tiers ?? [];
  const achieved = new Set(data?.achieved ?? []);
  const count = data?.count ?? 0;

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 gap-3">
        {[...Array(5)].map((_, i) => (
          <div
            key={i}
            className="animate-pulse p-4 rounded-xl bg-white/5 h-24"
          ></div>
        ))}
      </div>
    );
  }

  return (
    <div className="rounded-2xl bg-white/5 p-6 border border-[rgba(255,255,255,0.08)] backdrop-blur-xl">
      <div className="mb-4">
        <h3 className="text-xl font-['Inter'] font-[700] text-[#eaf6ffff] mb-2">Your Milestones</h3>
        <p className="text-sm text-[#94a3b8ff]">
          {count} referral{count !== 1 ? 's' : ''} earned
        </p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {tiers.map((t: any) => {
          const isAchieved = achieved.has(t.key);
          const progress = Math.min((count / t.at) * 100, 100);

          return (
            <div
              key={t.key}
              className={`p-4 rounded-xl border transition ${
                isAchieved
                  ? 'bg-brand-ffb703/20 border-brand-ffb703/50'
                  : 'bg-white/5 border-[rgba(255,255,255,0.08)]'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-[#94a3b8ff]">at {t.at} referrals</span>
                {isAchieved && (
                  <span className="text-brand-ffb703 font-bold">✓</span>
                )}
              </div>
              <div
                className={`font-['Inter'] font-[700] text-[#eaf6ffff] ${
                  isAchieved ? 'text-brand-ffb703' : ''
                }`}
              >
                {t.label}
              </div>
              {!isAchieved && (
                <div className="mt-2 h-1 bg-white/10 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-brand-ffb703/50 transition-all duration-300"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}


