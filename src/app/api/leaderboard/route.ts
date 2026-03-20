import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET() {
  const supabase = createClient();
  const { data } = await supabase
    .from('leaderboard')
    .select('*')
    .limit(50);
  return NextResponse.json({ leaderboard: data ?? [] });
}
