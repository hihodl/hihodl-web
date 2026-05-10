-- HIHODL Referral Program Database Schema
-- Run this in your Supabase SQL Editor

-- Table: waitlist_users
CREATE TABLE IF NOT EXISTS waitlist_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  display_name TEXT NOT NULL,
  referral_code TEXT UNIQUE NOT NULL,
  referred_by_code TEXT,
  referrals_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table: referral_events (for tracking referral history)
CREATE TABLE IF NOT EXISTS referral_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_code TEXT NOT NULL,
  referred_user_id UUID NOT NULL REFERENCES waitlist_users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_waitlist_users_email ON waitlist_users(email);
CREATE INDEX IF NOT EXISTS idx_waitlist_users_referral_code ON waitlist_users(referral_code);
CREATE INDEX IF NOT EXISTS idx_waitlist_users_referred_by ON waitlist_users(referred_by_code);
CREATE INDEX IF NOT EXISTS idx_referral_events_referrer ON referral_events(referrer_code);

-- RPC Function: increment_referrals_count
CREATE OR REPLACE FUNCTION increment_referrals_count(p_ref_code TEXT)
RETURNS VOID
LANGUAGE SQL
AS $$
  UPDATE waitlist_users
  SET referrals_count = referrals_count + 1,
      updated_at = NOW()
  WHERE referral_code = p_ref_code;
$$;

-- Trigger: Update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_waitlist_users_updated_at
  BEFORE UPDATE ON waitlist_users
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Enable Row Level Security (RLS)
ALTER TABLE waitlist_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE referral_events ENABLE ROW LEVEL SECURITY;

-- ── RLS POLICY ────────────────────────────────────────────────────────────
-- We do NOT grant the anon (browser-bundled) Supabase client any direct
-- access to waitlist_users. The previous policy was:
--
--   CREATE POLICY "Public leaderboard read"
--     ON waitlist_users FOR SELECT USING (true);
--
-- That policy comments said "(display_name, referrals_count only)" but the
-- USING clause did not restrict columns — anyone with the anon key (which
-- IS the browser bundle, by definition) could `select email` and dump the
-- entire waitlist with one query from devtools.
--
-- The fix: don't expose the table to anon at all. The /api/leaderboard,
-- /api/referral/stats, /api/milestones, and /api/waitlist/join routes all
-- use the service role key (SUPABASE_SERVICE_KEY in createSupabaseClient(true)
-- or implicit via the service-role bypass), which bypasses RLS.
--
-- If you previously ran the older schema and have "Public leaderboard read"
-- already created in production, drop it:
--
--   DROP POLICY IF EXISTS "Public leaderboard read" ON waitlist_users;
--
-- (We're idempotent here — DROP IF EXISTS keeps re-runs safe.)
DROP POLICY IF EXISTS "Public leaderboard read" ON waitlist_users;

-- Service role bypasses RLS by design (no policy needed). For inserts /
-- updates / selects via API routes, use SUPABASE_SERVICE_KEY.

-- Optional: if you ever want the browser-anon client to read leaderboard
-- data directly (e.g. for an SSR-free public widget), re-add a tightly-
-- scoped policy AND grant only the safe columns:
--
--   GRANT SELECT (display_name, referrals_count, created_at)
--     ON waitlist_users TO anon;
--   CREATE POLICY "Public leaderboard read (limited cols)"
--     ON waitlist_users FOR SELECT USING (true);
--
-- Until that need is real, leaving anon with no access is the safer
-- default. /api/leaderboard already serves this via the service role.

COMMENT ON TABLE waitlist_users IS 'Stores waitlist users and their referral data';
COMMENT ON TABLE referral_events IS 'Tracks referral events for analytics';


