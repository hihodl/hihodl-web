'use client';

import useSWR from 'swr';

const fetcher = (u: string) => fetch(u).then((r) => r.json());

export default function Leaderboard() {
  const { data, error, isLoading } = useSWR('/api/leaderboard', fetcher, {
    refreshInterval: 15000,
  });

  if (isLoading) {
    return (
      <div className="rounded-2xl bg-white/5 p-6 border border-[rgba(255,255,255,0.08)]">
        <h3 className="text-xl font-['Inter'] font-[700] text-[#eaf6ffff] mb-4">Leaderboard</h3>
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => (
            <div
              key={i}
              className="animate-pulse flex items-center justify-between p-3 rounded-lg bg-white/5"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-white/10 rounded"></div>
                <div className="w-32 h-4 bg-white/10 rounded"></div>
              </div>
              <div className="w-16 h-4 bg-white/10 rounded"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="rounded-2xl bg-white/5 p-6 border border-[rgba(255,255,255,0.08)]">
        <h3 className="text-xl font-['Inter'] font-[700] text-[#eaf6ffff] mb-4">Leaderboard</h3>
        <p className="text-[#94a3b8ff]">Unable to load leaderboard. Please try again later.</p>
      </div>
    );
  }

  const leaders = data?.leaders || [];

  return (
    <div className="rounded-2xl bg-white/5 p-6 border border-[rgba(255,255,255,0.08)] backdrop-blur-xl">
      <h3 className="text-xl font-['Inter'] font-[700] text-[#eaf6ffff] mb-4">
        Top 100 Leaderboard
      </h3>
      {leaders.length === 0 ? (
        <p className="text-[#94a3b8ff]">No one on the leaderboard yet. Be the first!</p>
      ) : (
        <ol className="space-y-2 max-h-[600px] overflow-y-auto">
          {leaders.map((u: any, i: number) => (
            <li
              key={i}
              className="flex items-center justify-between p-3 rounded-lg bg-white/5 hover:bg-white/10 transition"
            >
              <div className="flex items-center gap-3">
                <span
                  className={`w-8 text-right font-['Inter'] font-[700] ${
                    i === 0
                      ? 'text-brand-ffb703'
                      : i === 1
                        ? 'text-[#c0c0c0]'
                        : i === 2
                          ? 'text-[#cd7f32]'
                          : 'text-[#94a3b8ff]'
                  }`}
                >
                  {i + 1}.
                </span>
                <span className="font-['Inter'] font-[600] text-[#eaf6ffff]">
                  {u.display_name}
                </span>
              </div>
              <span className="tabular-nums font-['Inter'] font-[600] text-brand-ffb703">
                {u.referrals_count} {u.referrals_count === 1 ? 'ref' : 'refs'}
              </span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}


