import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';

export async function POST(req: NextRequest) {
  const supabaseAdmin = createAdminClient();

  const token = req.headers.get('Authorization')?.replace('Bearer ', '');
  if (!token) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });

  const { data: { user } } = await supabaseAdmin.auth.getUser(token);
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });

  const { favoriteChannel } = await req.json();
  await supabaseAdmin.from('profiles').update({ favorite_channel: favoriteChannel || null }).eq('id', user.id);

  return NextResponse.json({ ok: true });
}