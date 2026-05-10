import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseClient } from '@/lib/supabase';
import { bearerFromRequest, validateEmail, verifyToken } from '@/lib/security';

export const dynamic = 'force-dynamic';

const tiers = [
  { key: 'builder_club', at: 3, label: 'Builders Club' },
  { key: 'priority_beta', at: 10, label: 'Priority Beta' },
  { key: 'alias_reservation', at: 25, label: 'Alias Reservation' },
  { key: 'ambassador', at: 50, label: 'Ambassador' },
  { key: 'legend', at: 100, label: 'Legend' },
];

/**
 * GET /api/milestones?email=<email>
 *
 * Returns the caller's referral count + which milestones they've achieved.
 * Same auth model as /api/referral/stats: requires a Bearer token bound to
 * the same email. Without it, anyone could enumerate any user's milestone
 * tier by email (lower-stakes than stats but same IDOR class).
 */
export async function GET(req: NextRequest) {
  try {
    const email = validateEmail(req.nextUrl.searchParams.get('email'));
    if (!email) {
      return NextResponse.json({ error: 'invalid_email' }, { status: 400 });
    }

    const token = bearerFromRequest(req);
    const payload = verifyToken(token, email);
    if (!payload) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }

    // Service-role key — anon RLS access was removed in the schema fix
    // (see supabase-schema.sql comment block). The Bearer token above is
    // the actual auth gate.
    const supabase = createSupabaseClient(true);

    const { data } = await supabase
      .from('waitlist_users')
      .select('referrals_count')
      .eq('email', email)
      .maybeSingle();

    const count = data?.referrals_count ?? 0;
    const achieved = tiers.filter((t) => count >= t.at).map((t) => t.key);

    return NextResponse.json({
      count,
      achieved,
      tiers,
    });
  } catch (e) {
    console.error('Error in milestones:', e);
    return NextResponse.json({ error: 'server_error' }, { status: 500 });
  }
}
