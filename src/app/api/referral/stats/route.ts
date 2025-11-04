import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseClient } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const email = req.nextUrl.searchParams.get('email');

    if (!email) {
      return NextResponse.json({ error: 'missing_email' }, { status: 400 });
    }

    const supabase = createSupabaseClient(false);

    const { data: user, error } = await supabase
      .from('waitlist_users')
      .select('id, referral_code, referrals_count, display_name')
      .eq('email', email)
      .maybeSingle();

    if (error) {
      console.error('Stats error:', error);
      return NextResponse.json({ error: 'db_error' }, { status: 500 });
    }

    if (!user) {
      return NextResponse.json({ error: 'user_not_found' }, { status: 404 });
    }

    // Obtener posición en leaderboard
    const { data: allUsers } = await supabase
      .from('waitlist_users')
      .select('referrals_count, created_at, id')
      .order('referrals_count', { ascending: false })
      .order('created_at', { ascending: true });

    // Find user's position (1-indexed)
    const position = allUsers?.findIndex((u) => u.id === user.id);
    const finalPosition = position !== undefined && position >= 0 ? position + 1 : null;

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.hihodl.xyz';
    const referralLink = `${siteUrl}/?ref=${user.referral_code}`;

    return NextResponse.json({
      referralCode: user.referral_code,
      referralLink,
      referralsCount: user.referrals_count,
      displayName: user.display_name,
      position: finalPosition,
      totalUsers: allUsers?.length ?? 0,
    });
  } catch (e) {
    console.error('Error in referral stats:', e);
    return NextResponse.json({ error: 'server_error' }, { status: 500 });
  }
}

