import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseClient } from '@/lib/supabase';
import { bearerFromRequest, validateEmail, verifyToken } from '@/lib/security';

export const dynamic = 'force-dynamic';

/**
 * GET /api/referral/stats?email=<email>
 *
 * Returns the caller's referral stats. Requires a Bearer token (issued by
 * /api/waitlist/join on signup) bound to the same email — otherwise IDOR:
 * anyone could query anyone else's stats by email, enabling whole-waitlist
 * email enumeration AND referral-link hijacking.
 */
export async function GET(req: NextRequest) {
  try {
    const email = validateEmail(req.nextUrl.searchParams.get('email'));
    if (!email) {
      return NextResponse.json({ error: 'invalid_email' }, { status: 400 });
    }

    // Auth gate — token must be present, valid, and bound to this email.
    const token = bearerFromRequest(req);
    const payload = verifyToken(token, email);
    if (!payload) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }

    // Use the service-role key so reads bypass RLS. We just dropped the
    // anon-permissive "Public leaderboard read" policy in the schema (it
    // let the browser-bundled anon key dump the entire waitlist), so anon
    // has no access to waitlist_users any more. The route is already gated
    // on the Bearer token above, so the auth perimeter is intact.
    const supabase = createSupabaseClient(true);

    const { data: user, error } = await supabase
      .from('waitlist_users')
      .select('id, referral_code, referrals_count, display_name, created_at')
      .eq('email', email)
      .maybeSingle();

    if (error) {
      console.error('Stats error:', error);
      return NextResponse.json({ error: 'db_error' }, { status: 500 });
    }
    if (!user) {
      return NextResponse.json({ error: 'user_not_found' }, { status: 404 });
    }

    // ── O(1) leaderboard position via COUNT (was: O(n) full-table scan) ──
    // Old code fetched every row from waitlist_users (no LIMIT) and used
    // findIndex in JS to compute position. With the claimed 50k user count
    // that's a 50k-row pull on every stats request, which SWR polls. Replace
    // with a single COUNT query: rows that beat us = position - 1.
    //
    // Tie-break: more referrals → ahead, then earlier created_at → ahead.
    // Encode the timestamp for use inside a PostgREST .or() filter string.
    // PostgREST accepts ISO timestamps but `created_at` from Supabase is
    // a JS Date or ISO string depending on column flag — coerce to string
    // and trust PostgREST to parse. (The colons / dots are URL-safe.)
    const userCreatedAtIso = typeof user.created_at === 'string'
      ? user.created_at
      : new Date(user.created_at as any).toISOString();

    const { count: ahead, error: countError } = await supabase
      .from('waitlist_users')
      .select('id', { count: 'exact', head: true })
      .or(
        `referrals_count.gt.${user.referrals_count},and(referrals_count.eq.${user.referrals_count},created_at.lt.${userCreatedAtIso})`,
      );

    if (countError) {
      console.error('Position count error:', countError);
    }

    const { count: total, error: totalError } = await supabase
      .from('waitlist_users')
      .select('id', { count: 'exact', head: true });

    if (totalError) {
      console.error('Total count error:', totalError);
    }

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://hihodl.xyz';
    const referralLink = `${siteUrl}/?ref=${user.referral_code}`;

    return NextResponse.json({
      referralCode: user.referral_code,
      referralLink,
      referralsCount: user.referrals_count,
      displayName: user.display_name,
      position: typeof ahead === 'number' ? ahead + 1 : null,
      totalUsers: total ?? 0,
    });
  } catch (e) {
    console.error('Error in referral stats:', e);
    return NextResponse.json({ error: 'server_error' }, { status: 500 });
  }
}
