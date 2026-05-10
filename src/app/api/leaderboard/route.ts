import { NextResponse } from 'next/server';
import { createSupabaseClient } from '@/lib/supabase';

export async function GET() {
  try {
    // Service-role key — anon RLS access was removed in the schema fix
    // (see supabase-schema.sql comment block). Public leaderboard data
    // (display_name, referrals_count, created_at top-100) is still
    // exposed via this route, just funneled through the API instead of
    // direct anon-key reads from the browser.
    const supabase = createSupabaseClient(true);

    const { data, error } = await supabase
      .from('waitlist_users')
      .select('display_name, referrals_count, created_at')
      .order('referrals_count', { ascending: false })
      .order('created_at', { ascending: true })
      .limit(100);

    if (error) {
      console.error('Leaderboard error:', error);
      return NextResponse.json({ error: 'db_error' }, { status: 500 });
    }

    return NextResponse.json({ leaders: data || [] });
  } catch (e) {
    console.error('Error in leaderboard:', e);
    return NextResponse.json({ error: 'server_error' }, { status: 500 });
  }
}


