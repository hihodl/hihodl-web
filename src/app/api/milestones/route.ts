import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseClient } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

const tiers = [
  { key: 'builder_club', at: 3, label: 'Builders Club' },
  { key: 'priority_beta', at: 10, label: 'Priority Beta' },
  { key: 'alias_reservation', at: 25, label: 'Alias Reservation' },
  { key: 'ambassador', at: 50, label: 'Ambassador' },
  { key: 'legend', at: 100, label: 'Legend' },
];

export async function GET(req: NextRequest) {
  try {
    const email = req.nextUrl.searchParams.get('email');

    if (!email) {
      return NextResponse.json({ error: 'missing_email' }, { status: 400 });
    }

    const supabase = createSupabaseClient(false);

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

