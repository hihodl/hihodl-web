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

-- Policy: Allow public read access to leaderboard data (display_name, referrals_count only)
CREATE POLICY "Public leaderboard read"
  ON waitlist_users
  FOR SELECT
  USING (true);

-- Policy: Allow service role to insert/update (for API routes)
-- Note: This requires service role key, not anon key
-- For insert/update, use SUPABASE_SERVICE_KEY in your API routes

-- Optional: Policy for users to read their own data
-- CREATE POLICY "Users read own data"
--   ON waitlist_users
--   FOR SELECT
--   USING (auth.uid()::text = id::text OR email = current_setting('request.jwt.claims', true)::json->>'email');

COMMENT ON TABLE waitlist_users IS 'Stores waitlist users and their referral data';
COMMENT ON TABLE referral_events IS 'Tracks referral events for analytics';


