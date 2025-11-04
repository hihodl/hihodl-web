import { NextResponse } from 'next/server';
import { createSupabaseClient } from '@/lib/supabase';

export async function GET() {
  try {
    const supabase = createSupabaseClient(false);

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


